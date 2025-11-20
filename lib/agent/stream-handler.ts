/**
 * Agent message stream processing and utilities
 *
 * This module provides utilities for processing the async generator stream
 * returned by the Claude Agent SDK's query() function.
 *
 * Educational notes:
 * - The SDK returns an AsyncGenerator<SDKMessage>
 * - Messages come in real-time as the agent works
 * - Different message types represent different stages (system init, assistant response, tool use, etc.)
 * - We use discriminated unions (message.type) for type-safe handling
 *
 * @see https://docs.claude.com/en/api/agent-sdk/typescript#message-types
 */

import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentStreamEvent } from "./types";

/**
 * Process agent stream and convert to structured events
 *
 * This async generator transforms raw SDK messages into AgentStreamEvent objects
 * that are easier to work with in the application layer.
 *
 * It provides:
 * - Structured event types (message, progress, error, complete)
 * - Automatic logging of key events
 * - Error handling and recovery
 * - Type-safe event discrimination
 *
 * @param stream - The Query stream from query() or resumeAgentSession()
 * @yields AgentStreamEvent objects for each message/event
 *
 * @example
 * ```typescript
 * const { stream } = await startAgentSession("Build an app", "proj_123");
 *
 * for await (const event of processAgentStream(stream)) {
 *   switch (event.type) {
 *     case 'complete':
 *       console.log("Done:", event.data);
 *       break;
 *     case 'error':
 *       console.error("Error:", event.data);
 *       break;
 *   }
 * }
 * ```
 */
export async function* processAgentStream(
  stream: Query
): AsyncGenerator<AgentStreamEvent> {
  try {
    for await (const message of stream) {
      // Create base event structure
      const event: AgentStreamEvent = {
        type: "message",
        data: message,
        timestamp: new Date(),
      };

      // Handle different message types with appropriate logging and transformations
      switch (message.type) {
        case "system":
          // System messages contain initialization info and configuration
          if (message.subtype === "init") {
            console.log(`[Agent Stream] Session initialized: ${message.session_id}`);
            console.log(`[Agent Stream] Model: ${message.model}`);
            console.log(`[Agent Stream] Working directory: ${message.cwd}`);
            console.log(`[Agent Stream] Available tools: ${message.tools.length}`);
            console.log(`[Agent Stream] Permission mode: ${message.permissionMode}`);
          }
          yield event;
          break;

        case "assistant":
          // Assistant messages contain Claude's responses and tool use
          for (const content of message.message.content) {
            if (content.type === "text") {
              // Text content - Claude's actual response
              console.log(`[Agent Stream] Claude: ${content.text}`);
            } else if (content.type === "tool_use") {
              // Tool use - Claude is executing a command or operation
              console.log(`[Agent Stream] Tool: ${content.name}`);
              console.log(`[Agent Stream] Tool input:`, content.input);
            }
          }
          yield event;
          break;

        case "result":
          // Result message - final output from the agent
          // subtype can be 'success' or various error subtypes
          const resultType = message.subtype === "success" ? "✓" : "✗";
          const resultData =
            message.subtype === "success" ? message.result : `Error: ${message.subtype}`;
          console.log(
            `[Agent Stream] ${resultType} Result (${message.subtype})`
          );

          // Yield as 'complete' event for easier downstream handling
          yield {
            type: "complete",
            data: resultData,
            timestamp: new Date(),
          };
          break;

        case "stream_event":
          // Real-time streaming events - partial responses as they're generated
          // These allow for live UI updates showing Claude "thinking"
          yield {
            type: "progress",
            data: message,
            timestamp: new Date(),
          };
          break;

        default:
          // Unknown message type - yield as-is for debugging
          console.log(`[Agent Stream] Unknown message type:`, message);
          yield event;
      }
    }
  } catch (error) {
    // Stream errors - network issues, API errors, etc.
    console.error("[Agent Stream] Stream error:", error);

    yield {
      type: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date(),
    };
  }
}

/**
 * Collect all messages from a stream into an array
 *
 * Useful when you need to process all messages at once rather than streaming.
 * Caution: This waits for the entire conversation to complete before returning.
 *
 * @param stream - The Query stream to collect from
 * @returns Array of all stream events
 *
 * @example
 * ```typescript
 * const stream = resumeAgentSession(sessionId, "Add a button");
 * const events = await collectStreamEvents(stream);
 *
 * // Find the final result
 * const result = events.find(e => e.type === 'complete');
 * ```
 */
export async function collectStreamEvents(
  stream: Query
): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];

  for await (const event of processAgentStream(stream)) {
    events.push(event);
  }

  return events;
}

/**
 * Extract Expo URL from agent messages
 *
 * Searches through all messages for an Expo URL in the format: exp://hostname:port
 * This is useful after asking the agent to start Expo with tunnel mode.
 *
 * Pattern matched: exp://[hostname]:[port]
 * Examples:
 * - exp://192.168.1.100:8081
 * - exp://abc123-8081.ondevbook.com
 *
 * @param messages - Array of SDKMessage objects to search through
 * @returns The first Expo URL found, or null if none found
 *
 * @example
 * ```typescript
 * const events = await collectStreamEvents(stream);
 * const messages = events.map(e => e.data).filter(d => typeof d !== 'string');
 * const expoUrl = extractExpoUrl(messages as SDKMessage[]);
 *
 * if (expoUrl) {
 *   console.log("Scan this QR code:", await generateQRCode(expoUrl));
 * }
 * ```
 */
export function extractExpoUrl(messages: SDKMessage[]): string | null {
  for (const msg of messages) {
    // Only assistant messages can contain the URL
    if (msg.type === "assistant") {
      for (const content of msg.message.content) {
        if (content.type === "text") {
          // Match exp:// URLs with hostname and port
          // This regex matches:
          // - exp:// protocol
          // - Any hostname (alphanumeric, hyphens, dots)
          // - Colon and port number
          const match = content.text.match(/exp:\/\/[\w\-\.]+:\d+/);

          if (match) {
            console.log(`[Stream Handler] ✓ Found Expo URL: ${match[0]}`);
            return match[0];
          }
        }
      }
    }
  }

  console.log("[Stream Handler] No Expo URL found in messages");
  return null;
}

/**
 * Extract all text responses from assistant messages
 *
 * Filters out tool use and other non-text content, returning only
 * the actual text responses from Claude.
 *
 * @param messages - Array of SDKMessage objects
 * @returns Array of text strings from Claude
 *
 * @example
 * ```typescript
 * const events = await collectStreamEvents(stream);
 * const messages = events.map(e => e.data).filter(d => typeof d !== 'string');
 * const responses = extractTextResponses(messages as SDKMessage[]);
 *
 * responses.forEach(text => console.log("Claude said:", text));
 * ```
 */
export function extractTextResponses(messages: SDKMessage[]): string[] {
  const textResponses: string[] = [];

  for (const msg of messages) {
    if (msg.type === "assistant") {
      for (const content of msg.message.content) {
        if (content.type === "text") {
          textResponses.push(content.text);
        }
      }
    }
  }

  return textResponses;
}

/**
 * Check if the stream has completed successfully
 *
 * @param events - Array of stream events to check
 * @returns true if a success result was found
 */
export function isStreamSuccessful(events: AgentStreamEvent[]): boolean {
  return events.some(
    (event) =>
      event.type === "complete" &&
      typeof event.data === "string" &&
      event.data.length > 0
  );
}

/**
 * Check if the stream encountered errors
 *
 * @param events - Array of stream events to check
 * @returns true if any error events were found
 */
export function hasStreamErrors(events: AgentStreamEvent[]): boolean {
  return events.some((event) => event.type === "error");
}

/**
 * Get the final result from a completed stream
 *
 * @param events - Array of stream events
 * @returns The result string, or null if not found
 */
export function getFinalResult(events: AgentStreamEvent[]): string | null {
  const completeEvent = events.find((event) => event.type === "complete");

  if (completeEvent && typeof completeEvent.data === "string") {
    return completeEvent.data;
  }

  return null;
}
