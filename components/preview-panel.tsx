"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, QrCode } from "lucide-react";

interface PreviewPanelProps {
  sandboxStatus: "idle" | "starting" | "ready" | "error";
  onStartSandbox: () => void;
}

export function PreviewPanel({ sandboxStatus, onStartSandbox }: PreviewPanelProps) {
  const getStatusColor = () => {
    switch (sandboxStatus) {
      case "ready":
        return "bg-green-500";
      case "starting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (sandboxStatus) {
      case "ready":
        return "Ready";
      case "starting":
        return "Starting...";
      case "error":
        return "Error";
      default:
        return "Not started";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-6 pt-8">
        <div className="flex flex-col items-center justify-center h-full">
          {sandboxStatus === "idle" && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Sandbox not started</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Start Sandbox" to begin
                </p>
              </div>
            </div>
          )}

          {sandboxStatus === "starting" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto" />
              <div>
                <p className="text-sm font-medium">Initializing sandbox...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Setting up your development environment
                </p>
              </div>
            </div>
          )}

          {sandboxStatus === "ready" && (
            <Card className="w-full max-w-sm aspect-square bg-muted flex items-center justify-center">
              <div className="text-center space-y-3">
                <QrCode className="h-24 w-24 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  QR Code will appear here
                </p>
                <p className="text-xs text-muted-foreground">
                  Scan with Expo Go to preview your app
                </p>
              </div>
            </Card>
          )}

          {sandboxStatus === "error" && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <span className="text-red-500 text-3xl">!</span>
              </div>
              <div>
                <p className="text-sm font-medium text-red-500">Failed to start sandbox</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please try again or check the debug panel
                </p>
              </div>
              <Button onClick={onStartSandbox} size="sm" variant="outline">
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
