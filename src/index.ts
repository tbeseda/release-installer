import { access, chmod, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { extractArchive } from './extract.js'
import { downloadAsset, fetchReleaseInfo } from './github.js'
import { findBestAsset, getPlatformInfo } from './platform.js'

export interface InstallOptions {
  binName?: string
  outputDir?: string
  platformMap?: Record<string, string>
  force?: boolean
  verbose?: boolean
}

export interface ReleaseAsset {
  name: string
  download_url: string
  size: number
}

export interface ReleaseInfo {
  tag_name: string
  assets: ReleaseAsset[]
}

export async function installRelease(repo: string, version: string, options: InstallOptions = {}): Promise<void> {
  const { binName, outputDir = './bin', platformMap, force = false, verbose: v = false } = options

  if (v) console.log(`Installing ${repo} ${version}...`)

  // Fetch release info
  const releaseInfo = await fetchReleaseInfo(repo, version)

  if (v) console.log(`Found ${releaseInfo.assets.length} assets for ${releaseInfo.tag_name}`)

  // Get platform info
  const platformInfo = getPlatformInfo()

  if (v) console.log(`Platform: ${platformInfo.combined}`)

  // Find matching asset
  const releaseAssetNames = releaseInfo.assets.map((a) => a.name)
  let selectedReleaseAssetName: string | null = null

  if (platformMap?.[platformInfo.combined]) {
    // Use custom platform mapping
    const templateName = platformMap[platformInfo.combined]
    selectedReleaseAssetName = templateName.replace('{version}', version)
  } else {
    // Use automatic detection
    selectedReleaseAssetName = findBestAsset(releaseAssetNames, platformInfo)
  }

  if (!selectedReleaseAssetName) {
    console.error(`No matching release asset found for platform ${platformInfo.combined}`)
    console.error('Available release assets:')
    releaseAssetNames.forEach((name) => console.error(`  - ${name}`))
    throw new Error('No matching release asset found')
  }

  const releaseAsset = releaseInfo.assets.find((a) => a.name === selectedReleaseAssetName)
  if (!releaseAsset) throw new Error(`Release asset ${selectedReleaseAssetName} not found in release`)

  if (v) console.log(`Selected release asset: ${selectedReleaseAssetName}`)

  // Create output directory
  const outputPath = resolve(outputDir)
  await mkdir(outputPath, { recursive: true })

  // Download asset - sanitize filename to prevent path traversal
  const sanitizedFilename = basename(selectedReleaseAssetName)
  const tempPath = join(outputPath, sanitizedFilename)

  // Check if binary already exists (unless force is enabled)
  if (!force) {
    const finalBinName = binName || repo.split('/')[1]
    const potentialBinaryPaths = [
      join(outputPath, finalBinName),
      join(outputPath, `${finalBinName}.exe`),
      join(outputPath, `${finalBinName}.bin`),
    ]

    for (const binaryPath of potentialBinaryPaths) {
      try {
        await access(binaryPath)
        throw new Error(`Binary ${binaryPath} already exists. Use --force to overwrite.`)
      } catch (error) {
        // If access throws, file doesn't exist, continue checking
        if (error instanceof Error && error.message.includes('already exists')) {
          throw error
        }
      }
    }
  }

  if (v) console.log(`Downloading ${selectedReleaseAssetName}...`)

  await downloadAsset(releaseAsset.download_url, tempPath)

  let extractionSuccessful = false
  try {
    // Extract archive
    if (v) console.log(`Extracting ${selectedReleaseAssetName}...`)

    await extractArchive(tempPath, outputPath)
    extractionSuccessful = true

    // Find and set executable permissions on binary
    const finalBinName = binName || repo.split('/')[1]

    // Optimized binary search - try common locations first, then fallback to recursive
    const potentialBinaryNames = [finalBinName, `${finalBinName}.exe`, `${finalBinName}.bin`]

    let binaryFound = false

    // First, try direct paths in the output directory (most common case)
    for (const binaryName of potentialBinaryNames) {
      const directPath = join(outputPath, binaryName)
      try {
        const fileStat = await stat(directPath)
        if (fileStat.isFile()) {
          await chmod(directPath, 0o755)
          if (v) console.log(`Made ${directPath} executable`)
          binaryFound = true
          break
        }
      } catch {
        // File doesn't exist at direct path, continue
      }
    }

    // If not found in root, search recursively but with early termination
    if (!binaryFound) {
      const files = await readdir(outputPath, { recursive: true })

      for (const file of files) {
        const filePath = join(outputPath, file as string)
        const fileName = basename(file.toString())
        const fileExtension = extname(fileName)

        // More precise binary detection with early termination
        try {
          const fileStat = await stat(filePath)
          if (!fileStat.isFile()) continue

          const isExactMatch = fileName === finalBinName
          const isExecutableWithExt = fileName === `${finalBinName}.exe` || fileName === `${finalBinName}.bin`
          const hasSuspiciousExt = ['.txt', '.md', '.json', '.xml', '.html', '.log'].includes(fileExtension)

          if ((isExactMatch || isExecutableWithExt) && !hasSuspiciousExt) {
            await chmod(filePath, 0o755)
            if (v) {
              console.log(`Made ${filePath} executable`)
            }
            binaryFound = true
            break // Early termination once we find the binary
          }
        } catch {
          // Ignore chmod errors on Windows or if file doesn't exist
        }
      }
    }

    if (!binaryFound && v) console.log(`Warning: Binary '${finalBinName}' not found in extracted files`)

    // Throw if binName is specified and not found
    if (binName && !binaryFound) {
      const files = await readdir(outputPath, { recursive: true })
      console.error(`Error: Specified binName '${binName}' not found in extracted files.`)
      console.error('Files found:')
      for (const file of files) {
        console.error(`  - ${file}`)
      }
      throw new Error(`Specified binName '${binName}' not found after extraction`)
    }

    if (v) console.log(`✓ Successfully installed ${repo} ${version} to ${outputPath}`)
  } finally {
    // Always clean up downloaded archive, regardless of extraction success
    try {
      await unlink(tempPath)
      if (v && !extractionSuccessful) console.log('Cleaned up downloaded archive after failed extraction')
    } catch {
      // Ignore cleanup errors
    }
  }
}
