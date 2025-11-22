"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface PreviewPanelProps {
  sandboxStatus: "idle" | "starting" | "ready" | "error";
  onStartSandbox: () => void;
  expoUrl?: string;
  qrCode?: string;
  sandboxId?: string;
  projectId?: string;
}

export function PreviewPanel({ sandboxStatus, onStartSandbox, expoUrl, qrCode, sandboxId, projectId }: PreviewPanelProps) {
  const [isRestartingMetro, setIsRestartingMetro] = useState(false);

  const handleRestartMetro = async () => {
    if (!sandboxId || !projectId) return;

    setIsRestartingMetro(true);
    try {
      const response = await fetch("/api/sandbox/restart-metro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to restart Metro");
      }

      // Success - the realtime subscription will update the UI with new QR code
    } catch (error) {
      console.error("Failed to restart Metro:", error);
      alert("Failed to restart Metro server. Please try stopping and starting the sandbox.");
    } finally {
      setIsRestartingMetro(false);
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
                  Click &quot;Start Sandbox&quot; to begin
                </p>
              </div>
            </div>
          )}

          {sandboxStatus === "starting" && !qrCode && (
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

          {sandboxStatus === "starting" && qrCode && (
            <div className="text-center space-y-4">
              <Card className="w-full max-w-sm aspect-square bg-white dark:bg-muted flex items-center justify-center p-8 mx-auto">
                <div className="relative w-full h-full">
                  <Image
                    src={qrCode}
                    alt="Expo QR Code"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </Card>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Reconnecting to sandbox...
                </p>
                {expoUrl && (
                  <code className="text-xs bg-muted px-3 py-2 rounded-md text-muted-foreground break-all block">
                    {expoUrl}
                  </code>
                )}
              </div>
            </div>
          )}

          {sandboxStatus === "ready" && (
            <div className="text-center space-y-4">
              <Card className="w-full max-w-sm aspect-square bg-white dark:bg-muted flex items-center justify-center p-8 mx-auto">
                {qrCode ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={qrCode}
                      alt="Expo QR Code"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <Loader2 className="h-16 w-16 text-muted-foreground mx-auto animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Generating QR code...
                    </p>
                  </div>
                )}
              </Card>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Scan with Expo Go to preview your app
                </p>
                {expoUrl && (
                  <div className="flex flex-col gap-2">
                    <code className="text-xs bg-muted px-3 py-2 rounded-md text-muted-foreground break-all">
                      {expoUrl}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Open this URL in the Expo Go app on your device
                    </p>
                    <div className="mt-4 space-y-3">
                      {/* Restart Metro Button */}
                      <Button
                        onClick={handleRestartMetro}
                        disabled={isRestartingMetro || !sandboxId || !projectId}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        {isRestartingMetro ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Restarting Metro...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Restart Metro Server
                          </>
                        )}
                      </Button>

                      {/* Help text */}
                      <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>Troubleshooting:</strong> If you get a &quot;sandbox not found&quot; error when scanning:
                        </p>
                        <ul className="text-xs text-amber-800 dark:text-amber-200 mt-2 ml-4 space-y-1 list-disc">
                          <li>Try clicking &quot;Restart Metro Server&quot; above</li>
                          <li>If that doesn&apos;t work, click &quot;Stop Sandbox&quot; then &quot;Start Sandbox&quot;</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
