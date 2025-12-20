import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listFiles, downloadFile } from "@/lib/r2-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import JSZip from "jszip";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    console.log(`[DownloadProject] Downloading project ${projectId} for user ${userId}`);

    // Get project from database
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("[DownloadProject] Project not found:", projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify ownership
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!userData || userData.id !== project.user_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get latest snapshot
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from("project_snapshots")
      .select("r2_path, version, file_count")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (snapshotError || !snapshot) {
      console.error("[DownloadProject] No snapshots found:", snapshotError);
      return NextResponse.json(
        { error: "No snapshots available. Save your project first." },
        { status: 404 }
      );
    }

    console.log(`[DownloadProject] Using snapshot v${snapshot.version} at ${snapshot.r2_path}`);

    // List all files in the snapshot
    const files = await listFiles(snapshot.r2_path);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files found in snapshot" },
        { status: 404 }
      );
    }

    console.log(`[DownloadProject] Found ${files.length} files to zip`);

    // Create zip in memory
    const zip = new JSZip();

    // Download and add each file to the zip
    await Promise.all(
      files.map(async (file) => {
        try {
          const content = await downloadFile(file.key);
          // Strip the R2 prefix to get relative path
          const relativePath = file.key.replace(snapshot.r2_path, "");
          zip.file(relativePath, content);
        } catch (error) {
          console.error(`[DownloadProject] Failed to download file: ${file.key}`, error);
        }
      })
    );

    // Generate the zip buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Sanitize filename for safe download
    const sanitizedName = project.name
      .replace(/[^a-zA-Z0-9-_\s]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 50) || "project";

    console.log(`[DownloadProject] Generated zip: ${sanitizedName}.zip (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizedName}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[DownloadProject] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to download project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
