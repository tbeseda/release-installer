import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { findBestAsset, getPlatformInfo, matchAssetName } from '../src/platform.js'

describe('Platform Detection', () => {
  test('getPlatformInfo returns valid platform info', () => {
    const info = getPlatformInfo()
    assert.equal(typeof info.platform, 'string')
    assert.equal(typeof info.arch, 'string')
    assert.equal(typeof info.combined, 'string')
    assert.equal(info.combined, `${info.platform}-${info.arch}`)
  })

  test('matchAssetName detects macOS assets correctly', () => {
    const platform = {
      platform: 'darwin',
      arch: 'x64',
      combined: 'darwin-x64',
    }

    assert.equal(matchAssetName('app-v1.0.0-x86_64-apple-darwin.tar.gz', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-amd64-macos.zip', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-x64-darwin.tar.gz', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-x86_64-apple.tar.gz', platform), true)
  })

  test('matchAssetName detects Linux assets correctly', () => {
    const platform = { platform: 'linux', arch: 'x64', combined: 'linux-x64' }

    assert.equal(matchAssetName('app-v1.0.0-x86_64-unknown-linux-gnu.tar.gz', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-amd64-linux.tar.gz', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-x64-linux-gnu.tar.gz', platform), true)
  })

  test('matchAssetName detects Windows assets correctly', () => {
    const platform = { platform: 'win32', arch: 'x64', combined: 'win32-x64' }

    assert.equal(matchAssetName('app-v1.0.0-x86_64-pc-windows-msvc.zip', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-amd64-windows.zip', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-x64-win64.zip', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-x86_64-win32.zip', platform), true)
  })

  test('matchAssetName detects ARM64 assets correctly', () => {
    const platform = {
      platform: 'darwin',
      arch: 'arm64',
      combined: 'darwin-arm64',
    }

    assert.equal(matchAssetName('app-v1.0.0-aarch64-apple-darwin.tar.gz', platform), true)
    assert.equal(matchAssetName('app-v1.0.0-arm64-macos.tar.gz', platform), true)
  })

  test('matchAssetName rejects non-matching assets', () => {
    const platform = {
      platform: 'darwin',
      arch: 'x64',
      combined: 'darwin-x64',
    }

    assert.equal(matchAssetName('app-v1.0.0-x86_64-unknown-linux-gnu.tar.gz', platform), false)
    assert.equal(matchAssetName('app-v1.0.0-aarch64-apple-darwin.tar.gz', platform), false)
    assert.equal(matchAssetName('app-v1.0.0-x86_64-pc-windows-msvc.zip', platform), false)
    assert.equal(matchAssetName('app-v1.0.0-source.tar.gz', platform), false)
  })

  test('findBestAsset returns null for no matches', () => {
    const platform = {
      platform: 'darwin',
      arch: 'x64',
      combined: 'darwin-x64',
    }
    const assets = [
      'app-v1.0.0-x86_64-unknown-linux-gnu.tar.gz',
      'app-v1.0.0-aarch64-apple-darwin.tar.gz',
      'app-v1.0.0-source.tar.gz',
    ]

    assert.equal(findBestAsset(assets, platform), null)
  })

  test('findBestAsset returns single match', () => {
    const platform = {
      platform: 'darwin',
      arch: 'x64',
      combined: 'darwin-x64',
    }
    const assets = [
      'app-v1.0.0-x86_64-unknown-linux-gnu.tar.gz',
      'app-v1.0.0-x86_64-apple-darwin.tar.gz',
      'app-v1.0.0-source.tar.gz',
    ]

    assert.equal(findBestAsset(assets, platform), 'app-v1.0.0-x86_64-apple-darwin.tar.gz')
  })

  test('findBestAsset prefers tar.gz over zip on non-Windows', () => {
    const platform = {
      platform: 'darwin',
      arch: 'x64',
      combined: 'darwin-x64',
    }
    const assets = ['app-v1.0.0-x86_64-apple-darwin.zip', 'app-v1.0.0-x86_64-apple-darwin.tar.gz']

    assert.equal(findBestAsset(assets, platform), 'app-v1.0.0-x86_64-apple-darwin.tar.gz')
  })

  test('findBestAsset returns first match when no tar.gz preference', () => {
    const platform = { platform: 'win32', arch: 'x64', combined: 'win32-x64' }
    const assets = ['app-v1.0.0-x86_64-pc-windows-msvc.zip', 'app-v1.0.0-x64-windows.zip']

    assert.equal(findBestAsset(assets, platform), 'app-v1.0.0-x86_64-pc-windows-msvc.zip')
  })
})
