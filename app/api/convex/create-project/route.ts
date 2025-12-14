import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createConvexProject, type ConvexProjectCredentials } from "@/lib/convex-api";

/**
 * POST /api/convex/create-project
 *
 * Creates a new Convex project and associates it with an Appily project.
 * Uses Team Access Token from environment variables (no user OAuth needed).
 *
 * Request body:
 * - projectId: Appily project ID to attach the Convex backend to
 * - projectName: Optional custom name for the Convex project
 *
 * Response:
 * - convexProject: The created Convex project credentials
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      projectId: string;
      projectName?: string;
    };

    const { projectId, projectName } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: projectId" },
        { status: 400 }
      );
    }

    // Verify the user owns this project
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, name, user_id")
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

    // Mark as connecting
    await supabaseAdmin
      .from("projects")
      .update({
        convex_project: {
          status: "connecting",
        } satisfies ConvexProjectCredentials,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    try {
      // Create the Convex project using Team Access Token
      const name = projectName || project.name || "Appily App";
      const convexProject = await createConvexProject(name);

      // Store credentials
      const credentials: ConvexProjectCredentials = {
        status: "connected",
        projectId: convexProject.projectId,
        deploymentUrl: convexProject.deploymentUrl,
        deploymentName: convexProject.deploymentName,
        deployKey: convexProject.deployKey,
      };

      await supabaseAdmin
        .from("projects")
        .update({
          convex_project: credentials,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      return NextResponse.json({
        convexProject: {
          projectId: convexProject.projectId,
          deploymentUrl: convexProject.deploymentUrl,
          deploymentName: convexProject.deploymentName,
        },
      });
    } catch (error) {
      // Store error state
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await supabaseAdmin
        .from("projects")
        .update({
          convex_project: {
            status: "failed",
            errorMessage,
          } satisfies ConvexProjectCredentials,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      throw error;
    }
  } catch (error) {
    console.error("Error creating Convex project:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Convex project",
      },
      { status: 500 }
    );
  }
}
