# Migration Plan: Add Claude SDK as New AI Provider

## Overview

This document outlines the plan to add `claude-sdk` as a **new AI provider** alongside the existing `claude` (CLI) and `gemini` providers. This approach ensures zero risk to existing functionality and allows A/B testing between the CLI and SDK approaches.

### Why Add Instead of Replace?

1. **Safety**: Existing `claude` provider continues working
2. **A/B Testing**: Compare SDK vs CLI performance in production
3. **Easy Rollback**: If SDK has issues, simply don't select it
4. **Gradual Migration**: Once SDK is proven stable, deprecate CLI provider

### Authentication Change

| Provider | Environment Variable | Billing Model |
|----------|---------------------|---------------|
| `claude` (CLI) | `CLAUDE_CODE_OAUTH_TOKEN` | Free with Claude subscription |
| `claude-sdk` (SDK) | `ANTHROPIC_API_KEY` | Pay-per-token API billing |

---

## Architecture Comparison

### Current: Claude CLI Approach
```
Vercel → uploads stream-to-supabase.js → E2B runs script → spawn('claude', [...]) → NDJSON parsing → Supabase
```

### New: Claude SDK Approach
```
Vercel → uploads stream-to-supabase-sdk.js → E2B runs script → query({ prompt, options }) → typed messages → Supabase
```

The SDK uses the CLI internally as its runtime, so the CLI being installed in E2B is still required.

---

## Files to Modify

### Summary Table

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/agent/flows.ts` | Modify | Extend `AIProvider` type |
| `lib/agent/cli-executor.ts` | Modify | Add `executeClaudeSdkInE2B()` function |
| `lib/agent/e2b-scripts/stream-to-supabase-sdk.js` | **Create** | New SDK-based agent script |
| `lib/agent/e2b-scripts/setup-expo.js` | Modify | Handle `claude-sdk` provider |
| `app/api/agents/create/route.ts` | Modify | Validate `claude-sdk` provider |
| `components/ai-provider-selector.tsx` | Modify | Add UI option |
| `e2b-template/template.ts` | Modify | Pre-install SDK package |
| `.env.example` | Modify | Add `ANTHROPIC_API_KEY` |

---

## Detailed Changes

### 1. Extend AIProvider Type (`lib/agent/flows.ts`)

**Location**: Line 24

**Before**:
```typescript
export type AIProvider = 'claude' | 'gemini';
```

**After**:
```typescript
export type AIProvider = 'claude' | 'gemini' | 'claude-sdk';
```

**Also update** `handleExistingProjectFlow()` (around line 261-287) to route `claude-sdk`:

```typescript
if (aiProvider === 'gemini') {
  console.log(`[FLOW] Using Gemini CLI for agent execution`);
  const result = await executeGeminiInE2B(...);
  pid = result.pid;
  logFile = result.logFile;
} else if (aiProvider === 'claude-sdk') {
  console.log(`[FLOW] Using Claude SDK for agent execution`);
  const result = await executeClaudeSdkInE2B(
    systemPrompt,
    workingDir || "/home/user/project",
    sessionId || undefined,
    sandbox,
    projectId,
    userId,
    convexCredentials
  );
  pid = result.pid;
  logFile = result.logFile;
} else {
  console.log(`[FLOW] Using Claude Code CLI for agent execution`);
  const result = await executeClaudeInE2B(...);
  pid = result.pid;
  logFile = result.logFile;
}
```

---

### 2. Create SDK Executor Function (`lib/agent/cli-executor.ts`)

**Location**: After `executeGeminiInE2B()` (around line 495)

Add new function `executeClaudeSdkInE2B()`:

```typescript
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
    const saveScriptContent = readFileSync(saveScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/save-to-r2.js', saveScriptContent);
    console.log(`[E2B] ✓ Save-to-R2 module uploaded`);

    const loggerScriptPath = join(process.cwd(), 'lib/agent/e2b-scripts/e2b-logger.js');
    const loggerScriptContent = readFileSync(loggerScriptPath, 'utf-8');
    await sandbox.files.write('/home/user/e2b-logger.js', loggerScriptContent);
    console.log(`[E2B] ✓ E2B-Logger module uploaded`);

    const metroControlPath = join(process.cwd(), 'lib/agent/e2b-scripts/metro-control.js');
    const metroControlContent = readFileSync(metroControlPath, 'utf-8');
    await sandbox.files.write('/home/user/metro-control.js', metroControlContent);
    console.log(`[E2B] ✓ Metro-control module uploaded`);

    // Step 3: Install dependencies (SDK should be pre-installed in template)
    console.log(`[E2B] Installing dependencies...`);
    const installResult = await sandbox.commands.run(
      'npm list @supabase/supabase-js @aws-sdk/client-s3 @anthropic-ai/claude-agent-sdk || npm install @supabase/supabase-js @aws-sdk/client-s3 @anthropic-ai/claude-agent-sdk',
      {
        cwd: '/home/user',
        timeoutMs: 180000, // 3 minute timeout (SDK is larger)
      }
    );

    if (installResult.exitCode !== 0) {
      console.warn(`[E2B] ⚠️ npm install warning: ${installResult.stderr}`);
    } else {
      console.log(`[E2B] ✓ Dependencies ready`);
    }

    // Step 4: Prepare environment variables
    const envVars: Record<string, string> = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!, // SDK requires API key
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

    // Add Convex credentials if provided
    if (convex) {
      console.log(`[E2B] Adding Convex credentials for ${convex.deploymentUrl}`);
      envVars.CONVEX_DEPLOY_KEY = convex.deployKey;
      envVars.EXPO_PUBLIC_CONVEX_URL = convex.deploymentUrl;

      const convexRulesPath = join(process.cwd(), 'lib/agent/e2b-scripts/convex_rules.txt');
      const convexRulesContent = readFileSync(convexRulesPath, 'utf-8');
      await sandbox.files.write(`${workingDirectory}/convex_rules.txt`, convexRulesContent);
      console.log(`[E2B] ✓ Convex rules uploaded`);
    }

    console.log(`[E2B] Environment variables prepared`);

    // Step 5: Run script in background
    const logFile = '/home/user/claude-sdk-agent.log';
    console.log(`[E2B] Starting SDK script in background mode...`);

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

    // Store agent PID in database for stop functionality
    const { error: pidError } = await supabaseAdmin
      .from('projects')
      .update({ agent_pid: pid })
      .eq('id', projectId);

    if (pidError) {
      console.error('[E2B] Failed to store agent PID:', pidError.message);
    } else {
      console.log(`[E2B] ✓ Agent PID ${pid} stored in database`);
    }

    // Debug logging (non-blocking)
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
```

**Don't forget to export** it and update the import in `flows.ts`:

```typescript
import { executeSetupInE2B, executeClaudeInE2B, executeGeminiInE2B, executeClaudeSdkInE2B } from "./cli-executor";
```

---

### 3. Create SDK Agent Script (`lib/agent/e2b-scripts/stream-to-supabase-sdk.js`)

**This is a NEW FILE** - the core of the migration:

```javascript
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * E2B Script: Stream Claude SDK Output to Supabase
 *
 * This script runs INSIDE E2B sandbox and uses the Claude Agent SDK
 * to execute agent queries, posting events directly to Supabase.
 *
 * Key differences from CLI version:
 * - Uses SDK query() instead of spawn('claude', ...)
 * - Typed messages - no NDJSON parsing needed
 * - Built-in session resumption via `resume` option
 * - Built-in permission bypass via `permissionMode`
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for bypassing RLS
 * - ANTHROPIC_API_KEY: API key for Claude SDK (NOT OAuth token!)
 * - SESSION_ID: Agent session ID (optional for new sessions)
 * - PROJECT_ID: Project ID for linking events
 * - USER_PROMPT: The prompt to send to Claude
 * - WORKING_DIRECTORY: Working directory for Claude (default: /home/user/project)
 */

const { query } = require('@anthropic-ai/claude-agent-sdk');
const { createClient } = require('@supabase/supabase-js');
const { initLogger, logOperation } = require('/home/user/e2b-logger.js');

// Main async function
(async function main() {

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SESSION_ID = process.env.SESSION_ID; // May be undefined for new sessions
const PROJECT_ID = process.env.PROJECT_ID;
const USER_ID = process.env.USER_ID;
const USER_PROMPT = process.env.USER_PROMPT;
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/home/user/project';

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[E2B-SDK] ERROR: Missing Supabase credentials');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('[E2B-SDK] ERROR: Missing ANTHROPIC_API_KEY');
  console.error('[E2B-SDK] Note: SDK requires API key, not OAuth token');
  process.exit(1);
}

if (!PROJECT_ID) {
  console.error('[E2B-SDK] ERROR: Missing PROJECT_ID');
  process.exit(1);
}

if (!USER_ID) {
  console.error('[E2B-SDK] ERROR: Missing USER_ID');
  process.exit(1);
}

if (!USER_PROMPT) {
  console.error('[E2B-SDK] ERROR: Missing USER_PROMPT');
  process.exit(1);
}

console.log('[E2B-SDK] Starting Claude SDK stream to Supabase');
console.log(`[E2B-SDK] Project ID: ${PROJECT_ID}`);
console.log(`[E2B-SDK] Session ID: ${SESSION_ID || '(new session)'}`);
console.log(`[E2B-SDK] Working directory: ${WORKING_DIRECTORY}`);

// Initialize Supabase client
let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log('[E2B-SDK] ✓ Supabase client created');

  // Test connection
  const { error: testError } = await supabase.from('projects').select('id').limit(1);
  if (testError) {
    console.error('[E2B-SDK] ✗ Supabase connection test failed:', testError.message);
    process.exit(1);
  }
  console.log('[E2B-SDK] ✓ Supabase connection verified');

  // Initialize centralized logger
  initLogger(supabase, PROJECT_ID, SESSION_ID);
} catch (error) {
  console.error('[E2B-SDK] ✗ Failed to create Supabase client:', error.message);
  process.exit(1);
}

// Track session ID and events
let capturedSessionId = SESSION_ID;
let eventCount = 0;
let resultEventRecorded = false;

/**
 * Store event in Supabase
 */
async function storeEvent(message) {
  try {
    // Extract session ID from init event
    if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
      capturedSessionId = message.session_id;
      console.log(`[E2B-SDK] ✓ Session initialized: ${capturedSessionId}`);

      // Store session_id in projects table
      const { error: sessionError } = await supabase
        .from('projects')
        .update({ session_id: capturedSessionId })
        .eq('id', PROJECT_ID);

      if (sessionError) {
        console.error('[E2B-SDK] Failed to store session_id:', sessionError.message);
      } else {
        console.log('[E2B-SDK] ✓ Session ID stored in projects table');
      }
    }

    // Store event in agent_events table
    if (capturedSessionId) {
      const { error } = await supabase
        .from('agent_events')
        .insert({
          session_id: capturedSessionId,
          project_id: PROJECT_ID,
          event_type: message.type,
          event_data: message,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[E2B-SDK] Failed to store event:', error.message);
      } else {
        eventCount++;

        // Log event type for debugging
        if (message.type === 'result') {
          resultEventRecorded = true;
          console.log(`[E2B-SDK] ${message.subtype === 'success' ? '✓' : '✗'} ${message.subtype}`);

          // Trigger Metro reload and R2 save after success
          if (message.subtype === 'success') {
            await triggerMetroReload();
            await triggerSaveToR2();
          }
        } else if (message.type === 'assistant') {
          // Log assistant message preview
          if (message.message?.content) {
            for (const block of message.message.content) {
              if (block.type === 'text') {
                const preview = block.text.substring(0, 100);
                console.log(`[E2B-SDK] 💬 ${preview}${block.text.length > 100 ? '...' : ''}`);
              } else if (block.type === 'tool_use') {
                console.log(`[E2B-SDK] 🔧 ${block.name}`);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[E2B-SDK] Error storing event:', error.message);
  }
}

/**
 * Trigger save to R2 directly from E2B
 */
async function triggerSaveToR2() {
  try {
    await logOperation('r2_save', 'started', '[E2B-SDK] 💾 Triggering auto-save to R2...');

    const { saveProjectToR2 } = require('/home/user/save-to-r2.js');

    const result = await saveProjectToR2({
      projectId: PROJECT_ID,
      userId: USER_ID,
      projectDir: WORKING_DIRECTORY,
      description: 'Auto-save after task completion',
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
    });

    if (result.success) {
      await logOperation(
        'r2_save',
        'completed',
        `[E2B-SDK] ✓ Project saved to R2: v${result.version}, ${result.fileCount} files`,
        { version: result.version, fileCount: result.fileCount }
      );
    } else {
      await logOperation(
        'r2_save',
        'failed',
        `[E2B-SDK] ✗ Failed to save to R2: ${result.error}`,
        { error: result.error }
      );
    }
  } catch (error) {
    await logOperation(
      'r2_save',
      'failed',
      `[E2B-SDK] ✗ Error triggering save to R2: ${error.message}`,
      { error: error.message }
    );
  }
}

/**
 * Trigger Metro bundler reload
 */
async function triggerMetroReload() {
  try {
    await logOperation('metro_reload', 'started', '[E2B-SDK] 🔄 Triggering Metro reload...');

    const { triggerMetroReload: metroReload } = require('/home/user/metro-control.js');

    const result = await metroReload();

    if (result.success) {
      await logOperation(
        'metro_reload',
        'completed',
        '[E2B-SDK] ✓ Metro reloaded - changes should appear in Expo Go'
      );
    } else {
      await logOperation(
        'metro_reload',
        'failed',
        `[E2B-SDK] ⚠️ Metro reload skipped: ${result.error}`,
        { error: result.error }
      );
    }
  } catch (error) {
    await logOperation(
      'metro_reload',
      'failed',
      `[E2B-SDK] ✗ Error triggering Metro reload: ${error.message}`,
      { error: error.message }
    );
  }
}

// Execute Claude SDK query
console.log('[E2B-SDK] Starting SDK query...');
console.log(`[E2B-SDK] Prompt: ${USER_PROMPT.substring(0, 100)}...`);

try {
  // Use SDK query() with async iteration
  for await (const message of query({
    prompt: USER_PROMPT,
    options: {
      cwd: WORKING_DIRECTORY,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch'],
      permissionMode: 'bypassPermissions', // Auto-approve all operations
      resume: SESSION_ID || undefined, // Resume if session exists
    }
  })) {
    // Store each message directly - SDK provides typed messages
    await storeEvent(message);
  }

  console.log(`[E2B-SDK] ✓ Query completed. Events stored: ${eventCount}`);

  // Store synthetic result if none was recorded
  if (!resultEventRecorded) {
    console.log('[E2B-SDK] ! No result event detected, inserting fallback success.');
    await storeEvent({
      type: 'result',
      subtype: 'success',
      source: 'sdk-fallback',
      timestamp: new Date().toISOString(),
    });
  }

} catch (error) {
  console.error('[E2B-SDK] ✗ SDK query failed:', error.message);
  console.error('[E2B-SDK] Stack:', error.stack);

  // Store error result
  await storeEvent({
    type: 'result',
    subtype: 'error',
    error: error.message,
    timestamp: new Date().toISOString(),
  });

  process.exit(1);
}

// Clear agent_pid from database since task is complete
try {
  const { error: clearPidError } = await supabase
    .from('projects')
    .update({ agent_pid: null })
    .eq('id', PROJECT_ID);

  if (clearPidError) {
    console.error('[E2B-SDK] Failed to clear agent_pid:', clearPidError.message);
  } else {
    console.log('[E2B-SDK] ✓ Agent PID cleared from database');
  }
} catch (err) {
  console.error('[E2B-SDK] Error clearing agent_pid:', err.message);
}

console.log('[E2B-SDK] ✓ Script completed successfully');
process.exit(0);

})().catch((error) => {
  console.error('[E2B-SDK] ✗ FATAL ERROR:', error.message);
  console.error('[E2B-SDK] Stack trace:', error.stack);
  process.exit(1);
});
```

---

### 4. Update API Route Validation (`app/api/agents/create/route.ts`)

**Location**: Line 53

**Before**:
```typescript
const validatedAiProvider: AIProvider = aiProvider === 'gemini' ? 'gemini' : 'claude';
```

**After**:
```typescript
// Validate AI provider - support claude, gemini, and claude-sdk
let validatedAiProvider: AIProvider = 'claude';
if (aiProvider === 'gemini') {
  validatedAiProvider = 'gemini';
} else if (aiProvider === 'claude-sdk') {
  validatedAiProvider = 'claude-sdk';
}
```

---

### 5. Update AI Provider Selector (`components/ai-provider-selector.tsx`)

**Location**: Line 46-57

**Before**:
```typescript
const providers: { id: AIProvider; name: string; icon: React.ReactNode }[] = [
  {
    id: "claude",
    name: "Claude",
    icon: <ClaudeIcon className="text-[#cc785c]" />,
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: <GeminiIcon className="text-[#4285f4]" />,
  },
];
```

**After**:
```typescript
const providers: { id: AIProvider; name: string; icon: React.ReactNode }[] = [
  {
    id: "claude",
    name: "Claude (CLI)",
    icon: <ClaudeIcon className="text-[#cc785c]" />,
  },
  {
    id: "claude-sdk",
    name: "Claude (SDK)",
    icon: <ClaudeIcon className="text-[#d97706]" />, // Different color to distinguish
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: <GeminiIcon className="text-[#4285f4]" />,
  },
];
```

---

### 6. Update Setup Expo Script (`lib/agent/e2b-scripts/setup-expo.js`)

**Location**: Lines 38, 497-501, 564-572

**Changes needed**:

1. Add `ANTHROPIC_API_KEY` variable (line 38):
```javascript
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // For SDK provider
```

2. Update credential check (around line 497-501):
```javascript
const isGemini = AI_PROVIDER === 'gemini';
const isClaudeSdk = AI_PROVIDER === 'claude-sdk';

// Gemini requires Vertex AI credentials
// Claude SDK requires ANTHROPIC_API_KEY
// Claude CLI requires CLAUDE_CODE_OAUTH_TOKEN
const hasGeminiCredentials = !!(GOOGLE_APPLICATION_CREDENTIALS_JSON && GOOGLE_CLOUD_PROJECT);
const hasClaudeSdkCredentials = !!ANTHROPIC_API_KEY;
const hasClaudeCliCredentials = !!CLAUDE_CODE_OAUTH_TOKEN;

let hasCredentials;
if (isGemini) {
  hasCredentials = hasGeminiCredentials;
} else if (isClaudeSdk) {
  hasCredentials = hasClaudeSdkCredentials;
} else {
  hasCredentials = hasClaudeCliCredentials;
}
```

3. Update agent script selection (around line 541):
```javascript
// Select correct agent script based on provider
let agentScriptName;
if (isGemini) {
  agentScriptName = 'stream-to-supabase-gemini.js';
} else if (isClaudeSdk) {
  agentScriptName = 'stream-to-supabase-sdk.js';
} else {
  agentScriptName = 'stream-to-supabase.js';
}
```

4. Update agent environment (around line 564-572):
```javascript
// Add provider-specific credentials
if (isGemini) {
  agentEnv.GOOGLE_APPLICATION_CREDENTIALS_JSON = GOOGLE_APPLICATION_CREDENTIALS_JSON;
  agentEnv.GOOGLE_CLOUD_PROJECT = GOOGLE_CLOUD_PROJECT;
  agentEnv.GOOGLE_CLOUD_LOCATION = GOOGLE_CLOUD_LOCATION;
} else if (isClaudeSdk) {
  agentEnv.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY;
  console.log(`[Setup] Added ANTHROPIC_API_KEY to agent environment`);
} else {
  agentEnv.CLAUDE_CODE_OAUTH_TOKEN = CLAUDE_CODE_OAUTH_TOKEN;
  console.log(`[Setup] Added CLAUDE_CODE_OAUTH_TOKEN to agent environment`);
}
```

---

### 7. Update CLI Executor for Setup (`lib/agent/cli-executor.ts`)

**Location**: `executeSetupInE2B()` function (around line 617-650)

Add `ANTHROPIC_API_KEY` to environment variables:

```typescript
if (userPrompt) {
  envVars.AI_PROVIDER = aiProvider;
  envVars.USER_PROMPT = userPrompt;

  if (aiProvider === 'gemini') {
    // Vertex AI credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.GOOGLE_CLOUD_PROJECT) {
      envVars.GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      envVars.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
      envVars.GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    }
  } else if (aiProvider === 'claude-sdk' && process.env.ANTHROPIC_API_KEY) {
    envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  } else if (aiProvider === 'claude' && process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    envVars.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  }
}
```

Also update the function signature to accept the new provider:
```typescript
export async function executeSetupInE2B(
  sandbox: Sandbox,
  projectId: string,
  userId: string,
  userPrompt?: string,
  aiProvider: 'claude' | 'gemini' | 'claude-sdk' = 'claude', // Add claude-sdk
  convex?: ConvexCredentials
): Promise<E2BExecutionResult>
```

---

### 8. Update E2B Template (`e2b-template/template.ts`)

Pre-install the SDK package in the E2B template:

```typescript
// After existing Claude Code CLI installation
.runCmd("npm install -g @anthropic-ai/claude-agent-sdk")
```

---

### 9. Update Environment Variables (`.env.example`)

Add the new API key:

```bash
# Claude Code CLI (subscription-based)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your_oauth_token_here

# Claude Code SDK (API billing - required for claude-sdk provider)
ANTHROPIC_API_KEY=sk-ant-api03-your_api_key_here
```

---

## Feature Compatibility

| Feature | CLI Version | SDK Version | Notes |
|---------|-------------|-------------|-------|
| Send message | ✅ | ✅ | Both support |
| Tool calling | ✅ | ✅ | SDK uses `permissionMode: 'bypassPermissions'` |
| Session resume | ✅ (`-r sessionId`) | ✅ (`resume: sessionId`) | Built-in |
| Event streaming | ✅ (NDJSON parsing) | ✅ (typed messages) | SDK is cleaner |
| Stop/interrupt | ✅ (SIGTERM) | ⚠️ | SDK needs different approach |
| Image context | ✅ (prompt injection) | ✅ (prompt injection) | Same approach |
| Metro reload | ✅ | ✅ | Same trigger mechanism |
| R2 save | ✅ | ✅ | Same save mechanism |

### Stop/Interrupt Handling

The SDK's `interrupt()` function only works with streaming mode. For the initial implementation, we'll use the same SIGTERM approach as the CLI version:

```javascript
process.on('SIGTERM', () => {
  console.log('[E2B-SDK] Received SIGTERM');
  process.exit(0);
});
```

---

## Testing Checklist

- [ ] New project with `claude-sdk` provider
- [ ] Existing project message with `claude-sdk` provider
- [ ] Session resumption works
- [ ] Events stream to Supabase correctly
- [ ] Metro reload triggers after task completion
- [ ] R2 save works after task completion
- [ ] Stop button terminates agent
- [ ] Error handling works correctly
- [ ] Switching between providers works

---

## Rollback Plan

If the SDK provider has issues:
1. Simply don't select `claude-sdk` in the UI
2. Existing `claude` and `gemini` providers continue working
3. No code rollback needed - just don't use the new provider

---

## Future: Deprecating CLI Provider

Once SDK is proven stable:
1. Remove `claude` from `AIProvider` type
2. Delete `executeClaudeInE2B()` function
3. Delete `stream-to-supabase.js` script
4. Remove `CLAUDE_CODE_OAUTH_TOKEN` references
5. Rename `claude-sdk` to `claude` (optional)
