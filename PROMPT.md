# Build a GitHub Release Installer npm Package

I want to create an npm package called `release-installer` that solves a common problem: downloading GitHub release binaries for use in npm projects without requiring developers to manually install CLIs.

## Core Functionality

The package should provide a CLI tool that:
1. Takes a GitHub repo and release version as arguments
2. Automatically detects the current platform/architecture (using Node.js `os` module)
3. Downloads the appropriate release asset for that platform
4. Extracts the binary to a specified local directory
5. Sets proper executable permissions

## CLI Interface

```bash
# Basic usage
release-installer <owner/repo> <version> [options]

# Example
release-installer getzola/zola v0.20.0 --bin-name=zola --output=./bin
```

## Options to Support

- `--bin-name` or `-b`: Name of the binary inside the archive (defaults to repo name)
- `--output` or `-o`: Output directory (defaults to `./bin`)
- `--platform-map` or `-p`: JSON string or file path for custom platform mappings
- `--force` or `-f`: Overwrite existing files
- `--verbose` or `-v`: Verbose logging

## Platform Detection & Mapping

The tool should have intelligent defaults for common platform naming patterns:
- `darwin-x64` → look for patterns like `apple-darwin`, `macos`, `darwin`
- `linux-x64` → look for patterns like `linux-gnu`, `linux`, `x86_64-unknown-linux`
- `win32-x64` → look for patterns like `windows-msvc`, `windows`, `win64`

It should handle differing architectures and platforms.

But also allow custom mappings via config.

## Configuration Options

Support configuration via:
1. Command line arguments
2. `package.json` section like:
```json
{
  "githubRelease": {
    "getzola/zola": {
      "version": "v0.20.0",
      "binName": "zola",
      "outputDir": "./bin",
      "platformMap": {
        "darwin-x64": "zola-v{version}-x86_64-apple-darwin.tar.gz",
        "linux-x64": "zola-v{version}-x86_64-unknown-linux-gnu.tar.gz",
        "win32-x64": "zola-v{version}-x86_64-pc-windows-msvc.zip"
      }
    }
  }
}
```

## Technical Requirements

- Written in Node.js (TypeScript preferred)
- Use modern async/await patterns
- Handle both `.tar.gz` and `.zip` archives
- Proper error handling and user-friendly error messages
- Support for GitHub API rate limiting
- No authentication required for public repos
- Cross-platform support (Windows, macOS, Linux)

## Sample Package Structure

```
release-installer/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── installer.ts     # Main installer logic
│   ├── installer.test.ts
│   ├── platform.ts      # Platform detection
│   ├── platform.test.ts
│   ├── download.ts      # Download & extraction
│   ├── download.test.ts
│   └── config.ts        # Configuration handling
├── bin/
│   └── release-installer.js
├── package.json
├── README.md
└── tsconfig.json
```

I'm not married to this structure, but it shows how tests are siblings to the code they test.

## Dependencies to Consider

- use built in tools for arg parsing
- use built in tools for logging
- use built in tools for file system operations
- use new built in colors for colored output
- use built in fetch for HTTP requests
- use built in unzip for zip extraction
- use built in tar for tar.gz extraction
- use built in chmod for setting permissions

- fall back to `tar` for .tar.gz extraction
- fall back to `yauzl` or `adm-zip` for .zip extraction

## Error Handling

- Clear error messages when release/repo doesn't exist
- Helpful suggestions when no matching platform asset is found
- Permission error handling

## Testing Strategy

- Unit tests for platform detection
- Integration tests with real GitHub releases
- Cross-platform testing (if possible)
- Test with various archive formats

## Documentation

- Clear README with examples
- JSDoc comments for all public APIs
- Usage examples for different scenarios

## Getting Started

Please help me:
1. Set up the initial project structure with TypeScript
2. Create the basic CLI interface using commander
3. Implement platform detection logic
4. Build the GitHub API integration to fetch release info
5. Add download and extraction functionality
6. Create a simple test to verify it works with a real repo

Start with a minimal working version that can download and extract a single release, then we can iterate and add more features.

The goal is to create something that "just works" for the 90% use case while being extensible for edge cases.
