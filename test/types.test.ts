import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPlatformInfo, matchAssetName } from '../src/platform.js'

test('getPlatformInfo should return platform info', () => {
  const info = getPlatformInfo()
  assert.equal(typeof info.platform, 'string')
  assert.equal(typeof info.arch, 'string')
  assert.equal(typeof info.combined, 'string')
})

test('matchAssetName should match platform patterns', () => {
  const platformInfo = {
    platform: 'darwin',
    arch: 'x64',
    combined: 'darwin-x64',
  }

  assert.equal(
    matchAssetName('app-v1.0.0-x86_64-apple-darwin.tar.gz', platformInfo),
    true,
  )
  assert.equal(
    matchAssetName('app-v1.0.0-x86_64-unknown-linux-gnu.tar.gz', platformInfo),
    false,
  )
})
