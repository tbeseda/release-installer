import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fetchReleaseInfo } from './github.js';

const mockReleaseData = {
  tag_name: 'v0.20.0',
  assets: [
    {
      name: 'zola-v0.20.0-x86_64-unknown-linux-gnu.tar.gz',
      browser_download_url:
        'https://github.com/getzola/zola/releases/download/v0.20.0/zola-v0.20.0-x86_64-unknown-linux-gnu.tar.gz',
      size: 15728640,
    },
    {
      name: 'zola-v0.20.0-x86_64-apple-darwin.tar.gz',
      browser_download_url:
        'https://github.com/getzola/zola/releases/download/v0.20.0/zola-v0.20.0-x86_64-apple-darwin.tar.gz',
      size: 16777216,
    },
  ],
};

describe('GitHub API Integration', () => {
  test('fetchReleaseInfo returns release data for valid repo/version', async (t) => {
    t.mock.method(global, 'fetch', async (url: string) => {
      if (
        url ===
        'https://api.github.com/repos/getzola/zola/releases/tags/v0.20.0'
      ) {
        return {
          ok: true,
          json: async () => mockReleaseData,
        } as Response;
      }
      throw new Error('Unexpected fetch call');
    });

    const release = await fetchReleaseInfo('getzola/zola', 'v0.20.0');

    assert.equal(typeof release.tag_name, 'string');
    assert.equal(release.tag_name, 'v0.20.0');
    assert.equal(Array.isArray(release.assets), true);
    assert.equal(release.assets.length > 0, true);

    // Check asset structure
    const asset = release.assets[0];
    assert.equal(typeof asset.name, 'string');
    assert.equal(typeof asset.download_url, 'string');
    assert.equal(typeof asset.size, 'number');
    assert.equal(asset.download_url.startsWith('https://'), true);
  });

  test('fetchReleaseInfo throws error for non-existent repo', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response;
    });

    await assert.rejects(
      async () => await fetchReleaseInfo('nonexistent/repo', 'v1.0.0'),
      /Release v1.0.0 not found for repository nonexistent\/repo/,
    );
  });

  test('fetchReleaseInfo throws error for non-existent version', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response;
    });

    await assert.rejects(
      async () => await fetchReleaseInfo('getzola/zola', 'v999.999.999'),
      /Release v999.999.999 not found for repository getzola\/zola/,
    );
  });

  test('fetchReleaseInfo handles malformed repo name', async (t) => {
    t.mock.method(global, 'fetch', async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response;
    });

    await assert.rejects(
      async () => await fetchReleaseInfo('invalid-repo-name', 'v1.0.0'),
      /Release v1.0.0 not found for repository invalid-repo-name/,
    );
  });
});
