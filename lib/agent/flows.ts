/**
 * Agent Execution Flows
 *
 * This file separates the two main agent execution paths:
 * 1. NEW PROJECT: Setup Expo environment → Start agent
 * 2. EXISTING PROJECT: Start agent immediately
 *
 * Why separate flows?
 * - Clear separation of concerns
 * - Easy to understand what happens when
 * - Each flow is self-contained and testable
 * - Reduces complexity in API route handlers
 */

import type { Sandbox } from "e2b";
import { NextResponse } from "next/server";
import { buildExpoAgentPrompt } from "./prompts";
import { executeSetupInE2B, executeClaudeInE2B } from "./cli-executor";

/**
 * Options for new project flow
 */
export interface NewProjectFlowOptions {
  sandbox: Sandbox;
  projectId: string;
  userId: string;
  userPrompt: string;
  workingDir?: string;
}

/**
 * Options for existing project flow
 */
export interface ExistingProjectFlowOptions {
  sandbox: Sandbox;
  projectId: string;
  userId: string;
  userPrompt: string;
  expoUrl?: string | null;
  sessionId?: string | null;
  qrCode?: string | null;
  workingDir?: string;
}

/**
 * Handle NEW PROJECT flow
 *
 * This flow is for first-time project creation. It:
 * 1. Builds the agent system prompt (without Expo URL yet)
 * 2. Starts the Expo setup script in E2B background
 * 3. Setup script will:
 *    - Clone Expo template
 *    - Install dependencies
 *    - Start Metro bundler
 *    - Generate QR code & Expo URL
 *    - Post to Supabase
 *    - Start Claude agent with the system prompt
 * 4. Returns immediately to user
 *
 * The setup continues running on E2B for up to 1 hour.
 * Progress updates flow through Supabase Realtime to the frontend.
 *
 * @param options - Configuration for the new project flow
 * @returns Next.js response with sandbox info
 */
export async function handleNewProjectFlow(
  options: NewProjectFlowOptions
): Promise<NextResponse> {
  const { sandbox, projectId, userId, userPrompt, workingDir } = options;

  console.log(`[FLOW] Starting NEW PROJECT flow for ${projectId}`);
  console.log(`[FLOW] Sandbox: ${sandbox.sandboxId}`);

  // Build agent system prompt (no Expo URL yet - will be generated)
  const systemPrompt = buildExpoAgentPrompt({
    userTask: userPrompt,
    workingDir: workingDir || "/home/user/project",
    // expoUrl: undefined - not available yet
  });

  console.log(`[FLOW] System prompt built (${systemPrompt.length} chars)`);

  // Start Expo setup in E2B background
  // This will clone template, install deps, start Expo, then run Claude
  const { pid, logFile } = await executeSetupInE2B(
    sandbox,
    projectId,
    userId,
    systemPrompt // Agent will start after setup completes
  );

  console.log(`[FLOW] ✓ Setup started in E2B (PID: ${pid})`);
  console.log(`[FLOW] ✓ Logs: ${logFile}`);
  console.log(`[FLOW] Setup will continue in background, updates via Supabase`);

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

/**
 * Handle EXISTING PROJECT flow
 *
 * This flow is for follow-up messages to an existing project. It:
 * 1. Builds the agent system prompt (includes Expo URL)
 * 2. Starts Claude agent directly (Expo already running)
 * 3. Agent processes the user's request
 * 4. Events stream to Supabase in real-time
 * 5. Returns immediately to user
 *
 * The agent continues running on E2B for up to 1 hour.
 * Progress updates flow through Supabase Realtime to the frontend.
 *
 * @param options - Configuration for the existing project flow
 * @returns Next.js response with agent info
 */
export async function handleExistingProjectFlow(
  options: ExistingProjectFlowOptions
): Promise<NextResponse> {
  const {
    sandbox,
    projectId,
    userId,
    userPrompt,
    expoUrl,
    sessionId,
    qrCode,
    workingDir,
  } = options;

  console.log(`[FLOW] Starting EXISTING PROJECT flow for ${projectId}`);
  console.log(`[FLOW] Sandbox: ${sandbox.sandboxId}`);
  console.log(`[FLOW] Session: ${sessionId || "(new)"}`);
  console.log(`[FLOW] Expo URL: ${expoUrl || "(not available)"}`);

  // Build agent system prompt (includes Expo URL if available)
  const systemPrompt = buildExpoAgentPrompt({
    userTask: userPrompt,
    expoUrl: expoUrl || undefined,
    workingDir: workingDir || "/home/user/project",
  });

  console.log(`[FLOW] System prompt built (${systemPrompt.length} chars)`);

  // Start Claude agent in E2B background
  // Expo is already running, so agent can start immediately
  const { pid, logFile } = await executeClaudeInE2B(
    systemPrompt,
    workingDir || "/home/user/project",
    sessionId || undefined, // Use existing session_id for conversation continuity
    sandbox,
    projectId,
    userId
  );

  console.log(`[FLOW] ✓ Agent started in E2B (PID: ${pid})`);
  console.log(`[FLOW] ✓ Logs: ${logFile}`);
  console.log(`[FLOW] Agent will continue in background, updates via Supabase`);

  return NextResponse.json({
    message: "Agent is processing your request...",
    projectId,
    sandboxId: sandbox.sandboxId,
    status: "processing",
    expoUrl,
    qrCode,
  });
}
