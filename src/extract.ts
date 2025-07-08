import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { platform } from 'node:os'
import { resolve } from 'node:path'

/**
 * Normalizes tar error messages across different platforms
 */
function normalizeTarError(stderr: string): string {
  const errorMessage = stderr.trim()

  // File not found errors
  if (
    errorMessage.includes('Cannot open') ||
    errorMessage.includes('Failed to open') ||
    errorMessage.includes('No such file or directory')
  ) {
    return 'tar command failed: File not found'
  }

  // Invalid archive format errors
  if (
    errorMessage.includes('Unrecognized archive format') ||
    errorMessage.includes('Error opening archive') ||
    errorMessage.includes('incorrect header check')
  ) {
    return 'tar command failed: Invalid archive format'
  }

  // General extraction errors
  if (errorMessage.includes('Error is not recoverable') || errorMessage.includes('Child returned status')) {
    return 'tar command failed: Extraction error'
  }

  // If no specific pattern matches, return a generic message
  return `tar command failed: ${errorMessage}`
}

export async function extractTarGz(archivePath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  const tarCmd = platform() === 'win32' ? 'tar.exe' : 'tar'
  const tarArgs = ['-xzf', archivePath, '-C', outputDir]

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(tarCmd, tarArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        // Normalize error message for consistent cross-platform behavior
        const errorMsg = stderr.trim() ? normalizeTarError(stderr) : `${tarCmd} command failed with code ${code}`
        reject(new Error(errorMsg))
      }
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
