import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { installRelease } from './index.js';

describe('Error Handling', () => {
  test('installRelease throws error for invalid repo', async () => {
    await assert.rejects(
      async () => await installRelease('invalid/repo', 'v1.0.0'),
      /Release v1.0.0 not found for repository invalid\/repo/,
    );
  });

  test('installRelease throws error for invalid version', async () => {
    await assert.rejects(
      async () => await installRelease('getzola/zola', 'v999.999.999'),
      /Release v999.999.999 not found for repository getzola\/zola/,
    );
  });

  test('installRelease throws error when no matching asset found', async () => {
    // Test with a platform map that points to a non-existent asset
    // The current platform will use the custom mapping and fail to find the asset
    const { getPlatformInfo } = await import('./platform.js');
    const currentPlatform = getPlatformInfo();

    await assert.rejects(
      async () =>
        await installRelease('getzola/zola', 'v0.20.0', {
          platformMap: {
            [currentPlatform.combined]: 'nonexistent-asset.tar.gz',
          },
        }),
      /Asset nonexistent-asset.tar.gz not found in release/,
    );
  });

  test('installRelease handles malformed repo name', async () => {
    await assert.rejects(
      async () => await installRelease('malformed-repo-name', 'v1.0.0'),
      /Release v1.0.0 not found for repository malformed-repo-name/,
    );
  });

  test('installRelease validates custom platform mapping', async () => {
    const { getPlatformInfo } = await import('./platform.js');
    const currentPlatform = getPlatformInfo();

    await assert.rejects(
      async () =>
        await installRelease('getzola/zola', 'v0.20.0', {
          platformMap: {
            [currentPlatform.combined]: 'nonexistent-file.tar.gz',
          },
        }),
      /Asset nonexistent-file.tar.gz not found in release/,
    );
  });
});
