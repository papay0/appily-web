/**
 * API Route: Stop a running Claude/Gemini agent
 *
 * POST /api/agents/stop
 *
 * This endpoint stops a running agent by sending SIGTERM to the process.
 * Similar to pressing ESC in the Claude Code terminal.
 *
 * Request body:
 * - projectId: string - Project ID whose agent should be stopped
 *
 * Response:
 * - success: boolean
 * - message: string - Status message
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "@e2b/code-interpreter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: projectId" },
        { status: 400 }
      );
    }

    // Get Supabase user ID from Clerk ID
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get project and verify ownership
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, agent_pid, e2b_sandbox_id, session_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.user_id !== userData.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if there's an agent running
    if (!project.agent_pid) {
      return NextResponse.json(
        { error: "No agent is currently running for this project" },
        { status: 400 }
      );
    }

    if (!project.e2b_sandbox_id) {
      // Agent PID exists but no sandbox - clear the stale PID
      await supabaseAdmin
        .from("projects")
        .update({ agent_pid: null })
        .eq("id", projectId);

      return NextResponse.json(
        { error: "No active sandbox found. Stale PID cleared." },
        { status: 400 }
      );
    }

    // Connect to the sandbox
    let sandbox: Sandbox;
    try {
      sandbox = await Sandbox.connect(project.e2b_sandbox_id, {
        apiKey: process.env.E2B_API_KEY,
      });
    } catch (connectError) {
      console.error("[Stop] Failed to connect to sandbox:", connectError);
      // Clear the stale data
      await supabaseAdmin
        .from("projects")
        .update({ agent_pid: null, e2b_sandbox_id: null })
        .eq("id", projectId);

      return NextResponse.json(
        { error: "Sandbox no longer available. Stale data cleared." },
        { status: 400 }
      );
    }

    // Send SIGTERM to the agent process
    try {
      console.log(`[Stop] Sending SIGTERM to PID ${project.agent_pid}`);
      const killResult = await sandbox.commands.run(
        `kill -TERM ${project.agent_pid} 2>/dev/null || echo "Process not found"`,
        { timeoutMs: 5000 }
      );
      console.log(`[Stop] Kill result: ${killResult.stdout}`);
    } catch (killError) {
      console.error("[Stop] Error sending SIGTERM:", killError);
      // Continue anyway - the process might have already exited
    }

    // Insert a "cancelled" result event so the frontend knows the task was stopped
    const { error: eventError } = await supabaseAdmin
      .from("agent_events")
      .insert({
        session_id: project.session_id,
        project_id: projectId,
        event_type: "result",
        event_data: {
          type: "result",
          subtype: "cancelled",
          source: "user-stop",
          message: "Task cancelled by user",
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

    if (eventError) {
      console.error("[Stop] Failed to insert cancelled event:", eventError);
      // Continue anyway - the main goal is to stop the process
    }

    // Clear the agent_pid from the project
    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({ agent_pid: null })
      .eq("id", projectId);

    if (updateError) {
      console.error("[Stop] Failed to clear agent_pid:", updateError);
    }

    console.log(`[Stop] Successfully stopped agent for project ${projectId}`);

    return NextResponse.json({
      success: true,
      message: "Agent stopped successfully",
    });
  } catch (error) {
    console.error("[Stop] Error stopping agent:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to stop agent",
      },
      { status: 500 }
    );
  }
}
