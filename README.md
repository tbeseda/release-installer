# 📦 `release-installer`

**Simple GitHub release installer.**

A Node.js CLI tool that automatically downloads and installs GitHub release binaries for your platform without requiring manual CLI installation.

## Features

- 🎯 **Automatic platform detection** - Detects your OS and architecture
- 🔍 **Smart asset matching** - Finds the right binary for your platform
- 📥 **Download & extract** - Handles `.tar.gz` and `.zip` archives
- ⚡ **Zero dependencies** - Uses built-in Node.js modules
- 🔧 **Configurable** - CLI options and package.json configuration
- 🌍 **Cross-platform** - Works on macOS, Linux, and Windows

## Installation

```bash
npm install -g release-installer
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

## Platform Detection

The tool automatically detects your platform and architecture, then matches against common naming patterns:

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

## Error Handling

The tool provides clear error messages for common issues:

- Repository or release not found
- No matching asset for your platform
- Download or extraction failures
- Permission errors

## Development

```bash
# Clone and install
git clone https://github.com/tbeseda/release-installer.git
cd release-installer
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```
