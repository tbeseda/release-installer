import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { InstallOptions } from './index.js';

test('InstallOptions should have optional properties', () => {
  const options: InstallOptions = {};
  assert.equal(typeof options, 'object');

  const optionsWithValues: InstallOptions = {
    binName: 'test-bin',
    outputDir: './test-output',
    verbose: true,
  };
  assert.equal(optionsWithValues.binName, 'test-bin');
});
