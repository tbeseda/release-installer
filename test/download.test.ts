import assert from 'node:assert/strict'
import { access, readFile, rm } from 'node:fs/promises'
import { describe, test } from 'node:test'
import { downloadAsset } from '../src/github.js'

describe('Streaming Download Error Handling', () => {
  test('handles response with null body', async () => {
    // Mock fetch to return response with null body
    const originalFetch = global.fetch
    global.fetch = async () => {
      return {
        ok: true,
        body: null,
      } as Response
    }

    try {
      await assert.rejects(
        async () => await downloadAsset('https://example.com/file.tar.gz', './test-null-body.tar.gz'),
        /GitHub API response body is empty/,
      )
    } finally {
      global.fetch = originalFetch
      await rm('./test-null-body.tar.gz').catch(() => {})
    }
  })

  test('handles response with undefined body', async () => {
    // Mock fetch to return response with undefined body
    const originalFetch = global.fetch
    global.fetch = async () => {
      return {
        ok: true,
        body: undefined,
      } as unknown as Response
    }

    try {
      await assert.rejects(
        async () => await downloadAsset('https://example.com/file.tar.gz', './test-undefined-body.tar.gz'),
        /GitHub API response body is empty/,
      )
    } finally {
      global.fetch = originalFetch
      await rm('./test-undefined-body.tar.gz').catch(() => {})
    }
  })

  test('cleans up partial file on stream error', async () => {
    // Mock fetch to return a stream that errors
    const originalFetch = global.fetch
    global.fetch = async () => {
      const mockBody = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream interrupted'))
        },
      })

      return {
        ok: true,
        body: mockBody,
      } as Response
    }

    const testFile = './test-stream-error.tar.gz'

    try {
      await assert.rejects(
        async () => await downloadAsset('https://example.com/file.tar.gz', testFile),
        /Failed to download asset: Stream interrupted/,
      )

      // Verify file was cleaned up after error
      await assert.rejects(
        async () => await access(testFile),
        // File should not exist (cleaned up)
      )
    } finally {
      global.fetch = originalFetch
      await rm(testFile).catch(() => {})
    }
  })

  test('handles HTTP error responses', async () => {
    // Mock fetch to return HTTP error
    const originalFetch = global.fetch
    global.fetch = async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response
    }

    try {
      await assert.rejects(
        async () => await downloadAsset('https://example.com/nonexistent.tar.gz', './test-404.tar.gz'),
        /Failed to download asset: 404 Not Found/,
      )
    } finally {
      global.fetch = originalFetch
      await rm('./test-404.tar.gz').catch(() => {})
    }
  })

  test('handles successful streaming download', async () => {
    // Mock fetch to return successful stream
    const testData = Buffer.from('mock file content')
    const originalFetch = global.fetch

    global.fetch = async () => {
      const chunks = [testData]
      const _chunkIndex = 0

      const mockBody = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(chunk))
          controller.close()
        },
      })

      return {
        ok: true,
        body: mockBody,
      } as Response
    }

    const testFile = './test-successful-download.txt'

    try {
      // Should complete without error
      await downloadAsset('https://example.com/file.txt', testFile)

      // Verify file was created and contains expected content
      const content = await readFile(testFile)
      assert.deepEqual(content, testData)
    } finally {
      global.fetch = originalFetch
      await rm(testFile).catch(() => {})
    }
  })

  test('handles network timeout/connection errors', async () => {
    // Mock fetch to throw network error
    const originalFetch = global.fetch
    global.fetch = async () => {
      throw new Error('ECONNRESET: Connection reset by peer')
    }

    try {
      await assert.rejects(
        async () => await downloadAsset('https://example.com/file.tar.gz', './test-network-error.tar.gz'),
        /ECONNRESET: Connection reset by peer/,
      )
    } finally {
      global.fetch = originalFetch
      await rm('./test-network-error.tar.gz').catch(() => {})
    }
  })
})
