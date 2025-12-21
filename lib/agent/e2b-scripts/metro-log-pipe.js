/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Metro Log Pipe Receiver (RUNS INSIDE E2B SANDBOX)
 *
 * Receives Metro output via stdin from tmux pipe-pane and sends to Supabase in real-time.
 * This is much more efficient than polling - logs appear instantly.
 *
 * Usage: tmux pipe-pane -t metro "node /home/user/metro-log-pipe.js"
 */

const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_ID = process.env.PROJECT_ID;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PROJECT_ID) {
  console.error('[LogPipe] Missing required env vars');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Batch logs to reduce Supabase calls
let logBatch = [];
let flushTimeout = null;
const BATCH_INTERVAL_MS = 500; // Flush every 500ms
const MAX_BATCH_SIZE = 20;

/**
 * Strip ANSI escape codes
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Parse log level from message content
 */
function parseLogLevel(message) {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('exception') || lower.includes('failed')) {
    return 'error';
  }
  if (lower.includes('warn') || lower.includes('warning')) {
    return 'warn';
  }
  if (lower.includes('log ') || lower.includes('console.log')) {
    return 'log';
  }
  return 'info';
}

/**
 * Flush batched logs to Supabase
 */
async function flushLogs() {
  flushTimeout = null;
  if (logBatch.length === 0) return;

  const logsToSend = [...logBatch];
  logBatch = [];

  try {
    const { error } = await supabase.from('agent_events').insert(logsToSend);
    if (error) {
      console.error('[LogPipe] Supabase error:', error.message);
    }
  } catch (err) {
    console.error('[LogPipe] Send error:', err.message);
  }
}

/**
 * Queue a log line for sending
 */
function queueLog(line) {
  const clean = stripAnsi(line).trim();
  if (!clean) return; // Skip empty lines

  logBatch.push({
    project_id: PROJECT_ID,
    session_id: null,
    event_type: 'log',
    event_data: {
      type: 'log',
      level: parseLogLevel(clean),
      message: clean,
      source: 'metro',
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  // Schedule flush
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, BATCH_INTERVAL_MS);
  }

  // Immediate flush if batch is full
  if (logBatch.length >= MAX_BATCH_SIZE) {
    clearTimeout(flushTimeout);
    flushLogs();
  }
}

// Read from stdin line by line
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', (line) => {
  queueLog(line);
});

// Flush remaining logs on exit
process.on('exit', () => {
  if (logBatch.length > 0) {
    // Sync flush on exit (best effort)
    flushLogs();
  }
});

process.on('SIGTERM', () => {
  flushLogs().then(() => process.exit(0));
});
