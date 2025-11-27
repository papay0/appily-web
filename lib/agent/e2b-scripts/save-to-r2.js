/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Save Project Files to R2 (RUNS INSIDE E2B SANDBOX)
 *
 * This module runs INSIDE the E2B sandbox and saves files directly to R2.
 * It has direct filesystem access and doesn't need to call Vercel.
 *
 * Why this approach?
 * - No circular dependency (E2B → Vercel → E2B)
 * - Faster (no network round-trip to Vercel)
 * - More reliable (fewer failure points)
 * - E2B already has the files in its filesystem
 */

/**
 * Save project files from E2B filesystem to R2
 *
 * @param {Object} options - Configuration options
 * @param {string} options.projectId - Project ID
 * @param {string} options.userId - User ID
 * @param {string} options.projectDir - Project directory path
 * @param {string} options.description - Snapshot description
 * @param {string} options.accountId - R2 account ID
 * @param {string} options.accessKeyId - R2 access key
 * @param {string} options.secretAccessKey - R2 secret key
 * @param {string} options.bucketName - R2 bucket name
 * @param {string} options.supabaseUrl - Supabase URL
 * @param {string} options.supabaseKey - Supabase service role key
 * @returns {Promise<{success: boolean, version?: number, fileCount?: number, error?: string}>}
 */
async function saveProjectToR2(options) {
  const {
    projectId,
    userId,
    projectDir,
    description,
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    supabaseUrl,
    supabaseKey,
  } = options;

  try {
    const { spawn } = require('child_process');
    const { readdirSync, statSync, readFileSync } = require('fs');
    const { join, relative } = require('path');
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { createClient } = require('@supabase/supabase-js');

    console.log('[SaveToR2] Starting save process...');
    console.log(`[SaveToR2] Project: ${projectId}`);
    console.log(`[SaveToR2] Directory: ${projectDir}`);

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read all files from project directory
    const files = [];

    // Directories to exclude (these will match as path components)
    const excludeDirs = [
      'node_modules',
      '.git',
      '.expo',
      '.next',
      'dist',
      'build',
      'coverage',
      '.turbo',
      'out',
    ];

    // Specific files to exclude (exact filename matches)
    const excludeFiles = [
      '.DS_Store',
    ];

    function walkDir(dir) {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = relative(projectDir, fullPath);

        // Skip excluded files (exact match)
        if (excludeFiles.includes(entry.name)) {
          continue;
        }

        // Skip excluded directories (check if any path segment matches)
        // Split by path separator and check if any segment is in excludeDirs
        const pathParts = relativePath.split('/');
        if (pathParts.some(part => excludeDirs.includes(part))) {
          continue;
        }

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const content = readFileSync(fullPath);
            const stats = statSync(fullPath);
            files.push({
              path: relativePath,
              content,
              size: stats.size,
            });
          } catch (error) {
            console.warn(`[SaveToR2] Failed to read ${relativePath}:`, error.message);
          }
        }
      }
    }

    walkDir(projectDir);

    if (files.length === 0) {
      return {
        success: false,
        error: 'No files found in project directory',
      };
    }

    console.log(`[SaveToR2] Found ${files.length} files`);

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`[SaveToR2] Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Get next version number from Supabase
    const { data: existingSnapshots } = await supabase
      .from('project_snapshots')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingSnapshots && existingSnapshots.length > 0
      ? existingSnapshots[0].version + 1
      : 1;

    console.log(`[SaveToR2] Next version: ${nextVersion}`);

    // Create R2 path: projects/{userId}/{projectId}/v{timestamp}/
    const timestamp = Date.now();
    const r2Path = `projects/${userId}/${projectId}/v${timestamp}/`;

    console.log(`[SaveToR2] Uploading to R2: ${r2Path}`);

    // Upload all files to R2
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = `${r2Path}${file.path}`;

      try {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.content,
          ContentType: getContentType(file.path),
          Metadata: {
            projectId,
            userId,
            version: nextVersion.toString(),
            originalPath: file.path,
          },
        });

        await s3Client.send(command);

        if ((i + 1) % 10 === 0 || i === files.length - 1) {
          console.log(`[SaveToR2] Uploaded ${i + 1}/${files.length} files`);
        }
      } catch (error) {
        console.error(`[SaveToR2] Failed to upload ${file.path}:`, error.message);
      }
    }

    console.log('[SaveToR2] ✓ Files uploaded to R2');

    // Create snapshot record in Supabase
    const { data: snapshot, error: snapshotError } = await supabase
      .from('project_snapshots')
      .insert({
        project_id: projectId,
        user_id: userId,
        version: nextVersion,
        description,
        r2_path: r2Path,
        file_count: files.length,
        total_size: totalSize,
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('[SaveToR2] Failed to create snapshot record:', snapshotError.message);
      return {
        success: false,
        error: `Failed to save snapshot metadata: ${snapshotError.message}`,
      };
    }

    console.log(`[SaveToR2] ✓ Snapshot v${nextVersion} saved successfully`);

    return {
      success: true,
      version: nextVersion,
      fileCount: files.length,
    };
  } catch (error) {
    console.error('[SaveToR2] Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Helper function to determine content type based on file extension
 */
function getContentType(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase();

  const contentTypes = {
    // JavaScript/TypeScript
    js: 'text/javascript',
    jsx: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    mjs: 'text/javascript',

    // JSON/Config
    json: 'application/json',

    // Styles
    css: 'text/css',
    scss: 'text/css',
    sass: 'text/css',

    // Markup
    html: 'text/html',
    xml: 'application/xml',

    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',

    // Documents
    md: 'text/markdown',
    txt: 'text/plain',

    // Other
    pdf: 'application/pdf',
    zip: 'application/zip',
  };

  return contentTypes[extension] || 'application/octet-stream';
}

module.exports = {
  saveProjectToR2,
};
