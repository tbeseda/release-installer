#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { installRelease } from './index.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'bin-name': { type: 'string', short: 'b' },
    output: { type: 'string', short: 'o' },
    'platform-map': { type: 'string', short: 'p' },
    force: { type: 'boolean', short: 'f' },
    verbose: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Usage: release-installer <owner/repo> <version> [options]

Options:
  -b, --bin-name <name>       Name of the binary inside the archive
  -o, --output <dir>          Output directory (default: ./bin)
  -p, --platform-map <json>   JSON string or file path for platform mappings
  -f, --force                 Overwrite existing files
  -v, --verbose               Verbose logging
  -h, --help                  Show this help message

Examples:
  release-installer getzola/zola v0.20.0
  release-installer getzola/zola v0.20.0 --bin-name=zola --output=./bin
  `);
  process.exit(0);
}

const [repo, version] = positionals;

if (!repo || !version) {
  console.error('Error: Both repository and version are required');
  console.error('Usage: release-installer <owner/repo> <version>');
  process.exit(1);
}

try {
  await installRelease(repo, version, {
    binName: values['bin-name'],
    outputDir: values.output,
    platformMap: values['platform-map']
      ? JSON.parse(values['platform-map'])
      : undefined,
    force: values.force,
    verbose: values.verbose,
  });
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
