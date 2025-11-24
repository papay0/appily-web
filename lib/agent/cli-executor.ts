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
 * @returns Execution result with PID and sandbox ID
 */
export async function executeClaudeInE2B(
  prompt: string,
  workingDirectory: string,
  sessionId: string | undefined,
  sandbox: Sandbox,
  projectId: string,
  userId: string
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
    };

    // Add SESSION_ID only if resuming
    if (sessionId) {
      envVars.SESSION_ID = sessionId;
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
 * @param userPrompt - Initial prompt for Claude agent (optional)
 * @returns Execution result with PID and log file path
 */
export async function executeSetupInE2B(
  sandbox: Sandbox,
  projectId: string,
  userId: string,
  userPrompt?: string
): Promise<E2BExecutionResult> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  console.log("[E2B] Starting Expo setup with E2B background script");
  console.log(`[E2B] Project: ${projectId}, User: ${userId}`);
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

    // Step 2.5: Also upload stream-to-supabase.js (needed for Claude agent)
    if (userPrompt) {
      const agentScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/stream-to-supabase.js');
      console.log(`[E2B] Reading agent script from: ${agentScriptPath}`);
      const agentScriptContent = readFileSync(agentScriptPath, 'utf-8');
      await sandbox.files.write('/home/user/stream-to-supabase.js', agentScriptContent);
      console.log(`[E2B] ✓ Agent script uploaded`);

      // Also upload save-to-r2.js (needed for auto-save)
      const saveScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/save-to-r2.js');
      console.log(`[E2B] Reading save-to-r2 module from: ${saveScriptPath}`);
      const saveScriptContent = readFileSync(saveScriptPath, 'utf-8');
      await sandbox.files.write('/home/user/save-to-r2.js', saveScriptContent);
      console.log(`[E2B] ✓ Save-to-R2 module uploaded`);
    }

    // Step 3: Install @supabase/supabase-js if not already installed
    console.log(`[E2B] Installing @supabase/supabase-js...`);
    const installResult = await sandbox.commands.run(
      'npm list @supabase/supabase-js || npm install @supabase/supabase-js',
      {
        cwd: '/home/user',
        timeoutMs: 60000, // 1 minute timeout for npm install
      }
    );

    if (installResult.exitCode !== 0 && !installResult.stdout.includes('@supabase/supabase-js')) {
      console.warn(`[E2B] ⚠️ npm install warning: ${installResult.stderr}`);
      // Continue anyway - might already be installed
    } else {
      console.log(`[E2B] ✓ @supabase/supabase-js ready`);
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
    };

    // Add Claude agent env vars if prompt provided
    if (userPrompt && process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      envVars.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      envVars.USER_PROMPT = userPrompt;
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
