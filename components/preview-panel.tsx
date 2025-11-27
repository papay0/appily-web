"use client";

import { Button } from "@/components/ui/button";
import { Loader2, QrCode, RefreshCw, ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import { Iphone } from "@/components/ui/iphone";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SandboxStatusOverlay } from "@/components/sandbox-status-overlay";
import type { HealthStatus } from "@/app/api/sandbox/health/route";

interface PreviewPanelProps {
  sandboxStatus: "idle" | "starting" | "ready" | "error";
  onStartSandbox: () => void;
  expoUrl?: string;
  qrCode?: string;
  sandboxId?: string;
  projectId?: string;
  healthStatus?: HealthStatus | null;
  healthMessage?: string;
}

export function PreviewPanel({
  sandboxStatus,
  onStartSandbox,
  expoUrl,
  qrCode,
  sandboxId,
  projectId,
  healthStatus,
  healthMessage,
}: PreviewPanelProps) {
  const [isRestartingMetro, setIsRestartingMetro] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Determine if we should show the health overlay
  const showHealthOverlay = healthStatus && healthStatus !== "ready";

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
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-[var(--magic-violet)]/5" />
        <div className="absolute top-10 right-10 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-10 w-[250px] h-[250px] bg-[var(--magic-violet)]/5 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
      </div>

      {/* Health Status Overlay - shown when sandbox is sleeping/starting */}
      {showHealthOverlay && (
        <SandboxStatusOverlay
          status={healthStatus}
          message={healthMessage || ""}
          onWakeUp={onStartSandbox}
          isWakingUp={sandboxStatus === "starting"}
        />
      )}

      {/* Preview Content */}
      <div className="flex-1 overflow-auto p-6 pt-8">
        <div className="flex flex-col items-center justify-center h-full">
          {/* Idle State - Ready to Preview */}
          {sandboxStatus === "idle" && !qrCode && (
            <div className="text-center space-y-6 animate-fade-in-up">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl glass-morphism flex items-center justify-center mx-auto glow-primary">
                  <QrCode className="h-12 w-12 text-primary animate-pulse-slow" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-[var(--magic-gold)] animate-sparkle" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold font-display text-gradient-magic">
                  Ready to Preview
                </p>
                <p className="text-sm text-muted-foreground">
                  Click &quot;Start Sandbox&quot; to begin
                </p>
              </div>
            </div>
          )}

          {/* Idle with existing QR Code */}
          {sandboxStatus === "idle" && qrCode && (
            <div className="text-center space-y-6 animate-scale-fade-in">
              {/* iPhone Frame with QR Code */}
              <div className="mx-auto flex justify-center qr-glow">
                <Iphone
                  src={qrCode}
                  className="w-[320px]"
                />
              </div>

              {/* Instructions */}
              <div className="space-y-4 max-w-md mx-auto px-4">
                <div className="text-center space-y-2">
                  <p className="text-base font-semibold font-display text-gradient-magic">
                    Scan to Reconnect
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Open the Expo Go app and scan the QR code
                  </p>
                </div>

                {expoUrl && (
                  <code className="text-xs glass-morphism px-4 py-3 rounded-xl break-all block font-mono">
                    {expoUrl}
                  </code>
                )}
              </div>
            </div>
          )}

          {/* Starting State - Loading */}
          {sandboxStatus === "starting" && !qrCode && (
            <div className="text-center space-y-6 animate-fade-in-up">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-[var(--magic-violet)] flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                  <Loader2 className="h-12 w-12 text-white animate-spin" />
                </div>
                <div className="absolute inset-0 h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-[var(--magic-violet)] mx-auto animate-ping opacity-20" />
                <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-[var(--magic-gold)] animate-sparkle" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold font-display text-gradient-magic">
                  Initializing Sandbox
                </p>
                <p className="text-sm text-muted-foreground">
                  Setting up your development environment
                </p>
              </div>
            </div>
          )}

          {/* Starting with existing QR Code */}
          {sandboxStatus === "starting" && qrCode && (
            <div className="text-center space-y-6 animate-scale-fade-in">
              <div className="mx-auto flex justify-center qr-glow opacity-75">
                <Iphone
                  src={qrCode}
                  className="w-[320px]"
                />
              </div>
              <div className="space-y-3">
                <p className="text-base font-semibold font-display text-gradient-magic">
                  Reconnecting to Sandbox
                </p>
                {expoUrl && (
                  <code className="text-xs glass-morphism px-4 py-2 rounded-xl break-all block font-mono">
                    {expoUrl}
                  </code>
                )}
              </div>
            </div>
          )}

          {/* Ready State - Success */}
          {sandboxStatus === "ready" && (
            <div className="text-center space-y-6 animate-bounce-in">
              {/* iPhone Frame with QR Code */}
              <div className="mx-auto flex justify-center">
                {qrCode ? (
                  <div className="qr-glow">
                    <Iphone
                      src={qrCode}
                      className="w-[320px]"
                    />
                  </div>
                ) : (
                  <div className="w-[320px] flex items-center justify-center" style={{ aspectRatio: '433/882' }}>
                    <div className="text-center space-y-3">
                      <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
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
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5 text-[var(--magic-gold)] animate-sparkle" />
                    <p className="text-lg font-semibold font-display text-gradient-magic">
                      Scan with Your iPhone
                    </p>
                    <Sparkles className="h-5 w-5 text-[var(--magic-gold)] animate-sparkle animation-delay-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Open the Expo Go app and scan the QR code
                  </p>
                </div>

                {expoUrl && (
                  <div className="space-y-3">
                    <code className="text-xs glass-morphism px-4 py-3 rounded-xl break-all block font-mono">
                      {expoUrl}
                    </code>

                    {/* Collapsible Advanced Options */}
                    <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground hover:text-foreground rounded-xl"
                        >
                          <span className="text-xs">Advanced Options</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 ml-2 transition-transform duration-200",
                              isAdvancedOpen && "rotate-180"
                            )}
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
                          className="w-full rounded-xl glass-morphism border-border/50 hover:border-primary/50 transition-all"
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
                        <div className="p-3 glass-morphism rounded-xl border-amber-500/20">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Troubleshooting
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            If you get a &quot;sandbox not found&quot; error:
                          </p>
                          <ul className="text-xs text-muted-foreground mt-2 ml-4 space-y-1 list-disc">
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

          {/* Error State */}
          {sandboxStatus === "error" && (
            <div className="text-center space-y-6 animate-fade-in-up">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                  <span className="text-red-500 text-4xl font-bold">!</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold font-display text-red-500">
                  Failed to Start Sandbox
                </p>
                <p className="text-sm text-muted-foreground">
                  Please try again or check the debug panel
                </p>
              </div>
              <Button
                onClick={onStartSandbox}
                size="sm"
                variant="outline"
                className="rounded-xl glass-morphism border-border/50 hover:border-primary/50 transition-all"
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
