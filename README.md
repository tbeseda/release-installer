# 📦 `release-installer`

**Simple GitHub release installer.**

A Node.js CLI to automatically download and install GitHub release binaries for your platform.  
Helpful for installing non-npm tools.

## Features

- **Automatically detect** OS and architecture
- **Download & extract** `.tar.gz` and `.zip` archives
- **Configurable** platform mappings, binary name, output dir
- **Zero dependencies** (requires Node.js 22+)
- **Cross-platform**

## Installation

```bash
npm i release-installer
```

## Usage

### Basic Usage

```bash
# Install latest release
release-installer getzola/zola v0.20.0

# Install to specific directory
release-installer getzola/zola v0.20.0 --output=./bin

# Verbose output
release-installer getzola/zola v0.20.0 --verbose
```

### CLI Options

```
Usage: release-installer <owner/repo> <version> [options]

Options:
  -b, --bin-name <name>       Name of the binary inside the archive
  -o, --output <dir>          Output directory (default: ./bin)
  -p, --platform-map <json>   JSON string or file path for platform mappings
  -f, --force                 Overwrite existing files
  -v, --verbose               Verbose logging
  -h, --help                  Show this help message
```

<!--
### Package.json Configuration

You can also configure releases in your `package.json`:

```json
{
  "githubRelease": {
    "getzola/zola": {
      "version": "v0.20.0",
      "binName": "zola",
      "outputDir": "./bin"
    }
  }
}
```
-->

## Platform Detection

The tool tries to detect your platform and architecture, then matches against common naming patterns:

- **macOS**: `apple-darwin`, `macos`, `darwin`
- **Linux**: `linux-gnu`, `linux`, `unknown-linux`
- **Windows**: `windows-msvc`, `windows`, `win64`, `pc-windows`

Architecture patterns:
- **x64**: `x86_64`, `x64`, `amd64`
- **ARM64**: `aarch64`, `arm64`

## Examples

```bash
# Install Zola static site generator
release-installer getzola/zola v0.20.0

# Install specific binary name
release-installer owner/repo v1.0.0 --bin-name=custom-name

# Install with custom output directory
release-installer owner/repo v1.0.0 --output=./tools

# Use custom platform mappings
release-installer owner/repo v1.0.0 --platform-map='{"darwin-x64":"app-macos.tar.gz"}'
```

## Development

```bash
npm install

npm run build

npm test
```
