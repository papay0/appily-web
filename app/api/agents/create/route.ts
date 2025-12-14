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
import { createSandbox } from "@/lib/e2b";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Sandbox } from "e2b";
import {
  handleNewProjectFlow,
  handleExistingProjectFlow,
  type AIProvider,
  type ConvexConfig,
  type AIConfig,
} from "@/lib/agent/flows";
import { createConvexProject, type ConvexProjectCredentials } from "@/lib/convex-api";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { prompt, projectId, workingDirectory, sandboxId, clientMessageId, displayMessage, imageKeys, imagePreviewUrls, aiProvider } =
      await request.json();

    // Validate and default AI provider
    const validatedAiProvider: AIProvider = aiProvider === 'gemini' ? 'gemini' : 'claude';

    if (!prompt || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, projectId" },
        { status: 400 }
      );
    }

    // Validate imageKeys if provided
    const validatedImageKeys: string[] = Array.isArray(imageKeys) ? imageKeys.filter((k: unknown) => typeof k === "string") : [];

    // Validate imagePreviewUrls if provided (for displaying in chat)
    const validatedImageUrls: string[] = Array.isArray(imagePreviewUrls) ? imagePreviewUrls.filter((u: unknown) => typeof u === "string") : [];

    // displayMessage is what gets stored in DB and shown in chat
    // prompt is what gets sent to Claude (may include enhanced context)
    const messageToStore = displayMessage || prompt;

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
    console.log(`[API] AI Provider: ${validatedAiProvider}`);
    console.log(`[API] User: ${userId}`);
    console.log(`[API] Working directory: ${cwd}`);
    console.log(`[API] User prompt length: ${prompt.length} chars`);
    console.log(`[API] Attached images: ${validatedImageKeys.length}`);

    // Store user message in database (backend-only insert)
    // Store displayMessage (short version) not the full enhanced prompt
    try {
      await supabaseAdmin.from("agent_events").insert({
        session_id: null,
        project_id: projectId,
        event_type: "user",
        event_data: {
          type: "user",
          role: "user",
          content: messageToStore,
          timestamp: new Date().toISOString(),
          clientMessageId,
          // Include image URLs for display in chat UI
          ...(validatedImageUrls.length > 0 && { imageUrls: validatedImageUrls }),
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

        // Extend sandbox timeout by 1 hour from now on every user message
        await sandbox.setTimeout(3600000);

        console.log(`[API] ✓ Reconnected to sandbox: ${sandboxId}`);
        createdSandbox = false;

        // Sandbox already exists, so Expo is already running
        // Get the E2B URL, session_id, and Convex config from existing project data
        const { data: projectData } = await supabaseAdmin
          .from("projects")
          .select("expo_url, qr_code, session_id, convex_project")
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

        // Clear old sandbox data (including QR code and Expo URL)
        await supabaseAdmin
          .from("projects")
          .update({
            e2b_sandbox_id: null,
            e2b_sandbox_status: "idle",
            e2b_sandbox_created_at: null,
            expo_url: null,
            qr_code: null,
          })
          .eq("id", projectId);

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

    // Route to appropriate flow based on sandbox state
    if (createdSandbox) {
      // NEW PROJECT FLOW: Setup Expo environment → Start agent
      console.log(`[API] Routing to NEW PROJECT flow`);

      // Store sandbox ID in database before starting setup
      await supabaseAdmin
        .from("projects")
        .update({
          e2b_sandbox_id: sandbox.sandboxId,
          e2b_sandbox_status: "starting",
          e2b_sandbox_created_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      // Auto-create Convex project for new projects
      let convexConfig: ConvexConfig | undefined;

      // Check if Convex credentials are configured
      const hasConvexCredentials = process.env.CONVEX_TEAM_ACCESS_TOKEN && process.env.CONVEX_TEAM_ID;

      if (hasConvexCredentials) {
        try {
          // Fetch project name and existing Convex config
          const { data: newProjectData } = await supabaseAdmin
            .from("projects")
            .select("name, convex_project")
            .eq("id", projectId)
            .single();

          const existingConvex = newProjectData?.convex_project as ConvexProjectCredentials | null;

          // Check if Convex project already exists
          if (existingConvex?.status === "connected" && existingConvex.deploymentUrl && existingConvex.deployKey) {
            console.log(`[API] ✓ Using existing Convex backend: ${existingConvex.deploymentUrl}`);
            convexConfig = {
              deploymentUrl: existingConvex.deploymentUrl,
              deployKey: existingConvex.deployKey,
              isInitialized: false,
            };
          } else {
            // Auto-create new Convex project
            console.log(`[API] 🔧 Auto-creating Convex backend for project...`);
            const projectName = newProjectData?.name || "Appily App";

            const convexResult = await createConvexProject(projectName);
            console.log(`[API] ✓ Convex project created: ${convexResult.deploymentName}`);

            // Store Convex credentials in database
            const credentials: ConvexProjectCredentials = {
              status: "connected",
              projectId: convexResult.projectId,
              deploymentUrl: convexResult.deploymentUrl,
              deploymentName: convexResult.deploymentName,
              deployKey: convexResult.deployKey,
            };

            await supabaseAdmin
              .from("projects")
              .update({
                convex_project: credentials,
                updated_at: new Date().toISOString(),
              })
              .eq("id", projectId);

            convexConfig = {
              deploymentUrl: convexResult.deploymentUrl,
              deployKey: convexResult.deployKey,
              isInitialized: false,
            };
            console.log(`[API] ✓ Convex credentials stored in database`);
          }
        } catch (convexError) {
          console.error(`[API] ⚠️ Failed to create Convex project:`, convexError);
          // Continue without Convex - don't fail the whole request
        }
      } else {
        console.log(`[API] ℹ️ Convex credentials not configured, skipping auto-creation`);
      }

      // Create AI config - always enabled for all projects
      const apiBaseUrl = process.env.API_URL || 'https://www.appily.dev';
      const aiConfig: AIConfig = {
        projectId: projectId,
        apiBaseUrl: apiBaseUrl,
      };

      return handleNewProjectFlow({
        sandbox,
        projectId,
        userId,
        userPrompt: prompt,
        workingDir: cwd,
        imageKeys: validatedImageKeys,
        aiProvider: validatedAiProvider,
        convex: convexConfig,
        ai: aiConfig,
      });
    }

    // EXISTING PROJECT FLOW: Start agent immediately
    console.log(`[API] Routing to EXISTING PROJECT flow`);

    // Extract Convex config from project data if available
    let convexConfig: ConvexConfig | undefined;
    const { data: existingProjectData } = await supabaseAdmin
      .from("projects")
      .select("convex_project")
      .eq("id", projectId)
      .single();

    const convexProject = existingProjectData?.convex_project as ConvexProjectCredentials | null;
    if (convexProject?.status === "connected" && convexProject.deploymentUrl && convexProject.deployKey) {
      convexConfig = {
        deploymentUrl: convexProject.deploymentUrl,
        deployKey: convexProject.deployKey,
        isInitialized: true, // Existing project, likely already deployed
      };
      console.log(`[API] ✓ Using existing Convex backend: ${convexProject.deploymentUrl}`);
    }

    // Create AI config - always enabled for all projects
    const apiBaseUrl = process.env.API_URL || 'https://www.appily.dev';
    const aiConfig: AIConfig = {
      projectId: projectId,
      apiBaseUrl: apiBaseUrl,
    };

    return handleExistingProjectFlow({
      sandbox,
      projectId,
      userId,
      userPrompt: prompt,
      expoUrl,
      sessionId: existingSessionId,
      qrCode,
      workingDir: cwd,
      imageKeys: validatedImageKeys,
      aiProvider: validatedAiProvider,
      convex: convexConfig,
      ai: aiConfig,
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
