import assert from 'node:assert/strict'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { extractArchive } from '../src/extract.js'

describe('Archive Extraction', () => {
  test('extractArchive identifies tar.gz files', async () => {
    const testDir = './test-extract'
    const archivePath = join(testDir, 'test.tar.gz')

    await mkdir(testDir, { recursive: true })

    // Create a minimal tar.gz file (this is a mock test)
    await writeFile(archivePath, Buffer.from('mock-tar-content'))

    try {
      // This will fail because it's not a real tar.gz, but we're testing the path detection
      await extractArchive(archivePath, testDir)
    } catch (error) {
      // Expected to fail with gzip/tar error from our native implementation
      assert.match(
        (error as Error).message,
        /tar command failed|Failed to extract|incorrect header check/,
      )
    }

    // Clean up
    await rm(testDir, { recursive: true })
  })

  test('extractArchive identifies zip files', async () => {
    const testDir = './test-extract-zip'
    const archivePath = join(testDir, 'test.zip')

    await mkdir(testDir, { recursive: true })

    // Create a minimal zip file (this is a mock test)
    await writeFile(archivePath, Buffer.from('mock-zip-content'))

    try {
      // This will fail because it's not a real zip, but we're testing the path detection
      await extractArchive(archivePath, testDir)
    } catch (error) {
      // Expected to fail with unzip command error
      assert.match(
        (error as Error).message,
        /unzip command failed|Failed to extract/,
      )
    }

    // Clean up
    await rm(testDir, { recursive: true })
  })

  test('extractArchive rejects unsupported formats', async () => {
    const testDir = './test-extract-unsupported'
    const archivePath = join(testDir, 'test.rar')

    await mkdir(testDir, { recursive: true })
    await writeFile(archivePath, Buffer.from('mock-content'))

    await assert.rejects(
      async () => await extractArchive(archivePath, testDir),
      /Unsupported archive format/,
    )

    // Clean up
    await rm(testDir, { recursive: true })
  })

  test('extractArchive creates output directory', async () => {
    const testDir = './test-extract-mkdir'
    const archivePath = './test-mkdir.tar.gz'

    // Create a mock archive file in current directory
    await writeFile(archivePath, Buffer.from('mock-content'))

    try {
      await extractArchive(archivePath, testDir)
    } catch (_error) {
      // Expected to fail, but directory should be created
      try {
        await access(testDir)
        // Directory exists, test passed
      } catch (_accessError) {
        assert.fail('Output directory was not created')
      }
    }

    // Clean up
    try {
      await rm(testDir, { recursive: true })
    } catch {}
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(archivePath)
    } catch {}
  })
})
