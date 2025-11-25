"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Bug, X, Copy, Check, Loader2, Square, Save, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface DebugPanelProps {
  sandboxId?: string;
  sandboxStatus: "idle" | "starting" | "ready" | "error";
  uptime?: number;
  error?: string;
  onStartSandbox?: () => void;
  onStopSandbox?: () => void;
  onSaveToR2?: () => void;
  isSaving?: boolean;
}

export function DebugPanel({
  sandboxId,
  sandboxStatus,
  uptime,
  error,
  onStartSandbox,
  onStopSandbox,
  onSaveToR2,
  isSaving,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();

  // Position state (only updated on drag end for performance)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isOnLeft, setIsOnLeft] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Refs for performant dragging
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, buttonX: 0, buttonY: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Initialize position
  useEffect(() => {
    if (typeof window !== "undefined" && !initialized) {
      const x = window.innerWidth - 64;
      const y = window.innerHeight - 140;
      setPosition({ x, y });
      currentPosRef.current = { x, y };
      setInitialized(true);
    }
  }, [initialized]);

  const updateButtonTransform = useCallback((x: number, y: number) => {
    if (buttonRef.current) {
      buttonRef.current.style.left = `${x}px`;
      buttonRef.current.style.top = `${y}px`;
    }
  }, []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startPosRef.current = {
      x: clientX,
      y: clientY,
      buttonX: currentPosRef.current.x,
      buttonY: currentPosRef.current.y,
    };
    if (buttonRef.current) {
      buttonRef.current.style.transition = "none";
      buttonRef.current.style.transform = "scale(1.1)";
    }
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;

    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;

    // Mark as dragged if moved more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasDraggedRef.current = true;
    }

    const newX = startPosRef.current.buttonX + deltaX;
    const newY = startPosRef.current.buttonY + deltaY;

    // Clamp Y to viewport
    const maxY = window.innerHeight - 48;
    const clampedY = Math.max(60, Math.min(maxY - 16, newY));

    currentPosRef.current = { x: newX, y: clampedY };
    updateButtonTransform(newX, clampedY);
  }, [updateButtonTransform]);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Snap to left or right edge
    const screenCenter = window.innerWidth / 2;
    const snapToLeft = currentPosRef.current.x < screenCenter;
    const finalX = snapToLeft ? 16 : window.innerWidth - 64;
    const finalY = currentPosRef.current.y;

    setIsOnLeft(snapToLeft);
    setPosition({ x: finalX, y: finalY });
    currentPosRef.current = { x: finalX, y: finalY };

    if (buttonRef.current) {
      buttonRef.current.style.transition = "all 0.3s ease-out";
      buttonRef.current.style.transform = "scale(1)";
      updateButtonTransform(finalX, finalY);
    }
  }, [updateButtonTransform]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [handleDragStart, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  }, [handleDragMove]);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleButtonClick = useCallback(() => {
    // Only toggle if we didn't drag
    if (!hasDraggedRef.current) {
      setIsOpen(prev => !prev);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "0s";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  // Shared content for both mobile sheet and desktop card
  const debugContent = (
    <div className="space-y-4">
      {/* Sandbox Controls */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Sandbox Controls</span>
        <div className="flex flex-wrap gap-2">
          {sandboxStatus === "idle" && onStartSandbox && (
            <Button onClick={onStartSandbox} size="sm" className="gap-2">
              <Play className="h-3.5 w-3.5" />
              Start Sandbox
            </Button>
          )}
          {sandboxStatus === "starting" && (
            <Button disabled size="sm" variant="secondary" className="gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Starting...
            </Button>
          )}
          {sandboxStatus === "ready" && (
            <>
              {onStopSandbox && (
                <Button onClick={onStopSandbox} size="sm" variant="secondary" className="gap-2">
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              )}
              {onSaveToR2 && (
                <Button
                  onClick={onSaveToR2}
                  size="sm"
                  variant="outline"
                  className="gap-2"
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
            </>
          )}
          {sandboxStatus === "error" && onStartSandbox && (
            <Button onClick={onStartSandbox} size="sm" variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-rose-500" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Status</span>
          <Badge
            variant={
              sandboxStatus === "ready"
                ? "default"
                : sandboxStatus === "error"
                ? "destructive"
                : "secondary"
            }
          >
            {sandboxStatus}
          </Badge>
        </div>

        {sandboxId && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Sandbox ID</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                {sandboxId}
              </code>
              <Button
                onClick={() => copyToClipboard(sandboxId)}
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        )}

        {uptime !== undefined && sandboxStatus === "ready" && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-mono">{formatUptime(uptime)}</span>
          </div>
        )}

        {error && (
          <div className="space-y-1">
            <span className="text-xs text-red-500">Error</span>
            <div className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-2 rounded">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
        Drag the bug button to reposition it.
      </div>
    </div>
  );

  if (!initialized) return null;

  return (
    <>
      {/* Draggable Toggle Button */}
      <Button
        ref={buttonRef}
        onClick={handleButtonClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        size="icon"
        variant="outline"
        className="fixed h-12 w-12 rounded-full shadow-lg z-50 touch-none select-none cursor-grab active:cursor-grabbing"
        style={{
          left: position.x,
          top: position.y,
          transition: "all 0.3s ease-out",
        }}
      >
        <Bug className="h-5 w-5" />
      </Button>

      {/* Mobile: Bottom Sheet */}
      {isMobile ? (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] px-6">
            <SheetHeader className="pb-2">
              <SheetTitle className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Panel
              </SheetTitle>
            </SheetHeader>
            <div className="py-4 pb-8">
              {debugContent}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        /* Desktop: Floating Card */
        <div
          className={cn(
            "fixed w-80 md:w-96 z-50 transition-all duration-200 p-4",
            isOnLeft ? "left-0" : "right-0",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
          style={{
            top: Math.max(16, Math.min(position.y - 200, window.innerHeight - 450)),
          }}
        >
          <Card className="shadow-xl">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Debug Panel</h3>
                </div>
                <Button
                  onClick={() => setIsOpen(false)}
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {debugContent}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
