import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/convex/disconnect
 *
 * Disconnects a Convex project from an Appily project.
 * This removes the stored credentials but does NOT delete the Convex project.
 *
 * Request body:
 * - projectId: Appily project ID
 *
 * Response:
 * - success: boolean
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json() as { projectId: string };

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: projectId" },
        { status: 400 }
      );
    }

    // Verify the user owns this project
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get user's internal ID
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!user || project.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Clear Convex project credentials
    await supabaseAdmin
      .from("projects")
      .update({
        convex_project: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Convex project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect Convex project" },
      { status: 500 }
    );
  }
}
