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

import { access, chmod, readdir, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { extractArchive } from './extract.js'
import { downloadAsset, fetchReleaseInfo } from './github.js'
import { findBestAsset, getPlatformInfo } from './platform.js'

export async function installRelease(
  repo: string,
  version: string,
  options: InstallOptions = {},
): Promise<void> {
  const {
    binName,
    outputDir = './bin',
    platformMap,
    force = false,
    verbose = false,
  } = options

  if (verbose) {
    console.log(`Installing ${repo} ${version}...`)
  }

  // Fetch release info
  const releaseInfo = await fetchReleaseInfo(repo, version)

  if (verbose) {
    console.log(
      `Found ${releaseInfo.assets.length} assets for ${releaseInfo.tag_name}`,
    )
  }

  // Get platform info
  const platformInfo = getPlatformInfo()

  if (verbose) {
    console.log(`Platform: ${platformInfo.combined}`)
  }

  // Find matching asset
  const assetNames = releaseInfo.assets.map((a) => a.name)
  let selectedAsset: string | null = null

  if (platformMap?.[platformInfo.combined]) {
    // Use custom platform mapping
    const templateName = platformMap[platformInfo.combined]
    selectedAsset = templateName.replace('{version}', version)
  } else {
    // Use automatic detection
    selectedAsset = findBestAsset(assetNames, platformInfo)
  }

  if (!selectedAsset) {
    console.error(
      `No matching asset found for platform ${platformInfo.combined}`,
    )
    console.error('Available assets:')
    assetNames.forEach((name) => console.error(`  - ${name}`))
    throw new Error('No matching asset found')
  }

  const asset = releaseInfo.assets.find((a) => a.name === selectedAsset)
  if (!asset) {
    throw new Error(`Asset ${selectedAsset} not found in release`)
  }

  if (verbose) {
    console.log(`Selected asset: ${selectedAsset}`)
  }

  // Create output directory
  const outputPath = resolve(outputDir)
  const { mkdir } = await import('node:fs/promises')
  await mkdir(outputPath, { recursive: true })

  // Download asset - sanitize filename to prevent path traversal
  const sanitizedFilename = basename(selectedAsset)
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
        throw new Error(
          `Binary ${binaryPath} already exists. Use --force to overwrite.`,
        )
      } catch (error) {
        // If access throws, file doesn't exist, continue checking
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          throw error
        }
      }
    }
  }

  if (verbose) {
    console.log(`Downloading ${selectedAsset}...`)
  }

  await downloadAsset(asset.download_url, tempPath)

  let extractionSuccessful = false
  try {
    // Extract archive
    if (verbose) {
      console.log(`Extracting ${selectedAsset}...`)
    }

    await extractArchive(tempPath, outputPath)
    extractionSuccessful = true

    // Find and set executable permissions on binary
    const finalBinName = binName || repo.split('/')[1]

    // Optimized binary search - try common locations first, then fallback to recursive
    const potentialBinaryNames = [
      finalBinName,
      `${finalBinName}.exe`,
      `${finalBinName}.bin`,
    ]

    let binaryFound = false

    // First, try direct paths in the output directory (most common case)
    for (const binaryName of potentialBinaryNames) {
      const directPath = join(outputPath, binaryName)
      try {
        const fileStat = await stat(directPath)
        if (fileStat.isFile()) {
          await chmod(directPath, 0o755)
          if (verbose) {
            console.log(`Made ${directPath} executable`)
          }
          binaryFound = true
          break
        }
      } catch (_error) {
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
          const isExecutableWithExt =
            fileName === `${finalBinName}.exe` ||
            fileName === `${finalBinName}.bin`
          const hasSuspiciousExt = [
            '.txt',
            '.md',
            '.json',
            '.xml',
            '.html',
            '.log',
          ].includes(fileExtension)

          if ((isExactMatch || isExecutableWithExt) && !hasSuspiciousExt) {
            await chmod(filePath, 0o755)
            if (verbose) {
              console.log(`Made ${filePath} executable`)
            }
            binaryFound = true
            break // Early termination once we find the binary
          }
        } catch (_error) {
          // Ignore chmod errors on Windows or if file doesn't exist
        }
      }
    }

    if (!binaryFound && verbose) {
      console.log(
        `Warning: Binary '${finalBinName}' not found in extracted files`,
      )
    }

    if (verbose) {
      console.log(
        `✓ Successfully installed ${repo} ${version} to ${outputPath}`,
      )
    }
  } finally {
    // Always clean up downloaded archive, regardless of extraction success
    const { unlink } = await import('node:fs/promises')
    try {
      await unlink(tempPath)
      if (verbose && !extractionSuccessful) {
        console.log('Cleaned up downloaded archive after failed extraction')
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  }
}
