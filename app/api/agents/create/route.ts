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
import { executeSetupInE2B } from "@/lib/agent/cli-executor";
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
    const { prompt, projectId, workingDirectory, sandboxId, clientMessageId } =
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

    // Store user message in database (backend-only insert)
    try {
      await supabaseAdmin.from("agent_events").insert({
        session_id: null,
        project_id: projectId,
        event_type: "user",
        event_data: {
          type: "user",
          role: "user",
          content: prompt,
          timestamp: new Date().toISOString(),
          clientMessageId,
        },
      });
      console.log("[API] ✓ User message stored in database");
    } catch (error) {
      console.error("[API] Failed to store user message:", error);
      // Continue anyway - message already shown in UI via optimistic update
    }

    // Get or create E2B sandbox
    let sandbox: Sandbox;
    let createdSandbox = false;
    let expoUrl: string | null = null;
    let qrCode: string | null = null;
    let existingSessionId: string | null = null;

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
        // Get the E2B URL and session_id from existing project data
        const { data: projectData } = await supabaseAdmin
          .from("projects")
          .select("expo_url, qr_code, session_id")
          .eq("id", projectId)
          .single();

        if (projectData) {
          expoUrl = projectData.expo_url;
          qrCode = projectData.qr_code;
          existingSessionId = projectData.session_id;
          console.log(`[API] ✓ Using existing Expo URL: ${expoUrl}`);
          if (existingSessionId) {
            console.log(`[API] ✓ Found existing session_id for conversation resumption`);
          }
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

    // If this is a new sandbox, start Expo setup in E2B background
    if (createdSandbox) {
      console.log(`[API] Starting Expo setup in E2B (background)...`);

      // Store sandbox ID in database before starting setup
      await supabaseAdmin
        .from("projects")
        .update({
          e2b_sandbox_id: sandbox.sandboxId,
          e2b_sandbox_status: "starting",
          e2b_sandbox_created_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      // Build agent prompt for FEATURE IMPLEMENTATION
      const systemPrompt = `You are building a native mobile app using Expo.

The Expo template is already cloned and running at: /home/user/project
Metro bundler is already running on port 8081.

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

      // Execute setup script in E2B
      // This script will:
      // 1. Clone Expo template
      // 2. Install dependencies
      // 3. Start Expo Metro
      // 4. Generate QR code
      // 5. Post expo_url + qr_code to Supabase
      // 6. Start Claude agent with systemPrompt
      const { pid, logFile } = await executeSetupInE2B(
        sandbox,
        projectId,
        userId,
        systemPrompt // Agent will start after setup completes
      );

      console.log(`[API] ✓ Setup script started in E2B (PID: ${pid})`);
      console.log(`[API] ✓ Logs: ${logFile}`);
      console.log(`[API] Setup will continue in background, updates via Supabase`);

      // Return immediately - Expo URL will appear in Supabase when ready
      return NextResponse.json({
        message: "Setting up development environment...",
        projectId,
        sandboxId: sandbox.sandboxId,
        status: "starting",
        setupPid: pid,
        setupLogFile: logFile,
      });
    }

    // Sandbox already exists with Expo running
    // Start Claude agent to process the user's request
    console.log(`[API] Sandbox exists, starting Claude agent directly...`);

    const { executeClaudeInE2B } = await import("@/lib/agent/cli-executor");

    // Build agent prompt for FEATURE IMPLEMENTATION
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

    // Execute Claude in E2B with direct Supabase streaming
    const { pid, logFile } = await executeClaudeInE2B(
      systemPrompt,
      cwd,
      existingSessionId || undefined, // Use existing session_id for conversation resumption
      sandbox,
      projectId,
      userId
    );

    console.log(`[API] ✓ Agent started in E2B (PID: ${pid})`);
    console.log(`[API] ✓ Logs: ${logFile}`);

    return NextResponse.json({
      message: "Agent is processing your request...",
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
