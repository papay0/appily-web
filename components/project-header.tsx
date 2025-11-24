"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Loader2, Square, Save } from "lucide-react";

interface ProjectHeaderProps {
  projectName?: string;

  // Optional view controls (for project pages)
  viewMode?: "preview" | "code";
  onViewModeChange?: (mode: "preview" | "code") => void;

  // Optional sandbox controls (for project pages)
  sandboxStatus?: "idle" | "starting" | "ready" | "error";
  onStartSandbox?: () => void;
  onStopSandbox?: () => void;

  // Debug: Manual save button
  onSaveToR2?: () => void;
  isSaving?: boolean;
}

export function ProjectHeader({
  projectName,
  viewMode,
  onViewModeChange,
  sandboxStatus,
  onStartSandbox,
  onStopSandbox,
  onSaveToR2,
  isSaving,
}: ProjectHeaderProps) {
  const showControls = viewMode && onViewModeChange;
  const showSandboxButton = sandboxStatus && (onStartSandbox || onStopSandbox);

  return (
    <header className="flex h-12 shrink-0 items-center border-b px-4 gap-4">
      {/* Left: Sidebar trigger + Breadcrumbs */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SidebarTrigger className="h-8 w-8" />
        <Separator orientation="vertical" className="h-4" />
        <AppBreadcrumbs projectName={projectName} />
      </div>

      {/* Center: View mode tabs (only on project pages) - Unified button style */}
      {showControls && (
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("preview")}
            className="h-8 px-3"
          >
            Preview
          </Button>
          <Button
            variant={viewMode === "code" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("code")}
            className="h-8 px-3"
          >
            Code
          </Button>
        </div>
      )}

      {/* Right: Sandbox controls (only on project pages) - Unified button style */}
      {showSandboxButton && (
        <div className="flex items-center gap-2">
          {/* Debug: Manual Save to R2 button */}
          {onSaveToR2 && sandboxStatus === "ready" && (
            <Button
              onClick={onSaveToR2}
              size="sm"
              variant="outline"
              className="h-8 px-3 gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save to R2
                </>
              )}
            </Button>
          )}

          {sandboxStatus === "idle" && onStartSandbox && (
            <Button onClick={onStartSandbox} size="sm" className="h-8 px-3">
              Start Sandbox
            </Button>
          )}
          {sandboxStatus === "starting" && (
            <Button disabled size="sm" variant="secondary" className="h-8 px-3 gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Starting...
            </Button>
          )}
          {sandboxStatus === "ready" && onStopSandbox && (
            <Button onClick={onStopSandbox} size="sm" variant="secondary" className="h-8 px-3 gap-2">
              <Square className="h-3.5 w-3.5" />
              Stop Sandbox
            </Button>
          )}
          {sandboxStatus === "error" && onStartSandbox && (
            <Button
              onClick={onStartSandbox}
              size="sm"
              variant="secondary"
              className="h-8 px-3 gap-2"
            >
              <div className="h-2 w-2 rounded-full bg-rose-500" />
              Retry
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
