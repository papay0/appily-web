import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    console.log(`[GetVersions] Fetching versions for project ${projectId}`);

    // Get project and verify ownership
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
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

    // Get all snapshots for this project
    const { data: snapshots, error: snapshotsError } = await supabaseAdmin
      .from("project_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false });

    if (snapshotsError) {
      console.error("[GetVersions] Error fetching snapshots:", snapshotsError);
      return NextResponse.json(
        { error: "Failed to fetch versions" },
        { status: 500 }
      );
    }

    console.log(`[GetVersions] Found ${snapshots?.length || 0} versions`);

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
      },
      versions: (snapshots || []).map((snapshot) => ({
        id: snapshot.id,
        version: snapshot.version,
        description: snapshot.description,
        fileCount: snapshot.file_count,
        totalSize: snapshot.total_size,
        createdAt: snapshot.created_at,
        r2Path: snapshot.r2_path,
      })),
    });
  } catch (error) {
    console.error("[GetVersions] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch versions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
