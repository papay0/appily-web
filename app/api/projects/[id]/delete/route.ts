import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteDirectory, deleteImageFile } from "@/lib/r2-client";
import { deleteConvexProject } from "@/lib/convex-api";

interface DeleteErrors {
  r2Primary?: string;
  r2Images?: string;
  convex?: string;
  database?: string;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const errors: DeleteErrors = {};

  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const projectId = params.id;

    console.log(`[DeleteProject] Deleting project ${projectId} for user ${userId}`);

    // Get project from database
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, convex_project, image_keys, bundle_url")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("[DeleteProject] Project not found:", projectError);
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

    const internalUserId = userData.id;

    // Step 1: Delete R2 project files (source code, snapshots)
    try {
      const r2Prefix = `projects/${internalUserId}/${projectId}/`;
      console.log(`[DeleteProject] Deleting R2 directory: ${r2Prefix}`);
      await deleteDirectory(r2Prefix);
      console.log("[DeleteProject] R2 project files deleted");
    } catch (error) {
      console.error("[DeleteProject] Failed to delete R2 project files:", error);
      errors.r2Primary = error instanceof Error ? error.message : "Unknown error";
    }

    // Step 2: Delete R2 images
    const imageKeys = project.image_keys as string[] | null;
    if (imageKeys && imageKeys.length > 0) {
      try {
        console.log(`[DeleteProject] Deleting ${imageKeys.length} images from R2`);
        await Promise.all(imageKeys.map((key) => deleteImageFile(key)));
        console.log("[DeleteProject] R2 images deleted");
      } catch (error) {
        console.error("[DeleteProject] Failed to delete R2 images:", error);
        errors.r2Images = error instanceof Error ? error.message : "Unknown error";
      }
    }

    // Step 3: Delete Convex project if exists
    const convexProject = project.convex_project as {
      status?: string;
      projectId?: number;
    } | null;

    if (convexProject?.projectId && convexProject.status === "connected") {
      try {
        console.log(`[DeleteProject] Deleting Convex project: ${convexProject.projectId}`);
        await deleteConvexProject(convexProject.projectId);
        console.log("[DeleteProject] Convex project deleted");
      } catch (error) {
        console.error("[DeleteProject] Failed to delete Convex project:", error);
        errors.convex = error instanceof Error ? error.message : "Unknown error";
      }
    }

    // Step 4: Delete agent_events (doesn't have CASCADE)
    try {
      console.log("[DeleteProject] Deleting agent_events...");
      await supabaseAdmin
        .from("agent_events")
        .delete()
        .eq("project_id", projectId);
      console.log("[DeleteProject] Agent events deleted");
    } catch (error) {
      console.error("[DeleteProject] Failed to delete agent_events:", error);
      // Continue anyway - try the main delete
    }

    // Step 5: Delete from Supabase (CASCADE handles other related tables)
    const { error: deleteError } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      console.error("[DeleteProject] Failed to delete from database:", deleteError);
      errors.database = deleteError.message;
      return NextResponse.json(
        {
          error: "Failed to delete project from database",
          details: deleteError.message,
          partialErrors: errors,
        },
        { status: 500 }
      );
    }

    console.log(`[DeleteProject] Project ${projectId} deleted successfully`);

    // Return success with any cleanup errors noted
    const hasErrors = Object.keys(errors).length > 0;
    return NextResponse.json({
      success: true,
      message: hasErrors
        ? "Project deleted with some cleanup warnings"
        : "Project deleted successfully",
      ...(hasErrors && { cleanupWarnings: errors }),
    });
  } catch (error) {
    console.error("[DeleteProject] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete project",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
