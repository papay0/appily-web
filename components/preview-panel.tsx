"use client";

import { Button } from "@/components/ui/button";
import { Loader2, QrCode, Sparkles, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { Iphone } from "@/components/ui/iphone";
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
  healthStatus,
  healthMessage,
}: PreviewPanelProps) {
  const [isWebLoading, setIsWebLoading] = useState(true);

  // Derive web URL from expo URL (exp:// -> https://)
  const webUrl = expoUrl ? expoUrl.replace("exp://", "https://") : undefined;

  // Reset loading state when URL changes
  useEffect(() => {
    if (webUrl) {
      setIsWebLoading(true);
    }
  }, [webUrl]);

  // Determine if we should show the health overlay
  const showHealthOverlay = healthStatus && healthStatus !== "ready";

  // Check if preview is ready (has QR code or web URL)
  const hasPreview = !!(qrCode || webUrl);

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

      {/* Restarting Overlay - shown when Metro is restarting with existing preview */}
      {sandboxStatus === "starting" && hasPreview && !showHealthOverlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-[var(--magic-violet)] flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold font-display text-gradient-magic">
                Restarting...
              </p>
              <p className="text-sm text-muted-foreground">
                Refreshing your preview
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-2">
        {/* Idle State - No Preview Yet */}
        {sandboxStatus === "idle" && !hasPreview && (
          <div className="flex items-center justify-center h-full">
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
                  Start chatting to build your app
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Starting State - No Preview Yet */}
        {sandboxStatus === "starting" && !hasPreview && (
          <div className="flex items-center justify-center h-full">
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
          </div>
        )}

        {/* Error State */}
        {sandboxStatus === "error" && (
          <div className="flex items-center justify-center h-full">
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
          </div>
        )}

        {/* Preview Available - Side by Side Layout */}
        {hasPreview && sandboxStatus !== "error" && (
          <div className="flex gap-8 h-full items-center justify-center animate-scale-fade-in">
            {/* Left: Phone Preview (Web) */}
            <div className="flex items-center justify-center h-full">
              <div className="web-preview-glow h-full flex items-center">
                {webUrl ? (
                  <Iphone
                    iframeSrc={webUrl}
                    isIframeLoading={isWebLoading}
                    onIframeLoad={() => setIsWebLoading(false)}
                    className="h-full max-h-full"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-card/50 rounded-[40px] border border-border/50" style={{ aspectRatio: '433/882' }}>
                    <div className="text-center space-y-3 p-6">
                      <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Loading preview...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: QR Code + Instructions - fixed width, vertically centered */}
            <div className="flex flex-col items-center justify-center gap-6 w-[300px] flex-shrink-0 overflow-y-auto">
              {/* QR Code */}
              {qrCode ? (
                <div className="qr-glow">
                  <img
                    src={qrCode}
                    alt="Scan with Expo Go"
                    className="w-52 h-52 rounded-xl"
                  />
                </div>
              ) : (
                <div className="w-52 h-52 rounded-xl bg-card/50 border border-border/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              )}

              {/* Scan Instructions */}
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground">Scan to open on device</p>
                <p className="text-sm text-muted-foreground">Expo Go app required</p>
              </div>

              {/* Platform Warning */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-medium">Note:</span> Web preview is slightly different from actual mobile. Some features may not work. We encourage testing on a real device.
                  </p>
                </div>
              </div>

              {/* Test on Device Steps */}
              <div className="space-y-2 w-full">
                <p className="font-semibold text-foreground text-sm">Test on device</p>
                <ol className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">1.</span>
                    Install Expo Go app on your phone
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">2.</span>
                    Scan QR code above
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">3.</span>
                    Test your app live on device
                  </li>
                </ol>
              </div>

              {/* Open in New Tab Link */}
              {webUrl && (
                <a
                  href={webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mt-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open web preview in new tab
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
