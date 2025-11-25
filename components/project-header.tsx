"use client";

import { useState, useRef, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Check, X, QrCode } from "lucide-react";
import { useSupabaseClient } from "@/lib/supabase-client";

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
    <header className="flex h-12 shrink-0 items-center border-b px-4 gap-4">
      {/* Left: Sidebar trigger + Breadcrumbs/Name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SidebarTrigger className="h-8 w-8" />
        <Separator orientation="vertical" className="h-4" />

        {/* Project name with inline editing */}
        {projectId && projectName ? (
          <div className="flex items-center gap-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
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
                  className="h-7 w-48 text-sm font-medium"
                  placeholder="Project name..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                >
                  {isSavingName ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCancel}
                  disabled={isSavingName}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group">
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {displayName}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <AppBreadcrumbs projectName={projectName} />
        )}
      </div>

      {/* Center: View mode tabs (only on project pages, hidden on mobile) */}
      {showControls && (
        <div className="hidden md:flex items-center gap-2">
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

      {/* Mobile: QR Code button */}
      {hasQrCode && onOpenQrSheet && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenQrSheet}
          className="md:hidden h-8 px-3 gap-2"
        >
          <QrCode className="h-4 w-4" />
          Preview
        </Button>
      )}
    </header>
  );
}
