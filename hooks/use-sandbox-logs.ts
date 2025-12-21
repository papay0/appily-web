import * as React from "react";
import { useRealtimeSubscription, type ChannelStatus } from "./use-realtime-subscription";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Represents a single log entry from the E2B sandbox
 */
export interface SandboxLog {
  id: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
  source: "metro" | "setup" | "system";
  timestamp: Date;
}

/**
 * Return type for the useSandboxLogs hook
 */
export interface UseSandboxLogsReturn {
  /** Array of log entries */
  logs: SandboxLog[];
  /** Number of unread logs since last markAsRead() call */
  unreadCount: number;
  /** Reset unread count to 0 */
  markAsRead: () => void;
  /** Clear all logs from memory */
  clearLogs: () => void;
  /** Whether the realtime subscription is connected */
  isConnected: boolean;
  /** Current connection status */
  status: ChannelStatus;
  /** Filter logs by level */
  filterByLevel: (level: SandboxLog["level"] | null) => void;
  /** Current level filter */
  levelFilter: SandboxLog["level"] | null;
}

interface UseSandboxLogsConfig {
  /** Project ID to subscribe to */
  projectId: string;
  /** Whether to enable the subscription (default: true) */
  enabled?: boolean;
}

// Agent event data structure from Supabase
interface AgentEventData {
  type?: string;
  subtype?: string;
  level?: string;
  message?: string | { content?: Array<{ type: string; text?: string; name?: string }> };
  source?: string;
  timestamp?: string;
  operation?: string;
  status?: string;
  [key: string]: unknown;
}

interface AgentEventPayload extends Record<string, unknown> {
  id: string;
  project_id: string;
  event_type: string;
  event_data: AgentEventData;
  created_at: string;
}

/**
 * Hook to subscribe to sandbox logs in real-time
 *
 * Uses Supabase Realtime to receive log events from the E2B sandbox.
 * Logs are stored in the agent_events table with event_type='log'.
 *
 * @example
 * ```tsx
 * const { logs, unreadCount, isConnected, markAsRead } = useSandboxLogs({
 *   projectId: "123",
 * });
 * ```
 */
export function useSandboxLogs(config: UseSandboxLogsConfig): UseSandboxLogsReturn {
  const { projectId, enabled = true } = config;

  const [logs, setLogs] = React.useState<SandboxLog[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [levelFilter, setLevelFilter] = React.useState<SandboxLog["level"] | null>(null);

  // Track seen event IDs to prevent duplicates
  const seenEventIdsRef = React.useRef(new Set<string>());

  // Parse an agent event into a SandboxLog
  const parseLogEvent = React.useCallback((payload: AgentEventPayload): SandboxLog[] | null => {
    const eventData = payload.event_data;

    // Skip if we've already seen this event
    if (seenEventIdsRef.current.has(payload.id)) {
      return null;
    }

    // Process different event types that should appear in terminal
    const logs: SandboxLog[] = [];
    let level: SandboxLog["level"] = "log";
    let message: string = "";
    let source: SandboxLog["source"] = "system";

    if (payload.event_type === "log" && eventData?.type === "log") {
      // Metro logs from metro-log-streamer.js
      level = (eventData.level as SandboxLog["level"]) || "log";
      message = typeof eventData.message === "string" ? eventData.message : "";
      source = (eventData.source as SandboxLog["source"]) || "metro";

      if (message) {
        logs.push({
          id: payload.id,
          level,
          message,
          source,
          timestamp: new Date(eventData.timestamp || payload.created_at),
        });
      }
    } else if (payload.event_type === "system" && eventData?.type === "system") {
      // System events (setup logs, operational logs)
      const subtype = eventData.subtype as string;

      // Skip init events
      if (subtype === "init") {
        return null;
      }

      // Map subtype to log level
      if (subtype === "error") {
        level = "error";
      } else if (subtype === "warning") {
        level = "warn";
      } else if (subtype === "success" || subtype === "operation") {
        level = "info";
      } else {
        level = "log";
      }

      message = typeof eventData.message === "string" ? eventData.message : "";
      source = "setup";

      if (message) {
        logs.push({
          id: payload.id,
          level,
          message,
          source,
          timestamp: new Date(eventData.timestamp || payload.created_at),
        });
      }
    } else if (payload.event_type === "assistant") {
      // Assistant messages from Claude CLI
      const content = eventData.message && typeof eventData.message === "object"
        ? eventData.message.content
        : null;

      if (content && Array.isArray(content)) {
        let idx = 0;
        for (const block of content) {
          if (block.type === "text" && block.text) {
            // Truncate long messages
            const preview = block.text.length > 150
              ? block.text.substring(0, 150) + "..."
              : block.text;
            logs.push({
              id: `${payload.id}-${idx++}`,
              level: "info",
              message: `💬 ${preview}`,
              source: "system",
              timestamp: new Date(payload.created_at),
            });
          } else if (block.type === "tool_use" && block.name) {
            logs.push({
              id: `${payload.id}-${idx++}`,
              level: "log",
              message: `🔧 ${block.name}`,
              source: "system",
              timestamp: new Date(payload.created_at),
            });
          }
        }
      }
    } else if (payload.event_type === "result") {
      // Result events (success/error)
      const subtype = eventData.subtype as string;
      level = subtype === "success" ? "info" : "error";
      message = subtype === "success" ? "✓ Task completed" : "✗ Task failed";

      logs.push({
        id: payload.id,
        level,
        message,
        source: "system",
        timestamp: new Date(payload.created_at),
      });
    } else {
      // Skip other event types (user, etc.)
      return null;
    }

    if (logs.length === 0) {
      return null;
    }

    seenEventIdsRef.current.add(payload.id);

    // Limit seen IDs cache size to prevent memory leak (keep last 10000)
    if (seenEventIdsRef.current.size > 10000) {
      const idsArray = Array.from(seenEventIdsRef.current);
      seenEventIdsRef.current = new Set(idsArray.slice(-5000));
    }

    return logs;
  }, []);

  // Handle new log events
  const handleEvent = React.useCallback(
    (payload: RealtimePostgresChangesPayload<AgentEventPayload>) => {
      // Only handle INSERT events (new logs)
      if (payload.eventType !== "INSERT" || !payload.new) return;

      const parsedLogs = parseLogEvent(payload.new as AgentEventPayload);
      if (!parsedLogs || parsedLogs.length === 0) return;

      setLogs((prevLogs) => [...prevLogs, ...parsedLogs]);

      // Increment unread count
      setUnreadCount((prev) => prev + parsedLogs.length);
    },
    [parseLogEvent]
  );

  // Subscribe to realtime events
  const { status } = useRealtimeSubscription<AgentEventPayload>({
    channelKey: `sandbox-logs-${projectId}`,
    table: "agent_events",
    event: "INSERT",
    filter: `project_id=eq.${projectId}`,
    onEvent: handleEvent,
    enabled: enabled && !!projectId,
  });

  // Mark all logs as read
  const markAsRead = React.useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Clear all logs
  const clearLogs = React.useCallback(() => {
    setLogs([]);
    setUnreadCount(0);
    seenEventIdsRef.current.clear();
  }, []);

  // Filter by level
  const filterByLevel = React.useCallback((level: SandboxLog["level"] | null) => {
    setLevelFilter(level);
  }, []);

  // Apply level filter
  const filteredLogs = React.useMemo(() => {
    if (!levelFilter) return logs;
    return logs.filter((log) => log.level === levelFilter);
  }, [logs, levelFilter]);

  // Reset when project changes
  React.useEffect(() => {
    clearLogs();
  }, [projectId, clearLogs]);

  return {
    logs: filteredLogs,
    unreadCount,
    markAsRead,
    clearLogs,
    isConnected: status === "connected",
    status,
    filterByLevel,
    levelFilter,
  };
}
