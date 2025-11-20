/**
 * API Route: Create new Claude CLI agent session
 *
 * POST /api/agents/create
 *
 * This endpoint starts a new agent session for a project using the Claude CLI.
 * The CLI runs autonomously in an E2B sandbox based on the provided prompt.
 *
 * Request body:
 * - prompt: string - Initial message to the agent
 * - projectId: string - Project ID this session belongs to
 * - workingDirectory: string (optional) - Working directory for agent (default: /home/user/project)
 * - sandboxId: string (optional) - Existing E2B sandbox ID to reuse
 *
 * Response:
 * - sessionId: string - Unique CLI session ID for resuming
 * - projectId: string - Project ID
 * - sandboxId: string - E2B sandbox ID
 * - message: string - Status message
 *
 * The CLI processes the request asynchronously and streams progress
 * to Supabase (agent_events table) for real-time frontend updates.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeClaudeCLI } from "@/lib/agent/cli-executor";
import { parseNDJSONLine, storeEventInSupabase } from "@/lib/agent/ndjson-parser";
import { createSandbox } from "@/lib/e2b";
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
    const { prompt, projectId, workingDirectory, sandboxId } =
      await request.json();

    if (!prompt || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, projectId" },
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
    const cwd = workingDirectory || "/home/user/project";

    console.log(`[API] Creating CLI agent session for project: ${projectId}`);
    console.log(`[API] User: ${userId}`);
    console.log(`[API] Working directory: ${cwd}`);
    console.log(`[API] User prompt length: ${prompt.length} chars`);

    // Get or create E2B sandbox
    let sandbox: Sandbox;
    let createdSandbox = false;
    let expoUrl: string | null = null;
    let qrCode: string | null = null;

    if (sandboxId) {
      // Reconnect to existing sandbox
      console.log(`[API] Reconnecting to existing sandbox: ${sandboxId}`);
      try {
        const { Sandbox: SandboxClass } = await import("e2b");
        sandbox = await SandboxClass.connect(sandboxId, {
          apiKey: process.env.E2B_API_KEY,
        });
        console.log(`[API] ✓ Reconnected to sandbox: ${sandboxId}`);
        createdSandbox = false;

        // Sandbox already exists, so Expo is already running
        // Get the E2B URL from existing project data
        const { data: projectData } = await supabaseAdmin
          .from("projects")
          .select("expo_url, qr_code")
          .eq("id", projectId)
          .single();

        if (projectData) {
          expoUrl = projectData.expo_url;
          qrCode = projectData.qr_code;
          console.log(`[API] ✓ Using existing Expo URL: ${expoUrl}`);
        }
      } catch (error) {
        console.error(`[API] Failed to reconnect to sandbox ${sandboxId}:`, error);
        console.log(`[API] Creating new sandbox instead...`);
        const { sandbox: newSandbox } = await createSandbox();
        sandbox = newSandbox;
        console.log(`[API] ✓ New sandbox ready: ${sandbox.sandboxId}`);
        createdSandbox = true;
      }
    } else {
      console.log(`[API] Creating new E2B sandbox...`);
      const { sandbox: newSandbox } = await createSandbox();
      sandbox = newSandbox;
      console.log(`[API] ✓ Sandbox ready: ${sandbox.sandboxId}`);
      createdSandbox = true;
    }

    // If this is a new sandbox, do server-side setup FIRST
    if (createdSandbox) {
      console.log(`[API] Setting up Expo project (server-side)...`);
      const { setupExpoProject } = await import("@/lib/e2b");
      const { generateQRCode } = await import("@/lib/qrcode");
      const { sendSystemMessage } = await import("@/lib/agent/system-messages");

      try {
        // Send progress messages to chat so user sees what's happening
        await sendSystemMessage(projectId, "🔧 Creating development environment...");
        await sendSystemMessage(projectId, "📦 Cloning Expo template repository...");

        // This does: clone → install → start Expo → return E2B URL
        // Takes ~30 seconds but happens server-side before agent starts
        expoUrl = await setupExpoProject(sandbox);
        console.log(`[API] ✓ Expo running! URL: ${expoUrl}`);

        await sendSystemMessage(projectId, "✓ Expo Metro bundler started");

        // Generate QR code immediately
        qrCode = await generateQRCode(expoUrl);
        console.log(`[API] ✓ QR code generated`);

        // Store in database IMMEDIATELY so user can scan
        await supabaseAdmin
          .from("projects")
          .update({
            expo_url: expoUrl,
            qr_code: qrCode,
            e2b_sandbox_id: sandbox.sandboxId,
            e2b_sandbox_status: "ready",
            e2b_sandbox_created_at: new Date().toISOString(),
          })
          .eq("id", projectId);

        console.log(`[API] ✓ Expo URL stored - user can scan QR now!`);

        await sendSystemMessage(
          projectId,
          "✓ Ready! Scan the QR code to preview your app on your phone.",
          { type: "success" }
        );
        await sendSystemMessage(projectId, "🤖 Starting AI agent to build your app...");
      } catch (error) {
        console.error(`[API] Failed to setup Expo:`, error);
        await sendSystemMessage(
          projectId,
          `✗ Setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          { type: "error" }
        );
        // Continue anyway - agent can try to recover
      }
    }

    // Build agent prompt for FEATURE IMPLEMENTATION ONLY
    // Expo is already running, so agent just needs to edit code
    const systemPrompt = `You are building a native mobile app using Expo.

The Expo template is already cloned and running at: /home/user/project
Metro bundler is already running on port 8081.

${expoUrl ? `The Expo URL is: ${expoUrl}` : ""}

**Your task:**
${prompt}

**CRITICAL RULES:**
- The project is at /home/user/project
- Expo/Metro is ALREADY RUNNING on port 8081 - NEVER restart it
- Just edit the code files - Metro will hot-reload automatically
- NEVER run "npx expo start" or kill processes on port 8081/8082
- NEVER run "npm install" unless you're adding new packages
- Modify existing template files following Expo Router patterns
- Test your changes by checking Metro bundler output for errors

Focus ONLY on implementing the user's request. Expo is already set up.`;

    console.log(`[API] Starting agent for feature implementation...`);

    // Execute CLI in background
    // Don't await - return immediately and process asynchronously
    executeCLIInBackground(
      sandbox,
      systemPrompt,
      cwd,
      projectId,
      userId,
      false, // Don't cleanup - sandbox is used for Metro
      expoUrl
    );

    // Return immediately with Expo URL so user can scan
    return NextResponse.json({
      message: expoUrl
        ? "Expo is ready! Scan the QR code while the agent builds your app."
        : "Agent is starting...",
      projectId,
      sandboxId: sandbox.sandboxId,
      status: "processing",
      expoUrl,
      qrCode,
    });
  } catch (error) {
    console.error("[API] Error creating CLI agent session:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create CLI agent session",
      },
      { status: 500 }
    );
  }
}

/**
 * Execute Claude CLI in the background
 *
 * This function runs asynchronously and processes the CLI execution.
 * It streams events to Supabase for real-time frontend updates.
 *
 * Features:
 * - Real-time event streaming to agent_events table
 * - Automatic session tracking in agent_sessions table
 * - Sandbox cleanup on completion
 * - Error handling and recovery
 */
async function executeCLIInBackground(
  sandbox: Sandbox,
  prompt: string,
  workingDirectory: string,
  projectId: string,
  userId: string,
  shouldCleanupSandbox: boolean,
  existingExpoUrl?: string | null
) {
  try {
    console.log(`[Background] Executing Claude CLI in sandbox: ${sandbox.sandboxId}`);

    // Execute CLI with streaming
    // Session will be stored automatically when session ID is received
    const result = await executeClaudeCLI(
      prompt,
      workingDirectory,
      undefined, // No session ID for new sessions
      sandbox,
      projectId,
      userId
    );

    console.log(`[Background] ✓ CLI execution ${result.success ? "succeeded" : "failed"}`);
    console.log(`[Background] Session ID: ${result.sessionId}`);
    console.log(`[Background] Duration: ${Math.round(result.duration_ms / 1000)}s`);

    // Session and events are automatically stored in Supabase via:
    // 1. storeCliSession() when session ID is first received
    // 2. storeEventInSupabase() for each event in real-time

    // Expo URL should already be stored from server-side setup
    // But if the agent somehow found a different URL, log it
    if (result.expoUrl && result.expoUrl !== existingExpoUrl) {
      console.log(`[Background] ⚠️ Agent found different Expo URL: ${result.expoUrl}`);
      console.log(`[Background] Expected URL: ${existingExpoUrl}`);
      console.log(`[Background] This shouldn't happen - using server-provided URL`);
    }

    if (!result.success) {
      console.error(`[Background] CLI error: ${result.error}`);
    }
  } catch (error) {
    console.error(`[Background] Fatal error executing CLI:`, error);
  } finally {
    // DON'T cleanup sandbox! Keep it alive for:
    // 1. Metro dev server running in background
    // 2. User can send follow-up messages
    // 3. E2B will auto-terminate after 1 hour timeout
    console.log(`[Background] ✓ Sandbox kept alive (${sandbox.sandboxId})`);
    console.log(`[Background] E2B will auto-terminate after timeout`);

    // Sandbox ID is already stored from server-side setup,
    // but update status to show agent is done
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_status: "ready",
      })
      .eq("id", projectId);
    console.log(`[Background] ✓ Agent finished, sandbox still ready`);
  }
}
