import type { ReleaseInfo } from './index.js';

export async function fetchReleaseInfo(
  repo: string,
  version: string,
): Promise<ReleaseInfo> {
  const url = `https://api.github.com/repos/${repo}/releases/tags/${version}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'release-installer',
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Release ${version} not found for repository ${repo}`);
    }
    throw new Error(
      `Failed to fetch release info: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  return {
    tag_name: data.tag_name,
    assets: data.assets.map(
      (asset: {
        name: string;
        browser_download_url: string;
        size: number;
      }) => ({
        name: asset.name,
        download_url: asset.browser_download_url,
        size: asset.size,
      }),
    ),
  };
}

export async function downloadAsset(
  url: string,
  outputPath: string,
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'release-installer',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download asset: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fs = await import('node:fs/promises');
  await fs.writeFile(outputPath, buffer);
}
