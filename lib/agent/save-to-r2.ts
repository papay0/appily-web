import { Sandbox } from "e2b";
import { readProjectFiles } from "@/lib/e2b";
import { uploadFiles } from "@/lib/r2-client";

/**
 * Save project files from E2B sandbox to R2 storage
 * Called automatically after each "Task completed" event
 */
export async function saveProjectToR2(
  sandboxId: string,
  projectId: string,
  userId: string,
  description: string = "Auto-save snapshot"
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[SaveToR2] Starting save for project ${projectId}`);

    // Connect to the sandbox
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });

    // Read all project files
    const files = await readProjectFiles(sandbox, "/home/user/project");

    if (files.length === 0) {
      console.warn("[SaveToR2] No files found to save");
      return { success: false, error: "No files found" };
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(
      `[SaveToR2] Found ${files.length} files, total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Create timestamp for this version
    const timestamp = Date.now();
    const r2Path = `projects/${userId}/${projectId}/v${timestamp}/`;

    console.log(`[SaveToR2] Uploading to R2: ${r2Path}`);

    // Upload all files to R2
    const uploadPromises = files.map((file) => ({
      key: `${r2Path}${file.path}`,
      body: file.content,
      contentType: getContentType(file.path),
      metadata: {
        projectId,
        userId,
        timestamp: timestamp.toString(),
        originalPath: file.path,
      },
    }));

    await uploadFiles(uploadPromises);

    console.log(`[SaveToR2] ✓ Files uploaded successfully`);

    // Note: We're not creating DB record here because the API endpoint does that
    // This function is just for the file upload part

    return { success: true };
  } catch (error) {
    console.error("[SaveToR2] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Helper to determine content type based on file extension
 */
function getContentType(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    // JavaScript/TypeScript
    js: "text/javascript",
    jsx: "text/javascript",
    ts: "text/typescript",
    tsx: "text/typescript",
    mjs: "text/javascript",

    // JSON/Config
    json: "application/json",

    // Styles
    css: "text/css",
    scss: "text/css",

    // Markup
    html: "text/html",
    xml: "application/xml",

    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",

    // Documents
    md: "text/markdown",
    txt: "text/plain",
  };

  return contentTypes[extension || ""] || "application/octet-stream";
}
