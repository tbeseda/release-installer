import { spawn } from 'node:child_process';

export async function extractTarGz(
  archivePath: string,
  outputDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', archivePath, '-C', outputDir]);

    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar command failed with code ${code}`));
      }
    });

    tar.on('error', (error) => {
      reject(new Error(`Failed to extract tar.gz: ${error.message}`));
    });
  });
}

export async function extractZip(
  archivePath: string,
  outputDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const unzip = spawn('unzip', ['-o', archivePath, '-d', outputDir]);

    unzip.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`unzip command failed with code ${code}`));
      }
    });

    unzip.on('error', (error) => {
      reject(new Error(`Failed to extract zip: ${error.message}`));
    });
  });
}

export async function extractArchive(
  archivePath: string,
  outputDir: string,
): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.mkdir(outputDir, { recursive: true });

  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    await extractTarGz(archivePath, outputDir);
  } else if (archivePath.endsWith('.zip')) {
    await extractZip(archivePath, outputDir);
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }
}
