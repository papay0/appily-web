/**
 * Claude CLI Executor for E2B Sandboxes
 *
 * This module executes the `claude -p` CLI inside E2B sandboxes using the
 * CLAUDE_CODE_OAUTH_TOKEN for authentication (your Claude Code subscription).
 *
 * Why CLI instead of SDK?
 * - ✅ Uses CLAUDE_CODE_OAUTH_TOKEN (free with your subscription)
 * - ✅ SDK doesn't support OAuth tokens (API keys only)
 * - ✅ CLI has excellent streaming via `--output-format stream-json`
 * - ✅ E2B has pre-built `anthropic-claude-code` template
 *
 * Architecture:
 * 1. Create E2B sandbox (or use existing)
 * 2. Run `claude -p "prompt" --output-format stream-json`
 * 3. Parse NDJSON streaming output in real-time
 * 4. Store tool uses and responses in Supabase
 * 5. Extract session ID for resumption
 *
 * @see https://docs.claude.com/en/docs/claude-cli
 */

import type { Sandbox } from "e2b";
import { createSandbox } from "../e2b";
import type { AgentStreamEvent } from "./types";
import { storeEventInSupabase } from "./ndjson-parser";

/**
 * Result from executing Claude CLI
 */
export interface CLIExecutionResult {
  success: boolean;
  sessionId?: string;
  output: string;
  events: AgentStreamEvent[];
  expoUrl?: string;
  error?: string;
  duration_ms: number;
}

/**
 * Execute Claude CLI with a prompt in E2B sandbox
 *
 * This function runs the `claude -p` command with streaming JSON output,
 * parses the events in real-time, and returns the complete execution result.
 *
 * The CLI streams NDJSON (newline-delimited JSON) where each line is an event:
 * - `{"type": "system", "subtype": "init", "session_id": "sess_xxx"}` - Session start
 * - `{"type": "assistant", "message": {"content": [...]}}` - Claude's response
 * - `{"type": "tool_use", "name": "Read", "input": {...}}` - Tool execution
 * - `{"type": "result", "subtype": "success", ...}` - Final result
 *
 * @param prompt - The user's prompt to Claude
 * @param workingDirectory - Directory where CLI runs (default: /home/user)
 * @param sessionId - Optional session ID to resume previous conversation
 * @param sandbox - Optional existing sandbox (creates new one if not provided)
 * @param projectId - Optional project ID for storing session in database
 * @param userId - Optional user ID for storing session in database
 * @returns Execution result with session ID, events, and output
 *
 * @example
 * ```typescript
 * const result = await executeClaudeCLI(
 *   "Clone the Expo template and start dev server",
 *   "/home/user/project"
 * );
 *
 * console.log("Session ID:", result.sessionId);
 * console.log("Expo URL:", result.expoUrl);
 *
 * // Later, resume the conversation
 * const followUp = await executeClaudeCLI(
 *   "Add dark mode toggle",
 *   "/home/user/project",
 *   result.sessionId
 * );
 * ```
 */
export async function executeClaudeCLI(
  prompt: string,
  workingDirectory: string = "/home/user",
  sessionId?: string,
  sandbox?: Sandbox,
  projectId?: string,
  userId?: string
): Promise<CLIExecutionResult> {
  const startTime = Date.now();
  const events: AgentStreamEvent[] = [];
  let capturedSessionId: string | undefined = sessionId;
  let fullOutput = "";

  console.log("[CLI] Starting Claude CLI execution");
  console.log(`[CLI] Working directory: ${workingDirectory}`);
  console.log(`[CLI] Prompt length: ${prompt.length} chars`);
  if (sessionId) {
    console.log(`[CLI] Resuming session: ${sessionId}`);
  }

  // Create sandbox if not provided
  const shouldCleanupSandbox = !sandbox;
  if (!sandbox) {
    console.log("[CLI] Creating new E2B sandbox...");
    const { sandbox: newSandbox } = await createSandbox();
    sandbox = newSandbox;
    console.log(`[CLI] ✓ Sandbox created: ${sandbox.sandboxId}`);
  }

  try {
    // Verify OAuth token is set
    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      throw new Error(
        "CLAUDE_CODE_OAUTH_TOKEN environment variable is not set. " +
          "Get your token from claude.com/account → API Keys → OAuth Token"
      );
    }

    // If resuming, validate session exists in database
    if (sessionId && projectId && userId) {
      console.log(`[CLI] Validating session: ${sessionId}`);
      const { supabaseAdmin } = await import("../supabase-admin");
      const { data: existingSession } = await supabaseAdmin
        .from("agent_sessions")
        .select("session_id")
        .eq("session_id", sessionId)
        .single();

      if (!existingSession) {
        throw new Error(
          `Session ${sessionId} not found in database. It may have expired or been deleted.`
        );
      }
      console.log(`[CLI] ✓ Session validated`);
    }

    // Create working directory if it doesn't exist
    console.log(`[CLI] Ensuring working directory exists: ${workingDirectory}`);
    await sandbox.commands.run(`mkdir -p "${workingDirectory}"`, {
      cwd: "/home/user",
    });
    console.log(`[CLI] ✓ Working directory ready`);

    // Build the CLI command using heredoc for safe multi-line prompts
    // Heredoc prevents all shell interpretation and handles special characters perfectly
    // IMPORTANT: Always use --dangerously-skip-permissions for YOLO mode (no permission prompts)
    const command = sessionId
      ? // Resume existing session WITH new prompt (YOLO mode)
        `claude -r "${sessionId}" -p "$(cat <<'PROMPT_EOF'\n${prompt}\nPROMPT_EOF\n)" --output-format stream-json --verbose --dangerously-skip-permissions`
      : // New session with prompt (YOLO mode)
        `claude -p "$(cat <<'PROMPT_EOF'\n${prompt}\nPROMPT_EOF\n)" --output-format stream-json --verbose --dangerously-skip-permissions`;

    console.log(`[CLI] Executing claude command (resuming: ${!!sessionId})`);

    // Execute CLI with streaming output
    const result = await sandbox.commands.run(command, {
      cwd: workingDirectory,
      envs: {
        CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
      },
      timeoutMs: 10 * 60 * 1000, // 10 minute timeout
      onStdout: (line) => {
        fullOutput += line + "\n";

        // Parse NDJSON line-by-line
        try {
          const event = JSON.parse(line);

          // Extract session ID from system init message
          if (event.type === "system" && event.subtype === "init") {
            capturedSessionId = event.session_id;
            console.log(`[CLI] ✓ Session initialized: ${capturedSessionId}`);

            // Store session in database IMMEDIATELY so events can be linked
            if (capturedSessionId && projectId && userId) {
              storeCliSession(capturedSessionId, projectId, userId).catch((err) => {
                console.error("[CLI] Failed to store session in database:", err);
              });
            }
          }

          // Log assistant messages (Claude's thinking/responses) - CLEAN format
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text") {
                const preview = block.text.length > 100 ? block.text.substring(0, 100) + "..." : block.text;
                console.log(`[CLI] 💬 ${preview}`);
              } else if (block.type === "tool_use") {
                console.log(`[CLI] 🔧 ${block.name}`);
              }
            }
          }

          // Log result messages cleanly
          if (event.type === "result") {
            console.log(`[CLI] ${event.subtype === "success" ? "✓" : "✗"} ${event.subtype}`);
          }

          // Store event for later processing
          events.push({
            type: "message",
            data: event,
            timestamp: new Date(),
          });

          // Store event in Supabase for real-time streaming to frontend
          if (capturedSessionId) {
            storeEventInSupabase(capturedSessionId, event, projectId).catch((err) => {
              console.error("[CLI] Failed to store event in Supabase:", err);
            });
          }
        } catch (e) {
          // Not JSON or parse error - could be non-JSON output
          // This is fine, just skip
        }
      },
      onStderr: (line) => {
        // Only log significant errors, not noise
        if (line.includes("error") || line.includes("Error") || line.includes("failed") || line.includes("ENOENT")) {
          console.error(`[CLI] ⚠️ ${line.substring(0, 200)}`);
        }
      },
    });

    const duration = Date.now() - startTime;

    console.log(`[CLI] ✓ Complete (${Math.round(duration / 1000)}s, ${events.length} events)`);
    if (result.stderr) {
      console.error(`[CLI] Errors: ${result.stderr}`);
    }

    // Extract Expo URL if present
    const expoUrl = extractExpoUrlFromOutput(fullOutput);
    if (expoUrl) {
      console.log(`[CLI] ✓ Found Expo URL: ${expoUrl}`);
    }

    if (result.exitCode !== 0) {
      console.error(`[CLI] ✗ Failed (exit code ${result.exitCode})`);
      if (result.stderr) {
        const errorPreview = result.stderr.substring(0, 500);
        console.error(`[CLI] Error: ${errorPreview}${result.stderr.length > 500 ? "..." : ""}`);
      }
    }

    return {
      success: result.exitCode === 0,
      sessionId: capturedSessionId,
      output: fullOutput,
      events,
      expoUrl,
      error: result.exitCode !== 0 ? `${result.stderr}\n${result.stdout}` : undefined,
      duration_ms: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CLI] ✗ Execution failed:", error);

    return {
      success: false,
      sessionId: capturedSessionId,
      output: fullOutput,
      events,
      error: error instanceof Error ? error.message : "Unknown error",
      duration_ms: duration,
    };
  } finally {
    // Cleanup sandbox if we created it
    if (shouldCleanupSandbox && sandbox) {
      console.log("[CLI] Cleaning up sandbox...");
      await sandbox.kill().catch((err) => {
        console.error("[CLI] Failed to cleanup sandbox:", err);
      });
    }
  }
}

/**
 * Execute Claude CLI for Expo project setup
 *
 * Specialized function for setting up Expo projects with the CLI.
 * Handles the complete flow:
 * 1. Clone Expo template
 * 2. Install dependencies (including @expo/ngrok)
 * 3. Start Expo with tunnel mode
 * 4. Extract and return Expo URL
 *
 * @param templateRepoUrl - GitHub URL of Expo template
 * @param projectId - Project ID for tracking
 * @param userId - User ID for Supabase
 * @returns Execution result with Expo URL and session ID
 *
 * @example
 * ```typescript
 * const result = await setupExpoWithCLI(
 *   "https://github.com/papay0/appily-expo-go-template",
 *   "proj_123",
 *   "user_456"
 * );
 *
 * const qrCode = await generateQRCode(result.expoUrl);
 * ```
 */
export async function setupExpoWithCLI(
  templateRepoUrl: string,
  projectId: string,
  userId: string
): Promise<CLIExecutionResult & { sandbox: Sandbox }> {
  console.log("[Expo CLI] Starting Expo setup with Claude CLI");
  console.log(`[Expo CLI] Template: ${templateRepoUrl}`);
  console.log(`[Expo CLI] Project: ${projectId}, User: ${userId}`);

  // Create sandbox
  const { sandbox, info } = await createSandbox();
  console.log(`[Expo CLI] ✓ Sandbox created: ${sandbox.sandboxId}`);

  // Get the E2B public hostname for port 8081 (where Expo Metro will run)
  const e2bHostname = await sandbox.getHost(8081);
  const expoUrl = `exp://${e2bHostname}`;
  console.log(`[Expo CLI] ✓ E2B tunnel URL for port 8081: ${expoUrl}`);

  const prompt = `You are setting up an Expo mobile app project. Please complete these steps:

**Step 1: Clone Template Repository**
- Clone ${templateRepoUrl} to /home/user/project
- Use: git clone ${templateRepoUrl} /home/user/project

**Step 2: Install Dependencies**
- Navigate to: cd /home/user/project
- Install project dependencies: npm install
- Install @expo/ngrok globally: npm install -g @expo/ngrok
  IMPORTANT: Use latest version (do NOT specify version number)

**Step 3: Start Expo with Tunnel Mode**
- Start Expo: npx expo start --tunnel
- Wait for Metro bundler to start (look for "Metro" or "Bundler" messages)
- IMPORTANT: You are running in an E2B sandbox
- DO NOT try to extract the URL from Expo output, ngrok, or any other source
- The Expo URL is provided by E2B's tunnel system

**Step 4: Report Status**
- When Metro is ready, report this EXACT Expo URL: ${expoUrl}
- This is the E2B tunnel URL for port 8081
- Users will scan this URL with Expo Go to connect to your app

IMPORTANT BUILD VALIDATION:
When making code changes to Expo apps in the future:
1. ALWAYS run "npx expo start --tunnel" after code changes to check for errors
2. If you see ANY errors (import errors, missing files, syntax errors):
   - Read the error message carefully
   - Fix ALL errors before considering the task complete
   - Re-run the build to verify the fix worked
3. Only mark tasks as complete when the build succeeds with NO errors

Never leave the app in a broken state. Always ensure imports are valid and files exist.

Please execute these steps and report back when complete.
**IMPORTANT:** When reporting the Expo URL, use EXACTLY: ${expoUrl}
This is the E2B tunnel URL - do not try to find a different URL.`;

  try {
    const result = await executeClaudeCLI(
      prompt,
      "/home/user/project",
      undefined,
      sandbox
    );

    // Store session in Supabase
    if (result.sessionId) {
      const { startAgentSession } = await import("./session");
      await storeCliSession(result.sessionId, projectId, userId);
    }

    // Use the E2B tunnel URL we already calculated (don't rely on extraction from output)
    // The agent was instructed to report this exact URL, but we don't need to extract it
    console.log(`[Expo CLI] ✓ Setup complete! Expo URL: ${expoUrl}`);

    return {
      ...result,
      expoUrl, // Use the E2B tunnel URL we got from sandbox.getHost(8081)
      sandbox,
    };
  } catch (error) {
    // Cleanup on failure
    await sandbox.kill().catch(() => {});
    throw error;
  }
}

/**
 * Store CLI session in Supabase
 *
 * Maps CLI session IDs to Supabase agent_sessions table for tracking.
 * This allows us to query sessions, check ownership, etc.
 */
export async function storeCliSession(
  sessionId: string,
  projectId: string,
  userId: string
): Promise<void> {
  const { supabaseAdmin } = await import("../supabase-admin");

  await supabaseAdmin.from("agent_sessions").insert({
    session_id: sessionId,
    project_id: projectId,
    user_id: userId,
    model: "claude-sonnet-4-5", // CLI uses latest by default
    permission_mode: "bypassPermissions", // --dangerously-skip-permissions
    working_directory: "/home/user/project",
    status: "active",
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  });

  console.log(`[CLI] ✓ Session stored in Supabase: ${sessionId}`);
}

/**
 * Extract Expo URL from CLI output
 *
 * Searches for exp:// URLs in multiple formats:
 * - exp://hostname:port (e.g., exp://192.168.1.1:8081)
 * - exp://subdomain-port.domain (e.g., exp://j8t16bo-anonymous-8081.exp.direct)
 */
function extractExpoUrlFromOutput(output: string): string | undefined {
  // Match exp:// followed by hostname (with hyphens, dots, and alphanumeric)
  // This handles both traditional exp://host:port and tunnel URLs like exp://abc-8081.exp.direct
  const match = output.match(/exp:\/\/[\w\-\.]+/);
  return match ? match[0] : undefined;
}

/**
 * Escape shell argument for safe CLI execution
 *
 * Prevents shell injection by escaping special characters.
 */
function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' (close quote, escaped quote, open quote)
  return arg.replace(/'/g, "'\\''");
}
