/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * E2B Script: Stream Claude CLI Output to Supabase
 *
 * This script runs INSIDE E2B sandbox and posts events directly to Supabase.
 * It spawns the Claude CLI, parses NDJSON output, and stores events in real-time.
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for bypassing RLS
 * - CLAUDE_CODE_OAUTH_TOKEN: OAuth token for Claude CLI
 * - SESSION_ID: Agent session ID (optional for new sessions)
 * - PROJECT_ID: Project ID for linking events
 * - USER_PROMPT: The prompt to send to Claude
 * - WORKING_DIRECTORY: Working directory for Claude (default: /home/user/project)
 *
 * This script is uploaded to E2B by Vercel and runs independently.
 */

const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { initLogger, logOperation } = require('/home/user/e2b-logger.js');

// Main async function
(async function main() {

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
const SESSION_ID = process.env.SESSION_ID; // May be undefined for new sessions
const PROJECT_ID = process.env.PROJECT_ID;
const USER_ID = process.env.USER_ID;
let USER_PROMPT = process.env.USER_PROMPT; // May be modified with history context
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/home/user/project';

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[E2B] ERROR: Missing Supabase credentials');
  process.exit(1);
}

if (!CLAUDE_CODE_OAUTH_TOKEN) {
  console.error('[E2B] ERROR: Missing CLAUDE_CODE_OAUTH_TOKEN');
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

console.log('[E2B] Starting Claude CLI stream to Supabase');
console.log('[E2B] Model: claude-sonnet-4');
console.log(`[E2B] Project ID: ${PROJECT_ID}`);
console.log(`[E2B] Session ID: ${SESSION_ID || '(new session)'}`);
console.log(`[E2B] Working directory: ${WORKING_DIRECTORY}`);

// Initialize Supabase client with service role key
let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log('[E2B] ✓ Supabase client created');

  // Test connection by doing a simple query
  const { error: testError } = await supabase.from('projects').select('id').limit(1);
  if (testError) {
    console.error('[E2B] ✗ Supabase connection test failed:', testError.message);
    console.error('[E2B] Error details:', JSON.stringify(testError, null, 2));
    process.exit(1);
  }
  console.log('[E2B] ✓ Supabase connection verified');

  // Initialize centralized logger for operational logs (Metro reload, R2 save, etc.)
  initLogger(supabase, PROJECT_ID, SESSION_ID);
} catch (error) {
  console.error('[E2B] ✗ Failed to create Supabase client:', error.message);
  console.error('[E2B] Stack:', error.stack);
  process.exit(1);
}

/**
 * Load conversation history from Supabase agent_events table
 * Used when session cannot be resumed (sandbox was recreated)
 */
async function loadConversationHistory() {
  try {
    const { data, error } = await supabase
      .from('agent_events')
      .select('event_type, event_data, created_at')
      .eq('project_id', PROJECT_ID)
      .in('event_type', ['user', 'assistant'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[E2B] Failed to load conversation history:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[E2B] Error loading conversation history:', err.message);
    return [];
  }
}

/**
 * Format conversation history into a prompt context
 * This allows Claude to understand previous conversation when session is lost
 */
function formatPromptWithHistory(events, currentPrompt) {
  const historyLines = [];

  for (const event of events) {
    if (event.event_type === 'user' && event.event_data?.content) {
      // Only get actual user messages (string content), skip tool results
      if (typeof event.event_data.content === 'string') {
        historyLines.push(`User: ${event.event_data.content}`);
      }
    } else if (event.event_type === 'assistant') {
      const content = event.event_data?.message?.content;
      if (Array.isArray(content)) {
        const textParts = content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        if (textParts) {
          // Truncate very long assistant responses to avoid context overflow
          const truncated = textParts.length > 2000
            ? textParts.substring(0, 2000) + '...[truncated]'
            : textParts;
          historyLines.push(`Assistant: ${truncated}`);
        }
      }
    }
  }

  if (historyLines.length === 0) {
    return currentPrompt;
  }

  console.log(`[E2B] Loaded ${historyLines.length} conversation turns from history`);

  return `## Previous Conversation History:

${historyLines.join('\n\n')}

## Current Request:
${currentPrompt}`;
}

/**
 * Quick check if session exists by spawning Claude with -r and detecting fast failure
 * Returns { exists: true } if session can be resumed, or { exists: false, stderr } if not
 */
async function checkSessionExists(sessionId) {
  return new Promise((resolve) => {
    // Use a simple echo command to test session - if session doesn't exist, it fails immediately
    const testArgs = ['-r', sessionId, '-p', '--output-format', 'stream-json', '--dangerously-skip-permissions', 'echo test'];
    let stderr = '';
    let timedOut = false;

    const testProcess = spawn('claude', testArgs, {
      cwd: WORKING_DIRECTORY,
      env: {
        ...process.env,
        CLAUDE_CODE_OAUTH_TOKEN,
        HOME: process.env.HOME || '/home/user',
        PATH: process.env.PATH,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Timeout after 5 seconds - if it takes longer, session probably exists
    const timeout = setTimeout(() => {
      timedOut = true;
      testProcess.kill('SIGTERM');
      resolve({ exists: true });
    }, 5000);

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    testProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return; // Already resolved

      // Check if session not found error
      if (code !== 0 && stderr.includes('No conversation found')) {
        resolve({ exists: false, stderr });
      } else {
        // Session exists (or other error we should let through)
        resolve({ exists: true });
      }
    });

    testProcess.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[E2B] Error checking session:', err.message);
      resolve({ exists: true }); // Assume exists, let main process handle errors
    });
  });
}

// Check if we need to load conversation history (session lost due to sandbox recreation)
let useSessionResume = !!SESSION_ID;

if (SESSION_ID) {
  console.log('[E2B] Checking if session can be resumed...');
  const sessionCheck = await checkSessionExists(SESSION_ID);

  if (!sessionCheck.exists) {
    console.log('[E2B] Session not found - sandbox was likely recreated');
    console.log('[E2B] Loading conversation history from Supabase...');

    const history = await loadConversationHistory();

    if (history.length > 0) {
      USER_PROMPT = formatPromptWithHistory(history, USER_PROMPT);
      console.log('[E2B] ✓ Conversation history loaded and added to prompt');
    } else {
      console.log('[E2B] No conversation history found, starting fresh');
    }

    useSessionResume = false; // Don't use -r flag
  } else {
    console.log('[E2B] ✓ Session exists, will resume');
  }
}

// Build Claude CLI command
// -p (--print) is required for --output-format
// Prompt is a positional argument that comes LAST
// Use useSessionResume (not SESSION_ID) to handle graceful fallback when session is lost
const args = useSessionResume
  ? ['-r', SESSION_ID, '-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', USER_PROMPT]
  : ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', USER_PROMPT];

console.log(`[E2B] Spawning: claude ${args.join(' ')}`);

// Spawn Claude CLI
// IMPORTANT: stdin must be 'ignore' to prevent Claude from waiting for input
const claude = spawn('claude', args, {
  cwd: WORKING_DIRECTORY,
  env: {
    ...process.env,
    CLAUDE_CODE_OAUTH_TOKEN,
    HOME: process.env.HOME || '/home/user',
    PATH: process.env.PATH,
  },
  stdio: ['ignore', 'pipe', 'pipe'], // stdin=ignore, stdout=pipe, stderr=pipe
});

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
  'stop'
]);

// Buffer for incomplete NDJSON lines
let stdoutBuffer = '';
let stderrBuffer = '';

// Debug: Log process spawn
console.log('[E2B] ✓ Claude process spawned, PID:', claude.pid);

// Safety timeout: Kill Claude if no output after 60 seconds
const safetyTimeout = setTimeout(() => {
  console.error('[E2B] ⚠️ TIMEOUT: No output from Claude after 60 seconds');
  console.error(`[E2B] Stats: stdout chunks=${stdoutChunkCount}, stderr chunks=${stderrChunkCount}, events=${eventCount}`);
  console.error('[E2B] Killing Claude process...');
  claude.kill('SIGTERM');
  setTimeout(() => process.exit(1), 2000);
}, 60000);

/**
 * Store event in Supabase
 */
async function storeEvent(event) {
  try {
    // Extract session ID from init event
    if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
      capturedSessionId = event.session_id;
      console.log(`[E2B] ✓ Session initialized: ${capturedSessionId}`);

      // Store session_id in projects table for conversation resumption
      const { error: sessionError } = await supabase
        .from('projects')
        .update({ session_id: capturedSessionId })
        .eq('id', PROJECT_ID);

      if (sessionError) {
        console.error('[E2B] Failed to store session_id in projects:', sessionError.message);
      } else {
        console.log('[E2B] ✓ Session ID stored in projects table');
      }
    }

    // Store event in agent_events table
    if (capturedSessionId) {
      const { error } = await supabase
        .from('agent_events')
        .insert({
          session_id: capturedSessionId,
          project_id: PROJECT_ID,
          event_type: event.type,
          event_data: event,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[E2B] Failed to store event:', error.message);
      } else {
        eventCount++;
        if (event.type === 'result') {
          resultEventRecorded = true;
          console.log(`[E2B] ${event.subtype === 'success' ? '✓' : '✗'} ${event.subtype}`);

          // Trigger Metro reload and save to R2 after successful task completion
          // Reload first so user sees changes immediately, then save in background
          if (event.subtype === 'success') {
            await triggerMetroReload();
            await triggerSaveToR2();
          }
        } else if (event.type === 'assistant') {
          if (event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                const preview = block.text.substring(0, 100);
                console.log(`[E2B] 💬 ${preview}${block.text.length > 100 ? '...' : ''}`);
              } else if (block.type === 'tool_use') {
                console.log(`[E2B] 🔧 ${block.name}`);
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
    }
  } catch (error) {
    console.error('[E2B] Error storing event:', error.message);
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
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[E2B] Failed to store synthetic result event:', error.message);
    } else {
      resultEventRecorded = true;
      console.log(`[E2B] ✓ Synthetic result event stored (${source}, ${subtype})`);

      // Trigger Metro reload and save to R2 after successful task completion
      // Reload first so user sees changes immediately, then save in background
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
    await logOperation('r2_save', 'started', '[E2B] 💾 Triggering auto-save to R2...');

    // Use local save module (runs directly in E2B, no HTTP calls)
    const { saveProjectToR2, exportAndUploadBundle } = require('/home/user/save-to-r2.js');

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
        `[E2B] ✓ Project saved to R2: v${result.version}, ${result.fileCount} files`,
        { version: result.version, fileCount: result.fileCount }
      );

      // Export and upload iOS bundle for mobile app loading
      await triggerBundleExport(exportAndUploadBundle);
    } else {
      await logOperation(
        'r2_save',
        'failed',
        `[E2B] ✗ Failed to save to R2: ${result.error}`,
        { error: result.error }
      );
    }
  } catch (error) {
    await logOperation(
      'r2_save',
      'failed',
      `[E2B] ✗ Error triggering save to R2: ${error.message}`,
      { error: error.message }
    );
    // Don't throw - save failures shouldn't break the agent
  }
}

/**
 * Trigger iOS bundle export and upload to R2 (for mobile app loading)
 */
async function triggerBundleExport(exportAndUploadBundle) {
  try {
    await logOperation('bundle_export', 'started', '[E2B] 📦 Exporting iOS bundle...');

    const bundleResult = await exportAndUploadBundle({
      projectId: PROJECT_ID,
      projectDir: WORKING_DIRECTORY,
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      imagesBucketName: process.env.R2_IMAGES_BUCKET_NAME,
      imagesPublicUrl: process.env.R2_IMAGES_PUBLIC_URL,
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
    });

    if (bundleResult.success) {
      await logOperation(
        'bundle_export',
        'completed',
        `[E2B] ✓ iOS bundle exported: ${bundleResult.bundleUrl}`,
        { bundleUrl: bundleResult.bundleUrl }
      );
    } else {
      await logOperation(
        'bundle_export',
        'failed',
        `[E2B] ✗ Failed to export bundle: ${bundleResult.error}`,
        { error: bundleResult.error }
      );
    }
  } catch (error) {
    await logOperation(
      'bundle_export',
      'failed',
      `[E2B] ✗ Error exporting bundle: ${error.message}`,
      { error: error.message }
    );
    // Don't throw - bundle export failures shouldn't break the agent
  }
}

/**
 * Trigger Metro bundler reload (for Expo projects)
 */
async function triggerMetroReload() {
  try {
    await logOperation('metro_reload', 'started', '[E2B] 🔄 Triggering Metro reload...');

    // Use local metro-control module
    const { triggerMetroReload: metroReload } = require('/home/user/metro-control.js');

    const result = await metroReload();

    if (result.success) {
      await logOperation(
        'metro_reload',
        'completed',
        '[E2B] ✓ Metro reloaded - changes should appear in Expo Go'
      );
    } else {
      await logOperation(
        'metro_reload',
        'failed',
        `[E2B] ⚠️ Metro reload skipped: ${result.error}`,
        { error: result.error }
      );
    }
  } catch (error) {
    await logOperation(
      'metro_reload',
      'failed',
      `[E2B] ✗ Error triggering Metro reload: ${error.message}`,
      { error: error.message }
    );
    // Don't throw - reload failures shouldn't break the agent
  }
}

// Process stdout (NDJSON events)
claude.stdout.on('data', (data) => {
  stdoutChunkCount++;

  // Clear safety timeout once we get first output
  if (stdoutChunkCount === 1) {
    console.log('[E2B] ✓ Received first stdout chunk!');
    clearTimeout(safetyTimeout);
  }

  stdoutBuffer += data.toString();
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line);
      enqueueStore(event);
    } catch {
      // Not valid JSON, might be plain text output
      console.log('[E2B] Non-JSON output:', line.substring(0, 100));
    }
  }
});

// Process stderr (errors and warnings)
claude.stderr.on('data', (data) => {
  stderrChunkCount++;
  const text = data.toString();
  stderrBuffer += text;
  const lines = stderrBuffer.split('\n');
  stderrBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    // Log all stderr output (not just errors) for debugging
    console.error(`[E2B] stderr: ${line.substring(0, 200)}`);
  }
});

// Handle process exit (fires before 'close')
claude.on('exit', (code, signal) => {
  console.log(`[E2B] Claude process exited: code=${code}, signal=${signal}`);
  clearTimeout(safetyTimeout);
});

// Handle process completion
claude.on('close', async (code) => {
  clearTimeout(safetyTimeout);
  console.log(`[E2B] Claude process closed with code ${code}`);
  console.log(`[E2B] Stats: events=${eventCount}, stdout chunks=${stdoutChunkCount}, stderr chunks=${stderrChunkCount}`);

  await storeQueue.catch((error) => {
    console.error('[E2B] Error waiting for pending events:', error);
  });

  // Session status tracking removed - session_id stored in projects table for reuse only
  if (capturedSessionId) {
    console.log(`[E2B] ✓ Session ${capturedSessionId} ${code === 0 ? 'completed' : 'error'}`);
    if (!resultEventRecorded) {
      const subtype = code === 0 ? 'success' : 'error';
      console.log('[E2B] ! No result event detected, inserting fallback.');
      await storeSyntheticResult(subtype, 'fallback');
    }
  }

  // Clear agent_pid from database since task is complete
  try {
    const { error: clearPidError } = await supabase
      .from('projects')
      .update({ agent_pid: null })
      .eq('id', PROJECT_ID);

    if (clearPidError) {
      console.error('[E2B] Failed to clear agent_pid:', clearPidError.message);
    } else {
      console.log('[E2B] ✓ Agent PID cleared from database');
    }
  } catch (err) {
    console.error('[E2B] Error clearing agent_pid:', err.message);
  }

  // Exit with same code as claude
  process.exit(code);
});

// Handle script errors
claude.on('error', (error) => {
  console.error('[E2B] Failed to spawn Claude CLI:', error.message);
  process.exit(1);
});

// Handle script termination
process.on('SIGTERM', () => {
  console.log('[E2B] Received SIGTERM, terminating Claude process');
  resultEventRecorded = true;  // Prevent fallback error event - stop endpoint handles the cancelled event
  claude.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[E2B] Received SIGINT, terminating Claude process');
  resultEventRecorded = true;  // Prevent fallback error event
  claude.kill('SIGINT');
});

console.log('[E2B] Script initialized, waiting for Claude output...');

})().catch((error) => {
  console.error('[E2B] ✗ FATAL ERROR:', error.message);
  console.error('[E2B] Stack trace:', error.stack);
  process.exit(1);
});
