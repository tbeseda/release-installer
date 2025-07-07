import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

// Simple tar header parsing (tar format is straightforward)
interface TarHeader {
  name: string
  size: number
  type: string
}

function parseTarHeader(buffer: Buffer): TarHeader | null {
  if (buffer.length < 512) return null

  // Check if this is a valid tar header (not all zeros)
  const isValid = buffer.subarray(0, 100).some((byte) => byte !== 0)
  if (!isValid) return null

  // Extract filename (first 100 bytes, null-terminated)
  const nameBytes = buffer.subarray(0, 100)
  const nameEnd = nameBytes.indexOf(0)
  const name = nameBytes
    .subarray(0, nameEnd > 0 ? nameEnd : 100)
    .toString('utf8')

  // Extract file size (12 bytes at offset 124, octal format)
  const sizeStr = buffer
    .subarray(124, 136)
    .toString('utf8')
    .trim()
    .replace(/\0/g, '')
  const size = sizeStr ? parseInt(sizeStr, 8) : 0

  // Extract file type (1 byte at offset 156)
  const typeFlag = buffer[156]
  const type = typeFlag === 48 || typeFlag === 0 ? 'file' : 'directory' // '0' or null for regular file

  return { name, size, type }
}

export async function extractTarGz(
  archivePath: string,
  outputDir: string,
): Promise<void> {
  const resolvedArchivePath = resolve(archivePath)
  const resolvedOutputDir = resolve(outputDir)

  try {
    await access(resolvedArchivePath)
  } catch {
    throw new Error(`Archive file does not exist: ${resolvedArchivePath}`)
  }

  const fs = await import('node:fs/promises')
  await fs.mkdir(resolvedOutputDir, { recursive: true })

  // Create streams for decompression
  const readStream = createReadStream(resolvedArchivePath)
  const gunzip = createGunzip()

  let buffer = Buffer.alloc(0)
  let currentFile: {
    name: string
    size: number
    stream?: NodeJS.WritableStream
  } | null = null

  return new Promise((resolve, reject) => {
    const processChunk = async (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])

      while (buffer.length >= 512) {
        if (!currentFile) {
          // Parse header
          const header = parseTarHeader(buffer.subarray(0, 512))
          if (!header) {
            // End of archive or invalid header
            buffer = buffer.subarray(512)
            continue
          }

          if (header.type === 'file' && header.size > 0) {
            currentFile = { name: header.name, size: header.size }
            const outputPath = join(resolvedOutputDir, header.name)

            // Ensure directory exists
            await fs.mkdir(dirname(outputPath), { recursive: true })
            currentFile.stream = createWriteStream(outputPath)
          }

          buffer = buffer.subarray(512) // Skip header
        } else {
          // Extract file content
          const remainingSize = currentFile.size
          const availableData = Math.min(remainingSize, buffer.length)

          if (availableData > 0 && currentFile.stream) {
            currentFile.stream.write(buffer.subarray(0, availableData))
            currentFile.size -= availableData
            buffer = buffer.subarray(availableData)
          }

          if (currentFile.size === 0) {
            // File complete
            if (currentFile.stream) {
              currentFile.stream.end()
            }
            currentFile = null

            // Skip padding to 512-byte boundary
            const paddingSize = (512 - (availableData % 512)) % 512
            if (buffer.length >= paddingSize) {
              buffer = buffer.subarray(paddingSize)
            }
          } else if (buffer.length < remainingSize) {
            // Need more data
            break
          }
        }
      }
    }

    gunzip.on('data', (chunk: Buffer) => {
      processChunk(chunk).catch(reject)
    })

    gunzip.on('end', () => {
      if (currentFile?.stream) {
        currentFile.stream.end()
      }
      resolve()
    })

    gunzip.on('error', reject)
    readStream.on('error', reject)

    pipeline(readStream, gunzip).catch(reject)
  })
}

export async function extractZip(
  archivePath: string,
  outputDir: string,
): Promise<void> {
  // Validate paths to prevent command injection
  const resolvedArchivePath = resolve(archivePath)
  const resolvedOutputDir = resolve(outputDir)

  try {
    await access(resolvedArchivePath)
  } catch {
    throw new Error(`Archive file does not exist: ${resolvedArchivePath}`)
  }

  const fs = await import('node:fs/promises')
  await fs.mkdir(resolvedOutputDir, { recursive: true })

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
        const proc = spawn(tool.command, tool.args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stderr = ''

        proc.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        proc.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(
              new Error(`${tool.command} failed with code ${code}: ${stderr}`),
            )
          }
        })

        proc.on('error', (error) => {
          reject(new Error(`Failed to run ${tool.command}: ${error.message}`))
        })
      })

      // If we get here, extraction succeeded
      return
    } catch (_error) {}
  }

  // If all tools failed
  throw new Error(
    'Failed to extract zip file. Please ensure unzip, PowerShell, or 7z is available on your system.',
  )
}

export async function extractArchive(
  archivePath: string,
  outputDir: string,
): Promise<void> {
  const fs = await import('node:fs/promises')
  await fs.mkdir(outputDir, { recursive: true })

  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    await extractTarGz(archivePath, outputDir)
  } else if (archivePath.endsWith('.zip')) {
    await extractZip(archivePath, outputDir)
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`)
  }
}
