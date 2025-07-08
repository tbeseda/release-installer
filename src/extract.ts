import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { platform } from 'node:os'
import { resolve } from 'node:path'

export async function extractTarGz(archivePath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  const tarCmd = platform() === 'win32' ? 'tar.exe' : 'tar'
  const tarArgs = ['-xzf', archivePath, '-C', outputDir]

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(tarCmd, tarArgs, { stdio: 'inherit' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${tarCmd} command failed with code ${code}`))
    })
    proc.on('error', reject)
  })
}

export async function extractZip(archivePath: string, outputDir: string): Promise<void> {
  // Validate paths to prevent command injection
  const resolvedArchivePath = resolve(archivePath)
  const resolvedOutputDir = resolve(outputDir)

  await mkdir(resolvedOutputDir, { recursive: true })

  // Try multiple zip extraction tools for better compatibility
  const zipTools = [
    {
      command: 'unzip',
      args: ['-o', resolvedArchivePath, '-d', resolvedOutputDir],
    },
    {
      command: 'powershell',
      args: [
        '-Command',
        `Expand-Archive -Path '${resolvedArchivePath}' -DestinationPath '${resolvedOutputDir}' -Force`,
      ],
    },
    {
      command: '7z',
      args: ['x', resolvedArchivePath, `-o${resolvedOutputDir}`, '-y'],
    },
  ]

  for (const tool of zipTools) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(tool.command, tool.args, { stdio: ['ignore', 'pipe', 'pipe'] })
        let stderr = ''

        proc.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        proc.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`${tool.command} failed with code ${code}: ${stderr}`))
          }
        })

        proc.on('error', (error) => {
          reject(new Error(`Failed to run ${tool.command}: ${error.message}`))
        })
      })

      // If we get here, extraction succeeded
      return
    } catch {}
  }

  // If all tools failed
  throw new Error('Failed to extract zip file. Please ensure unzip, PowerShell, or 7z is available on your system.')
}

export async function extractArchive(archivePath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    await extractTarGz(archivePath, outputDir)
  } else if (archivePath.endsWith('.zip')) {
    await extractZip(archivePath, outputDir)
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`)
  }
}
