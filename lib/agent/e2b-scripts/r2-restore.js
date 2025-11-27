/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * R2 Restore Utility (RUNS INSIDE E2B SANDBOX)
 *
 * This module is uploaded to E2B and runs INSIDE the sandbox.
 * It has direct filesystem access and writes files using Node.js fs module.
 *
 * For restoring from VERCEL BACKEND to E2B, see:
 * @see /lib/agent/restore-from-r2.ts (uses E2B API, not filesystem)
 *
 * Why two separate modules?
 * - This one: Fast, direct filesystem writes (runs in E2B)
 * - TypeScript one: API-based uploads (runs on Vercel, pushes to E2B)
 */

/**
 * Restore project files from R2
 *
 * @param {Object} options - Configuration options
 * @param {string} options.r2Path - R2 path prefix (e.g., "projects/userId/projectId/v123/")
 * @param {string} options.targetDir - Local directory to restore to
 * @param {string} options.accountId - R2 account ID
 * @param {string} options.accessKeyId - R2 access key
 * @param {string} options.secretAccessKey - R2 secret key
 * @param {string} options.bucketName - R2 bucket name
 * @param {Function} [options.onProgress] - Progress callback (file, index, total)
 * @returns {Promise<{success: boolean, fileCount: number, error?: string}>}
 */
async function restoreFromR2(options) {
  const {
    r2Path,
    targetDir,
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    onProgress,
  } = options;

  try {
    // Import required modules
    const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { writeFileSync, mkdirSync } = require('fs');
    const { dirname, join } = require('path');

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // List all files in the R2 path
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: r2Path,
    });

    const listResult = await s3Client.send(listCommand);
    const files = listResult.Contents || [];

    if (files.length === 0) {
      return {
        success: false,
        fileCount: 0,
        error: 'No files found in R2 snapshot',
      };
    }

    // Create target directory
    mkdirSync(targetDir, { recursive: true });

    // Download and write each file
    let restoredCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = file.Key;
      const relativePath = key.replace(r2Path, '');

      if (!relativePath) continue; // Skip the directory itself

      const fullPath = join(targetDir, relativePath);
      const dir = dirname(fullPath);

      // Create directory if it doesn't exist
      mkdirSync(dir, { recursive: true });

      // Download file from R2
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const getResult = await s3Client.send(getCommand);
      const body = await getResult.Body.transformToByteArray();

      // Write file
      writeFileSync(fullPath, Buffer.from(body));
      restoredCount++;

      // Call progress callback if provided
      if (onProgress) {
        onProgress(relativePath, restoredCount, files.length);
      }
    }

    // Fix file permissions - ensure all files are readable/writable
    // This prevents "EACCES: permission denied" errors in Expo/Metro
    const { execSync } = require('child_process');
    try {
      execSync(`chmod -R u+rw "${targetDir}"`, { timeout: 30000 });
    } catch (permError) {
      console.warn('[r2-restore] Warning: Could not fix permissions:', permError.message);
    }

    return {
      success: true,
      fileCount: restoredCount,
    };
  } catch (error) {
    return {
      success: false,
      fileCount: 0,
      error: error.message,
    };
  }
}

module.exports = {
  restoreFromR2,
};
