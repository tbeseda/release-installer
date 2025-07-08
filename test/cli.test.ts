import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseArgs } from 'node:util'

describe('CLI Argument Parsing', () => {
  test('parseArgs handles basic arguments', () => {
    const { positionals } = parseArgs({
      args: ['owner/repo', 'v1.0.0'],
      options: {
        'bin-name': { type: 'string', short: 'b' },
        output: { type: 'string', short: 'o' },
        verbose: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    assert.equal(positionals[0], 'owner/repo')
    assert.equal(positionals[1], 'v1.0.0')
  })

  test('parseArgs handles short flags', () => {
    const { values } = parseArgs({
      args: ['-b', 'custom-bin', '-o', './custom-output', '-v'],
      options: {
        'bin-name': { type: 'string', short: 'b' },
        output: { type: 'string', short: 'o' },
        verbose: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    assert.equal(values['bin-name'], 'custom-bin')
    assert.equal(values.output, './custom-output')
    assert.equal(values.verbose, true)
  })

  test('parseArgs handles long flags', () => {
    const { values } = parseArgs({
      args: ['--bin-name', 'custom-bin', '--output', './custom-output', '--verbose'],
      options: {
        'bin-name': { type: 'string', short: 'b' },
        output: { type: 'string', short: 'o' },
        verbose: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    assert.equal(values['bin-name'], 'custom-bin')
    assert.equal(values.output, './custom-output')
    assert.equal(values.verbose, true)
  })

  test('parseArgs handles platform-map JSON', () => {
    const platformMap = '{"darwin-x64":"app-macos.tar.gz"}'
    const { values } = parseArgs({
      args: ['--platform-map', platformMap],
      options: {
        'platform-map': { type: 'string', short: 'p' },
      },
      allowPositionals: true,
    })

    assert.equal(values['platform-map'], platformMap)

    // Test JSON parsing
    const parsed = JSON.parse(values['platform-map'])
    assert.equal(parsed['darwin-x64'], 'app-macos.tar.gz')
  })

  test('parseArgs handles mixed positional and option args', () => {
    const { values, positionals } = parseArgs({
      args: ['owner/repo', 'v1.0.0', '--verbose', '--output', './bin'],
      options: {
        output: { type: 'string', short: 'o' },
        verbose: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    assert.equal(positionals[0], 'owner/repo')
    assert.equal(positionals[1], 'v1.0.0')
    assert.equal(values.output, './bin')
    assert.equal(values.verbose, true)
  })
})
