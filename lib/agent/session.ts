/**
 * Agent session lifecycle management with Supabase persistence
 *
 * This module handles creating, resuming, and managing agent sessions.
 * Sessions are stateful conversations that maintain context across multiple interactions.
 *
 * PRODUCTION IMPLEMENTATION:
 * - Uses Supabase for persistent storage (survives server restarts)
 * - RLS policies enforce multi-tenancy security
 * - Automatic cleanup of expired sessions
 * - Full ACID compliance for session state
 *
 * Educational notes:
 * - Sessions are identified by a unique sessionId returned by the SDK
 * - You can resume sessions to continue conversations without losing context
 * - All session metadata is stored in the agent_sessions table
 * - The query() function returns an async generator that yields messages
 *
 * @see https://platform.claude.com/docs/en/agent-sdk/sessions
 */

import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentSession } from "./types";
import { supabaseAdmin } from "../supabase-admin";

/**
 * Start a new agent session with Supabase persistence
 *
 * This function initializes a new conversation with Claude Agent SDK and
 * persists the session metadata to Supabase for tracking and resumption.
 *
 * How it works:
 * 1. Call query() with the initial prompt and options
 * 2. Wait for the first 'system' message with subtype 'init'
 * 3. Extract the session_id from that message
 * 4. Store session metadata in Supabase agent_sessions table
 * 5. Return both the sessionId and the stream for further processing
 *
 * @param prompt - Initial message to the agent
 * @param projectId - Project ID this session belongs to (for tracking)
 * @param userId - User ID who owns this session (for RLS)
 * @param options - Agent options (model, tools, working directory, etc.)
 * @returns Object containing sessionId and the query stream
 *
 * @throws Error if session ID cannot be extracted or database insert fails
 *
 * @example
 * ```typescript
 * const { sessionId, stream } = await startAgentSession(
 *   "Clone the expo template and start the dev server",
 *   "proj_123",
 *   "user_456",
 *   EXPO_BUILDER_OPTIONS
 * );
 *
 * // Process the rest of the stream
 * for await (const message of stream) {
 *   console.log(message);
 * }
 * ```
 */
export async function startAgentSession(
  prompt: string,
  projectId: string,
  userId: string,
  options?: Partial<Options>
): Promise<{ sessionId: string; stream: Query }> {
  console.log(`[Agent] Starting new session for project: ${projectId}`);

  // Create the query stream
  const stream = query({ prompt, options });

  let sessionId: string | undefined;
  let model: string | undefined;
  let permissionMode: string | undefined;

  // Extract session ID from the first system init message
  // This is the ONLY way to get the session ID - it's in the first message
  for await (const message of stream) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
      model = message.model;
      permissionMode = message.permissionMode;

      console.log(`[Agent] ✓ SDK session created: ${sessionId}`);
      console.log(`[Agent] Model: ${model}`);
      console.log(`[Agent] Tools: ${message.tools.length} available`);

      // Important: Break here to not consume the entire stream
      // The caller needs to process the remaining messages
      break;
    }
  }

  // If we didn't get a session ID, something went wrong
  if (!sessionId) {
    throw new Error(
      "Failed to extract session ID from agent. The agent may not have initialized correctly."
    );
  }

  // Store session metadata in Supabase
  try {
    const { error } = await supabaseAdmin.from("agent_sessions").insert({
      session_id: sessionId,
      project_id: projectId,
      user_id: userId,
      model: model || "claude-sonnet-4-5",
      permission_mode: permissionMode || "default",
      working_directory: options?.cwd || null,
      status: "active",
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[Agent] Failed to store session in Supabase:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`[Agent] ✓ Session persisted to Supabase`);
  } catch (error) {
    console.error("[Agent] Database error:", error);
    throw error;
  }

  return { sessionId, stream };
}

/**
 * Resume an existing agent session
 *
 * Use this to continue a conversation that was started earlier.
 * The SDK maintains all context and conversation history automatically.
 *
 * How it works:
 * 1. Fetch session from Supabase to verify it exists
 * 2. Update the last_activity_at timestamp
 * 3. Call query() with the resume option set to the sessionId
 * 4. Return the stream for processing
 *
 * @param sessionId - The session ID to resume (from startAgentSession)
 * @param prompt - New message to send to the agent
 * @param options - Optional agent options to override
 * @returns Query stream for the continued conversation
 *
 * @throws Error if session not found or expired
 *
 * @example
 * ```typescript
 * // Later, resume the conversation
 * const stream = await resumeAgentSession(
 *   sessionId,
 *   "Now add dark mode to the app"
 * );
 *
 * for await (const message of stream) {
 *   if (message.type === 'result') {
 *     console.log("Done:", message.result);
 *   }
 * }
 * ```
 */
export async function resumeAgentSession(
  sessionId: string,
  prompt: string,
  options?: Partial<Options>
): Promise<Query> {
  console.log(`[Agent] Attempting to resume session: ${sessionId}`);

  // Fetch session from Supabase
  const { data: session, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error || !session) {
    throw new Error(
      `Session ${sessionId} not found. It may have expired or been deleted.`
    );
  }

  // Check if session is still active
  if (session.status !== "active") {
    throw new Error(
      `Session ${sessionId} is ${session.status} and cannot be resumed.`
    );
  }

  // Update last activity timestamp
  const { error: updateError } = await supabaseAdmin
    .from("agent_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (updateError) {
    console.error("[Agent] Failed to update session activity:", updateError);
  }

  console.log(`[Agent] ✓ Resuming session for project: ${session.project_id}`);

  // Resume the session using the SDK's resume option
  return query({
    prompt,
    options: {
      ...options,
      resume: sessionId, // This is the key - tells SDK to continue the session
    },
  });
}

/**
 * Get session metadata from Supabase
 *
 * Retrieve information about a session without resuming it.
 * Useful for checking if a session exists or getting project context.
 *
 * @param sessionId - The session ID to look up
 * @returns Session metadata or null if not found
 *
 * @example
 * ```typescript
 * const session = await getSession(sessionId);
 * if (session) {
 *   console.log(`Session age: ${Date.now() - new Date(session.createdAt).getTime()}ms`);
 * }
 * ```
 */
export async function getSession(
  sessionId: string
): Promise<AgentSession | null> {
  const { data, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    sessionId: data.session_id,
    projectId: data.project_id,
    createdAt: new Date(data.created_at),
    lastActivity: new Date(data.last_activity_at),
  };
}

/**
 * Check if a session exists and is valid
 *
 * @param sessionId - The session ID to check
 * @returns true if session exists and is active, false otherwise
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("session_id, status")
    .eq("session_id", sessionId)
    .single();

  return !error && data !== null && data.status === "active";
}

/**
 * List all active sessions for a project
 *
 * Useful for debugging or showing users their active agent conversations.
 *
 * @param projectId - Project ID to filter by
 * @returns Array of sessions for this project
 *
 * @example
 * ```typescript
 * const projectSessions = await listProjectSessions("proj_123");
 * console.log(`Active sessions: ${projectSessions.length}`);
 * ```
 */
export async function listProjectSessions(
  projectId: string
): Promise<AgentSession[]> {
  const { data, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("last_activity_at", { ascending: false });

  if (error) {
    console.error("[Agent] Failed to list sessions:", error);
    return [];
  }

  return (
    data?.map((row) => ({
      sessionId: row.session_id,
      projectId: row.project_id,
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity_at),
    })) || []
  );
}

/**
 * Mark a session as completed
 *
 * Call this when the user explicitly ends a conversation or when the agent
 * completes its final task.
 *
 * @param sessionId - The session ID to complete
 * @param result - Optional final result message
 * @returns true if updated, false if not found
 */
export async function completeSession(
  sessionId: string,
  result?: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("agent_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: result ? { final_result: result } : {},
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[Agent] Failed to complete session:", error);
    return false;
  }

  console.log(`[Agent] Completed session: ${sessionId}`);
  return true;
}

/**
 * Mark a session as errored
 *
 * Call this when the agent encounters an unrecoverable error.
 *
 * @param sessionId - The session ID to mark as errored
 * @param errorMessage - Error message describing what went wrong
 * @returns true if updated, false if not found
 */
export async function errorSession(
  sessionId: string,
  errorMessage: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("agent_sessions")
    .update({
      status: "error",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[Agent] Failed to mark session as error:", error);
    return false;
  }

  console.log(`[Agent] Marked session as error: ${sessionId}`);
  return true;
}

/**
 * Clean up old or inactive sessions
 *
 * This function marks expired sessions as 'expired' based on their last activity.
 * Run this periodically via a cron job or background task.
 *
 * Production deployment:
 * - Set up a Vercel Cron job to run this hourly
 * - Or use Supabase Edge Functions with pg_cron
 * - Or run manually via an admin API endpoint
 *
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns Number of sessions marked as expired
 *
 * @example
 * ```typescript
 * // Clean up sessions older than 2 hours
 * const cleaned = await cleanupSessions(2 * 60 * 60 * 1000);
 * console.log(`Cleaned up ${cleaned} old sessions`);
 * ```
 */
export async function cleanupSessions(
  maxAgeMs: number = 3600000
): Promise<number> {
  const expiryDate = new Date(Date.now() - maxAgeMs);

  const { data, error } = await supabaseAdmin
    .from("agent_sessions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("last_activity_at", expiryDate.toISOString())
    .select("session_id");

  if (error) {
    console.error("[Agent] Failed to cleanup sessions:", error);
    return 0;
  }

  const count = data?.length || 0;

  if (count > 0) {
    console.log(`[Agent] ✓ Cleaned up ${count} expired sessions`);
  }

  return count;
}

/**
 * Delete a specific session permanently
 *
 * Use this when a user explicitly ends a conversation or closes a project.
 * This is a hard delete - the session cannot be recovered.
 *
 * @param sessionId - The session ID to delete
 * @returns true if deleted, false if not found
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("agent_sessions")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    console.error("[Agent] Failed to delete session:", error);
    return false;
  }

  console.log(`[Agent] Deleted session: ${sessionId}`);
  return true;
}

/**
 * Get total number of active sessions
 *
 * Useful for monitoring and capacity planning.
 *
 * @returns Count of active sessions
 */
export async function getActiveSessionCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    console.error("[Agent] Failed to count sessions:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get active sessions count for a specific user
 *
 * Useful for rate limiting or quota enforcement.
 *
 * @param userId - User ID to count sessions for
 * @returns Number of active sessions for this user
 */
export async function getUserActiveSessionCount(
  userId: string
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("agent_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    console.error("[Agent] Failed to count user sessions:", error);
    return 0;
  }

  return count || 0;
}
