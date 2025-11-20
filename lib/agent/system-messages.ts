/**
 * System Messages Helper
 *
 * Utilities for sending project-level system messages to the chat
 * that appear BEFORE an agent session exists (e.g., during server-side Expo setup).
 *
 * These messages are stored in agent_events with:
 * - project_id (set)
 * - session_id (null)
 * - event_type: "system"
 *
 * The chat panel subscribes to both session-based AND project-based events.
 */

import { supabaseAdmin } from "../supabase-admin";

/**
 * Send a system message to the project chat
 *
 * This appears in the chat immediately, even before an agent session exists.
 * Useful for showing progress during server-side operations.
 *
 * @param projectId - Project ID to send message to
 * @param message - Message text to display
 * @param metadata - Optional metadata (tool name, context, etc.)
 *
 * @example
 * ```typescript
 * await sendSystemMessage(projectId, "Cloning repository...");
 * await sendSystemMessage(projectId, "Installing dependencies...");
 * await sendSystemMessage(projectId, "Starting Expo...");
 * await sendSystemMessage(projectId, "✓ Expo ready! Scan the QR code.");
 * ```
 */
export async function sendSystemMessage(
  projectId: string,
  message: string,
  metadata?: {
    toolUse?: string;
    toolContext?: string;
    type?: "info" | "success" | "error" | "warning";
  }
): Promise<void> {
  try {
    await supabaseAdmin.from("agent_events").insert({
      project_id: projectId,
      session_id: null, // No session - this is a project-level message
      event_type: "system",
      event_data: {
        type: "system",
        subtype: metadata?.type || "info",
        message,
        toolUse: metadata?.toolUse,
        toolContext: metadata?.toolContext,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[SystemMessage] Sent to project ${projectId}: ${message}`);
  } catch (error) {
    console.error("[SystemMessage] Failed to send message:", error);
    // Don't throw - system messages are non-critical
  }
}

/**
 * Send multiple system messages in sequence
 *
 * Useful for showing a series of progress updates.
 *
 * @param projectId - Project ID
 * @param messages - Array of messages to send
 */
export async function sendSystemMessages(
  projectId: string,
  messages: string[]
): Promise<void> {
  for (const message of messages) {
    await sendSystemMessage(projectId, message);
  }
}
