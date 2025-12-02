"use client";

import { useState, useRef, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Check, X, QrCode, Eye, Code2 } from "lucide-react";
import { useSupabaseClient } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";

interface ProjectHeaderProps {
  projectId?: string;
  projectName?: string;

  // Optional view controls (for project pages, desktop only)
  viewMode?: "preview" | "code";
  onViewModeChange?: (mode: "preview" | "code") => void;

  // Mobile QR code button
  hasQrCode?: boolean;
  onOpenQrSheet?: () => void;
}

export function ProjectHeader({
  projectId,
  projectName,
  viewMode,
  onViewModeChange,
  hasQrCode,
  onOpenQrSheet,
}: ProjectHeaderProps) {
  const supabase = useSupabaseClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(projectName || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [displayName, setDisplayName] = useState(projectName || "");
  const inputRef = useRef<HTMLInputElement>(null);

  const showControls = viewMode && onViewModeChange;
  // TODO: Enable when Code view is implemented
  const showViewModeTabs = false;

  // Update display name when projectName prop changes
  useEffect(() => {
    setDisplayName(projectName || "");
    setEditedName(projectName || "");
  }, [projectName]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveName = async () => {
    if (!editedName.trim() || !projectId) {
      setIsEditing(false);
      setEditedName(displayName);
      return;
    }

    if (editedName.trim() === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: editedName.trim() })
        .eq("id", projectId);

      if (error) throw error;

      setDisplayName(editedName.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating project name:", error);
      setEditedName(displayName);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancel = () => {
    setEditedName(displayName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border/50 px-4 gap-4 glass-morphism relative z-10">
      {/* Left: Sidebar trigger + Breadcrumbs/Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-foreground/5 transition-colors" />
        <Separator orientation="vertical" className="h-5 bg-border/50" />

        {/* Project name with inline editing */}
        {projectId && projectName ? (
          <div className="flex items-center gap-1.5 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  ref={inputRef}
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    // Small delay to allow button clicks to register
                    setTimeout(() => {
                      if (isEditing) handleSaveName();
                    }, 150);
                  }}
                  disabled={isSavingName}
                  className={cn(
                    "h-8 w-52 text-sm font-medium rounded-lg",
                    "border-border/50 bg-background/50 backdrop-blur-sm",
                    "focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  )}
                  placeholder="Project name..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-[var(--magic-mint)]/10"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                >
                  {isSavingName ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Check className="h-4 w-4 text-[var(--magic-mint)]" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-red-500/10"
                  onClick={handleCancel}
                  disabled={isSavingName}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <span className="text-sm font-semibold font-display truncate max-w-[200px] text-foreground/90">
                  {displayName}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3 w-3 text-primary" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <AppBreadcrumbs projectName={projectName} />
        )}
      </div>

      {/* Center: View mode tabs (only on project pages, hidden on mobile) */}
      {/* Hidden until Code view is implemented - set showViewModeTabs to true to enable */}
      {showViewModeTabs && showControls && (
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl glass-morphism border border-border/50">
          <button
            onClick={() => onViewModeChange("preview")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              viewMode === "preview"
                ? "bg-gradient-to-r from-primary to-[var(--magic-violet)] text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={() => onViewModeChange("code")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              viewMode === "code"
                ? "bg-gradient-to-r from-primary to-[var(--magic-violet)] text-white shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Code2 className="h-4 w-4" />
            Code
          </button>
        </div>
      )}

      {/* Mobile: QR Code button */}
      {hasQrCode && onOpenQrSheet && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenQrSheet}
          className={cn(
            "md:hidden h-9 px-4 gap-2 rounded-xl",
            "glass-morphism border-border/50",
            "hover:border-primary/50 hover:bg-primary/5",
            "transition-all duration-200"
          )}
        >
          <QrCode className="h-4 w-4 text-primary" />
          <span className="font-medium">Preview</span>
        </Button>
      )}
    </header>
  );
}
