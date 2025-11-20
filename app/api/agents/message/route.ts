/**
 * API Route: Send message to existing Claude CLI agent session
 *
 * POST /api/agents/message
 *
 * This endpoint sends a follow-up message to an existing CLI agent session.
 * The CLI resumes the conversation with full context from previous messages.
 *
 * Request body:
 * - sessionId: string - CLI session ID to resume (from /api/agents/create)
 * - prompt: string - Follow-up message to send to the agent
 * - sandboxId: string (optional) - E2B sandbox ID (required for resumption)
 * - workingDirectory: string (optional) - Working directory (default: /home/user/project)
 *
 * Response:
 * - sessionId: string - Session ID that was resumed
 * - sandboxId: string - E2B sandbox ID
 * - message: string - Status message
 *
 * Example use case:
 * 1. User creates session: "Build a todo app"
 * 2. CLI builds the app
 * 3. User sends follow-up: "Add dark mode"
 * 4. CLI modifies the app with full context
 *
 * Note: Events are streamed to Supabase agent_events table in real-time.
 * Frontend should subscribe to this table for live updates.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeClaudeInE2B } from "@/lib/agent/cli-executor";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Sandbox } from "e2b";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { sessionId, prompt, sandboxId, workingDirectory } =
      await request.json();

    if (!sessionId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, prompt" },
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

    const userId = userData.id;

    // Verify session exists and belongs to this user
    const { data: sessionData } = await supabaseAdmin
      .from("agent_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (!sessionData) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    if (sessionData.user_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Session does not belong to this user" },
        { status: 403 }
      );
    }

    console.log(`[API] Resuming CLI session: ${sessionId}`);
    console.log(`[API] User: ${userId}`);
    console.log(`[API] Prompt: ${prompt.substring(0, 100)}...`);

    const cwd = workingDirectory || sessionData.working_directory || "/home/user/project";

    // TODO: Reconnect to existing sandbox if sandboxId provided
    // For now, warn that sandbox reconnection is not implemented
    if (!sandboxId) {
      return NextResponse.json(
        {
          error:
            "Sandbox ID required for session resumption. Sandbox persistence not yet implemented.",
        },
        { status: 400 }
      );
    }

    // Get project ID and user ID from session data
    const { data: fullSessionData } = await supabaseAdmin
      .from("agent_sessions")
      .select("project_id, user_id")
      .eq("session_id", sessionId)
      .single();

    if (!fullSessionData) {
      return NextResponse.json(
        { error: "Session data not found" },
        { status: 404 }
      );
    }

    // Reconnect to existing sandbox
    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    console.log(`[API] ✓ Reconnected to sandbox: ${sandboxId}`);

    // Execute Claude in E2B with session resumption
    const { pid } = await executeClaudeInE2B(
      prompt,
      cwd,
      sessionId, // Resume existing session
      sandbox,
      fullSessionData.project_id,
      fullSessionData.user_id
    );

    console.log(`[API] ✓ Agent resumed in E2B (PID: ${pid})`);

    // Return immediately
    return NextResponse.json({
      message: "CLI session resuming...",
      sessionId,
      sandboxId,
      status: "processing",
      pid,
    });
  } catch (error) {
    console.error("[API] Error sending message to CLI agent:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send message to CLI agent",
      },
      { status: 500 }
    );
  }
}

