import { Sandbox } from "e2b";
import { listFiles, downloadFile } from "@/lib/r2-client";

/**
 * Restore project files from R2 to E2B sandbox (BACKEND TO E2B)
 *
 * This module runs on VERCEL BACKEND and pushes files to E2B using the E2B API.
 * Used for manual "Start Sandbox" button (will be deprecated).
 *
 * For restoring INSIDE E2B sandbox (faster, used by message flow), see:
 * @see /lib/agent/e2b-scripts/r2-restore.js (direct filesystem access)
 *
 * Why two separate modules?
 * - This one: API-based uploads (runs on Vercel, pushes to E2B)
 * - JavaScript one: Fast, direct filesystem writes (runs in E2B)
 */
export async function restoreProjectFromR2(
  sandbox: Sandbox,
  r2Path: string,
  targetDir: string = "/home/user/project"
): Promise<{ success: boolean; fileCount: number; error?: string }> {
  try {
    console.log(`[RestoreFromR2] Restoring from ${r2Path} to ${targetDir}`);

    // List all files in R2 for this snapshot
    const r2Files = await listFiles(r2Path);

    if (r2Files.length === 0) {
      console.warn("[RestoreFromR2] No files found in R2");
      return { success: false, fileCount: 0, error: "No files found in snapshot" };
    }

    console.log(`[RestoreFromR2] Found ${r2Files.length} files in R2`);

    // Create target directory
    await sandbox.commands.run(`mkdir -p ${targetDir}`);

    // Download and upload files in batches
    const batchSize = 5;
    let restoredCount = 0;

    for (let i = 0; i < r2Files.length; i += batchSize) {
      const batch = r2Files.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (r2File) => {
          try {
            // Extract relative path (remove the r2Path prefix)
            const relativePath = r2File.key.replace(r2Path, "");

            if (!relativePath) {
              return; // Skip if path is empty
            }

            console.log(`[RestoreFromR2] Restoring ${relativePath}...`);

            // Download file from R2
            const fileContent = await downloadFile(r2File.key);

            // Create directory structure if needed
            const filePath = `${targetDir}/${relativePath}`;
            const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));

            if (dirPath !== targetDir) {
              await sandbox.commands.run(`mkdir -p "${dirPath}"`);
            }

            // Upload file to E2B (convert Buffer to string for text files, or to Uint8Array for binary)
            const content = fileContent.toString('utf-8');
            await sandbox.files.write(filePath, content);

            restoredCount++;
          } catch (error) {
            console.error(`[RestoreFromR2] Failed to restore ${r2File.key}:`, error);
          }
        })
      );

      console.log(
        `[RestoreFromR2] Progress: ${Math.min(i + batchSize, r2Files.length)}/${r2Files.length} files`
      );
    }

    console.log(`[RestoreFromR2] ✓ Restored ${restoredCount} files successfully`);

    return { success: true, fileCount: restoredCount };
  } catch (error) {
    console.error("[RestoreFromR2] Error:", error);
    return {
      success: false,
      fileCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Install npm dependencies after restoring project
 */
export async function installDependencies(
  sandbox: Sandbox,
  projectDir: string = "/home/user/project"
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[RestoreFromR2] Installing npm dependencies...");

    const installResult = await sandbox.commands.run(`cd ${projectDir} && npm install`, {
      timeoutMs: 120000, // 2 minutes timeout
    });

    if (installResult.exitCode !== 0) {
      throw new Error(`npm install failed: ${installResult.stderr}`);
    }

    console.log("[RestoreFromR2] ✓ Dependencies installed");
    return { success: true };
  } catch (error) {
    console.error("[RestoreFromR2] Error installing dependencies:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
