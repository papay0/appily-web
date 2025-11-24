/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * E2B Centralized Logging Module (RUNS INSIDE E2B SANDBOX)
 *
 * This module provides unified logging for E2B operations, sending logs to BOTH:
 * 1. Console (for E2B server logs)
 * 2. Supabase (for frontend chat panel visibility)
 *
 * This makes operations like Metro reload and R2 save visible in the frontend,
 * making debugging much easier than checking E2B logs separately.
 *
 * Usage:
 *   const { initLogger, logOperation } = require('/home/user/e2b-logger.js');
 *   initLogger(supabaseClient, projectId, sessionId);
 *   await logOperation('r2_save', 'started', '[E2B] Starting save...');
 */

let supabaseClient = null;
let projectId = null;
let sessionId = null;

/**
 * Initialize the logger with Supabase client and project context
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} projId - Project ID
 * @param {string|null} sessId - Session ID (optional, null for pre-session logs)
 */
function initLogger(supabase, projId, sessId = null) {
  supabaseClient = supabase;
  projectId = projId;
  sessionId = sessId;
}

/**
 * Log an operation to both console and Supabase
 *
 * @param {string} operation - Operation type: 'metro_reload', 'r2_save', 'r2_restore'
 * @param {string} status - Operation status: 'started', 'progress', 'completed', 'failed'
 * @param {string} message - Human-readable log message
 * @param {Object} details - Additional structured details (optional)
 * @returns {Promise<void>}
 */
async function logOperation(operation, status, message, details = {}) {
  // Always log to console for E2B server logs
  console.log(message);

  // Also send to Supabase for frontend visibility
  if (!supabaseClient || !projectId) {
    // Logger not initialized yet (e.g., during early setup)
    return;
  }

  try {
    await supabaseClient.from('agent_events').insert({
      project_id: projectId,
      session_id: sessionId,
      event_type: 'system',
      event_data: {
        type: 'system',
        subtype: 'operation', // Distinguishes operational logs from regular system messages
        operation, // Type of operation (metro_reload, r2_save, etc.)
        status, // Current status (started, progress, completed, failed)
        message, // Human-readable message
        details, // Structured details for filtering/debugging
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Log to console but don't throw - logging failures shouldn't break operations
    console.error('[E2BLogger] Failed to log to Supabase:', error.message);
  }
}

module.exports = {
  initLogger,
  logOperation,
};
