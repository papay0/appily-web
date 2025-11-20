/**
 * NDJSON Parser for Claude CLI Streaming Output
 *
 * The Claude CLI with `--output-format stream-json` outputs newline-delimited JSON (NDJSON).
 * Each line is a separate JSON event representing different stages of agent execution.
 *
 * Event Types:
 * - system: Initialization, configuration, session info
 * - assistant: Claude's responses and tool use
 * - tool_result: Results from tool executions
 * - result: Final outcome (success or error)
 * - stream_event: Real-time streaming content
 *
 * This parser provides:
 * - Safe JSON parsing with error handling
 * - Type-safe event discrimination
 * - Real-time event streaming to Supabase
 * - Utility functions for extracting specific data (URLs, errors, etc.)
 *
 * @see https://docs.claude.com/en/docs/claude-cli#streaming-output
 */

import { supabaseAdmin } from "../supabase-admin";

/**
 * Base interface for all CLI events
 */
export interface CLIEvent {
  type: string;
  timestamp?: string;
}

/**
 * System initialization event
 * Contains session ID, model, working directory, available tools
 */
export interface CLISystemEvent extends CLIEvent {
  type: "system";
  subtype: "init" | "config" | "permission";
  session_id?: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  permissionMode?: string;
}

/**
 * Assistant message event
 * Contains Claude's text responses and tool use blocks
 */
export interface CLIAssistantEvent extends CLIEvent {
  type: "assistant";
  message: {
    role: "assistant";
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: unknown }
    >;
  };
}

/**
 * Tool result event
 * Contains output from tool executions (Read, Edit, Bash, etc.)
 */
export interface CLIToolResultEvent extends CLIEvent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Result event
 * Final outcome of the agent execution
 */
export interface CLIResultEvent extends CLIEvent {
  type: "result";
  subtype: "success" | "error" | "max_turns" | "timeout";
  result?: string;
  error?: string;
}

/**
 * Stream event
 * Real-time partial responses as they're generated
 */
export interface CLIStreamEvent extends CLIEvent {
  type: "stream_event";
  event_type: "content_block_start" | "content_block_delta" | "content_block_stop";
  delta?: {
    type: "text_delta";
    text: string;
  };
}

/**
 * Union type for all possible CLI events
 */
export type ParsedCLIEvent =
  | CLISystemEvent
  | CLIAssistantEvent
  | CLIToolResultEvent
  | CLIResultEvent
  | CLIStreamEvent;

/**
 * Parse a single NDJSON line from CLI output
 *
 * Safely parses JSON with error handling. Returns null for:
 * - Empty lines
 * - Non-JSON output (stderr, debug logs)
 * - Malformed JSON
 *
 * @param line - Raw NDJSON line from CLI stdout
 * @returns Parsed event or null if not valid JSON
 *
 * @example
 * ```typescript
 * const event = parseNDJSONLine('{"type":"system","subtype":"init","session_id":"sess_123"}');
 * if (event?.type === "system") {
 *   console.log("Session:", event.session_id);
 * }
 * ```
 */
export function parseNDJSONLine(line: string): ParsedCLIEvent | null {
  // Skip empty lines
  if (!line.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(line);

    // Validate it's an event object with a type
    if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
      return parsed as ParsedCLIEvent;
    }

    return null;
  } catch (error) {
    // Not JSON - could be stderr or debug output
    // This is normal, just skip
    return null;
  }
}

/**
 * Parse multiple NDJSON lines from CLI output
 *
 * Processes entire CLI output, filtering out non-JSON lines.
 * Useful for post-processing after CLI execution completes.
 *
 * @param output - Full CLI output string with multiple lines
 * @returns Array of successfully parsed events
 *
 * @example
 * ```typescript
 * const output = await sandbox.commands.run("claude -p 'Hello'");
 * const events = parseNDJSONOutput(output.stdout);
 * const sessionId = events.find(e => e.type === "system")?.session_id;
 * ```
 */
export function parseNDJSONOutput(output: string): ParsedCLIEvent[] {
  const lines = output.split("\n");
  const events: ParsedCLIEvent[] = [];

  for (const line of lines) {
    const event = parseNDJSONLine(line);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Extract session ID from CLI events
 *
 * Searches for the system init event containing the session ID.
 * This is needed for session resumption.
 *
 * @param events - Array of parsed CLI events
 * @returns Session ID or null if not found
 *
 * @example
 * ```typescript
 * const events = parseNDJSONOutput(cliOutput);
 * const sessionId = extractSessionId(events);
 * if (sessionId) {
 *   await storeSessionInSupabase(sessionId);
 * }
 * ```
 */
export function extractSessionId(events: ParsedCLIEvent[]): string | null {
  for (const event of events) {
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      return event.session_id;
    }
  }

  return null;
}

/**
 * Extract all text responses from assistant events
 *
 * Filters out tool use blocks, returning only Claude's actual text responses.
 * Useful for displaying conversation history to users.
 *
 * @param events - Array of parsed CLI events
 * @returns Array of text strings from Claude
 *
 * @example
 * ```typescript
 * const events = parseNDJSONOutput(cliOutput);
 * const responses = extractTextResponses(events);
 * responses.forEach(text => console.log("Claude:", text));
 * ```
 */
export function extractTextResponses(events: ParsedCLIEvent[]): string[] {
  const responses: string[] = [];

  for (const event of events) {
    if (event.type === "assistant") {
      for (const content of event.message.content) {
        if (content.type === "text") {
          responses.push(content.text);
        }
      }
    }
  }

  return responses;
}

/**
 * Extract all tool uses from assistant events
 *
 * Returns information about which tools Claude used and with what inputs.
 * Useful for debugging, logging, and UI progress indicators.
 *
 * @param events - Array of parsed CLI events
 * @returns Array of tool use objects
 *
 * @example
 * ```typescript
 * const events = parseNDJSONOutput(cliOutput);
 * const toolUses = extractToolUses(events);
 * toolUses.forEach(tool => console.log(`Used ${tool.name}:`, tool.input));
 * ```
 */
export function extractToolUses(
  events: ParsedCLIEvent[]
): Array<{ id: string; name: string; input: unknown }> {
  const toolUses: Array<{ id: string; name: string; input: unknown }> = [];

  for (const event of events) {
    if (event.type === "assistant") {
      for (const content of event.message.content) {
        if (content.type === "tool_use") {
          toolUses.push({
            id: content.id,
            name: content.name,
            input: content.input,
          });
        }
      }
    }
  }

  return toolUses;
}

/**
 * Check if CLI execution was successful
 *
 * @param events - Array of parsed CLI events
 * @returns true if result event has subtype "success"
 */
export function isExecutionSuccessful(events: ParsedCLIEvent[]): boolean {
  return events.some(
    (event) => event.type === "result" && event.subtype === "success"
  );
}

/**
 * Extract error message from CLI events
 *
 * @param events - Array of parsed CLI events
 * @returns Error message or null if no error
 */
export function extractErrorMessage(events: ParsedCLIEvent[]): string | null {
  for (const event of events) {
    if (event.type === "result" && event.subtype !== "success") {
      return event.error || `Execution failed: ${event.subtype}`;
    }
  }

  return null;
}

/**
 * Extract Expo URL from CLI events
 *
 * Searches both assistant text responses AND tool_result events for Expo tunnel URLs.
 * The Expo URL typically appears in BashOutput tool results from `npx expo start --tunnel`.
 * Pattern: exp://hostname:port
 *
 * @param events - Array of parsed CLI events
 * @returns Expo URL or null if not found
 *
 * @example
 * ```typescript
 * const events = parseNDJSONOutput(cliOutput);
 * const expoUrl = extractExpoUrl(events);
 * if (expoUrl) {
 *   const qr = await generateQRCode(expoUrl);
 * }
 * ```
 */
export function extractExpoUrl(events: ParsedCLIEvent[]): string | null {
  // First, check tool_result events (most likely source for Expo URLs from BashOutput)
  for (const event of events) {
    if (event.type === "tool_result" && event.content) {
      const match = event.content.match(/exp:\/\/[\w\-\.]+:\d+/);
      if (match) {
        console.log(`[NDJSON Parser] ✓ Found Expo URL in tool_result: ${match[0]}`);
        return match[0];
      }
    }
  }

  // Fallback: check assistant text responses
  const textResponses = extractTextResponses(events);
  for (const text of textResponses) {
    const match = text.match(/exp:\/\/[\w\-\.]+:\d+/);
    if (match) {
      console.log(`[NDJSON Parser] ✓ Found Expo URL in assistant response: ${match[0]}`);
      return match[0];
    }
  }

  console.log("[NDJSON Parser] No Expo URL found in events");
  return null;
}

/**
 * Store CLI event in Supabase for real-time streaming
 *
 * This enables real-time progress updates to the frontend via Supabase Realtime.
 * Each event is stored with a timestamp for chronological ordering.
 *
 * Events are now stored with BOTH session_id AND project_id so:
 * - User can see ALL events for a project (across multiple sessions)
 * - Events remain session-specific for Claude's context
 *
 * @param sessionId - Agent session ID
 * @param event - Parsed CLI event to store
 * @param projectId - Project ID (optional, looked up from session if not provided)
 *
 * @example
 * ```typescript
 * // In onStdout callback
 * const event = parseNDJSONLine(line);
 * if (event) {
 *   await storeEventInSupabase(sessionId, event, projectId);
 * }
 * ```
 */
export async function storeEventInSupabase(
  sessionId: string,
  event: ParsedCLIEvent,
  projectId?: string
): Promise<void> {
  try {
    // If projectId not provided, look it up from the session
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const { data: session } = await supabaseAdmin
        .from("agent_sessions")
        .select("project_id")
        .eq("session_id", sessionId)
        .single();

      resolvedProjectId = session?.project_id;
    }

    // Store event in agent_events table for real-time streaming
    await supabaseAdmin.from("agent_events").insert({
      session_id: sessionId,
      project_id: resolvedProjectId || null, // Store project_id for project-scoped queries
      event_type: event.type,
      event_data: event,
      created_at: new Date().toISOString(),
    });

    // Update session's last activity timestamp
    await supabaseAdmin
      .from("agent_sessions")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("session_id", sessionId);
  } catch (error) {
    // Don't throw - we don't want event storage failures to break CLI execution
    console.error(`[NDJSON Parser] Failed to store event in Supabase:`, error);
  }
}

/**
 * Stream CLI events to Supabase in real-time
 *
 * This is an async generator that parses NDJSON lines as they arrive
 * and stores them in Supabase for real-time frontend updates.
 *
 * @param sessionId - Agent session ID
 * @param lines - Async iterator of NDJSON lines from CLI stdout
 *
 * @example
 * ```typescript
 * const proc = await sandbox.commands.run("claude -p 'Build app'", {
 *   onStdout: async (line) => {
 *     const event = parseNDJSONLine(line);
 *     if (event) {
 *       await storeEventInSupabase(sessionId, event);
 *     }
 *   }
 * });
 * ```
 */
export async function* streamEventsToSupabase(
  sessionId: string,
  lines: AsyncIterable<string>
): AsyncGenerator<ParsedCLIEvent> {
  for await (const line of lines) {
    const event = parseNDJSONLine(line);

    if (event) {
      // Store in Supabase (fire and forget)
      storeEventInSupabase(sessionId, event).catch((err) => {
        console.error("[NDJSON Parser] Event storage failed:", err);
      });

      // Yield for local processing
      yield event;
    }
  }
}

/**
 * Get final result from CLI events
 *
 * @param events - Array of parsed CLI events
 * @returns Result string or null if not found
 */
export function getFinalResult(events: ParsedCLIEvent[]): string | null {
  for (const event of events) {
    if (event.type === "result" && event.subtype === "success" && event.result) {
      return event.result;
    }
  }

  return null;
}
