"use client";

import * as React from "react";
import { Terminal, ChevronUp, ChevronDown, ArrowDown, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSandboxLogs, type SandboxLog } from "@/hooks/use-sandbox-logs";

interface TerminalLogViewerProps {
  /** Project ID to subscribe to logs for */
  projectId: string;
  /** Optional className for the container */
  className?: string;
}

/**
 * Log entry component for rendering a single log line
 */
function LogEntry({ log }: { log: SandboxLog }) {
  const levelStyles: Record<SandboxLog["level"], string> = {
    error: "text-red-400",
    warn: "text-yellow-400",
    info: "text-blue-400",
    log: "text-zinc-400",
  };

  const levelBadgeStyles: Record<SandboxLog["level"], string> = {
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    warn: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    log: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex items-start gap-2 py-0.5 px-2 hover:bg-zinc-800/50 group">
      {/* Timestamp */}
      <span className="text-zinc-600 text-xs font-mono shrink-0">
        {formatTimestamp(log.timestamp)}
      </span>

      {/* Level badge */}
      <span
        className={cn(
          "text-xs px-1.5 py-0.5 rounded border font-mono shrink-0",
          levelBadgeStyles[log.level]
        )}
      >
        {log.level.toUpperCase().padEnd(5)}
      </span>

      {/* Message */}
      <span className={cn("font-mono text-xs break-all", levelStyles[log.level])}>
        {log.message}
      </span>
    </div>
  );
}

/**
 * Terminal Log Viewer Component
 *
 * A collapsible panel that displays real-time logs from the E2B sandbox.
 * Shows Metro bundler logs, console output, and errors.
 *
 * Features:
 * - Collapsible panel (closed by default)
 * - Unread badge when collapsed with new logs
 * - Auto-scroll to bottom
 * - Color-coded log levels
 * - Clear logs button
 */
export function TerminalLogViewer({ projectId, className }: TerminalLogViewerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const {
    logs,
    unreadCount,
    markAsRead,
    clearLogs,
    isConnected,
  } = useSandboxLogs({ projectId, enabled: true });

  // Auto-scroll to bottom when new logs arrive
  React.useEffect(() => {
    if (isAutoScrollEnabled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isAutoScrollEnabled]);

  // Mark as read when panel is opened
  React.useEffect(() => {
    if (isOpen) {
      markAsRead();
    }
  }, [isOpen, markAsRead]);

  // Handle scroll to detect if user has scrolled up
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setIsAutoScrollEnabled(isAtBottom);
  }, []);

  // Scroll to bottom button handler
  const scrollToBottom = React.useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAutoScrollEnabled(true);
  }, []);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("border-t border-border/50", className)}
    >
      {/* Header - Always visible */}
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Terminal Logs</span>

          {/* Unread badge */}
          {!isOpen && unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 px-1.5 text-xs animate-pulse"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}

          {/* Connection status indicator */}
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-zinc-500"
            )}
            title={isConnected ? "Connected" : "Disconnected"}
          />
        </div>

        {/* Expand/Collapse icon */}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>

      {/* Content - Expandable */}
      <CollapsibleContent>
        <div className="relative bg-zinc-900 border-t border-zinc-800">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800">
            <span className="text-xs text-zinc-500">
              {logs.length} log{logs.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              {/* Clear logs button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
                onClick={clearLogs}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Log content */}
          <ScrollArea className="h-[200px]">
            <div
              ref={scrollRef}
              className="py-1"
              onScroll={handleScroll}
            >
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-[180px] text-zinc-600 text-sm">
                  No logs yet. Waiting for Metro bundler output...
                </div>
              ) : (
                logs.map((log) => <LogEntry key={log.id} log={log} />)
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Scroll to bottom button */}
          {!isAutoScrollEnabled && logs.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-3 right-3 h-7 px-2 text-xs bg-zinc-800 hover:bg-zinc-700"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              Latest
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
