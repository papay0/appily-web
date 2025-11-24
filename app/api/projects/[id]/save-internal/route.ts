import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "e2b";
import { readProjectFiles } from "@/lib/e2b";
import { uploadFiles } from "@/lib/r2-client";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Internal API endpoint for saving projects to R2
 *
 * This endpoint is called from E2B scripts using service role authentication.
 * It bypasses Clerk authentication and uses the service role key instead.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate using service role key from header
    const serviceKey = request.headers.get("x-service-key");
    if (!serviceKey || serviceKey !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    // Get request body (optional description)
    const body = await request.json().catch(() => ({}));
    const description = body.description || "Auto-save after task completion";

    console.log(`[SaveInternal] Saving project ${projectId}`);

    // Get project from database
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, e2b_sandbox_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("[SaveInternal] Project not found:", projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if sandbox exists
    if (!project.e2b_sandbox_id) {
      return NextResponse.json(
        { error: "No active sandbox for this project" },
        { status: 400 }
      );
    }

    console.log(`[SaveInternal] Connecting to sandbox ${project.e2b_sandbox_id}`);

    // Connect to existing sandbox
    const sandbox = await Sandbox.connect(project.e2b_sandbox_id, {
      apiKey: process.env.E2B_API_KEY,
    });

    // Read all project files from E2B
    console.log("[SaveInternal] Reading project files from E2B...");
    const files = await readProjectFiles(sandbox, "/home/user/project");
    console.log(`[SaveInternal] Read ${files.length} files`);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files found in project" },
        { status: 400 }
      );
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`[SaveInternal] Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Get the next version number
    const { data: existingSnapshots } = await supabaseAdmin
      .from("project_snapshots")
      .select("version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingSnapshots && existingSnapshots.length > 0
      ? existingSnapshots[0].version + 1
      : 1;

    // Create R2 path: projects/{userId}/{projectId}/v{timestamp}/
    const timestamp = Date.now();
    const r2Path = `projects/${project.user_id}/${projectId}/v${timestamp}/`;

    console.log(`[SaveInternal] Uploading ${files.length} files to R2 at ${r2Path}`);

    // Upload all files to R2
    const uploadPromises = files.map((file) => ({
      key: `${r2Path}${file.path}`,
      body: file.content,
      contentType: getContentType(file.path),
      metadata: {
        projectId,
        userId: project.user_id,
        version: nextVersion.toString(),
        originalPath: file.path,
      },
    }));

    await uploadFiles(uploadPromises);

    console.log(`[SaveInternal] ✓ Files uploaded to R2`);

    // Create snapshot record in database
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from("project_snapshots")
      .insert({
        project_id: projectId,
        user_id: project.user_id,
        version: nextVersion,
        description,
        r2_path: r2Path,
        file_count: files.length,
        total_size: totalSize,
      })
      .select()
      .single();

    if (snapshotError) {
      console.error("[SaveInternal] Failed to create snapshot record:", snapshotError);
      return NextResponse.json(
        { error: "Failed to save snapshot metadata" },
        { status: 500 }
      );
    }

    console.log(`[SaveInternal] ✓ Snapshot v${nextVersion} saved successfully`);

    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        version: snapshot.version,
        description: snapshot.description,
        fileCount: snapshot.file_count,
        totalSize: snapshot.total_size,
        createdAt: snapshot.created_at,
        r2Path: snapshot.r2_path,
      },
    });
  } catch (error) {
    console.error("[SaveInternal] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to save project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to determine content type based on file extension
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
    sass: "text/css",

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

    // Other
    pdf: "application/pdf",
    zip: "application/zip",
  };

  return contentTypes[extension || ""] || "application/octet-stream";
}
