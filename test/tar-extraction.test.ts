import assert from 'node:assert/strict'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { describe, test } from 'node:test'
import { createGzip } from 'node:zlib'
import { extractTarGz } from '../src/extract.js'

describe('Native tar.gz Extraction Edge Cases', () => {
  test('handles empty gzip file', async () => {
    const testDir = './test-empty-gzip'
    const archivePath = join(testDir, 'empty.tar.gz')

    await mkdir(testDir, { recursive: true })

    // Create empty file that's not a valid gzip
    await writeFile(archivePath, Buffer.alloc(0))

    try {
      await extractTarGz(archivePath, testDir)
      // Check that no files were extracted
      const { readdir } = await import('node:fs/promises')
      const files = await readdir(testDir)
      // Only the archive file should exist
      assert.deepEqual(files, ['empty.tar.gz'])
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })

  test('handles invalid gzip header', async () => {
    const testDir = './test-invalid-gzip'
    const archivePath = join(testDir, 'invalid.tar.gz')

    await mkdir(testDir, { recursive: true })

    // Create file with invalid gzip magic bytes
    const invalidGzipHeader = Buffer.from([0x1f, 0x8a, 0x08, 0x00]) // incomplete header
    await writeFile(archivePath, invalidGzipHeader)

    try {
      await assert.rejects(
        async () => await extractTarGz(archivePath, testDir),
        /tar command failed: Invalid archive format/,
      )
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })

  test('handles valid gzip with invalid tar content', async () => {
    const testDir = './test-invalid-tar'
    const archivePath = join(testDir, 'invalid-tar.tar.gz')

    await mkdir(testDir, { recursive: true })

    // Create a valid gzip file but with invalid tar content
    const invalidTarContent = Buffer.from('This is not tar data')
    const readableStream = Readable.from([invalidTarContent])
    const gzipStream = createGzip()
    const writeStream = createWriteStream(archivePath)

    await pipeline(readableStream, gzipStream, writeStream)

    try {
      await assert.rejects(
        async () => await extractTarGz(archivePath, testDir),
        /tar command failed: Invalid archive format/,
      )
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })

  test('handles file that does not exist', async () => {
    const nonExistentPath = './nonexistent/file.tar.gz'
    const outputDir = './test-nonexistent'

    await assert.rejects(
      async () => await extractTarGz(nonExistentPath, outputDir),
      /tar command failed: File not found/,
    )
  })

  test('handles tar with directories and files', async () => {
    const testDir = './test-tar-with-dirs'
    const archivePath = join(testDir, 'with-dirs.tar.gz')
    const outputDir = join(testDir, 'output')

    await mkdir(testDir, { recursive: true })

    // Create a simple tar.gz with directory structure
    // This is a minimal test - we'd need actual tar.gz creation for full testing
    // Create a minimal valid tar header for a file
    const tarHeader = Buffer.alloc(512)

    // File name (first 100 bytes)
    const fileName = 'test.txt'
    tarHeader.write(fileName, 0, fileName.length)

    // File mode in octal (8 bytes at offset 100)
    const fileMode = '0000644\0' // rw-r--r--
    tarHeader.write(fileMode, 100, fileMode.length)

    // File size in octal (12 bytes at offset 124)
    const fileSize = '000000000015' // 13 bytes in octal
    tarHeader.write(fileSize, 124, fileSize.length)

    // File type (1 byte at offset 156) - '0' for regular file
    tarHeader[156] = 48 // ASCII '0'

    // Calculate checksum (8 bytes at offset 148)
    let checksum = 0
    for (let i = 0; i < 512; i++) {
      checksum += i >= 148 && i < 156 ? 32 : tarHeader[i] // Treat checksum field as spaces
    }
    const checksumStr = `${checksum.toString(8).padStart(6, '0')}\0 `
    tarHeader.write(checksumStr, 148, checksumStr.length)

    // File content (13 bytes + padding to 512-byte boundary)
    const fileContent = Buffer.from('Hello, world!')
    const filePadding = Buffer.alloc(512 - fileContent.length)

    // End of archive (two zero blocks)
    const endOfArchive = Buffer.alloc(1024)

    const tarData = Buffer.concat([tarHeader, fileContent, filePadding, endOfArchive])

    const readableStream = Readable.from([tarData])
    const gzipStream = createGzip()
    const writeStream = createWriteStream(archivePath)

    await pipeline(readableStream, gzipStream, writeStream)

    try {
      await extractTarGz(archivePath, outputDir)
      // Verify file was extracted and is readable
      const extractedContent = await readFile(join(outputDir, 'test.txt'), 'utf8')
      assert.equal(extractedContent, 'Hello, world!')
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })

  test('handles extraction to non-existent output directory', async () => {
    const testDir = './test-create-output'
    const archivePath = join(testDir, 'test.tar.gz')
    const outputDir = join(testDir, 'deep/nested/output')

    await mkdir(testDir, { recursive: true })

    // Create minimal valid gzipped content
    const emptyContent = Buffer.alloc(1024) // Empty tar (two zero blocks)
    const readableStream = Readable.from([emptyContent])
    const gzipStream = createGzip()
    const writeStream = createWriteStream(archivePath)

    await pipeline(readableStream, gzipStream, writeStream)

    try {
      // Should create output directory automatically
      await extractTarGz(archivePath, outputDir)

      // Verify directory was created
      const { access } = await import('node:fs/promises')
      await access(outputDir) // Should not throw

      assert.ok(true, 'Created output directory automatically')
    } finally {
      await rm(testDir, { recursive: true }).catch(() => {})
    }
  })
})
