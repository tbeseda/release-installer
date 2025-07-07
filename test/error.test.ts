import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { installRelease } from '../src/index.js'

describe('Error Handling', () => {
  test('installRelease throws error for invalid repo', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response
    })

    await assert.rejects(
      async () => await installRelease('invalid/repo', 'v1.0.0'),
      /Release v1.0.0 not found for repository invalid\/repo/,
    )
  })

  test('installRelease throws error for invalid version', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response
    })

    await assert.rejects(
      async () => await installRelease('getzola/zola', 'v999.999.999'),
      /Release v999.999.999 not found for repository getzola\/zola/,
    )
  })

  test('installRelease throws error when no matching asset found', async (t) => {
    // Mock a successful release response but with assets that don't match
    const mockReleaseData = {
      tag_name: 'v0.20.0',
      assets: [
        {
          name: 'zola-v0.20.0-x86_64-unknown-linux-gnu.tar.gz',
          browser_download_url: 'https://example.com/download',
          size: 15728640,
        },
      ],
    }

    t.mock.method(global, 'fetch', async () => {
      return {
        ok: true,
        json: async () => mockReleaseData,
      } as Response
    })

    // Test with a platform map that points to a non-existent asset
    // The current platform will use the custom mapping and fail to find the asset
    const { getPlatformInfo } = await import('../src/platform.js')
    const currentPlatform = getPlatformInfo()

    await assert.rejects(
      async () =>
        await installRelease('getzola/zola', 'v0.20.0', {
          platformMap: {
            [currentPlatform.combined]: 'nonexistent-asset.tar.gz',
          },
        }),
      /Asset nonexistent-asset.tar.gz not found in release/,
    )
  })

  test('installRelease handles malformed repo name', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response
    })

    await assert.rejects(
      async () => await installRelease('malformed-repo-name', 'v1.0.0'),
      /Release v1.0.0 not found for repository malformed-repo-name/,
    )
  })

  test('installRelease validates custom platform mapping', async (t) => {
    // Mock a successful release response but with assets that don't match
    const mockReleaseData = {
      tag_name: 'v0.20.0',
      assets: [
        {
          name: 'zola-v0.20.0-x86_64-unknown-linux-gnu.tar.gz',
          browser_download_url: 'https://example.com/download',
          size: 15728640,
        },
      ],
    }

    t.mock.method(global, 'fetch', async () => {
      return {
        ok: true,
        json: async () => mockReleaseData,
      } as Response
    })

    const { getPlatformInfo } = await import('../src/platform.js')
    const currentPlatform = getPlatformInfo()

    await assert.rejects(
      async () =>
        await installRelease('getzola/zola', 'v0.20.0', {
          platformMap: {
            [currentPlatform.combined]: 'nonexistent-file.tar.gz',
          },
        }),
      /Asset nonexistent-file.tar.gz not found in release/,
    )
  })

  test('installRelease throws error when binary exists without force flag', async (t) => {
    // Mock a successful release response
    const mockReleaseData = {
      tag_name: 'v0.20.0',
      assets: [
        {
          name: 'test-app-v0.20.0-x86_64-apple-darwin.tar.gz',
          browser_download_url: 'https://example.com/download',
          size: 15728640,
        },
      ],
    }

    t.mock.method(global, 'fetch', async () => {
      return {
        ok: true,
        json: async () => mockReleaseData,
      } as Response
    })

    // Get current platform for accurate testing
    const { getPlatformInfo } = await import('../src/platform.js')
    const currentPlatform = getPlatformInfo()

    // Create a test directory with an existing binary
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    const testDir = './test-force-flag'
    const binaryPath = `${testDir}/app`

    await mkdir(testDir, { recursive: true })
    await writeFile(binaryPath, 'existing binary')

    try {
      await assert.rejects(
        async () =>
          await installRelease('test/app', 'v0.20.0', {
            outputDir: testDir,
            platformMap: {
              [currentPlatform.combined]:
                'test-app-v0.20.0-x86_64-apple-darwin.tar.gz',
            },
          }),
        /Binary .* already exists. Use --force to overwrite./,
      )
    } finally {
      // Clean up
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })

  test('installRelease cleans up archive after extraction failure', async (t) => {
    // Mock a successful release response
    const mockReleaseData = {
      tag_name: 'v0.20.0',
      assets: [
        {
          name: 'test-app-v0.20.0-x86_64-apple-darwin.tar.gz',
          browser_download_url: 'https://example.com/download',
          size: 15728640,
        },
      ],
    }

    let downloadCallCount = 0
    t.mock.method(global, 'fetch', async (url: string) => {
      if (url.includes('api.github.com')) {
        return {
          ok: true,
          json: async () => mockReleaseData,
        } as Response
      }

      // Mock download that succeeds but creates invalid archive
      downloadCallCount++
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            // Create content that will fail extraction (invalid gzip)
            controller.enqueue(new Uint8Array([0x00, 0x01, 0x02, 0x03]))
            controller.close()
          },
        }),
      } as Response
    })

    const { getPlatformInfo } = await import('../src/platform.js')
    const currentPlatform = getPlatformInfo()
    const testDir = './test-cleanup-after-failure'

    try {
      await assert.rejects(
        async () =>
          await installRelease('test/app', 'v0.20.0', {
            outputDir: testDir,
            platformMap: {
              [currentPlatform.combined]:
                'test-app-v0.20.0-x86_64-apple-darwin.tar.gz',
            },
          }),
        // Should fail during extraction but still clean up
      )

      // Verify download was called
      assert.equal(downloadCallCount, 1)

      // Verify archive was cleaned up (temp file shouldn't exist)
      const { access } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const tempPath = join(
        testDir,
        'test-app-v0.20.0-x86_64-apple-darwin.tar.gz',
      )

      await assert.rejects(
        async () => await access(tempPath),
        // File should not exist (cleaned up)
      )
    } finally {
      // Clean up test directory
      const { rm } = await import('node:fs/promises')
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })
})
