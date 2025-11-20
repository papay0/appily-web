/**
 * Claude CLI execution inside E2B sandboxes
 *
 * This module integrates the Claude CLI (`claude -p`) with E2B sandboxes,
 * allowing agents to work within isolated containerized environments.
 *
 * Architecture: Claude CLI runs inside E2B sandbox (NOT on Next.js server)
 * - Uses CLAUDE_CODE_OAUTH_TOKEN (free with Claude Code subscription)
 * - Claude CLI has full access to sandbox filesystem via built-in tools
 * - Real-time streaming via `--output-format stream-json` (NDJSON)
 * - Session resumption via `claude -r SESSION_ID`
 * - Supports iterative conversations and error recovery
 *
 * Why CLI instead of SDK?
 * - ✅ CLI supports CLAUDE_CODE_OAUTH_TOKEN (cost-free)
 * - ✅ SDK requires ANTHROPIC_API_KEY (pay-per-call)
 * - ✅ CLI has excellent streaming output
 * - ✅ E2B has pre-built `anthropic-claude-code` template
 * - ✅ Migration path to SDK exists when we need API keys for scaling
 *
 * Educational notes:
 * - The CLI runs INSIDE the E2B sandbox (not on server)
 * - Agent has direct filesystem access through CLI tools
 * - We parse NDJSON output to track progress in real-time
 * - Events are stored in Supabase for frontend streaming
 *
 * @see https://docs.claude.com/en/docs/claude-cli
 */

import type { Sandbox } from "e2b";
import { createSandbox, type SandboxInfo } from "../e2b";
import {
  executeClaudeCLI,
  setupExpoWithCLI,
  type CLIExecutionResult,
} from "../agent/cli-executor";
import { extractExpoUrl, parseNDJSONOutput } from "../agent/ndjson-parser";

/**
 * Setup Expo project using Claude CLI
 *
 * This function orchestrates the complete Expo setup flow:
 * 1. Create E2B sandbox (isolated environment)
 * 2. Execute Claude CLI with Expo setup prompt
 * 3. CLI autonomously: clones repo, installs deps, starts Expo tunnel
 * 4. Parse CLI output to extract Expo URL
 * 5. Store session in Supabase for future resumption
 *
 * The CLI does all the heavy lifting autonomously. We just provide the
 * initial prompt and parse the streaming output.
 *
 * @param templateRepoUrl - GitHub URL of Expo template (default: official Appily template)
 * @param projectId - Project ID for session tracking
 * @param userId - User ID for Supabase RLS
 * @returns Object containing sandbox, info, Expo URL, and CLI session ID
 *
 * @throws Error if sandbox creation, CLI execution, or Expo startup fails
 *
 * @example
 * ```typescript
 * const result = await setupExpoWithCLI(
 *   "https://github.com/papay0/appily-expo-go-template",
 *   "proj_abc123",
 *   "user_456"
 * );
 *
 * console.log("Scan this QR:", await generateQRCode(result.expoUrl));
 * console.log("CLI session:", result.sessionId);
 *
 * // Later, send follow-up to the same session
 * const followUp = await modifyExpoApp(result.sessionId, "Add dark mode");
 * ```
 */
export async function setupExpoWithAgent(
  templateRepoUrl: string = "https://github.com/papay0/appily-expo-go-template",
  projectId: string,
  userId: string
): Promise<{
  sandbox: Sandbox;
  info: SandboxInfo;
  expoUrl: string;
  sessionId: string;
}> {
  console.log("[E2B CLI] Starting Expo setup with Claude CLI");
  console.log(`[E2B CLI] Template: ${templateRepoUrl}`);
  console.log(`[E2B CLI] Project ID: ${projectId}`);
  console.log(`[E2B CLI] User ID: ${userId}`);

  // Step 1: Create E2B sandbox
  console.log("[E2B CLI] Step 1/2: Creating E2B sandbox...");
  const { sandbox, info } = await createSandbox();
  console.log(`[E2B CLI] ✓ Sandbox created: ${sandbox.sandboxId}`);

  try {
    // Step 2: Execute Claude CLI with Expo setup
    // Uses setupExpoWithCLI from cli-executor.ts
    console.log("[E2B CLI] Step 2/2: Executing Claude CLI for Expo setup...");
    console.log("[E2B CLI] This may take 2-3 minutes...");

    const result = await setupExpoWithCLI(
      templateRepoUrl,
      projectId,
      userId
    );

    if (!result.success) {
      throw new Error(result.error || "CLI execution failed");
    }

    if (!result.sessionId) {
      throw new Error("CLI execution succeeded but no session ID was captured");
    }

    if (!result.expoUrl) {
      throw new Error("CLI execution succeeded but no Expo URL was found");
    }

    console.log(`[E2B CLI] ✓ Expo setup complete!`);
    console.log(`[E2B CLI] Expo URL: ${result.expoUrl}`);
    console.log(`[E2B CLI] Sandbox: ${sandbox.sandboxId}`);
    console.log(`[E2B CLI] Session: ${result.sessionId}`);
    console.log(`[E2B CLI] Duration: ${Math.round(result.duration_ms / 1000)}s`);

    return {
      sandbox: result.sandbox,
      info,
      expoUrl: result.expoUrl,
      sessionId: result.sessionId,
    };
  } catch (error) {
    // If anything fails, clean up the sandbox
    console.error("[E2B CLI] ✗ Setup failed:", error);
    console.log("[E2B CLI] Cleaning up sandbox...");

    try {
      await sandbox.kill();
      console.log("[E2B CLI] ✓ Sandbox cleaned up");
    } catch (cleanupError) {
      console.error("[E2B CLI] Failed to cleanup sandbox:", cleanupError);
    }

    // Re-throw the original error
    throw new Error(
      `Expo setup failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Send a follow-up message to modify the Expo app
 *
 * Use this after setupExpoWithAgent to make changes to the app.
 * The CLI will remember the context from the previous session.
 *
 * @param sessionId - CLI session ID from setupExpoWithAgent
 * @param userRequest - What the user wants to add/change
 * @param sandbox - Optional E2B sandbox (uses existing if provided)
 * @returns CLI execution result
 *
 * @example
 * ```typescript
 * // After initial setup
 * const result = await setupExpoWithAgent(...);
 *
 * // User wants to add a feature
 * const response = await modifyExpoApp(
 *   result.sessionId,
 *   "Add a dark mode toggle to the settings screen",
 *   result.sandbox
 * );
 *
 * console.log("CLI response:", response);
 * ```
 */
export async function modifyExpoApp(
  sessionId: string,
  userRequest: string,
  sandbox?: Sandbox
): Promise<CLIExecutionResult> {
  console.log(`[E2B CLI] Modifying app in session: ${sessionId}`);
  console.log(`[E2B CLI] User request: ${userRequest}`);

  // Execute CLI with session resumption
  const result = await executeClaudeCLI(
    userRequest,
    "/home/user/project",
    sessionId,
    sandbox
  );

  if (!result.success) {
    throw new Error(result.error || "CLI execution failed");
  }

  console.log(`[E2B CLI] ✓ Modification complete`);
  console.log(`[E2B CLI] Duration: ${Math.round(result.duration_ms / 1000)}s`);

  return result;
}

