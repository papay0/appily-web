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
import { executeSetupInE2B, executeClaudeInE2B, executeGeminiInE2B } from "./cli-executor";
import { downloadImagesToSandbox, buildImageContext } from "./download-images-to-sandbox";

/**
 * Supported AI providers for agent execution
 */
export type AIProvider = 'claude' | 'gemini';

/**
 * Convex backend configuration for agent flows
 */
export interface ConvexConfig {
  /** The Convex deployment URL */
  deploymentUrl: string;
  /** The deploy key for `npx convex dev --once` */
  deployKey: string;
  /** Whether Convex is already initialized in the project */
  isInitialized?: boolean;
}

/**
 * AI API configuration for agent flows
 */
export interface AIConfig {
  /** The project UUID for rate limiting */
  projectId: string;
  /** The API base URL for AI endpoints (e.g., https://appily.dev) */
  apiBaseUrl: string;
}

/**
 * Options for new project flow
 */
export interface NewProjectFlowOptions {
  sandbox: Sandbox;
  projectId: string;
  userId: string;
  userPrompt: string;
  workingDir?: string;
  imageKeys?: string[];
  aiProvider?: AIProvider;
  /** Convex backend config (if enabled) */
  convex?: ConvexConfig;
  /** AI API config (for generated apps to use AI features) */
  ai?: AIConfig;
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
  imageKeys?: string[];
  aiProvider?: AIProvider;
  /** Convex backend config (if enabled) */
  convex?: ConvexConfig;
  /** AI API config (for generated apps to use AI features) */
  ai?: AIConfig;
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
  const { sandbox, projectId, userId, userPrompt, workingDir, imageKeys, aiProvider = 'claude', convex, ai } = options;

  console.log(`[FLOW] Starting NEW PROJECT flow for ${projectId}`);
  console.log(`[FLOW] AI Provider: ${aiProvider}`);
  console.log(`[FLOW] Sandbox: ${sandbox.sandboxId}`);
  console.log(`[FLOW] Images to download: ${imageKeys?.length || 0}`);
  console.log(`[FLOW] Convex enabled: ${!!convex}`);
  console.log(`[FLOW] AI API enabled: ${!!ai}`);

  // Download images to sandbox if provided
  let imageContext = "";
  if (imageKeys && imageKeys.length > 0) {
    const downloadResult = await downloadImagesToSandbox(sandbox, imageKeys);
    if (downloadResult.localPaths.length > 0) {
      imageContext = buildImageContext(downloadResult.localPaths);
      console.log(`[FLOW] ✓ Downloaded ${downloadResult.localPaths.length} images`);
    }
    if (downloadResult.errors.length > 0) {
      console.warn(`[FLOW] Image download errors:`, downloadResult.errors);
    }
  }

  // Build agent system prompt (no Expo URL yet - will be generated)
  const systemPrompt = buildExpoAgentPrompt({
    userTask: userPrompt + imageContext,
    workingDir: workingDir || "/home/user/project",
    aiProvider,
    // expoUrl: undefined - not available yet
    // Include Convex config if enabled
    convex: convex ? {
      deploymentUrl: convex.deploymentUrl,
      isInitialized: convex.isInitialized,
    } : undefined,
    // Include AI API config if enabled
    ai: ai ? {
      projectId: ai.projectId,
      apiBaseUrl: ai.apiBaseUrl,
    } : undefined,
  });

  console.log(`[FLOW] System prompt built (${systemPrompt.length} chars)`);

  // Start Expo setup in E2B background
  // This will clone template, install deps, start Expo, then run the appropriate agent
  const { pid, logFile } = await executeSetupInE2B(
    sandbox,
    projectId,
    userId,
    systemPrompt, // Agent will start after setup completes
    aiProvider, // Pass AI provider so setup knows which agent to start
    convex ? { deploymentUrl: convex.deploymentUrl, deployKey: convex.deployKey } : undefined
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
    imageKeys,
    aiProvider = 'claude',
    convex,
    ai,
  } = options;

  console.log(`[FLOW] Starting EXISTING PROJECT flow for ${projectId}`);
  console.log(`[FLOW] AI Provider: ${aiProvider}`);
  console.log(`[FLOW] Sandbox: ${sandbox.sandboxId}`);
  console.log(`[FLOW] Session: ${sessionId || "(new)"}`);
  console.log(`[FLOW] Expo URL: ${expoUrl || "(not available)"}`);
  console.log(`[FLOW] Images to download: ${imageKeys?.length || 0}`);
  console.log(`[FLOW] Convex enabled: ${!!convex}`);
  console.log(`[FLOW] AI API enabled: ${!!ai}`);

  // Download images to sandbox if provided
  let imageContext = "";
  if (imageKeys && imageKeys.length > 0) {
    const downloadResult = await downloadImagesToSandbox(sandbox, imageKeys);
    if (downloadResult.localPaths.length > 0) {
      imageContext = buildImageContext(downloadResult.localPaths);
      console.log(`[FLOW] ✓ Downloaded ${downloadResult.localPaths.length} images`);
    }
    if (downloadResult.errors.length > 0) {
      console.warn(`[FLOW] Image download errors:`, downloadResult.errors);
    }
  }

  // Build agent system prompt (includes Expo URL if available)
  const systemPrompt = buildExpoAgentPrompt({
    userTask: userPrompt + imageContext,
    expoUrl: expoUrl || undefined,
    workingDir: workingDir || "/home/user/project",
    aiProvider,
    // Include Convex config if enabled
    convex: convex ? {
      deploymentUrl: convex.deploymentUrl,
      isInitialized: convex.isInitialized,
    } : undefined,
    // Include AI API config if enabled
    ai: ai ? {
      projectId: ai.projectId,
      apiBaseUrl: ai.apiBaseUrl,
    } : undefined,
  });

  console.log(`[FLOW] System prompt built (${systemPrompt.length} chars)`);

  // Start agent in E2B background based on AI provider
  // Expo is already running, so agent can start immediately
  let pid: number;
  let logFile: string;

  // Prepare Convex credentials for CLI executor
  const convexCredentials = convex ? { deploymentUrl: convex.deploymentUrl, deployKey: convex.deployKey } : undefined;

  if (aiProvider === 'gemini') {
    console.log(`[FLOW] Using Gemini CLI for agent execution`);
    const result = await executeGeminiInE2B(
      systemPrompt,
      workingDir || "/home/user/project",
      sessionId || undefined, // Use existing session_id for conversation continuity
      sandbox,
      projectId,
      userId,
      convexCredentials
    );
    pid = result.pid;
    logFile = result.logFile;
  } else {
    console.log(`[FLOW] Using Claude Code CLI for agent execution`);
    const result = await executeClaudeInE2B(
      systemPrompt,
      workingDir || "/home/user/project",
      sessionId || undefined, // Use existing session_id for conversation continuity
      sandbox,
      projectId,
      userId,
      convexCredentials
    );
    pid = result.pid;
    logFile = result.logFile;
  }

  console.log(`[FLOW] ✓ ${aiProvider === 'gemini' ? 'Gemini' : 'Claude'} agent started in E2B (PID: ${pid})`);
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
