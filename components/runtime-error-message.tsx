"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface FullError {
  message?: string;
  stack?: string;
  componentStack?: string;
  filename?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface DeviceInfo {
  platform?: string;
  version?: string;
}

interface RuntimeErrorMessageProps {
  message: string;
  fullError?: FullError;
  deviceInfo?: DeviceInfo;
  onFixError?: () => void;
  isFixing?: boolean;
}

export function RuntimeErrorMessage({
  message,
  fullError,
  deviceInfo,
  onFixError,
  isFixing = false,
}: RuntimeErrorMessageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 my-2 w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {/* Main error card */}
      <div className="inline-flex flex-col gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
        {/* Header with icon and title */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-red-600 dark:text-red-400">
              Runtime Error in App
            </span>
            <p className="text-xs text-red-500/80 mt-1 whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
        </div>

        {/* Device info badge */}
        {deviceInfo && deviceInfo.platform && (
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
              {deviceInfo.platform === "ios" ? "iOS" : "Android"}{" "}
              {deviceInfo.version}
            </span>
          </div>
        )}

        {/* Collapsible stack trace */}
        {fullError?.stack && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors",
                  "text-red-500/70 hover:text-red-500"
                )}
              >
                {isOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {isOpen ? "Hide details" : "Show stack trace"}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5 overflow-x-auto">
                <pre className="text-[10px] text-red-500/70 font-mono whitespace-pre-wrap break-all">
                  {fullError.stack}
                </pre>
                {fullError.componentStack && (
                  <>
                    <div className="border-t border-red-500/20 my-2" />
                    <p className="text-[10px] text-red-500/50 mb-1 font-medium">
                      Component Stack:
                    </p>
                    <pre className="text-[10px] text-red-500/70 font-mono whitespace-pre-wrap break-all">
                      {fullError.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Fix button */}
        <Button
          size="sm"
          variant="destructive"
          className="gap-2 self-start"
          onClick={onFixError}
          disabled={isFixing}
        >
          <Wrench className="h-3.5 w-3.5" />
          {isFixing ? "Fixing..." : "Fix this error"}
        </Button>
      </div>
    </div>
  );
}
