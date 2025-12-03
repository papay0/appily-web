"use client";

import { Button } from "@/components/ui/button";
import { Loader2, QrCode, Sparkles, Globe, ExternalLink, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { Iphone } from "@/components/ui/iphone";
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
  const [viewMode, setViewMode] = useState<"qr" | "web">("qr");
  const [isWebLoading, setIsWebLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Derive web URL from expo URL (exp:// -> https://)
  const webUrl = expoUrl ? expoUrl.replace("exp://", "https://") : undefined;

  // Reset loading state when URL changes
  useEffect(() => {
    if (webUrl) {
      setIsWebLoading(true);
    }
  }, [webUrl]);

  // Handle refresh button click
  const handleRefresh = () => {
    setIsWebLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  // Determine if we should show the health overlay
  const showHealthOverlay = healthStatus && healthStatus !== "ready";

  // Show tabs when we have a QR code/URL available
  const showTabs = !!(qrCode && expoUrl);

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

      {/* View Mode Tabs */}
      {showTabs && (
        <div className="flex justify-center pt-4">
          <div className="inline-flex items-center glass-morphism rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("qr")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === "qr"
                  ? "bg-gradient-to-r from-primary to-[var(--magic-violet)] text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <QrCode className="h-3.5 w-3.5" />
              Expo Go
            </button>
            <button
              onClick={() => setViewMode("web")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === "web"
                  ? "bg-gradient-to-r from-primary to-[var(--magic-violet)] text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Web Preview
            </button>
            {viewMode === "web" && (
              <button
                onClick={handleRefresh}
                className="p-1.5 ml-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                title="Refresh preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview Content */}
      <div className={cn("flex-1 overflow-auto p-6", !showTabs && "pt-8")}>
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
              {/* iPhone Frame with QR Code or Web Preview - both rendered, CSS hidden */}
              <div className="relative mx-auto flex justify-center">
                <div className={cn("qr-glow", viewMode !== "qr" && "invisible absolute")}>
                  <Iphone
                    src={qrCode}
                    className="w-[320px]"
                  />
                </div>
                {webUrl && (
                  <div className={cn("web-preview-glow", viewMode !== "web" && "invisible absolute")}>
                    <Iphone
                      key={refreshKey}
                      iframeSrc={webUrl}
                      isIframeLoading={isWebLoading}
                      onIframeLoad={() => setIsWebLoading(false)}
                      className="w-[320px]"
                    />
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-4 max-w-md mx-auto px-4">
                {viewMode === "qr" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="text-center space-y-2">
                      <p className="text-base font-semibold font-display text-gradient-magic">
                        Web Preview
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Interact with your app directly
                      </p>
                    </div>

                    {webUrl && (
                      <a
                        href={webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open in new tab
                      </a>
                    )}
                  </>
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
              <div className="relative mx-auto flex justify-center opacity-75">
                <div className={cn("qr-glow", viewMode !== "qr" && "invisible absolute")}>
                  <Iphone
                    src={qrCode}
                    className="w-[320px]"
                  />
                </div>
                {webUrl && (
                  <div className={cn("web-preview-glow", viewMode !== "web" && "invisible absolute")}>
                    <Iphone
                      key={refreshKey}
                      iframeSrc={webUrl}
                      isIframeLoading={isWebLoading}
                      onIframeLoad={() => setIsWebLoading(false)}
                      className="w-[320px]"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-base font-semibold font-display text-gradient-magic">
                  Reconnecting to Sandbox
                </p>
                {viewMode === "qr" && expoUrl && (
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
              {/* iPhone Frame with QR Code or Web Preview - both rendered, CSS hidden */}
              <div className="relative mx-auto flex justify-center">
                {/* QR Code View */}
                <div className={cn(viewMode !== "qr" && "invisible absolute")}>
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
                {/* Web Preview View */}
                <div className={cn(viewMode !== "web" && "invisible absolute")}>
                  {webUrl ? (
                    <div className="web-preview-glow">
                      <Iphone
                        key={refreshKey}
                        iframeSrc={webUrl}
                        isIframeLoading={isWebLoading}
                        onIframeLoad={() => setIsWebLoading(false)}
                        className="w-[320px]"
                      />
                    </div>
                  ) : (
                    <div className="w-[320px] flex items-center justify-center" style={{ aspectRatio: '433/882' }}>
                      <div className="text-center space-y-3">
                        <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">
                          Loading web preview...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions - different for QR vs Web */}
              <div className="space-y-4 max-w-md mx-auto px-4">
                {viewMode === "qr" ? (
                  // QR Code Instructions
                  <>
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
                      <code className="text-xs glass-morphism px-4 py-3 rounded-xl break-all block font-mono">
                        {expoUrl}
                      </code>
                    )}
                  </>
                ) : (
                  // Web Preview Instructions
                  <>
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <p className="text-lg font-semibold font-display text-gradient-magic">
                          Web Preview
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Interact with your app directly in the browser
                      </p>
                    </div>

                    {webUrl && (
                      <div className="space-y-3">
                        <a
                          href={webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in new tab
                        </a>
                      </div>
                    )}
                  </>
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
