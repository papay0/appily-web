"use client";

import { Moon, Loader2, Zap, AlertCircle, Sparkles, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { HealthStatus } from "@/app/api/sandbox/health/route";

interface SandboxStatusOverlayProps {
  status: HealthStatus;
  message: string;
  className?: string;
  onWakeUp?: () => void;
  isWakingUp?: boolean;
}

// Icon and animation configuration for each status
const STATUS_CONFIG: Record<
  HealthStatus,
  {
    Icon: React.ComponentType<{ className?: string }>;
    iconClassName: string;
    containerClassName: string;
    showSparkles: boolean;
    animate: boolean;
  }
> = {
  sleeping: {
    Icon: Moon,
    iconClassName: "text-indigo-400",
    containerClassName: "bg-indigo-500/10 border-indigo-500/20",
    showSparkles: true,
    animate: false,
  },
  starting: {
    Icon: Loader2,
    iconClassName: "text-primary animate-spin",
    containerClassName: "bg-primary/10 border-primary/20",
    showSparkles: true,
    animate: true,
  },
  metro_starting: {
    Icon: Zap,
    iconClassName: "text-amber-400 animate-pulse",
    containerClassName: "bg-amber-500/10 border-amber-500/20",
    showSparkles: true,
    animate: true,
  },
  ready: {
    Icon: Sparkles,
    iconClassName: "text-green-400",
    containerClassName: "bg-green-500/10 border-green-500/20",
    showSparkles: false,
    animate: false,
  },
  error: {
    Icon: AlertCircle,
    iconClassName: "text-red-400",
    containerClassName: "bg-red-500/10 border-red-500/20",
    showSparkles: false,
    animate: false,
  },
};

export function SandboxStatusOverlay({
  status,
  message,
  className,
  onWakeUp,
  isWakingUp,
}: SandboxStatusOverlayProps) {
  const config = STATUS_CONFIG[status];
  const { Icon, iconClassName, containerClassName, showSparkles, animate } = config;

  // Don't show overlay when ready
  if (status === "ready") {
    return null;
  }

  // Show wake up button for sleeping or error states
  const showWakeUpButton = (status === "sleeping" || status === "error") && onWakeUp && !isWakingUp;

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        "animate-fade-in",
        className
      )}
    >
      <div className="text-center space-y-4 p-6">
        {/* Icon Container */}
        <div className="relative inline-block">
          <div
            className={cn(
              "h-20 w-20 rounded-2xl border flex items-center justify-center mx-auto",
              "transition-all duration-300",
              containerClassName
            )}
          >
            <Icon className={cn("h-10 w-10", iconClassName)} />
          </div>

          {/* Animated ping effect for starting states */}
          {animate && (
            <div
              className={cn(
                "absolute inset-0 h-20 w-20 rounded-2xl mx-auto",
                "animate-ping opacity-20",
                containerClassName
              )}
            />
          )}

          {/* Sparkles decoration */}
          {showSparkles && (
            <>
              <Sparkles
                className={cn(
                  "absolute -top-2 -right-2 w-5 h-5",
                  "text-[var(--magic-gold)] animate-sparkle"
                )}
              />
              <Sparkles
                className={cn(
                  "absolute -bottom-1 -left-2 w-4 h-4",
                  "text-[var(--magic-gold)] animate-sparkle animation-delay-500"
                )}
              />
            </>
          )}
        </div>

        {/* Status Message */}
        <div className="space-y-2">
          <p className="text-lg font-semibold font-display text-gradient-magic">
            {message}
          </p>

          {/* Sub-message based on status */}
          {status === "sleeping" && (
            <p className="text-sm text-muted-foreground">
              Your preview needs to be started
            </p>
          )}
          {status === "starting" && (
            <p className="text-sm text-muted-foreground">
              Setting up your preview
            </p>
          )}
          {status === "metro_starting" && (
            <p className="text-sm text-muted-foreground">
              Starting the preview server
            </p>
          )}
          {status === "error" && (
            <p className="text-sm text-muted-foreground">
              Something went wrong. Try again?
            </p>
          )}
        </div>

        {/* Wake Up Button for sleeping/error states */}
        {showWakeUpButton && (
          <Button
            onClick={onWakeUp}
            size="lg"
            className="mt-4 gap-2 rounded-xl bg-gradient-to-r from-primary to-[var(--magic-violet)] hover:opacity-90 transition-opacity"
          >
            <Play className="h-4 w-4" />
            Start Preview
          </Button>
        )}

        {/* Progress dots for active states */}
        {(status === "starting" || status === "metro_starting" || isWakingUp) && (
          <div className="flex justify-center gap-1.5 pt-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full bg-primary/60",
                "animate-bounce"
              )}
              style={{ animationDelay: "0ms" }}
            />
            <div
              className={cn(
                "w-2 h-2 rounded-full bg-primary/60",
                "animate-bounce"
              )}
              style={{ animationDelay: "150ms" }}
            />
            <div
              className={cn(
                "w-2 h-2 rounded-full bg-primary/60",
                "animate-bounce"
              )}
              style={{ animationDelay: "300ms" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
