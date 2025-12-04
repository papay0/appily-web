/**
 * E2B Image Download Utility
 *
 * Downloads images from R2 storage to E2B sandbox filesystem.
 * This allows Claude to access images via local file paths.
 */

import type { Sandbox } from "e2b";
import { getImagePublicUrl } from "@/lib/r2-client";

export interface DownloadImagesResult {
  success: boolean;
  localPaths: string[];
  errors: string[];
}

/**
 * Download images from R2 to E2B sandbox
 *
 * @param sandbox - E2B sandbox instance
 * @param imageKeys - R2 keys of images to download
 * @param targetDir - Target directory in sandbox (default: /home/user/project/images)
 * @returns Object with local paths and any errors
 */
export async function downloadImagesToSandbox(
  sandbox: Sandbox,
  imageKeys: string[],
  targetDir: string = "/home/user/project/images"
): Promise<DownloadImagesResult> {
  if (!imageKeys || imageKeys.length === 0) {
    return { success: true, localPaths: [], errors: [] };
  }

  console.log(`[E2B Images] Downloading ${imageKeys.length} images to ${targetDir}`);

  const localPaths: string[] = [];
  const errors: string[] = [];

  try {
    // Create target directory
    await sandbox.commands.run(`mkdir -p ${targetDir}`);

    for (const key of imageKeys) {
      try {
        // Get filename from R2 key
        const filename = key.split("/").pop();
        if (!filename) {
          errors.push(`Invalid R2 key: ${key}`);
          continue;
        }

        const localPath = `${targetDir}/${filename}`;

        // Get public URL from R2 images bucket (no expiration)
        const publicUrl = getImagePublicUrl(key);

        // Download using curl in E2B
        const result = await sandbox.commands.run(
          `curl -sL -o "${localPath}" "${publicUrl}"`,
          { timeoutMs: 30000 }
        );

        if (result.exitCode !== 0) {
          errors.push(`Failed to download ${filename}: ${result.stderr}`);
          continue;
        }

        // Verify file exists and has content
        const checkResult = await sandbox.commands.run(`test -s "${localPath}" && echo "ok" || echo "empty"`);
        if (checkResult.stdout.trim() !== "ok") {
          errors.push(`Downloaded file is empty: ${filename}`);
          continue;
        }

        localPaths.push(localPath);
        console.log(`[E2B Images] ✓ Downloaded: ${localPath}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error downloading ${key}: ${errorMsg}`);
        console.error(`[E2B Images] ✗ Failed to download ${key}:`, error);
      }
    }

    const success = localPaths.length > 0 || imageKeys.length === 0;
    console.log(`[E2B Images] Download complete: ${localPaths.length}/${imageKeys.length} successful`);

    return { success, localPaths, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[E2B Images] Fatal error:", error);
    return {
      success: false,
      localPaths,
      errors: [...errors, `Fatal error: ${errorMsg}`],
    };
  }
}

/**
 * Build image context for Claude prompt
 *
 * @param localPaths - Local paths to images in sandbox
 * @returns Formatted string for including in Claude's prompt
 */
export function buildImageContext(localPaths: string[]): string {
  if (!localPaths || localPaths.length === 0) {
    return "";
  }

  const pathsList = localPaths.map((p) => `- ${p}`).join("\n");

  return `

**Reference Images:**
The user has provided ${localPaths.length} image(s) for reference. You can view them at these paths:
${pathsList}

Use these images to understand the user's design intentions, UI mockups, screenshots, or visual references for the app.
You can analyze these images to inform your implementation decisions.`;
}
