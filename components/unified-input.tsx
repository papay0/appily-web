"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Send,
  Loader2,
  Sparkles,
  Command,
  ImagePlus,
} from "lucide-react";
import { MagicButton } from "@/components/marketing/MagicButton";
import { ImagePreviewGrid } from "@/components/image-preview-grid";
import { useImageUpload, type UploadedImage } from "@/hooks/use-image-upload";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_EXTENSIONS } from "@/lib/image-utils";

export interface UnifiedInputProps {
  /** Callback when user submits. Receives text, R2 keys, and preview URLs of uploaded images */
  onSubmit: (text: string, imageKeys: string[], imagePreviewUrls: string[]) => void;
  /** Whether input is disabled (e.g., loading) */
  isLoading: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Variant determines layout and styling */
  variant: "home" | "build";

  // Home-specific props
  /** Show the plan features checkbox (Home page) */
  showPlanCheckbox?: boolean;
  /** Current state of plan features checkbox */
  planFeatures?: boolean;
  /** Callback when plan features checkbox changes */
  onPlanFeaturesChange?: (checked: boolean) => void;

  // Image context for R2 storage
  /** Project ID - if provided, images stored under project */
  projectId?: string;
  /** Temp upload ID - used if no projectId (Home page flow) */
  tempUploadId?: string;

  // Optional configuration
  /** Maximum number of images (default: 5) */
  maxImages?: number;
  /** Minimum text length required to submit (default: 10 for home, 1 for build) */
  minTextLength?: number;

  /** Callback to get the tempUploadId being used (for Home page linking) */
  onTempUploadIdReady?: (tempUploadId: string) => void;
  /** Callback when images change */
  onImagesChange?: (images: UploadedImage[]) => void;
}

export function UnifiedInput({
  onSubmit,
  isLoading,
  placeholder,
  variant,
  showPlanCheckbox = false,
  planFeatures = false,
  onPlanFeaturesChange,
  projectId,
  tempUploadId,
  maxImages = 5,
  minTextLength,
  onTempUploadIdReady,
  onImagesChange,
}: UnifiedInputProps) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use hook-managed temp upload ID
  const {
    images,
    addImages,
    removeImage,
    clearImages,
    isUploading,
    getUploadedKeys,
    currentTempUploadId,
  } = useImageUpload({
    projectId,
    tempUploadId,
    maxImages,
  });

  // Notify parent of tempUploadId
  useEffect(() => {
    if (!projectId && currentTempUploadId && onTempUploadIdReady) {
      onTempUploadIdReady(currentTempUploadId);
    }
  }, [projectId, currentTempUploadId, onTempUploadIdReady]);

  // Notify parent when images change
  useEffect(() => {
    onImagesChange?.(images);
  }, [images, onImagesChange]);

  // Default minimum text length based on variant
  const effectiveMinLength = minTextLength ?? (variant === "home" ? 10 : 1);

  // Default placeholder based on variant
  const effectivePlaceholder =
    placeholder ??
    (variant === "home"
      ? "Describe your app idea... A habit tracker with daily streaks, a recipe book with photo upload, a fitness log with progress charts..."
      : "Describe your app...");

  const handleSubmit = useCallback(() => {
    if (text.trim().length < effectiveMinLength) return;
    if (isLoading || isUploading) return;

    const imageKeys = getUploadedKeys();
    // Get preview URLs before clearing (for display in chat)
    const imagePreviewUrls = images
      .filter((img) => img.uploadStatus === "uploaded")
      .map((img) => img.previewUrl);

    onSubmit(text.trim(), imageKeys, imagePreviewUrls);

    // Clear text and images after submit
    setText("");
    clearImages();
  }, [text, effectiveMinLength, isLoading, isUploading, getUploadedKeys, images, onSubmit, clearImages]);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    // Submit on Cmd/Ctrl + Enter (for textarea) or Enter (for input)
    if (variant === "home") {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    } else {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      addImages(files);
    },
    [addImages]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        addImages(files);
      }
    },
    [addImages]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const canSubmit =
    text.trim().length >= effectiveMinLength && !isLoading && !isUploading;
  const hasImages = images.length > 0;
  const canAddMoreImages = images.length < maxImages;

  // Accept attribute for file input
  const acceptedFormats = ACCEPTED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

  const isHome = variant === "home";

  // Shared elements
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={acceptedFormats}
      multiple
      onChange={(e) => handleFileSelect(e.target.files)}
      className="hidden"
    />
  );

  const dropOverlay = isDragOver && (
    <div className={cn(
      "absolute inset-0 z-20 bg-primary/10 backdrop-blur-sm flex items-center justify-center",
      isHome && "rounded-2xl"
    )}>
      <div className="flex flex-col items-center gap-2 text-primary">
        <ImagePlus className={isHome ? "h-8 w-8" : "h-6 w-6"} />
        <span className={cn("font-medium", isHome ? "text-sm" : "text-xs")}>Drop images here</span>
      </div>
    </div>
  );

  const imageGrid = hasImages && (
    <ImagePreviewGrid
      images={images}
      onRemove={removeImage}
      disabled={isLoading}
      className={!isHome ? "mb-2 -mx-3 -mt-3 border-b border-border/50" : undefined}
    />
  );

  const textarea = (
    <Textarea
      placeholder={effectivePlaceholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      disabled={isLoading}
      rows={isHome ? 5 : 3}
      className={cn(
        "resize-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
        "transition-colors duration-300",
        isHome
          ? cn(
              "min-h-[180px] bg-transparent border-none text-foreground",
              "placeholder:text-muted-foreground/60 text-lg p-6 pb-24",
              hasImages && "min-h-[140px]"
            )
          : cn(
              "flex-1 min-h-[80px] rounded-xl border-border/50 text-sm",
              "bg-background/50 backdrop-blur-sm",
              "focus:border-primary/50",
              "placeholder:text-muted-foreground/60"
            )
      )}
    />
  );

  const imageUploadButton = (
    <button
      type="button"
      onClick={openFilePicker}
      disabled={isLoading || !canAddMoreImages}
      className={cn(
        "flex items-center justify-center",
        "text-muted-foreground hover:text-foreground",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isHome
          ? "w-8 h-8 rounded-lg hover:bg-muted/50"
          : cn(
              "h-10 w-10 rounded-xl",
              "bg-background/50 backdrop-blur-sm border border-border/50",
              "hover:border-primary/50 hover:bg-muted/50"
            )
      )}
      title={canAddMoreImages ? "Add images" : `Maximum ${maxImages} images`}
    >
      <ImagePlus className={isHome ? "h-5 w-5" : "h-4 w-4"} />
    </button>
  );

  if (isHome) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        {fileInput}

        <div
          ref={containerRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-2xl overflow-hidden transition-all duration-500",
            "glass-morphism",
            isFocused && "shadow-xl shadow-primary/10",
            isDragOver && "ring-2 ring-primary ring-offset-2"
          )}
        >
          {/* Gradient border overlay */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500",
              isFocused ? "opacity-100" : "opacity-0",
              "gradient-border"
            )}
          />

          {/* Focus glow effect */}
          <div
            className={cn(
              "absolute -inset-1 rounded-2xl blur-xl transition-opacity duration-500 pointer-events-none",
              "bg-gradient-to-r from-primary/20 via-[var(--magic-violet)]/20 to-primary/20",
              isFocused ? "opacity-100" : "opacity-0"
            )}
          />

          {dropOverlay}

          <div className="relative">
            {imageGrid}
            {textarea}

            {/* Bottom toolbar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between border-t border-border/50 bg-card/30 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                {imageUploadButton}

                {showPlanCheckbox && (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Checkbox
                        id="plan-features"
                        checked={planFeatures}
                        onCheckedChange={(checked) =>
                          onPlanFeaturesChange?.(checked === true)
                        }
                        disabled={isLoading}
                        className={cn(
                          "transition-all duration-300",
                          planFeatures &&
                            "border-primary data-[state=checked]:bg-primary"
                        )}
                      />
                      {planFeatures && (
                        <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-[var(--magic-gold)] animate-sparkle" />
                      )}
                    </div>
                    <Label
                      htmlFor="plan-features"
                      className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Plan features first
                    </Label>
                  </div>
                )}
              </div>

              <MagicButton
                onClick={handleSubmit}
                className={cn(
                  "px-6",
                  !canSubmit && "opacity-50 pointer-events-none"
                )}
              >
                {isLoading || isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : showPlanCheckbox && planFeatures ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Create & Plan
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Create
                  </>
                )}
              </MagicButton>
            </div>
          </div>

          {/* Decorative sparkles */}
          <Sparkles
            className={cn(
              "absolute top-4 right-4 w-4 h-4 text-[var(--magic-violet)] transition-opacity duration-500",
              isFocused ? "opacity-100 animate-sparkle" : "opacity-0"
            )}
          />
          <Sparkles
            className={cn(
              "absolute top-8 right-8 w-3 h-3 text-primary transition-opacity duration-500 animation-delay-500",
              isFocused ? "opacity-100 animate-sparkle" : "opacity-0"
            )}
          />
        </div>

        <p className="hidden md:flex items-center justify-center gap-2 text-muted-foreground text-sm mt-4">
          <span>Press</span>
          <kbd className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border/50 text-xs font-medium">
            <Command className="h-3 w-3" />
            <span>+</span>
            <span>Enter</span>
          </kbd>
          <span>to submit</span>
        </p>
      </div>
    );
  }

  // Build variant
  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "glass-morphism border-t border-border/50 p-3",
        isDragOver && "ring-2 ring-primary ring-inset"
      )}
    >
      {fileInput}
      {dropOverlay}
      {imageGrid}

      <div className="flex gap-2 items-end">
        {imageUploadButton}
        {textarea}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="icon"
          className={cn(
            "h-10 w-10 rounded-xl shrink-0",
            "bg-gradient-to-r from-primary to-[var(--magic-violet)]",
            "hover:opacity-90 hover:scale-105",
            "shadow-lg shadow-primary/20",
            "transition-all duration-300",
            "disabled:opacity-50 disabled:scale-100"
          )}
        >
          {isLoading || isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
