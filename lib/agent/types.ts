/**
 * Type definitions for the Claude Agent SDK integration
 *
 * This file provides TypeScript types for type-safe agent interactions.
 * These types are used across the entire agent system for consistency.
 *
 * @see https://docs.claude.com/en/api/agent-sdk/typescript
 */

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Represents an active agent session
 *
 * Sessions are stateful conversations that can be resumed using the sessionId.
 * The SDK automatically maintains context and conversation history.
 */
export interface AgentSession {
  /** Unique session identifier from Claude SDK */
  sessionId: string;

  /** Project ID this session belongs to */
  projectId: string;

  /** When the session was created */
  createdAt: Date;

  /** Last time this session received a message */
  lastActivity: Date;
}

/**
 * Stream events emitted during agent execution
 *
 * These events provide real-time updates as the agent works.
 * Use this for UI progress indicators and logging.
 */
export interface AgentStreamEvent {
  /** Event type for discriminated union pattern */
  type: "message" | "progress" | "error" | "complete";

  /** Event payload - varies by type */
  data: SDKMessage | string;

  /** When this event occurred */
  timestamp: Date;
}

/**
 * Permission modes for agent execution
 *
 * Controls how the agent handles operations that require user approval:
 * - 'default': Standard permission behavior (asks for destructive operations)
 * - 'acceptEdits': Auto-approve file edits, ask for everything else
 * - 'bypassPermissions': Auto-approve all operations (use with caution!)
 * - 'plan': Planning mode - no actual execution, just planning
 *
 * @see https://docs.claude.com/en/docs/agent-sdk/permissions
 */
export type AgentPermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan";

/**
 * Result from starting an agent session
 */
export interface StartSessionResult {
  /** Session ID for resuming the conversation */
  sessionId: string;

  /** Project ID this session is associated with */
  projectId: string;

  /** Human-readable status message */
  message: string;
}

/**
 * Result from resuming an agent session
 */
export interface ResumeSessionResult {
  /** Session ID that was resumed */
  sessionId: string;

  /** All messages received in this interaction */
  messages: AgentStreamEvent[];
}
