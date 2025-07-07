import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { extractZip } from '../src/extract.js'

describe('Enhanced Zip Extraction Fallbacks', () => {
  test('handles when all zip tools fail', async () => {
    const testDir = './test-all-zip-tools-fail'
    const archivePath = join(testDir, 'test.zip')

    await mkdir(testDir, { recursive: true })
    await writeFile(archivePath, Buffer.from('fake zip content'))

    try {
      await assert.rejects(
        async () => await extractZip(archivePath, testDir),
        /Failed to extract zip file. Please ensure unzip, PowerShell, or 7z is available/,
      )
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })

  test('handles zip file that does not exist', async () => {
    const nonExistentPath = './nonexistent/file.zip'
    const outputDir = './test-zip-nonexistent'

    await assert.rejects(
      async () => await extractZip(nonExistentPath, outputDir),
      /Archive file does not exist/,
    )
  })

  test('creates output directory if it does not exist', async () => {
    const testDir = './test-zip-create-output'
    const archivePath = join(testDir, 'test.zip')
    const outputDir = join(testDir, 'nested/output')

    await mkdir(testDir, { recursive: true })
    await writeFile(archivePath, Buffer.from('fake zip content'))

    try {
      // Will fail during extraction but should create directory first
      await assert.rejects(
        async () => await extractZip(archivePath, outputDir),
        // Expected to fail with tool errors
      )

      // Verify output directory was created even though extraction failed
      const { access } = await import('node:fs/promises')
      await access(outputDir) // Should not throw

      assert.ok(true, 'Created output directory before attempting extraction')
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })
})
