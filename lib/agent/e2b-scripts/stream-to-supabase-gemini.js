/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * E2B Script: Stream Gemini CLI Output to Supabase
 *
 * This script runs INSIDE E2B sandbox and posts events directly to Supabase.
 * It spawns the Gemini CLI, parses NDJSON output, and stores events in real-time.
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for bypassing RLS
 * - SESSION_ID: Agent session ID (optional for new sessions)
 * - PROJECT_ID: Project ID for linking events
 * - USER_PROMPT: The prompt to send to Gemini
 * - WORKING_DIRECTORY: Working directory for Gemini (default: /home/user/project)
 *
 * Authentication (Vertex AI required):
 *   - GOOGLE_APPLICATION_CREDENTIALS_JSON: Service account JSON content
 *   - GOOGLE_CLOUD_PROJECT: GCP project ID
 *   - GOOGLE_CLOUD_LOCATION: GCP region (default: 'global' for newer models)
 *
 * This script is uploaded to E2B by Vercel and runs independently.
 */

const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { initLogger, logOperation } = require('/home/user/e2b-logger.js');
const fs = require('fs');
const path = require('path');

// Main async function
(async function main() {

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_ID = process.env.SESSION_ID; // May be undefined for new sessions
const PROJECT_ID = process.env.PROJECT_ID;
const USER_ID = process.env.USER_ID;
const USER_PROMPT = process.env.USER_PROMPT;
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/home/user/project';

// Vertex AI configuration (required for Gemini - more stable, higher quotas)
const GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
// Use 'global' location for newer models like gemini-2.5-pro and gemini-3-pro-preview
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[E2B] ERROR: Missing Supabase credentials');
  process.exit(1);
}

// Validate Vertex AI credentials (required)
if (!GOOGLE_APPLICATION_CREDENTIALS_JSON || !GOOGLE_CLOUD_PROJECT) {
  console.error('[E2B] ERROR: Missing Vertex AI credentials');
  console.error('[E2B]   Required: GOOGLE_APPLICATION_CREDENTIALS_JSON + GOOGLE_CLOUD_PROJECT');
  process.exit(1);
}

// Set up Vertex AI credentials
let credentialsPath = null;
try {
  // Write service account JSON to a temp file
  credentialsPath = '/tmp/gcp-credentials.json';
  fs.writeFileSync(credentialsPath, GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log('[E2B] ✓ Vertex AI credentials written to', credentialsPath);
} catch (error) {
  console.error('[E2B] ERROR: Failed to write Vertex AI credentials:', error.message);
  process.exit(1);
}

if (!PROJECT_ID) {
  console.error('[E2B] ERROR: Missing PROJECT_ID');
  process.exit(1);
}

if (!USER_ID) {
  console.error('[E2B] ERROR: Missing USER_ID');
  process.exit(1);
}

if (!USER_PROMPT) {
  console.error('[E2B] ERROR: Missing USER_PROMPT');
  process.exit(1);
}

console.log('[E2B] ========================================');
console.log('[E2B] Starting Gemini CLI stream to Supabase');
console.log('[E2B] ========================================');

// Initialize Supabase client with service role key
let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log('[E2B] Supabase client created');

  // Test connection by doing a simple query
  const { error: testError } = await supabase.from('projects').select('id').limit(1);
  if (testError) {
    console.error('[E2B] Supabase connection test failed:', testError.message);
    console.error('[E2B] Error details:', JSON.stringify(testError, null, 2));
    process.exit(1);
  }
  console.log('[E2B] Supabase connection verified');

  // Initialize centralized logger for operational logs (Metro reload, R2 save, etc.)
  initLogger(supabase, PROJECT_ID, SESSION_ID);
} catch (error) {
  console.error('[E2B] Failed to create Supabase client:', error.message);
  console.error('[E2B] Stack:', error.stack);
  process.exit(1);
}

/**
 * Send debug message to Supabase (appears in chat UI)
 */
async function sendDebugMessage(message, type = 'info') {
  const formattedMessage = message.startsWith('[Gemini]') ? message : `[Gemini] ${message}`;
  console.log(formattedMessage);
  try {
    await supabase.from('agent_events').insert({
      project_id: PROJECT_ID,
      session_id: null, // Pre-session message
      event_type: 'system',
      event_data: {
        type: 'system',
        subtype: type,
        message: formattedMessage,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Gemini] Failed to send debug message:', error.message);
  }
}

// Send initial debug info to Supabase
await sendDebugMessage('[Gemini] 💬 🤖 Initializing Gemini CLI...');
await sendDebugMessage(`[Gemini] Working directory: ${WORKING_DIRECTORY}`);
await sendDebugMessage(`[Gemini] 🔐 Using Vertex AI (project: ${GOOGLE_CLOUD_PROJECT}, region: ${GOOGLE_CLOUD_LOCATION})`);
console.log(`[E2B] Using Vertex AI: project=${GOOGLE_CLOUD_PROJECT}, location=${GOOGLE_CLOUD_LOCATION}`);

// Check if gemini CLI is available
await sendDebugMessage('[Gemini] 🔍 Checking if gemini CLI is available...');
const { execSync } = require('child_process');
try {
  const geminiPath = execSync('which gemini', { encoding: 'utf-8' }).trim();
  await sendDebugMessage(`[Gemini] ✓ CLI found at: ${geminiPath}`);

  // Also check gemini version
  try {
    const geminiVersion = execSync('gemini --version 2>&1 || echo "version unknown"', { encoding: 'utf-8' }).trim();
    await sendDebugMessage(`[Gemini] ✓ Version: ${geminiVersion}`);
  } catch (versionError) {
    await sendDebugMessage(`[Gemini] ⚠️ Could not get version: ${versionError.message}`, 'warning');
  }
} catch (whichError) {
  await sendDebugMessage('[Gemini] ✗ CLI not found in PATH!', 'error');
  await sendDebugMessage(`[Gemini] PATH: ${process.env.PATH}`, 'error');
  await sendDebugMessage(`[Gemini] Error: ${whichError.message}`, 'error');
  process.exit(1);
}

// Check Vertex AI credentials file
await sendDebugMessage(`[Gemini] 📁 Checking credentials file at: ${credentialsPath}`);
try {
  const credStats = require('fs').statSync(credentialsPath);
  await sendDebugMessage(`[Gemini] ✓ Credentials file exists (${credStats.size} bytes)`);
} catch (credError) {
  await sendDebugMessage(`[Gemini] ❌ Credentials file error: ${credError.message}`, 'error');
}

// Build Gemini CLI command
// Use stdin for prompt to handle long prompts reliably (no shell escaping issues)
// --yolo/-y auto-approves all tool calls (like Claude's --dangerously-skip-permissions)
// --output-format stream-json provides streaming JSON output as NDJSON
// --model specifies which Gemini model to use
// -r resumes a session
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-pro-preview';
await sendDebugMessage(`[Gemini] Using model: ${GEMINI_MODEL}`);

// Build args WITHOUT the prompt - we'll pipe it via stdin
// Use --approval-mode yolo instead of just --yolo for proper auto-approval
const args = SESSION_ID
  ? ['-r', SESSION_ID, '--model', GEMINI_MODEL, '--approval-mode', 'yolo', '--output-format', 'stream-json']
  : ['--model', GEMINI_MODEL, '--approval-mode', 'yolo', '--output-format', 'stream-json'];

await sendDebugMessage(`[Gemini] 🚀 Spawning Gemini CLI...`);
await sendDebugMessage(`[Gemini] Command: gemini ${args.join(' ')} (prompt via stdin)`);
await sendDebugMessage(`[Gemini] Prompt length: ${USER_PROMPT.length} chars`);
console.log(`[E2B] Full args: ${JSON.stringify(args)}`);
console.log(`[E2B] Prompt length: ${USER_PROMPT.length} chars`);
console.log(`[E2B] Working directory: ${WORKING_DIRECTORY}`);
console.log(`[E2B] Environment PATH: ${process.env.PATH}`);

// Build environment for Gemini CLI (Vertex AI only)
const geminiEnv = {
  ...process.env,
  HOME: process.env.HOME || '/home/user',
  PATH: process.env.PATH,
  // Vertex AI authentication via service account
  GOOGLE_GENAI_USE_VERTEXAI: 'true',  // Required to enable Vertex AI mode
  GOOGLE_APPLICATION_CREDENTIALS: credentialsPath,
  GOOGLE_CLOUD_PROJECT: GOOGLE_CLOUD_PROJECT,
  GOOGLE_CLOUD_LOCATION: GOOGLE_CLOUD_LOCATION,
};
// Ensure no API keys are present to force Vertex AI usage
delete geminiEnv.GOOGLE_API_KEY;
delete geminiEnv.GEMINI_API_KEY;

// Spawn Gemini CLI with stdin pipe for the prompt
await sendDebugMessage('[Gemini] 🚀 About to spawn gemini process...');
await sendDebugMessage(`[Gemini] 📋 Args: ${args.join(' ')}`);
await sendDebugMessage(`[Gemini] 📁 CWD: ${WORKING_DIRECTORY}`);
await sendDebugMessage(`[Gemini] 🔐 GOOGLE_GENAI_USE_VERTEXAI: ${geminiEnv.GOOGLE_GENAI_USE_VERTEXAI}`);
await sendDebugMessage(`[Gemini] 🔐 GOOGLE_APPLICATION_CREDENTIALS: ${geminiEnv.GOOGLE_APPLICATION_CREDENTIALS}`);
await sendDebugMessage(`[Gemini] 🔐 GOOGLE_CLOUD_PROJECT: ${geminiEnv.GOOGLE_CLOUD_PROJECT}`);

const gemini = spawn('gemini', args, {
  cwd: WORKING_DIRECTORY,
  env: geminiEnv,
  stdio: ['pipe', 'pipe', 'pipe'], // stdin=pipe, stdout=pipe, stderr=pipe
});

await sendDebugMessage(`[Gemini] ✅ Spawn returned, PID: ${gemini.pid || 'undefined'}`);

// Write the prompt to stdin and close it
await sendDebugMessage('[Gemini] ✍️ Writing prompt to stdin...');
gemini.stdin.write(USER_PROMPT);
gemini.stdin.end();
await sendDebugMessage('[Gemini] ✅ Prompt sent via stdin, stdin closed');

await sendDebugMessage(`[Gemini] ⏳ Waiting for Gemini CLI to produce output...`);
console.log(`[E2B] Gemini process spawned with PID: ${gemini.pid}`);

// Track session ID (will be extracted from first event)
let capturedSessionId = SESSION_ID;
let eventCount = 0;
let stdoutChunkCount = 0;
let stderrChunkCount = 0;
let resultEventRecorded = false;
let storeQueue = Promise.resolve();
const COMPLETION_STOP_REASONS = new Set([
  'end_turn',
  'stop_sequence',
  'max_tokens',
  'stop',
  'STOP',
  'MAX_TOKENS'
]);

// Buffer for incomplete NDJSON lines
let stdoutBuffer = '';
let stderrBuffer = '';

// Buffer for accumulating assistant message deltas
let assistantMessageBuffer = '';
let assistantMessageTimestamp = null;

// Debug: Log process spawn
console.log('[E2B] Gemini process spawned, PID:', gemini.pid);

// Safety timeout: Kill Gemini if no output after 60 seconds
await sendDebugMessage('[Gemini] ⏱️ Waiting for Gemini CLI output (60s timeout)...');
const safetyTimeout = setTimeout(async () => {
  await sendDebugMessage('[Gemini] ❌ TIMEOUT: No output from Gemini after 60 seconds', 'error');
  await sendDebugMessage(`[Gemini] Stats: stdout=${stdoutChunkCount}, stderr=${stderrChunkCount}, events=${eventCount}`, 'error');
  await sendDebugMessage('[Gemini] Killing Gemini process...', 'error');
  gemini.kill('SIGTERM');
  setTimeout(() => process.exit(1), 2000);
}, 60000);

/**
 * Transform Gemini event to Claude-compatible format for UI consistency
 *
 * Gemini NDJSON format (observed):
 * - {"type":"init","session_id":"...","model":"gemini-3-pro-preview"}
 * - {"type":"message","role":"user","content":"..."}
 * - {"type":"message","role":"assistant","content":"...","delta":true}
 * - {"type":"tool_use","tool_name":"write_file","tool_id":"...","parameters":{...}}
 * - {"type":"tool_result","tool_id":"...","status":"success"}
 * - {"type":"result","status":"success","stats":{...}}
 */
function transformGeminiEvent(event) {
  // Handle init event (session start)
  if (event.type === 'init' && event.session_id) {
    return {
      type: 'system',
      subtype: 'init',
      session_id: event.session_id,
      model: event.model,
      provider: 'gemini'
    };
  }

  // Handle message events (user and assistant)
  if (event.type === 'message') {
    if (event.role === 'assistant') {
      return {
        type: 'assistant',
        message: {
          content: [{
            type: 'text',
            text: event.content || ''
          }]
        },
        delta: event.delta || false,
        provider: 'gemini'
      };
    } else if (event.role === 'user') {
      // User messages - skip storing (we already stored user message in API route)
      return {
        type: 'user',
        content: event.content,
        skip: true, // Don't store duplicate user messages
        provider: 'gemini'
      };
    }
  }

  // Handle tool use events
  // Gemini format: {"type":"tool_use","tool_name":"write_file","tool_id":"...","parameters":{...}}
  if (event.type === 'tool_use') {
    return {
      type: 'assistant',
      message: {
        content: [{
          type: 'tool_use',
          id: event.tool_id,
          name: event.tool_name,
          input: event.parameters || {}
        }]
      },
      provider: 'gemini'
    };
  }

  // Handle tool result events
  // Gemini format: {"type":"tool_result","tool_id":"...","status":"success"}
  if (event.type === 'tool_result') {
    return {
      type: 'tool_result',
      tool_use_id: event.tool_id,
      status: event.status,
      content: event.content || event.output || '',
      provider: 'gemini'
    };
  }

  // Handle result/completion events
  if (event.type === 'result') {
    return {
      type: 'result',
      subtype: event.status === 'success' ? 'success' : 'error',
      stats: event.stats,
      error: event.error,
      provider: 'gemini'
    };
  }

  // Pass through other events with provider tag
  return {
    ...event,
    provider: 'gemini'
  };
}

/**
 * Flush accumulated assistant message buffer to Supabase
 * Called when a non-delta event arrives or at end of stream
 */
async function flushAssistantBuffer() {
  if (!assistantMessageBuffer) return;

  const event = {
    type: 'assistant',
    message: {
      content: [{
        type: 'text',
        text: assistantMessageBuffer
      }]
    },
    provider: 'gemini'
  };

  // Store accumulated message
  const { error } = await supabase.from('agent_events').insert({
    session_id: capturedSessionId || null,
    project_id: PROJECT_ID,
    event_type: 'assistant',
    event_data: event,
    created_at: assistantMessageTimestamp || new Date().toISOString(),
  });

  if (error) {
    console.error('[E2B] Failed to flush assistant buffer:', error.message);
    await sendDebugMessage(`[Gemini] ❌ Failed to flush message: ${error.message}`, 'error');
  } else {
    eventCount++;
    const preview = assistantMessageBuffer.substring(0, 100);
    console.log(`[E2B] ✓ Flushed assistant message (${assistantMessageBuffer.length} chars): ${preview}...`);
    await sendDebugMessage(`[Gemini] 💬 Assistant: ${preview}${assistantMessageBuffer.length > 100 ? '...' : ''}`);
  }

  assistantMessageBuffer = '';
  assistantMessageTimestamp = null;
}

/**
 * Store event in Supabase
 */
async function storeEvent(rawEvent) {
  try {
    // Log ALL incoming events to see the full picture
    if (rawEvent.type === 'message') {
      console.log(`[E2B] MESSAGE EVENT: role=${rawEvent.role}, delta=${rawEvent.delta}, content length=${(rawEvent.content || '').length}`);
      await sendDebugMessage(`[Gemini] 📨 Message: role=${rawEvent.role}, delta=${rawEvent.delta}, len=${(rawEvent.content || '').length}`);
    }

    // Handle assistant message streaming - accumulate deltas
    if (rawEvent.type === 'message' && rawEvent.role === 'assistant') {
      if (rawEvent.delta === true) {
        // Delta chunk - accumulate instead of storing
        assistantMessageBuffer += rawEvent.content || '';
        if (!assistantMessageTimestamp) {
          assistantMessageTimestamp = rawEvent.timestamp || new Date().toISOString();
        }
        console.log(`[E2B] Accumulated delta: "${(rawEvent.content || '').substring(0, 50)}..."`);
        await sendDebugMessage(`[Gemini] 📝 Delta chunk: "${(rawEvent.content || '').substring(0, 30)}..."`);
        return; // Don't store individual deltas
      } else {
        // Non-delta message - flush buffer first, then continue to store this message
        console.log(`[E2B] Non-delta assistant message, flushing buffer first`);
        await flushAssistantBuffer();
        // Continue to store this non-delta message normally
      }
    }

    // For any non-message event, flush the assistant buffer first
    if (rawEvent.type !== 'message' && assistantMessageBuffer) {
      console.log(`[E2B] Non-message event (${rawEvent.type}), flushing assistant buffer`);
      await flushAssistantBuffer();
    }

    // Log raw event for debugging
    console.log(`[E2B] Raw event: ${JSON.stringify(rawEvent).substring(0, 200)}`);
    await sendDebugMessage(`[Gemini] Raw event type: ${rawEvent.type || 'unknown'}`);

    // Transform Gemini event to normalized format
    const event = transformGeminiEvent(rawEvent);
    console.log(`[E2B] Transformed event type: ${event.type}`);

    // Skip user messages (already stored by API route)
    if (event.skip) {
      console.log(`[E2B] Skipping duplicate user message`);
      return;
    }

    // Extract session ID from init event
    // Gemini uses: {"type":"init","session_id":"...","model":"..."}
    // After transform: {"type":"system","subtype":"init","session_id":"..."}
    if ((event.type === 'system' && event.subtype === 'init' && event.session_id) ||
        (rawEvent.type === 'init' && rawEvent.session_id)) {
      capturedSessionId = event.session_id || rawEvent.session_id;
      console.log(`[E2B] Session initialized: ${capturedSessionId}`);
      await sendDebugMessage(`[Gemini] ✅ Session: ${capturedSessionId.substring(0, 8)}... (model: ${rawEvent.model || event.model || 'unknown'})`);

      // Store session_id in projects table for conversation resumption
      const { error: sessionError } = await supabase
        .from('projects')
        .update({ session_id: capturedSessionId })
        .eq('id', PROJECT_ID);

      if (sessionError) {
        console.error('[E2B] Failed to store session_id in projects:', sessionError.message);
      } else {
        console.log('[E2B] Session ID stored in projects table');
      }
    }

    // Store event in agent_events table
    // Always store events - use null session_id if not available yet
    const { error } = await supabase
      .from('agent_events')
      .insert({
        session_id: capturedSessionId || null,
        project_id: PROJECT_ID,
        event_type: event.type,
        event_data: event,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[E2B] Failed to store event:', error.message);
      await sendDebugMessage(`[Gemini] ❌ Failed to store event: ${error.message}`, 'error');
    } else {
      eventCount++;
      console.log(`[E2B] ✓ Event #${eventCount} stored (type: ${event.type})`);

      if (event.type === 'result') {
        // Ensure any remaining assistant message is flushed before marking complete
        await flushAssistantBuffer();

        resultEventRecorded = true;
        console.log(`[E2B] ${event.subtype === 'success' ? 'Success' : 'Error'} ${event.subtype}`);
        await sendDebugMessage(`[Gemini] ✅ Result: ${event.subtype}`, event.subtype === 'success' ? 'info' : 'error');

        // Trigger Metro reload and save to R2 after successful task completion
        if (event.subtype === 'success') {
          await triggerMetroReload();
          await triggerSaveToR2();
        }
      } else if (event.type === 'assistant') {
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              const preview = block.text.substring(0, 100);
              console.log(`[E2B] Gemini: ${preview}${block.text.length > 100 ? '...' : ''}`);
            } else if (block.type === 'tool_use') {
              console.log(`[E2B] Tool: ${block.name}`);
              await sendDebugMessage(`[Gemini] 🔧 Tool: ${block.name}`);
            }
          }
        }

        const stopReason =
          event.message?.stop_reason ||
          event.stop_reason ||
          event.response?.stop_reason;
        if (
          !resultEventRecorded &&
          stopReason &&
          COMPLETION_STOP_REASONS.has(stopReason)
        ) {
          await storeSyntheticResult('success', 'assistant-stop');
        }
      }
    }
  } catch (error) {
    console.error('[E2B] Error storing event:', error.message);
    await sendDebugMessage(`[Gemini] ❌ Error storing event: ${error.message}`, 'error');
  }
}

function enqueueStore(event) {
  storeQueue = storeQueue
    .then(() => storeEvent(event))
    .catch((error) => {
      console.error('[E2B] Failed to store event in queue:', error);
    });
}

async function storeSyntheticResult(subtype, source) {
  if (!capturedSessionId) return;

  try {
    const { error } = await supabase
      .from('agent_events')
      .insert({
        session_id: capturedSessionId,
        project_id: PROJECT_ID,
        event_type: 'result',
        event_data: {
          type: 'result',
          subtype,
          source,
          provider: 'gemini',
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[E2B] Failed to store synthetic result event:', error.message);
    } else {
      resultEventRecorded = true;
      console.log(`[E2B] Synthetic result event stored (${source}, ${subtype})`);

      // Trigger Metro reload and save to R2 after successful task completion
      if (subtype === 'success') {
        await triggerMetroReload();
        await triggerSaveToR2();
      }
    }
  } catch (error) {
    console.error('[E2B] Error storing synthetic result event:', error.message);
  }
}

/**
 * Trigger save to R2 directly from E2B (no Vercel middleman)
 */
async function triggerSaveToR2() {
  try {
    await logOperation('r2_save', 'started', '[E2B] Triggering auto-save to R2...');

    // Use local save module (runs directly in E2B, no HTTP calls)
    const { saveProjectToR2 } = require('/home/user/save-to-r2.js');

    const result = await saveProjectToR2({
      projectId: PROJECT_ID,
      userId: USER_ID,
      projectDir: WORKING_DIRECTORY,
      description: 'Auto-save after task completion (Gemini)',
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
        `[E2B] Project saved to R2: v${result.version}, ${result.fileCount} files`,
        { version: result.version, fileCount: result.fileCount }
      );
    } else {
      await logOperation(
        'r2_save',
        'failed',
        `[E2B] Failed to save to R2: ${result.error}`,
        { error: result.error }
      );
    }
  } catch (error) {
    await logOperation(
      'r2_save',
      'failed',
      `[E2B] Error triggering save to R2: ${error.message}`,
      { error: error.message }
    );
    // Don't throw - save failures shouldn't break the agent
  }
}

/**
 * Trigger Metro bundler reload (for Expo projects)
 */
async function triggerMetroReload() {
  try {
    await logOperation('metro_reload', 'started', '[E2B] Triggering Metro reload...');

    // Use local metro-control module
    const { triggerMetroReload: metroReload } = require('/home/user/metro-control.js');

    const result = await metroReload();

    if (result.success) {
      await logOperation(
        'metro_reload',
        'completed',
        '[E2B] Metro reloaded - changes should appear in Expo Go'
      );
    } else {
      await logOperation(
        'metro_reload',
        'failed',
        `[E2B] Metro reload skipped: ${result.error}`,
        { error: result.error }
      );
    }
  } catch (error) {
    await logOperation(
      'metro_reload',
      'failed',
      `[E2B] Error triggering Metro reload: ${error.message}`,
      { error: error.message }
    );
    // Don't throw - reload failures shouldn't break the agent
  }
}

// Process stdout (NDJSON events)
gemini.stdout.on('data', async (data) => {
  stdoutChunkCount++;
  const rawData = data.toString();

  // Log raw data for debugging
  console.log(`[E2B] stdout chunk #${stdoutChunkCount} (${rawData.length} bytes): ${rawData.substring(0, 200)}`);

  // Clear safety timeout once we get first output
  if (stdoutChunkCount === 1) {
    await sendDebugMessage('[Gemini] 🎉 Received first output from Gemini CLI!');
    await sendDebugMessage(`[Gemini] Raw data preview: ${rawData.substring(0, 100)}...`);
    console.log('[E2B] Received first stdout chunk!');
    clearTimeout(safetyTimeout);
  }

  stdoutBuffer += rawData;
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line);
      console.log(`[E2B] Parsed event type: ${event.type}`);

      // Log FULL event JSON for debugging (truncate large content)
      const debugEvent = { ...event };
      if (debugEvent.content && debugEvent.content.length > 200) {
        debugEvent.content = debugEvent.content.substring(0, 200) + '... [truncated]';
      }
      if (debugEvent.parameters) {
        debugEvent.parameters = '[object]';
      }
      const eventJson = JSON.stringify(debugEvent);
      console.log(`[E2B] FULL EVENT: ${eventJson}`);
      await sendDebugMessage(`[Gemini] 📦 ${event.type}: ${eventJson.substring(0, 150)}...`);

      enqueueStore(event);
    } catch {
      // Not valid JSON, might be plain text output
      console.log('[E2B] Non-JSON output:', line.substring(0, 100));
      await sendDebugMessage(`[Gemini] Non-JSON: ${line.substring(0, 80)}...`, 'warning');
    }
  }
});

// Process stderr (errors and warnings)
gemini.stderr.on('data', async (data) => {
  stderrChunkCount++;
  const text = data.toString();
  stderrBuffer += text;
  const lines = stderrBuffer.split('\n');
  stderrBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    // Filter out noisy/uninformative messages
    if (line.includes('YOLO mode') || line.includes('Auto-approving')) {
      console.log(`[E2B] Skipping noisy stderr: ${line.substring(0, 50)}...`);
      continue;
    }

    // Detect specific error types and provide user-friendly messages
    if (line.includes('503') || line.includes('overloaded')) {
      await sendDebugMessage(`[Gemini] ⚠️ Model overloaded, retrying automatically...`, 'warning');
      console.error(`[E2B] stderr (overload): ${line.substring(0, 200)}`);
    } else {
      // Send full message with expandable metadata for frontend
      const PREVIEW_LENGTH = 100;
      const isExpandable = line.length > PREVIEW_LENGTH;
      const preview = isExpandable ? line.substring(0, PREVIEW_LENGTH) : line;

      try {
        await supabase.from('agent_events').insert({
          project_id: PROJECT_ID,
          session_id: capturedSessionId || null,
          event_type: 'system',
          event_data: {
            type: 'system',
            subtype: 'stderr',
            message: `[Gemini] stderr: ${preview}${isExpandable ? '...' : ''}`,
            fullMessage: line,  // Full message for "show more"
            preview: preview,   // Short preview
            isExpandable: isExpandable,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[E2B] Failed to send expandable stderr message:', error.message);
      }
      console.error(`[E2B] stderr: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
    }
  }
});

// Handle process exit (fires before 'close')
gemini.on('exit', async (code, signal) => {
  await sendDebugMessage(`[Gemini] Process exited: code=${code}, signal=${signal}`, code === 0 ? 'info' : 'error');
  console.log(`[E2B] Gemini process exited: code=${code}, signal=${signal}`);
  clearTimeout(safetyTimeout);
});

// Handle process completion
gemini.on('close', async (code) => {
  clearTimeout(safetyTimeout);
  const statsMsg = `Stats: events=${eventCount}, stdout=${stdoutChunkCount}, stderr=${stderrChunkCount}`;
  console.log(`[E2B] Gemini process closed with code ${code}`);
  console.log(`[E2B] ${statsMsg}`);

  await sendDebugMessage(`[Gemini] Process closed with code ${code}`, code === 0 ? 'info' : 'error');
  await sendDebugMessage(`[Gemini] ${statsMsg}`);

  await storeQueue.catch((error) => {
    console.error('[E2B] Error waiting for pending events:', error);
  });

  // Session status tracking removed - session_id stored in projects table for reuse only
  if (capturedSessionId) {
    console.log(`[E2B] Session ${capturedSessionId} ${code === 0 ? 'completed' : 'error'}`);
    if (!resultEventRecorded) {
      const subtype = code === 0 ? 'success' : 'error';
      console.log('[E2B] ! No result event detected, inserting fallback.');
      await sendDebugMessage(`[Gemini] No result event, inserting fallback (${subtype})`, 'warning');
      await storeSyntheticResult(subtype, 'fallback');
    }
  } else {
    await sendDebugMessage(`[Gemini] ⚠️ No session ID captured - events may not have been stored`, 'warning');
  }

  // Exit with same code as gemini
  process.exit(code);
});

// Handle script errors
gemini.on('error', async (error) => {
  await sendDebugMessage(`[Gemini] ❌ Failed to spawn Gemini CLI: ${error.message}`, 'error');
  console.error('[E2B] Failed to spawn Gemini CLI:', error.message);
  process.exit(1);
});

// Handle script termination
process.on('SIGTERM', () => {
  console.log('[E2B] Received SIGTERM, terminating Gemini process');
  gemini.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[E2B] Received SIGINT, terminating Gemini process');
  gemini.kill('SIGINT');
});

await sendDebugMessage('[Gemini] ✅ Script initialized, waiting for output...');
console.log('[E2B] Script initialized, waiting for Gemini output...');

})().catch(async (error) => {
  console.error('[E2B] FATAL ERROR:', error.message);
  console.error('[E2B] Stack trace:', error.stack);

  // Try to log to Supabase so user can see the error
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PROJECT_ID = process.env.PROJECT_ID;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && PROJECT_ID) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('agent_events').insert({
        project_id: PROJECT_ID,
        session_id: null,
        event_type: 'system',
        event_data: {
          type: 'system',
          subtype: 'error',
          message: `[Gemini] ❌ FATAL ERROR: ${error.message}`,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    }
  } catch (supabaseError) {
    console.error('[E2B] Failed to log error to Supabase:', supabaseError.message);
  }

  process.exit(1);
});
