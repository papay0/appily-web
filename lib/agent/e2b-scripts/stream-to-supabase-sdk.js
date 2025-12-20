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
 * - SYSTEM_PROMPT: System instructions for Claude (~40K tokens, only used on first request)
 * - USER_MESSAGE: The user's message (~500-2000 tokens)
 * - WORKING_DIRECTORY: Working directory for Claude (default: /home/user/project)
 *
 * This script is uploaded to E2B by Vercel and runs independently.
 */

// ============ EARLY DEBUG LOGGING ============
// This runs BEFORE any npm requires to catch all errors
const fs = require('fs');
const DEBUG_LOG = '/home/user/sdk-early-debug.log';

function earlyLog(msg) {
  try {
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(`[SDK-EARLY] ${msg}`);
  } catch (e) {
    // Can't even write to file - nothing we can do
    console.error(`[SDK-EARLY] Failed to write log: ${e.message}`);
  }
}

// Clear previous log
try { fs.writeFileSync(DEBUG_LOG, ''); } catch {}

earlyLog('=== SDK SCRIPT STARTING ===');
earlyLog(`PID: ${process.pid}`);
earlyLog(`NODE_PATH: ${process.env.NODE_PATH || '(not set)'}`);
earlyLog(`CWD: ${process.cwd()}`);
earlyLog(`__dirname: ${__dirname}`);
earlyLog(`ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`);
earlyLog(`SUPABASE_URL present: ${!!process.env.SUPABASE_URL}`);
earlyLog(`PROJECT_ID: ${process.env.PROJECT_ID || '(not set)'}`);

// Try to find where global modules are
try {
  const { execSync } = require('child_process');
  const globalPath = execSync('npm root -g 2>/dev/null || echo "unknown"').toString().trim();
  earlyLog(`npm root -g: ${globalPath}`);

  // Also check if the SDK package exists at that path
  const sdkPath = `${globalPath}/@anthropic-ai/claude-agent-sdk`;
  const sdkExists = fs.existsSync(sdkPath);
  earlyLog(`SDK path exists (${sdkPath}): ${sdkExists}`);

  if (sdkExists) {
    // List the contents to verify
    const sdkContents = fs.readdirSync(sdkPath);
    earlyLog(`SDK directory contents: ${sdkContents.slice(0, 5).join(', ')}${sdkContents.length > 5 ? '...' : ''}`);
  }
} catch (e) {
  earlyLog(`npm root -g check failed: ${e.message}`);
}

// Now try the requires with individual error handling
earlyLog('--- Loading modules ---');

let createClient, initLogger, logOperation;

try {
  earlyLog('Loading @supabase/supabase-js...');
  const supabase = require('@supabase/supabase-js');
  createClient = supabase.createClient;
  earlyLog('✓ Supabase loaded');
} catch (e) {
  earlyLog(`✗ Supabase FAILED: ${e.message}`);
  earlyLog(`Stack: ${e.stack}`);
  process.exit(1);
}

try {
  earlyLog('Loading /home/user/e2b-logger.js...');
  const logger = require('/home/user/e2b-logger.js');
  initLogger = logger.initLogger;
  logOperation = logger.logOperation;
  earlyLog('✓ e2b-logger loaded');
} catch (e) {
  earlyLog(`✗ e2b-logger FAILED: ${e.message}`);
  earlyLog(`Stack: ${e.stack}`);
  process.exit(1);
}

earlyLog('--- All initial modules loaded successfully ---');
// ============ END EARLY DEBUG LOGGING ============

// Main async function
(async function main() {

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SESSION_ID = process.env.SESSION_ID; // May be undefined for new sessions
const PROJECT_ID = process.env.PROJECT_ID;
const USER_ID = process.env.USER_ID;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT; // System instructions (~40K tokens)
let USER_MESSAGE = process.env.USER_MESSAGE; // User's request (~500-2000 tokens, may be modified with history)
const WORKING_DIRECTORY = process.env.WORKING_DIRECTORY || '/home/user/project';

// Convex MCP configuration (optional - only if Convex is enabled for this project)
const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY;
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
const CONVEX_ENABLED = !!(CONVEX_DEPLOY_KEY && CONVEX_URL);

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

if (!USER_MESSAGE) {
  console.error('[E2B-SDK] ERROR: Missing USER_MESSAGE');
  process.exit(1);
}

// SYSTEM_PROMPT is only required for first request (no SESSION_ID)
// On follow-up with resume, SDK maintains system prompt internally
if (!SESSION_ID && !SYSTEM_PROMPT) {
  console.error('[E2B-SDK] ERROR: Missing SYSTEM_PROMPT for first request (no SESSION_ID)');
  process.exit(1);
}

console.log('[E2B-SDK] Starting Claude SDK stream to Supabase');
console.log('[E2B-SDK] Using Claude Agent SDK with ANTHROPIC_API_KEY');
console.log(`[E2B-SDK] Project ID: ${PROJECT_ID}`);
console.log(`[E2B-SDK] Session ID: ${SESSION_ID || '(new session)'}`);
console.log(`[E2B-SDK] Working directory: ${WORKING_DIRECTORY}`);
console.log(`[E2B-SDK] System prompt: ${SYSTEM_PROMPT ? `${SYSTEM_PROMPT.length} chars` : '(not needed - resuming session)'}`);
console.log(`[E2B-SDK] User message: ${USER_MESSAGE.length} chars`);
console.log(`[E2B-SDK] Mode: ${SESSION_ID ? '📎 RESUME (user message only ~500 tokens)' : '🆕 NEW (system prompt + user message)'}`);
console.log(`[E2B-SDK] NODE_PATH: ${process.env.NODE_PATH || '(not set)'}`);
console.log(`[E2B-SDK] Convex MCP: ${CONVEX_ENABLED ? '✓ enabled' : '✗ disabled'}`);
if (CONVEX_ENABLED) {
  console.log(`[E2B-SDK] Convex URL: ${CONVEX_URL}`);
}

// Initialize Supabase client with service role key
let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log('[E2B-SDK] ✓ Supabase client created');

  // Test connection by doing a simple query
  const { error: testError } = await supabase.from('projects').select('id').limit(1);
  if (testError) {
    console.error('[E2B-SDK] ✗ Supabase connection test failed:', testError.message);
    console.error('[E2B-SDK] Error details:', JSON.stringify(testError, null, 2));
    process.exit(1);
  }
  console.log('[E2B-SDK] ✓ Supabase connection verified');

  // Initialize centralized logger for operational logs (Metro reload, R2 save, etc.)
  initLogger(supabase, PROJECT_ID, SESSION_ID);
} catch (error) {
  console.error('[E2B-SDK] ✗ Failed to create Supabase client:', error.message);
  console.error('[E2B-SDK] Stack:', error.stack);
  process.exit(1);
}

// Helper to send debug logs to Supabase (visible in Appily UI)
async function debugLog(message, data = null) {
  console.log(`[E2B-SDK-DEBUG] ${message}`, data ? JSON.stringify(data) : '');
  try {
    await supabase.from('agent_events').insert({
      session_id: capturedSessionId || SESSION_ID || 'sdk-debug',
      project_id: PROJECT_ID,
      event_type: 'system',
      event_data: {
        type: 'system',
        subtype: 'debug',
        message: `[SDK] ${message}`,
        data: data,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[E2B-SDK-DEBUG] Failed to log to Supabase:', err.message);
  }
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
      console.error('[E2B-SDK] Failed to load conversation history:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[E2B-SDK] Error loading conversation history:', err.message);
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

  console.log(`[E2B-SDK] Loaded ${historyLines.length} conversation turns from history`);

  return `## Previous Conversation History:

${historyLines.join('\n\n')}

## Current Request:
${currentPrompt}`;
}

// Track session ID (will be extracted from first event)
let capturedSessionId = SESSION_ID;
let eventCount = 0;
let resultEventRecorded = false;
let storeQueue = Promise.resolve();

/**
 * Store event in Supabase
 */
async function storeEvent(message) {
  try {
    // Extract session ID from init event
    if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
      capturedSessionId = message.session_id;
      console.log(`[E2B-SDK] ✓ Session initialized: ${capturedSessionId}`);

      // Store session_id in projects table for conversation resumption
      const { error: sessionError } = await supabase
        .from('projects')
        .update({ session_id: capturedSessionId })
        .eq('id', PROJECT_ID);

      if (sessionError) {
        console.error('[E2B-SDK] Failed to store session_id in projects:', sessionError.message);
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

          // Trigger Metro reload and save to R2 after successful task completion
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

function enqueueStore(message) {
  storeQueue = storeQueue
    .then(() => storeEvent(message))
    .catch((error) => {
      console.error('[E2B-SDK] Failed to store event in queue:', error);
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
      console.error('[E2B-SDK] Failed to store synthetic result event:', error.message);
    } else {
      resultEventRecorded = true;
      console.log(`[E2B-SDK] ✓ Synthetic result event stored (${source}, ${subtype})`);

      // Trigger Metro reload and save to R2 after successful task completion
      if (subtype === 'success') {
        await triggerMetroReload();
        await triggerSaveToR2();
      }
    }
  } catch (error) {
    console.error('[E2B-SDK] Error storing synthetic result event:', error.message);
  }
}

/**
 * Trigger save to R2 directly from E2B (no Vercel middleman)
 */
async function triggerSaveToR2() {
  try {
    await logOperation('r2_save', 'started', '[E2B-SDK] 💾 Triggering auto-save to R2...');

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
        `[E2B-SDK] ✓ Project saved to R2: v${result.version}, ${result.fileCount} files`,
        { version: result.version, fileCount: result.fileCount }
      );

      // Export and upload iOS bundle for mobile app loading
      await triggerBundleExport(exportAndUploadBundle);
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
    // Don't throw - save failures shouldn't break the agent
  }
}

/**
 * Trigger iOS bundle export and upload to R2 (for mobile app loading)
 */
async function triggerBundleExport(exportAndUploadBundle) {
  try {
    await logOperation('bundle_export', 'started', '[E2B-SDK] 📦 Exporting iOS bundle...');

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
        `[E2B-SDK] ✓ iOS bundle exported: ${bundleResult.bundleUrl}`,
        { bundleUrl: bundleResult.bundleUrl }
      );
    } else {
      await logOperation(
        'bundle_export',
        'failed',
        `[E2B-SDK] ✗ Failed to export bundle: ${bundleResult.error}`,
        { error: bundleResult.error }
      );
    }
  } catch (error) {
    await logOperation(
      'bundle_export',
      'failed',
      `[E2B-SDK] ✗ Error exporting bundle: ${error.message}`,
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
    await logOperation('metro_reload', 'started', '[E2B-SDK] 🔄 Triggering Metro reload...');

    // Use local metro-control module
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
    // Don't throw - reload failures shouldn't break the agent
  }
}

// Check if we need to load conversation history (session lost due to sandbox recreation)
// Note: SDK has built-in session resumption, but if sandbox was recreated, session is lost
let useSessionResume = !!SESSION_ID;

// For SDK, we'll try to resume and if it fails, load history
// The SDK's resume option will handle session check internally

console.log('[E2B-SDK] Starting SDK query...');
console.log(`[E2B-SDK] User message length: ${USER_MESSAGE.length} chars`);
if (SYSTEM_PROMPT) {
  console.log(`[E2B-SDK] System prompt length: ${SYSTEM_PROMPT.length} chars`);
}

// Send initial debug log to Supabase
await debugLog('Script started', {
  projectId: PROJECT_ID,
  sessionId: SESSION_ID,
  workingDir: WORKING_DIRECTORY,
  userMessageLength: USER_MESSAGE.length,
  systemPromptLength: SYSTEM_PROMPT ? SYSTEM_PROMPT.length : 0,
  isResume: !!SESSION_ID,
  expectedInputTokens: SESSION_ID ? '~500-2000 (resume mode)' : '~40000+ (new session)',
  nodePath: process.env.NODE_PATH,
  apiKeyPresent: !!ANTHROPIC_API_KEY,
  apiKeyPrefix: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.substring(0, 15) + '...' : 'missing',
  convexEnabled: CONVEX_ENABLED,
  convexUrl: CONVEX_URL || null,
});

// Try to import the SDK (using dynamic import since it's an ES Module)
await debugLog('Importing SDK...');
let query;
try {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  query = sdk.query;
  await debugLog('SDK imported successfully', {
    hasQuery: typeof query === 'function',
    sdkKeys: Object.keys(sdk),
  });
} catch (importErr) {
  await debugLog('SDK import FAILED', {
    error: importErr.message,
    stack: importErr.stack,
    code: importErr.code,
  });
  console.error('[E2B-SDK] Failed to import SDK:', importErr);
  process.exit(1);
}

await debugLog('Starting query()', {
  cwd: WORKING_DIRECTORY,
  useSessionResume,
  sessionId: useSessionResume ? SESSION_ID : '(new)',
});

try {
  // Use SDK query() with async iteration
  // The SDK internally spawns claude CLI with the appropriate flags
  let messageIndex = 0;

  // Base allowed tools
  const allowedTools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'Skill', 'TodoWrite', 'TodoRead'];

  // Build query options
  // CRITICAL TOKEN OPTIMIZATION:
  // - First request (no SESSION_ID): Include systemPrompt (~40K tokens) + prompt (~500 tokens)
  // - Follow-up (with SESSION_ID): Use resume option, SDK maintains systemPrompt internally
  //   Only send prompt (~500 tokens) - this reduces input from 60K to ~500 tokens per request!
  const queryOptions = {
    cwd: WORKING_DIRECTORY,
    allowedTools,
    settingSources: ['project'], // Load skills from .claude/skills/ directory
    permissionMode: 'bypassPermissions', // Auto-approve all operations (required for E2B automation)
    allowDangerouslySkipPermissions: true, // REQUIRED for bypassPermissions mode to work
  };

  // Only include systemPrompt on FIRST request (no session to resume)
  // For follow-ups with resume, SDK maintains the system prompt internally - no need to resend!
  if (useSessionResume) {
    queryOptions.resume = SESSION_ID;
    console.log('[E2B-SDK] 📎 Using resume mode - systemPrompt NOT included (SDK maintains it)');
    console.log(`[E2B-SDK] 📊 Expected input tokens: ~${USER_MESSAGE.length / 4} (user message only)`);
  } else {
    queryOptions.systemPrompt = SYSTEM_PROMPT;
    console.log('[E2B-SDK] 🆕 First request - systemPrompt included');
    console.log(`[E2B-SDK] 📊 Expected input tokens: ~${(SYSTEM_PROMPT.length + USER_MESSAGE.length) / 4} (system + user)`);
  }

  // Add Convex MCP server if enabled
  // This gives the agent access to query tables, run functions, view logs, etc.
  if (CONVEX_ENABLED) {
    console.log('[E2B-SDK] Adding Convex MCP server to query options...');
    queryOptions.mcpServers = {
      convex: {
        command: 'npx',
        args: ['-y', 'convex@latest', 'mcp', 'start'],
      },
    };
    // Add Convex MCP tools to allowed tools
    allowedTools.push(
      'mcp__convex__status',
      'mcp__convex__tables',
      'mcp__convex__data',
      'mcp__convex__runOneoffQuery',
      'mcp__convex__functionSpec',
      'mcp__convex__run',
      'mcp__convex__logs'
    );
    console.log('[E2B-SDK] ✓ Convex MCP configured with tools:', allowedTools.filter(t => t.startsWith('mcp__convex')).join(', '));
  }

  for await (const message of query({
    prompt: USER_MESSAGE,
    options: queryOptions,
  })) {
    messageIndex++;
    await debugLog(`Message #${messageIndex}`, {
      type: message.type,
      subtype: message.subtype,
      hasContent: !!message.message?.content,
    });

    // Store each message directly - SDK provides typed messages
    // No NDJSON parsing needed!
    enqueueStore(message);
  }

  // Wait for all pending stores to complete
  await storeQueue.catch((error) => {
    console.error('[E2B-SDK] Error waiting for pending events:', error);
  });

  await debugLog('Query completed successfully', {
    eventCount,
    messageIndex,
    resultEventRecorded,
  });

  console.log(`[E2B-SDK] ✓ Query completed. Events stored: ${eventCount}`);

  // Store synthetic result if none was recorded
  if (!resultEventRecorded) {
    console.log('[E2B-SDK] ! No result event detected, inserting fallback success.');
    await storeSyntheticResult('success', 'sdk-fallback');
  }

} catch (error) {
  await debugLog('Query FAILED', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
  });
  console.error('[E2B-SDK] ✗ SDK query failed:', error.message);
  console.error('[E2B-SDK] Stack:', error.stack);

  // Check if this is a session not found error - load history and retry
  if (error.message && error.message.includes('No conversation found') && SESSION_ID) {
    console.log('[E2B-SDK] Session not found - sandbox was likely recreated');
    console.log('[E2B-SDK] Loading conversation history from Supabase...');

    const history = await loadConversationHistory();

    if (history.length > 0) {
      USER_MESSAGE = formatPromptWithHistory(history, USER_MESSAGE);
      console.log('[E2B-SDK] ✓ Conversation history loaded and added to prompt');

      // Retry without session resume - need to include systemPrompt since session was lost
      try {
        const retryOptions = { ...queryOptions };
        delete retryOptions.resume; // No resume - starting fresh with history in prompt
        retryOptions.systemPrompt = SYSTEM_PROMPT; // Need to resend since session was lost

        console.log('[E2B-SDK] 🔄 Retrying with systemPrompt + history context');

        for await (const message of query({
          prompt: USER_MESSAGE,
          options: retryOptions,
        })) {
          enqueueStore(message);
        }

        await storeQueue.catch((err) => {
          console.error('[E2B-SDK] Error waiting for pending events:', err);
        });

        console.log(`[E2B-SDK] ✓ Retry query completed. Events stored: ${eventCount}`);

        if (!resultEventRecorded) {
          await storeSyntheticResult('success', 'sdk-fallback-retry');
        }
      } catch (retryError) {
        console.error('[E2B-SDK] ✗ Retry also failed:', retryError.message);
        await storeSyntheticResult('error', 'sdk-retry-error');
        process.exit(1);
      }
    } else {
      console.log('[E2B-SDK] No conversation history found, cannot recover');
      await storeSyntheticResult('error', 'sdk-no-history');
      process.exit(1);
    }
  } else {
    // Store error result
    await storeSyntheticResult('error', 'sdk-error');
    process.exit(1);
  }
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
