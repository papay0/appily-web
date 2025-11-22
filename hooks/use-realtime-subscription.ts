import * as React from "react";
import { useSupabaseClient } from "@/lib/supabase-client";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresChangesFilter,
} from "@supabase/supabase-js";

type EventType = "INSERT" | "UPDATE" | "DELETE" | "*";
export type ChannelStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface UseRealtimeSubscriptionConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique key for this channel (used to memoize and log) */
  channelKey: string;
  /** Table to listen to */
  table: string;
  /** Postgres change type (defaults to INSERT) */
  event?: EventType;
  /** Optional schema (defaults to public) */
  schema?: string;
  /** Optional filter, eg: `project_id=eq.123` */
  filter?: string;
  /** Called whenever Supabase delivers a payload */
  onEvent: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** Optional callback when status changes */
  onStatusChange?: (status: ChannelStatus) => void;
  /** Optional callback for unrecoverable errors */
  onError?: (error: Error) => void;
  /** Base reconnect delay (ms) */
  reconnectDelayMs?: number;
  /** Maximum reconnect delay (ms) */
  maxReconnectDelayMs?: number;
  /** Disable connection entirely */
  enabled?: boolean;
}

interface UseRealtimeSubscriptionReturn {
  status: ChannelStatus;
  retryCount: number;
  error: Error | null;
  manualReconnect: () => void;
  manualDisconnect: () => void;
}

const DEFAULT_DELAY_MS = 2000;
const DEFAULT_MAX_DELAY_MS = 10000;

export function useRealtimeSubscription<T extends Record<string, unknown> = Record<string, unknown>>(
  config: UseRealtimeSubscriptionConfig<T>
): UseRealtimeSubscriptionReturn {
  const supabase = useSupabaseClient();
  const [status, setStatus] = React.useState<ChannelStatus>("idle");
  const [retryCount, setRetryCount] = React.useState(0);
  const [lastError, setLastError] = React.useState<Error | null>(null);

  const {
    channelKey,
    table,
    event = "INSERT",
    filter,
    schema = "public",
    reconnectDelayMs = DEFAULT_DELAY_MS,
    maxReconnectDelayMs = DEFAULT_MAX_DELAY_MS,
    enabled = true,
  } = config;

  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const attemptRef = React.useRef(0);
  const isMountedRef = React.useRef(true);
  const connectRef = React.useRef<() => void>(() => {});

  const callbacksRef = React.useRef({
    onEvent: config.onEvent,
    onStatusChange: config.onStatusChange,
    onError: config.onError,
  });

  React.useEffect(() => {
    callbacksRef.current = {
      onEvent: config.onEvent,
      onStatusChange: config.onStatusChange,
      onError: config.onError,
    };
  }, [config.onEvent, config.onStatusChange, config.onError]);

  const notifyStatus = React.useCallback(
    (next: ChannelStatus) => {
      setStatus(next);
      callbacksRef.current.onStatusChange?.(next);
    },
    []
  );

  const clearReconnectTimer = React.useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanupChannel = React.useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    // Null out the ref before removing to avoid recursive removeChannel -> onClose -> cleanup loops
    channelRef.current = null;
    void supabase.removeChannel(channel);
  }, [supabase]);

  const scheduleReconnect = React.useCallback(() => {
    if (!enabled || !isMountedRef.current || reconnectTimeoutRef.current) return;

    attemptRef.current += 1;
    const delay = Math.min(
      reconnectDelayMs * attemptRef.current,
      maxReconnectDelayMs
    );

    notifyStatus("reconnecting");
    setRetryCount(attemptRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (!enabled || !isMountedRef.current) return;
      connectRef.current();
    }, delay);
  }, [enabled, reconnectDelayMs, maxReconnectDelayMs, notifyStatus]);

  const handlePayload = React.useCallback(
    (payload: RealtimePostgresChangesPayload<T>) => {
      callbacksRef.current.onEvent(payload);
    },
    []
  );

  const connect = React.useCallback(() => {
    if (!enabled || !isMountedRef.current) return;

    clearReconnectTimer();
    cleanupChannel();

    attemptRef.current = Math.max(attemptRef.current, 0);
    notifyStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

    const dynamicChannelName = `${channelKey}-${Date.now()}`;
    type OnMethod = <RecordType extends Record<string, unknown>>(
      type: "postgres_changes",
      filter: RealtimePostgresChangesFilter<typeof event>,
      callback: (payload: RealtimePostgresChangesPayload<RecordType>) => void
    ) => RealtimeChannel;

    const channel = supabase.channel(dynamicChannelName);

    const changeFilter: RealtimePostgresChangesFilter<typeof event> = {
      event,
      schema,
      table,
      filter,
    };

    (channel.on as OnMethod)<T>(
      "postgres_changes",
      changeFilter,
      (payload) => handlePayload(payload)
    );

    channel.subscribe((subscriptionStatus, err) => {
      if (!isMountedRef.current) return;

      if (subscriptionStatus === "SUBSCRIBED") {
        attemptRef.current = 0;
        notifyStatus("connected");
        setRetryCount(0);
        setLastError(null);
      } else if (
        subscriptionStatus === "CLOSED" ||
        subscriptionStatus === "CHANNEL_ERROR" ||
        subscriptionStatus === "TIMED_OUT"
      ) {
        cleanupChannel();
        if (err) {
          const normalizedError =
            err instanceof Error ? err : new Error(JSON.stringify(err));
          setLastError(normalizedError);
          callbacksRef.current.onError?.(normalizedError);
        }
        scheduleReconnect();
      }
    });

    channelRef.current = channel;
  }, [
    channelKey,
    supabase,
    event,
    schema,
    table,
    filter,
    handlePayload,
    notifyStatus,
    clearReconnectTimer,
    cleanupChannel,
    scheduleReconnect,
    enabled,
  ]);

  React.useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const reconnect = React.useCallback(() => {
    attemptRef.current = 0;
    clearReconnectTimer();
    setRetryCount(0);
    setLastError(null);
    connect();
  }, [connect, clearReconnectTimer]);

  const disconnect = React.useCallback(() => {
    clearReconnectTimer();
    cleanupChannel();
    attemptRef.current = 0;
    setRetryCount(0);
    setLastError(null);
    notifyStatus("idle");
  }, [cleanupChannel, clearReconnectTimer, notifyStatus]);

  React.useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      connect();
    } else {
      notifyStatus("idle");
      cleanupChannel();
      clearReconnectTimer();
    }

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      cleanupChannel();
    };
  }, [connect, clearReconnectTimer, cleanupChannel, enabled, notifyStatus]);

  return {
    status,
    retryCount,
    error: lastError,
    manualReconnect: reconnect,
    manualDisconnect: disconnect,
  };
}
