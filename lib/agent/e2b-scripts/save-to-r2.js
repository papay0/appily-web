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
    // Note: .env files are now INCLUDED to preserve user configurations.
    // TODO: Implement proper secret management.
    const excludeFiles = [
      '.DS_Store',
      'core',           // Core dumps (huge, not needed)
    ];

    // File extensions to exclude (binary/large files that shouldn't be saved)
    const excludeExtensions = [
      '.log',
      '.lock',          // Keep package-lock.json but not other locks
      '.tgz',
      '.tar',
      '.gz',
      '.zip',
      '.dmg',
      '.exe',
      '.dll',
      '.so',
      '.dylib',
    ];

    // Maximum file size in bytes (50MB - anything larger is likely a mistake)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
          // Skip files with excluded extensions (but keep package-lock.json)
          const ext = '.' + entry.name.split('.').pop()?.toLowerCase();
          if (excludeExtensions.includes(ext) && entry.name !== 'package-lock.json') {
            console.log(`[SaveToR2] Skipping excluded extension: ${relativePath}`);
            continue;
          }

          try {
            const stats = statSync(fullPath);

            // Skip files that are too large
            if (stats.size > MAX_FILE_SIZE) {
              console.log(`[SaveToR2] Skipping large file (${(stats.size / 1024 / 1024).toFixed(2)} MB): ${relativePath}`);
              continue;
            }

            const content = readFileSync(fullPath);
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

/**
 * Export iOS bundle and upload to R2
 *
 * @param {Object} options - Configuration options
 * @param {string} options.projectId - Project ID
 * @param {string} options.projectDir - Project directory path
 * @param {string} options.accountId - R2 account ID
 * @param {string} options.accessKeyId - R2 access key
 * @param {string} options.secretAccessKey - R2 secret key
 * @param {string} options.imagesBucketName - R2 images bucket name (public)
 * @param {string} options.imagesPublicUrl - R2 images public URL
 * @param {string} options.supabaseUrl - Supabase URL
 * @param {string} options.supabaseKey - Supabase service role key
 * @returns {Promise<{success: boolean, bundleUrl?: string, error?: string}>}
 */
async function exportAndUploadBundle(options) {
  const {
    projectId,
    projectDir,
    accountId,
    accessKeyId,
    secretAccessKey,
    imagesBucketName,
    imagesPublicUrl,
    supabaseUrl,
    supabaseKey,
  } = options;

  try {
    const { spawn } = require('child_process');
    const { readdirSync, statSync, readFileSync, existsSync, renameSync } = require('fs');
    const { join, relative } = require('path');
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { createClient } = require('@supabase/supabase-js');

    console.log('[ExportBundle] Starting iOS bundle export...');
    console.log(`[ExportBundle] Project: ${projectId}`);
    console.log(`[ExportBundle] Directory: ${projectDir}`);

    // Run expo export
    const exportResult = await new Promise((resolve, reject) => {
      const exportProcess = spawn('npx', [
        'expo', 'export',
        '--platform', 'ios',
        '--dev',
        '--output-dir', 'dist'
      ], {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CI: '1' }
      });

      let stdout = '';
      let stderr = '';

      exportProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`[ExportBundle] ${data.toString().trim()}`);
      });

      exportProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Don't log stderr as error - expo export uses it for progress
        console.log(`[ExportBundle] ${data.toString().trim()}`);
      });

      exportProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          reject(new Error(`Export failed with code ${code}: ${stderr}`));
        }
      });

      exportProcess.on('error', (err) => {
        reject(err);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        exportProcess.kill();
        reject(new Error('Export timed out after 5 minutes'));
      }, 5 * 60 * 1000);
    });

    console.log('[ExportBundle] ✓ Export completed');

    // Check if dist folder exists
    const distDir = join(projectDir, 'dist');
    if (!existsSync(distDir)) {
      return {
        success: false,
        error: 'Export completed but dist folder not found',
      };
    }

    // Find the bundle file
    const bundleDir = join(distDir, '_expo', 'static', 'js', 'ios');
    if (!existsSync(bundleDir)) {
      return {
        success: false,
        error: 'Bundle directory not found in dist/_expo/static/js/ios/',
      };
    }

    const bundleFiles = readdirSync(bundleDir).filter(f => f.endsWith('.js'));
    if (bundleFiles.length === 0) {
      return {
        success: false,
        error: 'No .js bundle file found',
      };
    }

    const originalBundleFileName = bundleFiles[0];
    console.log(`[ExportBundle] Found bundle: ${originalBundleFileName}`);

    // Rename bundle to include projectId to prevent caching issues
    // The native sandbox library caches bundles by filename, so each project needs a unique name
    const uniqueBundleFileName = `bundle-${projectId}.js`;
    const originalBundlePath = join(bundleDir, originalBundleFileName);
    const uniqueBundlePath = join(bundleDir, uniqueBundleFileName);

    renameSync(originalBundlePath, uniqueBundlePath);
    console.log(`[ExportBundle] Renamed bundle to: ${uniqueBundleFileName}`);

    const bundleFileName = uniqueBundleFileName;

    // Create S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Upload all files from dist to R2
    const filesToUpload = [];

    function walkDistDir(dir) {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDistDir(fullPath);
        } else if (entry.isFile()) {
          const relativePath = relative(distDir, fullPath);
          const content = readFileSync(fullPath);
          const stats = statSync(fullPath);
          filesToUpload.push({
            path: relativePath,
            content,
            size: stats.size,
          });
        }
      }
    }

    walkDistDir(distDir);
    console.log(`[ExportBundle] Found ${filesToUpload.length} files to upload`);

    // Upload to R2 under bundles/{projectId}/
    const r2Prefix = `bundles/${projectId}/`;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const key = `${r2Prefix}${file.path}`;

      try {
        const command = new PutObjectCommand({
          Bucket: imagesBucketName,
          Key: key,
          Body: file.content,
          ContentType: getContentType(file.path),
        });

        await s3Client.send(command);

        if ((i + 1) % 10 === 0 || i === filesToUpload.length - 1) {
          console.log(`[ExportBundle] Uploaded ${i + 1}/${filesToUpload.length} files`);
        }
      } catch (error) {
        console.error(`[ExportBundle] Failed to upload ${file.path}:`, error.message);
      }
    }

    console.log('[ExportBundle] ✓ Bundle files uploaded to R2');

    // Construct the bundle URL
    const bundleUrl = `${imagesPublicUrl.replace(/\/$/, '')}/${r2Prefix}_expo/static/js/ios/${bundleFileName}`;
    console.log(`[ExportBundle] Bundle URL: ${bundleUrl}`);

    // Update project with bundle_url
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: updateError } = await supabase
      .from('projects')
      .update({ bundle_url: bundleUrl })
      .eq('id', projectId);

    if (updateError) {
      console.error('[ExportBundle] Failed to update project:', updateError.message);
      return {
        success: true,
        bundleUrl,
        warning: `Bundle uploaded but failed to update project: ${updateError.message}`,
      };
    }

    console.log('[ExportBundle] ✓ Project updated with bundle URL');

    return {
      success: true,
      bundleUrl,
    };
  } catch (error) {
    console.error('[ExportBundle] Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  saveProjectToR2,
  exportAndUploadBundle,
};
