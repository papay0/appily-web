"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Check, Moon, Loader2, Zap, Sparkles, Play, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { HealthStatus } from "@/app/api/sandbox/health/route";

interface QrCodeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode?: string;
  expoUrl?: string;
  healthStatus?: HealthStatus | null;
  healthMessage?: string;
  onStartPreview?: () => void;
  isStarting?: boolean;
}

export function QrCodeSheet({
  open,
  onOpenChange,
  qrCode,
  expoUrl,
  healthStatus,
  healthMessage,
  onStartPreview,
  isStarting,
}: QrCodeSheetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!expoUrl) return;
    await navigator.clipboard.writeText(expoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine if we should show health status instead of QR code
  const showHealthStatus = healthStatus && healthStatus !== "ready";

  // Show button when sleeping or error (and not currently starting)
  const showStartButton = (healthStatus === "sleeping" || healthStatus === "error") && onStartPreview && !isStarting;

  // Get icon based on health status
  const getStatusIcon = () => {
    switch (healthStatus) {
      case "sleeping":
        return <Moon className="h-10 w-10 text-indigo-400" />;
      case "starting":
        return <Loader2 className="h-10 w-10 text-primary animate-spin" />;
      case "metro_starting":
        return <Zap className="h-10 w-10 text-amber-400 animate-pulse" />;
      case "error":
        return <AlertCircle className="h-10 w-10 text-red-400" />;
      default:
        return <Loader2 className="h-10 w-10 text-primary animate-spin" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] px-6">
        <SheetHeader className="text-center pb-2">
          <SheetTitle>Preview Your App</SheetTitle>
          <SheetDescription>
            {showHealthStatus
              ? healthStatus === "sleeping"
                ? "Your preview needs to be started"
                : healthStatus === "error"
                ? "Something went wrong"
                : "Getting your preview ready"
              : "Scan with Expo Go or open directly on this device"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col items-center gap-6 py-4 pb-8">
          {/* Health Status Display */}
          {showHealthStatus && (
            <div className="text-center space-y-4">
              <div className="relative inline-block">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  {getStatusIcon()}
                </div>
                {(healthStatus === "starting" || healthStatus === "metro_starting" || isStarting) && (
                  <div className="absolute inset-0 h-20 w-20 rounded-2xl bg-primary/10 mx-auto animate-ping opacity-20" />
                )}
                <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-[var(--magic-gold)] animate-sparkle" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold">{healthMessage}</p>
                {healthStatus === "sleeping" && (
                  <p className="text-sm text-muted-foreground">
                    Tap the button below to start
                  </p>
                )}
                {healthStatus === "starting" && (
                  <p className="text-sm text-muted-foreground">
                    Setting up your preview
                  </p>
                )}
                {healthStatus === "metro_starting" && (
                  <p className="text-sm text-muted-foreground">
                    Starting the preview server
                  </p>
                )}
                {healthStatus === "error" && (
                  <p className="text-sm text-muted-foreground">
                    Try again?
                  </p>
                )}
              </div>

              {/* Start Preview Button */}
              {showStartButton && (
                <Button
                  onClick={onStartPreview}
                  size="lg"
                  className="mt-2 gap-2 rounded-xl bg-gradient-to-r from-primary to-[var(--magic-violet)] hover:opacity-90 transition-opacity"
                >
                  <Play className="h-4 w-4" />
                  Start Preview
                </Button>
              )}

              {/* Progress dots for loading states */}
              {(healthStatus === "starting" || healthStatus === "metro_starting" || isStarting) && (
                <div className="flex justify-center gap-1.5 pt-2">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
          )}

          {/* QR Code - only show when healthy */}
          {!showHealthStatus && qrCode && (
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <img
                src={qrCode}
                alt="QR Code for Expo Go"
                className="w-48 h-48"
              />
            </div>
          )}

          {/* Open in Expo Go button - only show when healthy */}
          {!showHealthStatus && expoUrl && (
            <Button asChild size="lg" className="w-full max-w-xs gap-2">
              <a href={expoUrl}>
                <ExternalLink className="h-4 w-4" />
                Open in Expo Go
              </a>
            </Button>
          )}

          {/* Expo URL with copy - only show when healthy */}
          {!showHealthStatus && expoUrl && (
            <div className="w-full max-w-xs">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <code className="text-xs flex-1 truncate">{expoUrl}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
