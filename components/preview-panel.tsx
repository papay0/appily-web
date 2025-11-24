"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, RefreshCw, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Iphone } from "@/components/ui/iphone";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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
      <div className="flex-1 overflow-auto p-6 pt-8 bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-900 dark:via-blue-950/20 dark:to-purple-950/20">
        <div className="flex flex-col items-center justify-center h-full">
          {sandboxStatus === "idle" && !qrCode && (
            <div className="text-center space-y-6 animate-in fade-in duration-500">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center mx-auto shadow-lg">
                <QrCode className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Ready to Preview
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click &quot;Start Sandbox&quot; to begin
                </p>
              </div>
            </div>
          )}

          {sandboxStatus === "idle" && qrCode && (
            <div className="text-center space-y-6 animate-in zoom-in duration-500">
              {/* iPhone Frame with QR Code */}
              <div className="mx-auto flex justify-center">
                <Iphone
                  src={qrCode}
                  className="w-[320px]"
                />
              </div>

              {/* Instructions */}
              <div className="space-y-4 max-w-md mx-auto px-4">
                <div className="text-center space-y-2">
                  <p className="text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                    Scan to Reconnect
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Open the Expo Go app and scan the QR code
                  </p>
                </div>

                {expoUrl && (
                  <code className="text-xs bg-white dark:bg-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 break-all block shadow-sm font-mono">
                    {expoUrl}
                  </code>
                )}
              </div>
            </div>
          )}

          {sandboxStatus === "starting" && !qrCode && (
            <div className="text-center space-y-6 animate-in fade-in duration-500">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
                <div className="absolute inset-0 h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mx-auto animate-ping opacity-20"></div>
              </div>
              <div>
                <p className="text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Initializing Sandbox
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Setting up your development environment
                </p>
              </div>
            </div>
          )}

          {sandboxStatus === "starting" && qrCode && (
            <div className="text-center space-y-6 animate-in zoom-in duration-500">
              <div className="mx-auto flex justify-center">
                <Iphone
                  src={qrCode}
                  className="w-[320px]"
                />
              </div>
              <div className="space-y-3">
                <p className="text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  Reconnecting to Sandbox
                </p>
                {expoUrl && (
                  <code className="text-xs bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 break-all block shadow-sm">
                    {expoUrl}
                  </code>
                )}
              </div>
            </div>
          )}

          {sandboxStatus === "ready" && (
            <div className="text-center space-y-6 animate-in zoom-in duration-500">
              {/* iPhone Frame with QR Code */}
              <div className="mx-auto flex justify-center">
                {qrCode ? (
                  <Iphone
                    src={qrCode}
                    className="w-[320px]"
                  />
                ) : (
                  <div className="w-[320px] flex items-center justify-center" style={{ aspectRatio: '433/882' }}>
                    <div className="text-center space-y-3">
                      <Loader2 className="h-12 w-12 text-blue-600 mx-auto animate-spin" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Generating QR code...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-4 max-w-md mx-auto px-4">
                <div className="text-center space-y-2">
                  <p className="text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                    Scan with Your iPhone
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Open the Expo Go app and scan the QR code
                  </p>
                </div>

                {expoUrl && (
                  <div className="space-y-3">
                    <code className="text-xs bg-white dark:bg-gray-800 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 break-all block shadow-sm font-mono">
                      {expoUrl}
                    </code>

                    {/* Collapsible Advanced Options */}
                    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground hover:text-foreground"
                        >
                          <span className="text-xs">Advanced Options</span>
                          <ChevronDown
                            className={`h-4 w-4 ml-2 transition-transform ${
                              isAdvancedOpen ? "rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 mt-2">
                        {/* Restart Metro Button */}
                        <Button
                          onClick={handleRestartMetro}
                          disabled={isRestartingMetro || !sandboxId || !projectId}
                          variant="outline"
                          size="sm"
                          className="w-full shadow-sm hover:shadow-md transition-shadow"
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
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                            Troubleshooting
                          </p>
                          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                            If you get a &quot;sandbox not found&quot; error:
                          </p>
                          <ul className="text-xs text-amber-800 dark:text-amber-300 mt-2 ml-4 space-y-1 list-disc">
                            <li>Try restarting Metro Server above</li>
                            <li>Or stop and restart the Sandbox</li>
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </div>
            </div>
          )}

          {sandboxStatus === "error" && (
            <div className="text-center space-y-6 animate-in fade-in duration-500">
              <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto shadow-lg">
                <span className="text-red-600 dark:text-red-400 text-4xl font-bold">!</span>
              </div>
              <div>
                <p className="text-base font-semibold text-red-600 dark:text-red-400">
                  Failed to Start Sandbox
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please try again or check the debug panel
                </p>
              </div>
              <Button
                onClick={onStartSandbox}
                size="sm"
                variant="outline"
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
