export interface InstallOptions {
  binName?: string;
  outputDir?: string;
  platformMap?: Record<string, string>;
  force?: boolean;
  verbose?: boolean;
}

export interface ReleaseAsset {
  name: string;
  download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tag_name: string;
  assets: ReleaseAsset[];
}

import { chmod, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extractArchive } from './extract.js';
import { downloadAsset, fetchReleaseInfo } from './github.js';
import { findBestAsset, getPlatformInfo } from './platform.js';

export async function installRelease(
  repo: string,
  version: string,
  options: InstallOptions = {},
): Promise<void> {
  const {
    binName,
    outputDir = './bin',
    platformMap,
    verbose = false,
  } = options;

  if (verbose) {
    console.log(`Installing ${repo} ${version}...`);
  }

  // Fetch release info
  const releaseInfo = await fetchReleaseInfo(repo, version);

  if (verbose) {
    console.log(
      `Found ${releaseInfo.assets.length} assets for ${releaseInfo.tag_name}`,
    );
  }

  // Get platform info
  const platformInfo = getPlatformInfo();

  if (verbose) {
    console.log(`Platform: ${platformInfo.combined}`);
  }

  // Find matching asset
  const assetNames = releaseInfo.assets.map((a) => a.name);
  let selectedAsset: string | null = null;

  if (platformMap?.[platformInfo.combined]) {
    // Use custom platform mapping
    const templateName = platformMap[platformInfo.combined];
    selectedAsset = templateName.replace('{version}', version);
  } else {
    // Use automatic detection
    selectedAsset = findBestAsset(assetNames, platformInfo);
  }

  if (!selectedAsset) {
    console.error(
      `No matching asset found for platform ${platformInfo.combined}`,
    );
    console.error('Available assets:');
    assetNames.forEach((name) => console.error(`  - ${name}`));
    throw new Error('No matching asset found');
  }

  const asset = releaseInfo.assets.find((a) => a.name === selectedAsset);
  if (!asset) {
    throw new Error(`Asset ${selectedAsset} not found in release`);
  }

  if (verbose) {
    console.log(`Selected asset: ${selectedAsset}`);
  }

  // Create output directory
  const outputPath = resolve(outputDir);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(outputPath, { recursive: true });

  // Download asset
  const tempPath = join(outputPath, selectedAsset);

  if (verbose) {
    console.log(`Downloading ${selectedAsset}...`);
  }

  await downloadAsset(asset.download_url, tempPath);

  // Extract archive
  if (verbose) {
    console.log(`Extracting ${selectedAsset}...`);
  }

  await extractArchive(tempPath, outputPath);

  // Find and set executable permissions on binary
  const finalBinName = binName || repo.split('/')[1];
  const files = await readdir(outputPath, { recursive: true });

  for (const file of files) {
    const filePath = join(outputPath, file as string);
    const fileName = file.toString();

    if (fileName.includes(finalBinName) && !fileName.includes('.')) {
      try {
        await chmod(filePath, 0o755);
        if (verbose) {
          console.log(`Made ${filePath} executable`);
        }
      } catch (_error) {
        // Ignore chmod errors on Windows
      }
    }
  }

  // Clean up downloaded archive
  const { unlink } = await import('node:fs/promises');
  try {
    await unlink(tempPath);
  } catch (_error) {
    // Ignore cleanup errors
  }

  if (verbose) {
    console.log(`✓ Successfully installed ${repo} ${version} to ${outputPath}`);
  }
}
