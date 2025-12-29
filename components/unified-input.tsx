"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Loader2,
  Command,
  ImagePlus,
  Square,
  ListPlus,
  Mic,
  MicOff,
  ChevronDown,
  Wand2,
  Palette,
  Rocket,
  Database,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ImagePreviewGrid } from "@/components/image-preview-grid";
import { useImageUpload, type UploadedImage } from "@/hooks/use-image-upload";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_EXTENSIONS } from "@/lib/image-utils";
import { AIProviderSelector, type AIProvider } from "@/components/ai-provider-selector";

/** Starting mode for project creation */
export type StartMode = "plan" | "design" | "build";

const START_MODE_CONFIG: Record<StartMode, { label: string; shortLabel: string; icon: typeof Wand2; description: string }> = {
  plan: {
    label: "Create & Plan",
    shortLabel: "Plan",
    icon: Wand2,
    description: "Plan features, design screens, then build",
  },
  design: {
    label: "Start with Design",
    shortLabel: "Design",
    icon: Palette,
    description: "Design screens first, then build",
  },
  build: {
    label: "Build Directly",
    shortLabel: "Build",
    icon: Rocket,
    description: "Skip to building immediately",
  },
};

type SpeechRecognitionEventLike = {
  readonly resultIndex?: number;
  readonly results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorLike = {
  readonly error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const appendSegment = (base: string, addition: string) => {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) return base;
  if (!base) return trimmedAddition;
  const needsSeparator = !/\s$/.test(base);
  return `${base}${needsSeparator ? " " : ""}${trimmedAddition}`;
};

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
  /** Show the start mode selector (Home page) */
  showStartModeSelector?: boolean;
  /** Current start mode */
  startMode?: StartMode;
  /** Callback when start mode changes */
  onStartModeChange?: (mode: StartMode) => void;

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

  // AI Provider selection (build variant only)
  /** Current AI provider */
  aiProvider?: AIProvider;
  /** Callback when AI provider changes */
  onAIProviderChange?: (provider: AIProvider) => void;

  // Stop/Queue functionality (build variant only)
  /** Callback to stop the running agent */
  onStop?: () => void;
  /** Whether stop request is in progress */
  isStopping?: boolean;
  /** Number of messages currently queued */
  queuedCount?: number;

  // Convex backend toggle (home variant only)
  /** Whether to use Convex backend */
  useConvex?: boolean;
  /** Callback when Convex toggle changes */
  onUseConvexChange?: (enabled: boolean) => void;
}

export function UnifiedInput({
  onSubmit,
  isLoading,
  placeholder,
  variant,
  showStartModeSelector = false,
  startMode = "plan",
  onStartModeChange,
  projectId,
  tempUploadId,
  maxImages = 5,
  minTextLength,
  onTempUploadIdReady,
  onImagesChange,
  aiProvider = "claude-sdk",
  onAIProviderChange,
  onStop,
  isStopping = false,
  queuedCount = 0,
  useConvex = false,
  onUseConvexChange,
}: UnifiedInputProps) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechBaseTextRef = useRef("");
  const speechCommittedRef = useRef("");
  const speechInterimRef = useRef("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

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

  // Keep the speech base text aligned with manual edits when not dictating
  useEffect(() => {
    if (!isListening && !speechCommittedRef.current && !speechInterimRef.current) {
      speechBaseTextRef.current = text;
    }
  }, [text, isListening]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = navigator?.language ?? "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalTranscript = "";
      let interimTranscript = "";
      const startIndex = event.resultIndex ?? 0;

      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (!transcript) continue;

        if (result.isFinal) {
          finalTranscript = `${finalTranscript}${transcript} `;
        } else {
          interimTranscript = `${interimTranscript}${transcript}`;
        }
      }

      if (finalTranscript.trim()) {
        speechCommittedRef.current = appendSegment(
          speechCommittedRef.current,
          finalTranscript
        );
      }

      speechInterimRef.current = interimTranscript;

      const nextText = appendSegment(
        appendSegment(speechBaseTextRef.current, speechCommittedRef.current),
        speechInterimRef.current
      );

      setText(nextText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      setIsListening(false);
      setSpeechError(
        event?.error === "not-allowed"
          ? "Microphone permission denied"
          : "Unable to use speech recognition"
      );
    };

    recognition.onend = () => {
      const finalText = appendSegment(
        appendSegment(speechBaseTextRef.current, speechCommittedRef.current),
        speechInterimRef.current
      );
      speechBaseTextRef.current = finalText;
      speechCommittedRef.current = "";
      speechInterimRef.current = "";
      setText(finalText);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    // Safe to set derived support flag after mount to avoid hydration mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSpeechSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  // Default minimum text length based on variant
  const effectiveMinLength = minTextLength ?? 1;

  // Default placeholder based on variant
  const effectivePlaceholder =
    placeholder ??
    (variant === "home"
      ? "Describe your app idea... A habit tracker with daily streaks, a recipe book with photo upload, a fitness log with progress charts..."
      : "Describe your app...");

  const handleSubmit = useCallback(() => {
    if (text.trim().length < effectiveMinLength) return;
    // For home variant, block when loading. For build variant, allow queueing.
    if (variant === "home" && isLoading) return;
    if (isUploading) return;

    const imageKeys = getUploadedKeys();
    // Get preview URLs before clearing (for display in chat)
    const imagePreviewUrls = images
      .filter((img) => img.uploadStatus === "uploaded")
      .map((img) => img.previewUrl);

    onSubmit(text.trim(), imageKeys, imagePreviewUrls);

    // Clear text and images after submit
    setText("");
    clearImages();
  }, [text, effectiveMinLength, variant, isLoading, isUploading, getUploadedKeys, images, onSubmit, clearImages]);

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

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = e.clipboardData.files;
      if (files.length === 0) return;

      // Prevent default paste behavior when images are present
      e.preventDefault();
      addImages(files);
    },
    [addImages]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (!isSpeechSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    speechBaseTextRef.current = text;
    speechCommittedRef.current = "";
    speechInterimRef.current = "";
    setSpeechError(null);

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      setIsListening(false);
      setSpeechError(
        error instanceof Error ? error.message : "Unable to start microphone"
      );
    }
  }, [isSpeechSupported, isListening, text]);

  const isHome = variant === "home";

  // For build variant: allow queueing when agent is busy
  const isQueueingMode = !isHome && isLoading && !isUploading;
  const canSubmit = isHome
    ? text.trim().length >= effectiveMinLength && !isLoading && !isUploading
    : text.trim().length >= effectiveMinLength && !isUploading; // Build allows queueing
  const hasImages = images.length > 0;
  const canAddMoreImages = images.length < maxImages;

  // Accept attribute for file input
  const acceptedFormats = ACCEPTED_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

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
      className={cn(
        !isHome
          ? "mb-2 -mx-3 -mt-3 border-b border-border/50"
          : "mx-4 mb-3 rounded-xl bg-background/40 border border-border/30"
      )}
    />
  );

  const textarea = (
    <Textarea
      placeholder={isQueueingMode ? "Type to queue a message..." : effectivePlaceholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      disabled={isHome ? isLoading : false} // Build variant stays enabled for queueing
      rows={isHome ? 5 : 3}
      className={cn(
        "resize-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
        "transition-colors duration-300",
        isHome
          ? cn(
              "min-h-[120px] bg-transparent border-none text-foreground",
              "placeholder:text-muted-foreground/60 text-base px-6 pt-6 pb-20",
              hasImages && "min-h-[80px]"
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
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isHome
          ? "w-9 h-9 rounded-full bg-secondary/50 hover:bg-secondary border border-border/50 text-secondary-foreground/80 hover:text-secondary-foreground"
          : cn(
              "h-10 w-10 rounded-xl",
              "bg-background/50 backdrop-blur-sm border border-border/50",
              "hover:border-primary/50 hover:bg-muted/50",
              "text-muted-foreground hover:text-foreground"
            )
      )}
      title={canAddMoreImages ? "Add images" : `Maximum ${maxImages} images`}
    >
      <ImagePlus className="h-4 w-4" />
    </button>
  );

  const voiceInputButton = (
    <button
      type="button"
      onClick={toggleVoiceInput}
      disabled={!isSpeechSupported}
      aria-pressed={isListening}
      aria-label={
        speechError
          ? speechError
          : isSpeechSupported
            ? isListening
              ? "Stop dictation"
              : "Dictate with your microphone"
            : "Voice input is not supported in this browser"
      }
      className={cn(
        "relative flex items-center justify-center",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isHome
          ? cn(
              "w-9 h-9 rounded-full bg-secondary/50 hover:bg-secondary border border-border/50 text-secondary-foreground/80 hover:text-secondary-foreground",
              isListening && "bg-primary/20 border-primary/50 text-primary"
            )
          : cn(
              "h-10 w-10 rounded-xl",
              "bg-background/50 backdrop-blur-sm border border-border/50",
              "hover:border-primary/50 hover:bg-muted/50",
              "text-muted-foreground hover:text-foreground",
              isListening && "border-primary/60 bg-primary/5 text-primary"
            )
      )}
      title={
        speechError
          ? speechError
          : isSpeechSupported
            ? isListening
              ? "Stop dictation"
              : "Dictate with your microphone"
            : "Voice input is not supported in this browser"
      }
    >
      {isSpeechSupported ? (
        <>
          <Mic className="h-4 w-4" />
          {isListening && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full animate-pulse border border-background bg-primary" />
          )}
        </>
      ) : (
        <MicOff className="h-4 w-4" />
      )}
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
          className="relative w-full group"
        >
          {/* Glow effect behind input */}
          <div
            className={cn(
              "absolute -inset-1 bg-gradient-to-r from-blue-400/20 to-orange-400/20 dark:from-blue-500/10 dark:to-orange-500/10 rounded-[2rem] blur-2xl",
              "opacity-60 group-hover:opacity-80 transition-all duration-500",
              isFocused && "opacity-100 scale-[1.02]"
            )}
          />

          {/* Main card */}
          <div
            className={cn(
              "relative bg-card rounded-3xl shadow-xl border border-border",
              "overflow-hidden transition-all duration-300",
              isFocused && "ring-2 ring-primary/10 border-border",
              isDragOver && "ring-2 ring-primary ring-offset-2"
            )}
          >
            {dropOverlay}

            <div className="relative">
              {/* Top toolbar: AI Provider selector, Convex toggle, and Image upload */}
              {onAIProviderChange && (
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-2 z-10">
                  <AIProviderSelector
                    value={aiProvider}
                    onChange={onAIProviderChange}
                    disabled={isLoading}
                  />
                  {/* Convex Backend Toggle - only shown on home page */}
                  {onUseConvexChange && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label
                        htmlFor="convex-toggle"
                        className="text-xs font-medium text-secondary-foreground/80 cursor-pointer"
                      >
                        Database
                      </Label>
                      <Switch
                        id="convex-toggle"
                        checked={useConvex}
                        onCheckedChange={onUseConvexChange}
                        disabled={isLoading}
                        className="scale-75"
                      />
                    </div>
                  )}
                  {imageUploadButton}
                  {voiceInputButton}
                </div>
              )}

            {/* Content area with padding to clear the toolbar */}
            <div className={cn("pt-14", onAIProviderChange && "pt-16")}>
              {imageGrid}
              {textarea}
            </div>

              {/* Bottom toolbar */}
              <div className="p-4 flex items-center justify-between border-t border-border">
                <div className="flex items-center gap-4">
                  {/* Image upload button shown here if no AI provider selector */}
                  {!onAIProviderChange && (
                    <div className="flex items-center gap-2">
                      {imageUploadButton}
                      {voiceInputButton}
                    </div>
                  )}
                </div>

                {/* Split button with dropdown */}
                {showStartModeSelector ? (
                  <div className="group/btn relative">
                    {/* Glow effect on hover */}
                    <div className={cn(
                      "absolute -inset-1 rounded-full opacity-0 blur-lg transition-all duration-500 pointer-events-none",
                      "bg-gradient-to-r from-primary/60 via-primary/40 to-primary/60",
                      "group-hover/btn:opacity-70",
                      !canSubmit && "hidden"
                    )} />

                    {/* Button container */}
                    <div className={cn(
                      "relative flex items-center rounded-full",
                      "bg-gradient-to-b from-primary to-primary/90",
                      "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.1)]",
                      "hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.15)]",
                      "transition-all duration-300 ease-out",
                      "hover:translate-y-[-1px]",
                      "active:translate-y-[0px] active:shadow-[0_1px_4px_-1px_rgba(0,0,0,0.2)]",
                      !canSubmit && "opacity-50 pointer-events-none"
                    )}>
                      {/* Main submit button */}
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={cn(
                          "relative text-primary-foreground pl-5 pr-4 py-2.5 text-sm font-semibold",
                          "flex items-center gap-2.5 cursor-pointer",
                          "transition-all duration-200",
                          "disabled:cursor-not-allowed"
                        )}
                      >
                        {isLoading || isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            <span className="tracking-[-0.01em]">{START_MODE_CONFIG[startMode].label}</span>
                          </>
                        )}
                      </button>

                      {/* Subtle divider */}
                      <div className="w-px h-5 bg-primary-foreground/20" />

                      {/* Dropdown trigger */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={isLoading}
                            className={cn(
                              "relative text-primary-foreground pl-2.5 pr-3.5 py-2.5",
                              "flex items-center cursor-pointer",
                              "transition-all duration-200",
                              "hover:bg-white/10 rounded-r-full",
                              "disabled:cursor-not-allowed"
                            )}
                          >
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/btn:rotate-180" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={8}
                          className={cn(
                            "w-64 p-1.5 rounded-xl",
                            "bg-card/95 backdrop-blur-xl",
                            "border border-border/50",
                            "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.2)]"
                          )}
                        >
                          {(Object.keys(START_MODE_CONFIG) as StartMode[]).map((mode) => {
                            const config = START_MODE_CONFIG[mode];
                            const Icon = config.icon;
                            const isSelected = startMode === mode;
                            return (
                              <DropdownMenuItem
                                key={mode}
                                onClick={() => onStartModeChange?.(mode)}
                                className={cn(
                                  "flex items-start gap-3 p-3 rounded-lg cursor-pointer",
                                  "transition-all duration-200",
                                  "focus:bg-primary/5 focus:outline-none",
                                  isSelected
                                    ? "bg-primary/10 border border-primary/20"
                                    : "hover:bg-muted/50 border border-transparent"
                                )}
                              >
                                <div className={cn(
                                  "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                                  "transition-all duration-200",
                                  isSelected
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 pt-0.5">
                                  <span className={cn(
                                    "text-sm font-medium leading-none",
                                    isSelected && "text-primary"
                                  )}>
                                    {config.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground leading-snug mt-1">
                                    {config.description}
                                  </span>
                                </div>
                                {isSelected && (
                                  <div className="ml-auto self-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  </div>
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={cn(
                      "bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold",
                      "hover:bg-primary/90 transition-all shadow-lg",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      "flex items-center gap-2 cursor-pointer",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    )}
                  >
                    {isLoading || isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Create
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="hidden md:flex items-center justify-center gap-2 text-muted-foreground text-sm mt-4">
          <span>Press</span>
          <kbd className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted border border-border text-xs font-medium">
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

      {/* Top row: AI Provider selector and Image upload button */}
      {onAIProviderChange && (
        <div className="flex items-center gap-2 mb-2">
          <AIProviderSelector
            value={aiProvider}
            onChange={onAIProviderChange}
            disabled={isLoading}
          />
          {imageUploadButton}
          {voiceInputButton}
        </div>
      )}

      {/* Bottom row: Full-width textarea with send/stop/queue button */}
      <div className="flex gap-2 items-end">
        {/* Show image upload button inline if no AI provider selector */}
        {!onAIProviderChange && (
          <div className="flex flex-col gap-1.5">
            {imageUploadButton}
            {voiceInputButton}
          </div>
        )}
        {textarea}

        {/* Stacked buttons container */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {/* Queue/Send button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-xl",
              "transition-all duration-300",
              "disabled:opacity-50 disabled:scale-100",
              isQueueingMode
                ? cn(
                    "bg-muted hover:bg-muted/80",
                    "text-muted-foreground hover:text-foreground",
                    "shadow-sm"
                  )
                : cn(
                    "bg-gradient-to-r from-primary to-[var(--magic-violet)]",
                    "hover:opacity-90 hover:scale-105",
                    "shadow-lg shadow-primary/20"
                  )
            )}
            title={isQueueingMode ? `Queue message${queuedCount > 0 ? ` (${queuedCount} queued)` : ""}` : "Send message"}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isQueueingMode ? (
              <ListPlus className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>

          {/* Stop button - shown when agent is running and onStop is provided */}
          {isLoading && onStop ? (
            <Button
              onClick={onStop}
              disabled={isStopping}
              size="icon"
              variant="destructive"
              className={cn(
                "h-10 w-10 rounded-xl",
                "hover:scale-105",
                "shadow-lg shadow-destructive/20",
                "transition-all duration-300",
                "disabled:opacity-50 disabled:scale-100"
              )}
              title="Stop agent"
            >
              {isStopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4 fill-current" />
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Queue indicator */}
      {queuedCount > 0 && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          {queuedCount} message{queuedCount > 1 ? "s" : ""} queued
        </div>
      )}
    </div>
  );
}
