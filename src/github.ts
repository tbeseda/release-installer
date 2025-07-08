import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import type { ReleaseInfo } from './index.js'

export async function fetchReleaseInfo(repo: string, version: string): Promise<ReleaseInfo> {
  const url = `https://api.github.com/repos/${repo}/releases/tags/${version}`

  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  if (!response.ok) {
    if (response.status === 404) throw new Error(`Release ${version} not found for repository ${repo}`)
    throw new Error(`Failed to fetch release info: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return {
    tag_name: data.tag_name,
    assets: data.assets.map((asset: { name: string; browser_download_url: string; size: number }) => ({
      name: asset.name,
      download_url: asset.browser_download_url,
      size: asset.size,
    })),
  }
}

export async function downloadAsset(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url)

  if (!response.ok) throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`)
  if (!response.body) throw new Error('GitHub API response body is empty')

  // Use streaming for better memory efficiency
  const fileStream = createWriteStream(outputPath)
  const readableStream = Readable.fromWeb(response.body as ReadableStream)

  try {
    await pipeline(readableStream, fileStream)
  } catch (error) {
    // Clean up partial file on error
    try {
      await unlink(outputPath)
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Failed to download asset: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
