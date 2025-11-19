"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebugPanelProps {
  sandboxId?: string;
  sandboxStatus: "idle" | "starting" | "ready" | "error";
  uptime?: number;
  error?: string;
}

export function DebugPanel({ sandboxId, sandboxStatus, uptime, error }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "0s";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
      >
        <Bug className="h-5 w-5" />
      </Button>

      {/* Debug Panel */}
      <div
        className={cn(
          "fixed bottom-20 right-4 w-96 z-50 transition-all duration-200",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <Card className="shadow-xl">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Debug Panel</h3>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                size="icon"
                variant="ghost"
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={
                    sandboxStatus === "ready"
                      ? "default"
                      : sandboxStatus === "error"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {sandboxStatus}
                </Badge>
              </div>

              {sandboxId && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Sandbox ID</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                      {sandboxId}
                    </code>
                    <Button
                      onClick={() => copyToClipboard(sandboxId)}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {uptime !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono">{formatUptime(uptime)}</span>
                </div>
              )}

              {error && (
                <div className="space-y-1">
                  <span className="text-xs text-red-500">Error</span>
                  <div className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-2 rounded">
                    {error}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
              This panel shows E2B sandbox debugging information. It will be hidden from end users.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
