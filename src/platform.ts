import { arch, platform } from 'node:os';

export interface PlatformInfo {
  platform: string;
  arch: string;
  combined: string;
}

export function getPlatformInfo(): PlatformInfo {
  const p = platform();
  const a = arch();

  return {
    platform: p,
    arch: a,
    combined: `${p}-${a}`,
  };
}

export function matchAssetName(
  assetName: string,
  platformInfo: PlatformInfo,
): boolean {
  const name = assetName.toLowerCase();
  const { platform: p, arch: a } = platformInfo;

  // Platform patterns
  const platformPatterns = {
    darwin: ['apple-darwin', 'macos', 'darwin', 'apple'],
    linux: ['linux-gnu', 'linux', 'unknown-linux'],
    win32: ['windows-msvc', 'windows', 'win64', 'win32', 'pc-windows'],
  };

  // Architecture patterns
  const archPatterns = {
    x64: ['x86_64', 'x64', 'amd64'],
    arm64: ['aarch64', 'arm64'],
    arm: ['armv7', 'arm'],
  };

  const platformMatch = platformPatterns[
    p as keyof typeof platformPatterns
  ]?.some((pattern) => name.includes(pattern));

  const archMatch = archPatterns[a as keyof typeof archPatterns]?.some(
    (pattern) => name.includes(pattern),
  );

  return Boolean(platformMatch && archMatch);
}

export function findBestAsset(
  assets: string[],
  platformInfo: PlatformInfo,
): string | null {
  const matches = assets.filter((asset) => matchAssetName(asset, platformInfo));

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Prefer tar.gz over zip on non-Windows
  if (platformInfo.platform !== 'win32') {
    const tarGz = matches.find((m) => m.endsWith('.tar.gz'));
    if (tarGz) return tarGz;
  }

  return matches[0];
}
