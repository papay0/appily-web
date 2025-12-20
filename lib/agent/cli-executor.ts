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
import type { AgentStreamEvent } from "./types";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Convex credentials for E2B sandbox
 */
export interface ConvexCredentials {
  /** The Convex deployment URL (e.g., "https://cheerful-elephant-123.convex.cloud") */
  deploymentUrl: string;
  /** The deploy key for deploying functions via `npx convex dev --once` */
  deployKey: string;
}

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
 * Result from executing Claude in E2B (new approach)
 */
export interface E2BExecutionResult {
  pid: number;
  sandboxId: string;
  scriptPath: string;
  logFile: string;
}

/**
 * Execute Claude CLI in E2B with direct Supabase streaming
 *
 * **NEW APPROACH:** This function uploads a Node.js script to E2B that runs
 * independently and posts events directly to Supabase. Vercel can return
 * immediately without waiting for completion.
 *
 * Architecture:
 * 1. Read stream-to-supabase.js from filesystem
 * 2. Upload script to E2B sandbox
 * 3. Install @supabase/supabase-js (if not in template)
 * 4. Run script with background: true
 * 5. Return immediately with PID
 * 6. Script continues running on E2B for up to 1 hour
 * 7. Events posted directly to Supabase
 * 8. Frontend receives updates via realtime subscriptions
 *
 * @param prompt - The user's prompt to Claude
 * @param workingDirectory - Directory where Claude runs
 * @param sessionId - Optional session ID to resume conversation
 * @param sandbox - Existing E2B sandbox
 * @param projectId - Project ID for linking events
 * @param userId - User ID for session tracking
 * @param convex - Optional Convex credentials for backend
 * @returns Execution result with PID and sandbox ID
 */
export async function executeClaudeInE2B(
  prompt: string,
  workingDirectory: string,
  sessionId: string | undefined,
  sandbox: Sandbox,
  projectId: string,
  userId: string,
  convex?: ConvexCredentials
): Promise<E2BExecutionResult> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  console.log("[E2B] Starting Claude execution with direct Supabase streaming");
  console.log(`[E2B] Project: ${projectId}, User: ${userId}`);
  console.log(`[E2B] Session: ${sessionId || '(new)'}`);
  console.log(`[E2B] Sandbox: ${sandbox.sandboxId}`);

  try {
    // Step 1: Read the script file from filesystem
    const scriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/stream-to-supabase.js');
    console.log(`[E2B] Reading script from: ${scriptPath}`);
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    console.log(`[E2B] ✓ Script loaded (${scriptContent.length} bytes)`);

    // Step 2: Upload script to E2B
    const e2bScriptPath = '/home/user/stream-to-supabase.js';
    console.log(`[E2B] Uploading script to E2B: ${e2bScriptPath}`);
    await sandbox.files.write(e2bScriptPath, scriptContent);
    console.log(`[E2B] ✓ Script uploaded`);

    // Step 2.1: Upload save-to-r2.js module (for direct E2B saves)
    const saveScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/save-to-r2.js');
    console.log(`[E2B] Reading save-to-r2 module from: ${saveScriptPath}`);
    const saveScriptContent = readFileSync(saveScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/save-to-r2.js', saveScriptContent);
    console.log(`[E2B] ✓ Save-to-R2 module uploaded`);

    // Step 2.2: Upload e2b-logger.js module (for operational logging to Supabase)
    const loggerScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/e2b-logger.js');
    console.log(`[E2B] Reading e2b-logger module from: ${loggerScriptPath}`);
    const loggerScriptContent = readFileSync(loggerScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/e2b-logger.js', loggerScriptContent);
    console.log(`[E2B] ✓ E2B-Logger module uploaded`);

    // Step 2.3: Upload metro-control.js module (for hot reload after task completion)
    const metroControlPath = join(process.cwd(), 'lib/agent/e2b-scripts/metro-control.js');
    console.log(`[E2B] Reading metro-control module from: ${metroControlPath}`);
    const metroControlContent = readFileSync(metroControlPath, 'utf-8');
    await sandbox.files.write('/home/user/metro-control.js', metroControlContent);
    console.log(`[E2B] ✓ Metro-control module uploaded`);

    // Step 3: Install dependencies if not already installed
    console.log(`[E2B] Installing dependencies (@supabase/supabase-js, @aws-sdk/client-s3)...`);
    const installResult = await sandbox.commands.run(
      'npm list @supabase/supabase-js @aws-sdk/client-s3 || npm install @supabase/supabase-js @aws-sdk/client-s3',
      {
        cwd: '/home/user',
        timeoutMs: 120000, // 2 minute timeout for npm install
      }
    );

    if (installResult.exitCode !== 0) {
      console.warn(`[E2B] ⚠️ npm install warning: ${installResult.stderr}`);
      // Continue anyway - might already be installed
    } else {
      console.log(`[E2B] ✓ Dependencies ready`);
    }

    // Step 4: Prepare environment variables
    const envVars: Record<string, string> = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN!,
      PROJECT_ID: projectId,
      USER_ID: userId,
      USER_PROMPT: prompt,
      WORKING_DIRECTORY: workingDirectory,
      // R2 credentials for direct E2B saves
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME!,
      // R2 images bucket for bundle export (public bucket)
      R2_IMAGES_BUCKET_NAME: process.env.R2_IMAGES_BUCKET_NAME!,
      R2_IMAGES_PUBLIC_URL: process.env.R2_IMAGES_PUBLIC_URL!,
    };

    // Add SESSION_ID only if resuming
    if (sessionId) {
      envVars.SESSION_ID = sessionId;
    }

    // Add Convex credentials if provided
    if (convex) {
      console.log(`[E2B] Adding Convex credentials for ${convex.deploymentUrl}`);
      envVars.CONVEX_DEPLOY_KEY = convex.deployKey;
      envVars.EXPO_PUBLIC_CONVEX_URL = convex.deploymentUrl;

      // Upload Convex rules file for Claude to read
      const convexRulesPath = join(process.cwd(), 'lib/agent/e2b-scripts/convex_rules.txt');
      console.log(`[E2B] Reading Convex rules from: ${convexRulesPath}`);
      const convexRulesContent = readFileSync(convexRulesPath, 'utf-8');
      await sandbox.files.write(`${workingDirectory}/convex_rules.txt`, convexRulesContent);
      console.log(`[E2B] ✓ Convex rules uploaded to ${workingDirectory}/convex_rules.txt`);
    }

    console.log(`[E2B] Environment variables prepared`);

    // Step 5: Run script in background with output redirection for debugging
    const logFile = '/home/user/claude-agent.log';
    console.log(`[E2B] Starting script in background mode...`);
    console.log(`[E2B] Output will be logged to: ${logFile}`);

    // Start script with nohup for proper backgrounding and output capture
    const startResult = await sandbox.commands.run(
      `nohup node ${e2bScriptPath} > ${logFile} 2>&1 & echo $!`,
      {
        cwd: workingDirectory,
        envs: envVars,
        timeoutMs: 5000,
      }
    );

    const pid = parseInt(startResult.stdout.trim());
    if (!pid || isNaN(pid)) {
      throw new Error('Failed to start background process (no PID returned)');
    }

    console.log(`[E2B] ✓ Script started in background (PID: ${pid})`);
    console.log(`[E2B] ✓ Logs: ${logFile}`);
    console.log(`[E2B] Script will run independently on E2B and stream to Supabase`);

    // Store agent PID in database for stop functionality
    const { error: pidError } = await supabaseAdmin
      .from('projects')
      .update({ agent_pid: pid })
      .eq('id', projectId);

    if (pidError) {
      console.error('[E2B] Failed to store agent PID:', pidError.message);
      // Don't fail the execution, just log the error
    } else {
      console.log(`[E2B] ✓ Agent PID ${pid} stored in database`);
    }

    // Show initial output for debugging (non-blocking)
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`head -n 50 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] Initial output (first 50 lines):');
          console.log(logs.stdout);
        }
      } catch (err) {
        console.error('[E2B] Failed to read initial logs:', err);
      }
    }, 2000);

    // Show more output after 10 seconds to see if Claude is producing events
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`tail -n 30 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] Latest output (after 10s):');
          console.log(logs.stdout);
        }

        // Also check if process is still running
        const psResult = await sandbox.commands.run(`ps -p ${pid} -o pid,etime,cmd || echo "Process ${pid} not found"`, { timeoutMs: 3000 });
        console.log('[E2B] Process status:', psResult.stdout.trim());
      } catch (err) {
        console.error('[E2B] Failed to read latest logs:', err);
      }
    }, 10000);

    console.log(`[E2B] Vercel can now return immediately`);

    return {
      pid,
      sandboxId: sandbox.sandboxId,
      scriptPath: e2bScriptPath,
      logFile,
    };
  } catch (error) {
    console.error('[E2B] ✗ Failed to start Claude execution:', error);
    throw new Error(
      `Failed to execute Claude in E2B: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Execute Gemini CLI in E2B with direct Supabase streaming
 *
 * **GEMINI ALTERNATIVE:** This function is identical to executeClaudeInE2B but uses
 * Gemini CLI instead of Claude CLI for AI agent execution.
 *
 * Architecture:
 * 1. Read stream-to-supabase-gemini.js from filesystem
 * 2. Upload script to E2B sandbox
 * 3. Install @supabase/supabase-js (if not in template)
 * 4. Run script with background: true
 * 5. Return immediately with PID
 * 6. Script continues running on E2B for up to 1 hour
 * 7. Events posted directly to Supabase
 * 8. Frontend receives updates via realtime subscriptions
 *
 * @param prompt - The user's prompt to Gemini
 * @param workingDirectory - Directory where Gemini runs
 * @param sessionId - Optional session ID to resume conversation
 * @param sandbox - Existing E2B sandbox
 * @param projectId - Project ID for linking events
 * @param userId - User ID for session tracking
 * @param convex - Optional Convex credentials for backend
 * @returns Execution result with PID and sandbox ID
 */
export async function executeGeminiInE2B(
  prompt: string,
  workingDirectory: string,
  sessionId: string | undefined,
  sandbox: Sandbox,
  projectId: string,
  userId: string,
  convex?: ConvexCredentials
): Promise<E2BExecutionResult> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  console.log("[E2B] Starting Gemini execution with direct Supabase streaming");
  console.log(`[E2B] Project: ${projectId}, User: ${userId}`);
  console.log(`[E2B] Session: ${sessionId || '(new)'}`);
  console.log(`[E2B] Sandbox: ${sandbox.sandboxId}`);

  try {
    // Step 1: Read the Gemini script file from filesystem
    const scriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/stream-to-supabase-gemini.js');
    console.log(`[E2B] Reading Gemini script from: ${scriptPath}`);
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    console.log(`[E2B] Gemini script loaded (${scriptContent.length} bytes)`);

    // Step 2: Upload script to E2B
    const e2bScriptPath = '/home/user/stream-to-supabase-gemini.js';
    console.log(`[E2B] Uploading Gemini script to E2B: ${e2bScriptPath}`);
    await sandbox.files.write(e2bScriptPath, scriptContent);
    console.log(`[E2B] Gemini script uploaded`);

    // Step 2.1: Upload save-to-r2.js module (for direct E2B saves)
    const saveScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/save-to-r2.js');
    console.log(`[E2B] Reading save-to-r2 module from: ${saveScriptPath}`);
    const saveScriptContent = readFileSync(saveScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/save-to-r2.js', saveScriptContent);
    console.log(`[E2B] Save-to-R2 module uploaded`);

    // Step 2.2: Upload e2b-logger.js module (for operational logging to Supabase)
    const loggerScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/e2b-logger.js');
    console.log(`[E2B] Reading e2b-logger module from: ${loggerScriptPath}`);
    const loggerScriptContent = readFileSync(loggerScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/e2b-logger.js', loggerScriptContent);
    console.log(`[E2B] E2B-Logger module uploaded`);

    // Step 2.3: Upload metro-control.js module (for hot reload)
    const metroControlPath = join(process.cwd(), 'lib/agent/e2b-scripts/metro-control.js');
    console.log(`[E2B] Reading metro-control module from: ${metroControlPath}`);
    const metroControlContent = readFileSync(metroControlPath, 'utf-8');
    await sandbox.files.write('/home/user/metro-control.js', metroControlContent);
    console.log(`[E2B] Metro-control module uploaded`);

    // Step 3: Install dependencies if not already installed
    console.log(`[E2B] Installing dependencies (@supabase/supabase-js, @aws-sdk/client-s3)...`);
    const installResult = await sandbox.commands.run(
      'npm list @supabase/supabase-js @aws-sdk/client-s3 || npm install @supabase/supabase-js @aws-sdk/client-s3',
      {
        cwd: '/home/user',
        timeoutMs: 120000, // 2 minute timeout for npm install
      }
    );

    if (installResult.exitCode !== 0) {
      console.warn(`[E2B] npm install warning: ${installResult.stderr}`);
      // Continue anyway - might already be installed
    } else {
      console.log(`[E2B] Dependencies ready`);
    }

    // Step 4: Prepare environment variables
    // Vertex AI is preferred (more stable, higher quotas) - falls back to consumer API key
    const envVars: Record<string, string> = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      PROJECT_ID: projectId,
      USER_ID: userId,
      USER_PROMPT: prompt,
      WORKING_DIRECTORY: workingDirectory,
      // R2 credentials for direct E2B saves
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME!,
      // R2 images bucket for bundle export (public bucket)
      R2_IMAGES_BUCKET_NAME: process.env.R2_IMAGES_BUCKET_NAME!,
      R2_IMAGES_PUBLIC_URL: process.env.R2_IMAGES_PUBLIC_URL!,
    };

    // Vertex AI credentials (required for Gemini)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.GOOGLE_CLOUD_PROJECT) {
      console.log(`[E2B] Using Vertex AI authentication (project: ${process.env.GOOGLE_CLOUD_PROJECT})`);
      envVars.GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      envVars.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
      envVars.GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    } else {
      throw new Error('Missing Vertex AI credentials: Set GOOGLE_APPLICATION_CREDENTIALS_JSON and GOOGLE_CLOUD_PROJECT');
    }

    // Add SESSION_ID only if resuming
    if (sessionId) {
      envVars.SESSION_ID = sessionId;
    }

    // Add Convex credentials if provided
    if (convex) {
      console.log(`[E2B] Adding Convex credentials for ${convex.deploymentUrl}`);
      envVars.CONVEX_DEPLOY_KEY = convex.deployKey;
      envVars.EXPO_PUBLIC_CONVEX_URL = convex.deploymentUrl;

      // Upload Convex rules file for Gemini to read
      const convexRulesPath = join(process.cwd(), 'lib/agent/e2b-scripts/convex_rules.txt');
      console.log(`[E2B] Reading Convex rules from: ${convexRulesPath}`);
      const convexRulesContent = readFileSync(convexRulesPath, 'utf-8');
      await sandbox.files.write(`${workingDirectory}/convex_rules.txt`, convexRulesContent);
      console.log(`[E2B] ✓ Convex rules uploaded to ${workingDirectory}/convex_rules.txt`);
    }

    console.log(`[E2B] Environment variables prepared`);

    // Step 5: Run script in background with output redirection for debugging
    const logFile = '/home/user/gemini-agent.log';
    console.log(`[E2B] Starting Gemini script in background mode...`);
    console.log(`[E2B] Output will be logged to: ${logFile}`);

    // Start script with nohup for proper backgrounding and output capture
    const startResult = await sandbox.commands.run(
      `nohup node ${e2bScriptPath} > ${logFile} 2>&1 & echo $!`,
      {
        cwd: workingDirectory,
        envs: envVars,
        timeoutMs: 5000,
      }
    );

    const pid = parseInt(startResult.stdout.trim());
    if (!pid || isNaN(pid)) {
      throw new Error('Failed to start Gemini background process (no PID returned)');
    }

    console.log(`[E2B] Gemini script started in background (PID: ${pid})`);
    console.log(`[E2B] Logs: ${logFile}`);
    console.log(`[E2B] Script will run independently on E2B and stream to Supabase`);

    // Store agent PID in database for stop functionality
    const { error: pidError } = await supabaseAdmin
      .from('projects')
      .update({ agent_pid: pid })
      .eq('id', projectId);

    if (pidError) {
      console.error('[E2B] Failed to store Gemini agent PID:', pidError.message);
      // Don't fail the execution, just log the error
    } else {
      console.log(`[E2B] ✓ Gemini agent PID ${pid} stored in database`);
    }

    // Show initial output for debugging (non-blocking)
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`head -n 50 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] Gemini initial output (first 50 lines):');
          console.log(logs.stdout);
        }
      } catch (err) {
        console.error('[E2B] Failed to read Gemini initial logs:', err);
      }
    }, 2000);

    // Show more output after 10 seconds to see if Gemini is producing events
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`tail -n 30 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] Gemini latest output (after 10s):');
          console.log(logs.stdout);
        }

        // Also check if process is still running
        const psResult = await sandbox.commands.run(`ps -p ${pid} -o pid,etime,cmd || echo "Process ${pid} not found"`, { timeoutMs: 3000 });
        console.log('[E2B] Gemini process status:', psResult.stdout.trim());
      } catch (err) {
        console.error('[E2B] Failed to read Gemini latest logs:', err);
      }
    }, 10000);

    console.log(`[E2B] Vercel can now return immediately`);

    return {
      pid,
      sandboxId: sandbox.sandboxId,
      scriptPath: e2bScriptPath,
      logFile,
    };
  } catch (error) {
    console.error('[E2B] Failed to start Gemini execution:', error);
    throw new Error(
      `Failed to execute Gemini in E2B: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Execute Claude SDK in E2B with direct Supabase streaming
 *
 * **SDK APPROACH:** This function uses the Claude Agent SDK's query() function
 * instead of spawning the CLI directly. Benefits:
 * - Typed message responses (no NDJSON parsing)
 * - Built-in session resumption via `resume` option
 * - Built-in permission bypass via `permissionMode: 'bypassPermissions'`
 *
 * Architecture:
 * 1. Read stream-to-supabase-sdk.js from filesystem
 * 2. Upload script to E2B sandbox
 * 3. Install @anthropic-ai/claude-agent-sdk (if not in template)
 * 4. Run script with background: true
 * 5. Return immediately with PID
 * 6. Script uses SDK query() to execute agent
 * 7. Events posted directly to Supabase
 *
 * @param prompt - The user's prompt to Claude
 * @param workingDirectory - Directory where Claude runs
 * @param sessionId - Optional session ID to resume conversation
 * @param sandbox - Existing E2B sandbox
 * @param projectId - Project ID for linking events
 * @param userId - User ID for session tracking
 * @param convex - Optional Convex credentials for backend
 * @returns Execution result with PID and sandbox ID
 */
export async function executeClaudeSdkInE2B(
  systemPrompt: string,
  userMessage: string,
  workingDirectory: string,
  sessionId: string | undefined,
  sandbox: Sandbox,
  projectId: string,
  userId: string,
  convex?: ConvexCredentials
): Promise<E2BExecutionResult> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  console.log("[E2B] Starting Claude SDK execution with direct Supabase streaming");
  console.log(`[E2B] Project: ${projectId}, User: ${userId}`);
  console.log(`[E2B] Session: ${sessionId || '(new)'}`);
  console.log(`[E2B] Sandbox: ${sandbox.sandboxId}`);

  try {
    // Step 1: Read the SDK script file from filesystem
    const scriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/stream-to-supabase-sdk.js');
    console.log(`[E2B] Reading SDK script from: ${scriptPath}`);
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    console.log(`[E2B] ✓ SDK script loaded (${scriptContent.length} bytes)`);

    // Step 2: Upload script to E2B
    const e2bScriptPath = '/home/user/stream-to-supabase-sdk.js';
    console.log(`[E2B] Uploading SDK script to E2B: ${e2bScriptPath}`);
    await sandbox.files.write(e2bScriptPath, scriptContent);
    console.log(`[E2B] ✓ SDK script uploaded`);

    // Step 2.1: Upload supporting modules (same as CLI version)
    const saveScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/save-to-r2.js');
    console.log(`[E2B] Reading save-to-r2 module from: ${saveScriptPath}`);
    const saveScriptContent = readFileSync(saveScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/save-to-r2.js', saveScriptContent);
    console.log(`[E2B] ✓ Save-to-R2 module uploaded`);

    const loggerScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/e2b-logger.js');
    console.log(`[E2B] Reading e2b-logger module from: ${loggerScriptPath}`);
    const loggerScriptContent = readFileSync(loggerScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/e2b-logger.js', loggerScriptContent);
    console.log(`[E2B] ✓ E2B-Logger module uploaded`);

    const metroControlPath = join(process.cwd(), 'lib/agent/e2b-scripts/metro-control.js');
    console.log(`[E2B] Reading metro-control module from: ${metroControlPath}`);
    const metroControlContent = readFileSync(metroControlPath, 'utf-8');
    await sandbox.files.write('/home/user/metro-control.js', metroControlContent);
    console.log(`[E2B] ✓ Metro-control module uploaded`);

    // Step 3: Install dependencies (SDK should ideally be pre-installed in template)
    console.log(`[E2B] Installing dependencies (@supabase/supabase-js, @aws-sdk/client-s3, @anthropic-ai/claude-agent-sdk)...`);
    const installResult = await sandbox.commands.run(
      'npm list @supabase/supabase-js @aws-sdk/client-s3 @anthropic-ai/claude-agent-sdk 2>/dev/null || npm install @supabase/supabase-js @aws-sdk/client-s3 @anthropic-ai/claude-agent-sdk',
      {
        cwd: '/home/user',
        timeoutMs: 180000, // 3 minute timeout (SDK package is larger)
      }
    );

    if (installResult.exitCode !== 0) {
      console.warn(`[E2B] ⚠️ npm install warning: ${installResult.stderr}`);
      // Continue anyway - might already be installed
    } else {
      console.log(`[E2B] ✓ Dependencies ready`);
    }

    // Step 4: Prepare environment variables
    // IMPORTANT: We pass SYSTEM_PROMPT and USER_MESSAGE separately to optimize token usage
    // - On first request (no sessionId): SDK uses systemPrompt + prompt
    // - On follow-up (with sessionId): SDK uses resume option, only sends user message (~500 tokens vs 60K)
    const envVars: Record<string, string> = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!, // SDK requires API key
      PROJECT_ID: projectId,
      USER_ID: userId,
      SYSTEM_PROMPT: systemPrompt, // System instructions (~40K tokens, only needed for first request)
      USER_MESSAGE: userMessage,   // User's request (~500-2000 tokens)
      WORKING_DIRECTORY: workingDirectory,
      // R2 credentials for direct E2B saves
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME!,
      // R2 images bucket for bundle export (public bucket)
      R2_IMAGES_BUCKET_NAME: process.env.R2_IMAGES_BUCKET_NAME!,
      R2_IMAGES_PUBLIC_URL: process.env.R2_IMAGES_PUBLIC_URL!,
    };

    // Add SESSION_ID only if resuming
    if (sessionId) {
      envVars.SESSION_ID = sessionId;
    }

    // Add Convex credentials if provided
    if (convex) {
      console.log(`[E2B] Adding Convex credentials for ${convex.deploymentUrl}`);
      envVars.CONVEX_DEPLOY_KEY = convex.deployKey;
      envVars.EXPO_PUBLIC_CONVEX_URL = convex.deploymentUrl;

      // Upload Convex rules file for Claude to read
      const convexRulesPath = join(process.cwd(), 'lib/agent/e2b-scripts/convex_rules.txt');
      console.log(`[E2B] Reading Convex rules from: ${convexRulesPath}`);
      const convexRulesContent = readFileSync(convexRulesPath, 'utf-8');
      await sandbox.files.write(`${workingDirectory}/convex_rules.txt`, convexRulesContent);
      console.log(`[E2B] ✓ Convex rules uploaded to ${workingDirectory}/convex_rules.txt`);
    }

    console.log(`[E2B] Environment variables prepared`);

    // Step 5: Run script in background with output redirection for debugging
    const logFile = '/home/user/claude-sdk-agent.log';
    console.log(`[E2B] Starting SDK script in background mode...`);
    console.log(`[E2B] Output will be logged to: ${logFile}`);

    // Start script with nohup for proper backgrounding and output capture
    const startResult = await sandbox.commands.run(
      `nohup node ${e2bScriptPath} > ${logFile} 2>&1 & echo $!`,
      {
        cwd: workingDirectory,
        envs: envVars,
        timeoutMs: 5000,
      }
    );

    const pid = parseInt(startResult.stdout.trim());
    if (!pid || isNaN(pid)) {
      throw new Error('Failed to start SDK background process (no PID returned)');
    }

    console.log(`[E2B] ✓ SDK script started in background (PID: ${pid})`);
    console.log(`[E2B] ✓ Logs: ${logFile}`);
    console.log(`[E2B] Script will run independently on E2B and stream to Supabase`);

    // Store agent PID in database for stop functionality
    const { error: pidError } = await supabaseAdmin
      .from('projects')
      .update({ agent_pid: pid })
      .eq('id', projectId);

    if (pidError) {
      console.error('[E2B] Failed to store agent PID:', pidError.message);
      // Don't fail the execution, just log the error
    } else {
      console.log(`[E2B] ✓ Agent PID ${pid} stored in database`);
    }

    // Show initial output for debugging (non-blocking)
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`head -n 50 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] SDK initial output (first 50 lines):');
          console.log(logs.stdout);
        }
      } catch (err) {
        console.error('[E2B] Failed to read SDK initial logs:', err);
      }
    }, 2000);

    // Show more output after 10 seconds to see if SDK is producing events
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`tail -n 30 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] SDK latest output (after 10s):');
          console.log(logs.stdout);
        }

        // Also check if process is still running
        const psResult = await sandbox.commands.run(`ps -p ${pid} -o pid,etime,cmd || echo "Process ${pid} not found"`, { timeoutMs: 3000 });
        console.log('[E2B] SDK process status:', psResult.stdout.trim());
      } catch (err) {
        console.error('[E2B] Failed to read SDK latest logs:', err);
      }
    }, 10000);

    console.log(`[E2B] Vercel can now return immediately`);

    return {
      pid,
      sandboxId: sandbox.sandboxId,
      scriptPath: e2bScriptPath,
      logFile,
    };
  } catch (error) {
    console.error('[E2B] ✗ Failed to start Claude SDK execution:', error);
    throw new Error(
      `Failed to execute Claude SDK in E2B: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Execute Expo setup script in E2B
 *
 * **NEW APPROACH:** This function uploads and runs the setup-expo.js script
 * which handles all Expo setup tasks in the background on E2B.
 *
 * Architecture:
 * 1. Read setup-expo.js from filesystem
 * 2. Upload script to E2B sandbox
 * 3. Install required dependencies (@supabase/supabase-js)
 * 4. Run script with background: true
 * 5. Return immediately with PID
 * 6. Script continues running on E2B:
 *    - Clones Expo template
 *    - Runs npm install
 *    - Starts Expo Metro
 *    - Generates QR code
 *    - Posts to Supabase
 *    - Starts Claude agent when ready
 *
 * @param sandbox - Existing E2B sandbox
 * @param projectId - Project ID for linking to database
 * @param userId - User ID for session tracking
 * @param systemPrompt - System prompt for Claude agent (optional)
 * @param userMessage - User message for Claude SDK (optional, only for claude-sdk)
 * @param aiProvider - AI provider for agent execution
 * @param convex - Optional Convex credentials for backend
 * @returns Execution result with PID and log file path
 */
export async function executeSetupInE2B(
  sandbox: Sandbox,
  projectId: string,
  userId: string,
  systemPrompt?: string,
  userMessage?: string, // Only for claude-sdk (separate from systemPrompt)
  aiProvider: 'claude' | 'claude-sdk' | 'gemini' = 'claude',
  convex?: ConvexCredentials
): Promise<E2BExecutionResult> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  console.log("[E2B] Starting Expo setup with E2B background script");
  console.log(`[E2B] Project: ${projectId}, User: ${userId}`);
  console.log(`[E2B] AI Provider: ${aiProvider}`);
  console.log(`[E2B] Sandbox: ${sandbox.sandboxId}`);

  try {
    // Step 1: Read the setup script from filesystem
    const scriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/setup-expo.js');
    console.log(`[E2B] Reading setup script from: ${scriptPath}`);
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    console.log(`[E2B] ✓ Setup script loaded (${scriptContent.length} bytes)`);

    // Step 2: Upload setup script to E2B
    const e2bScriptPath = '/home/user/setup-expo.js';
    console.log(`[E2B] Uploading setup script to E2B: ${e2bScriptPath}`);
    await sandbox.files.write(e2bScriptPath, scriptContent);
    console.log(`[E2B] ✓ Setup script uploaded`);

    // Step 2.1: Upload shared R2 restore module
    const r2RestorePath = join(process.cwd(), 'lib/agent/e2b-scripts/r2-restore.js');
    console.log(`[E2B] Reading R2 restore module from: ${r2RestorePath}`);
    const r2RestoreContent = readFileSync(r2RestorePath, 'utf-8');
    await sandbox.files.write('/home/user/r2-restore.js', r2RestoreContent);
    console.log(`[E2B] ✓ R2 restore module uploaded`);

    // Step 2.2: Upload e2b-logger.js (ALWAYS needed - setup-expo.js requires it)
    const loggerScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/e2b-logger.js');
    console.log(`[E2B] Reading e2b-logger module from: ${loggerScriptPath}`);
    const loggerScriptContent = readFileSync(loggerScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/e2b-logger.js', loggerScriptContent);
    console.log(`[E2B] ✓ E2B-Logger module uploaded`);

    // Step 2.5: Also upload stream-to-supabase.js (needed for AI agent)
    if (systemPrompt) {
      // Upload the correct agent script based on AI provider
      let agentScriptName: string;
      let e2bScriptPath: string;
      let providerName: string;
      if (aiProvider === 'gemini') {
        agentScriptName = 'stream-to-supabase-gemini.js';
        e2bScriptPath = '/home/user/stream-to-supabase.js';
        providerName = 'Gemini';
      } else if (aiProvider === 'claude-sdk') {
        agentScriptName = 'stream-to-supabase-sdk.js';
        e2bScriptPath = '/home/user/stream-to-supabase-sdk.js';
        providerName = 'Claude SDK';
      } else {
        agentScriptName = 'stream-to-supabase.js';
        e2bScriptPath = '/home/user/stream-to-supabase.js';
        providerName = 'Claude CLI';
      }
      const agentScriptPath = join(process.cwd(), `lib/agent/e2b-scripts/${agentScriptName}`);
      console.log(`[E2B] Reading ${providerName} agent script from: ${agentScriptPath}`);
      const agentScriptContent = readFileSync(agentScriptPath, 'utf-8');
      await sandbox.files.write(e2bScriptPath, agentScriptContent);
      console.log(`[E2B] ✓ ${providerName} agent script uploaded to ${e2bScriptPath}`);

      // Also upload save-to-r2.js (needed for auto-save)
      const saveScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/save-to-r2.js');
      console.log(`[E2B] Reading save-to-r2 module from: ${saveScriptPath}`);
      const saveScriptContent = readFileSync(saveScriptPath, 'utf-8');
      await sandbox.files.write('/home/user/save-to-r2.js', saveScriptContent);
      console.log(`[E2B] ✓ Save-to-R2 module uploaded`);

      // Upload metro-control.js (needed for auto-reload)
      const metroControlPath = join(process.cwd(), 'lib/agent/e2b-scripts/metro-control.js');
      console.log(`[E2B] Reading metro-control module from: ${metroControlPath}`);
      const metroControlContent = readFileSync(metroControlPath, 'utf-8');
      await sandbox.files.write('/home/user/metro-control.js', metroControlContent);
      console.log(`[E2B] ✓ Metro-control module uploaded`);

      // For claude-sdk provider, download the frontend-design skill for better UI generation
      if (aiProvider === 'claude-sdk') {
        console.log(`[E2B] Downloading frontend-design skill...`);
        const skillDownloadResult = await sandbox.commands.run(
          `mkdir -p /home/user/project/.claude/skills/frontend-design && ` +
          `curl -sL "https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md" ` +
          `-o /home/user/project/.claude/skills/frontend-design/SKILL.md`,
          { timeoutMs: 30000 }
        );
        if (skillDownloadResult.exitCode === 0) {
          console.log(`[E2B] ✓ Frontend-design skill downloaded`);
        } else {
          console.warn(`[E2B] ⚠️ Failed to download frontend-design skill: ${skillDownloadResult.stderr}`);
          // Continue anyway - skill is optional enhancement
        }
      }
    }

    // Step 3: Install required dependencies if not already installed
    // For claude-sdk provider, also install the SDK package at runtime (always get latest version)
    const basePackages = '@supabase/supabase-js @aws-sdk/client-s3';
    const packages = aiProvider === 'claude-sdk'
      ? `${basePackages} @anthropic-ai/claude-agent-sdk`
      : basePackages;
    console.log(`[E2B] Installing dependencies (${packages})...`);
    const installResult = await sandbox.commands.run(
      `npm list ${packages} 2>/dev/null || npm install ${packages}`,
      {
        cwd: '/home/user',
        timeoutMs: aiProvider === 'claude-sdk' ? 180000 : 120000, // 3 min for SDK, 2 min otherwise
      }
    );

    if (installResult.exitCode !== 0 && !installResult.stdout.includes('@supabase/supabase-js')) {
      console.warn(`[E2B] ⚠️ npm install warning: ${installResult.stderr}`);
      // Continue anyway - might already be installed
    } else {
      console.log(`[E2B] ✓ Dependencies ready`);
    }

    // Step 4: Get E2B hostname for Expo URL
    const hostname = await sandbox.getHost(8081);
    console.log(`[E2B] ✓ E2B hostname: ${hostname}`);

    // Step 5: Prepare environment variables
    const envVars: Record<string, string> = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      PROJECT_ID: projectId,
      USER_ID: userId,
      SANDBOX_ID: sandbox.sandboxId,
      E2B_HOSTNAME: hostname,
      PROJECT_DIR: '/home/user/project',
      // R2 credentials for restoring from saved snapshots
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID!,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME!,
      // R2 images bucket for bundle export (public bucket)
      R2_IMAGES_BUCKET_NAME: process.env.R2_IMAGES_BUCKET_NAME!,
      R2_IMAGES_PUBLIC_URL: process.env.R2_IMAGES_PUBLIC_URL!,
    };

    // Add AI agent env vars if prompt provided
    if (systemPrompt) {
      envVars.AI_PROVIDER = aiProvider;

      if (aiProvider === 'claude-sdk') {
        // SDK: separate SYSTEM_PROMPT and USER_MESSAGE for token optimization
        envVars.SYSTEM_PROMPT = systemPrompt;
        if (userMessage) {
          envVars.USER_MESSAGE = userMessage;
        }
        if (process.env.ANTHROPIC_API_KEY) {
          envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
          console.log(`[E2B] Claude SDK: SYSTEM_PROMPT (${systemPrompt.length} chars), USER_MESSAGE (${userMessage?.length || 0} chars)`);
        }
      } else if (aiProvider === 'gemini') {
        // Gemini: combined prompt (USER_PROMPT for legacy compatibility)
        envVars.USER_PROMPT = systemPrompt;
        // Vertex AI credentials (required for Gemini)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.GOOGLE_CLOUD_PROJECT) {
          console.log(`[E2B] Gemini will use Vertex AI authentication (project: ${process.env.GOOGLE_CLOUD_PROJECT})`);
          envVars.GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
          envVars.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
          envVars.GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
        } else {
          console.error(`[E2B] Missing Vertex AI credentials for Gemini`);
        }
      } else if (aiProvider === 'claude') {
        // CLI: combined prompt
        envVars.USER_PROMPT = systemPrompt;
        if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
          envVars.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
        }
      }
    }

    // Add Convex credentials if provided
    if (convex) {
      console.log(`[E2B] Adding Convex credentials for ${convex.deploymentUrl}`);
      envVars.CONVEX_DEPLOY_KEY = convex.deployKey;
      envVars.EXPO_PUBLIC_CONVEX_URL = convex.deploymentUrl;

      // Upload Convex rules file for agent to read (will be in PROJECT_DIR after setup)
      const convexRulesPath = join(process.cwd(), 'lib/agent/e2b-scripts/convex_rules.txt');
      console.log(`[E2B] Reading Convex rules from: ${convexRulesPath}`);
      const convexRulesContent = readFileSync(convexRulesPath, 'utf-8');
      // Upload to both /home/user and /home/user/project (setup creates project dir)
      await sandbox.files.write('/home/user/convex_rules.txt', convexRulesContent);
      console.log(`[E2B] ✓ Convex rules uploaded to /home/user/convex_rules.txt`);
    }

    console.log(`[E2B] Environment variables prepared`);

    // Step 6: Run setup script in background with output redirection for debugging
    const logFile = '/home/user/setup-expo.log';
    console.log(`[E2B] Starting setup script in background mode...`);
    console.log(`[E2B] Output will be logged to: ${logFile}`);

    // Start script with nohup for proper backgrounding and output capture
    const startResult = await sandbox.commands.run(
      `nohup node ${e2bScriptPath} > ${logFile} 2>&1 & echo $!`,
      {
        cwd: '/home/user',
        envs: envVars,
        timeoutMs: 5000,
      }
    );

    const pid = parseInt(startResult.stdout.trim());
    if (!pid || isNaN(pid)) {
      throw new Error('Failed to start setup script (no PID returned)');
    }

    console.log(`[E2B] ✓ Setup script started in background (PID: ${pid})`);
    console.log(`[E2B] ✓ Logs: ${logFile}`);
    console.log(`[E2B] Setup script will run independently on E2B and update Supabase`);

    // Show initial output for debugging (non-blocking)
    setTimeout(async () => {
      try {
        const logs = await sandbox.commands.run(`head -n 50 ${logFile}`, { timeoutMs: 3000 });
        if (logs.stdout) {
          console.log('[E2B] Setup initial output (first 50 lines):');
          console.log(logs.stdout);
        }
      } catch (err) {
        console.error('[E2B] Failed to read setup logs:', err);
      }
    }, 2000);

    console.log(`[E2B] Vercel can now return immediately`);

    return {
      pid,
      sandboxId: sandbox.sandboxId,
      scriptPath: e2bScriptPath,
      logFile,
    };
  } catch (error) {
    console.error('[E2B] ✗ Failed to start Expo setup:', error);
    throw new Error(
      `Failed to execute Expo setup in E2B: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
