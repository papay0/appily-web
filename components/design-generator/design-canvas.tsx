"use client";

import React, { useState, useEffect, useRef } from "react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, RotateCcw, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScreenPreview } from "./screen-preview";
import {
  StreamingScreenPreview,
  type ParsedScreen,
  type DesignFeature,
  type CurrentScreen,
  type ConversationMessage,
} from "./streaming-screen-preview";
import type { GeneratedScreen, GeneratedTheme } from "@/lib/ai/types";

// iPhone 14 Pro dimensions
const PHONE_WIDTH = 390;
const MIN_PHONE_HEIGHT = 844;
const PHONE_SCALE = 0.65; // Scale down for canvas view

interface DesignCanvasProps {
  screens: GeneratedScreen[];
  theme: GeneratedTheme;
  /** Whether to show HTML streaming mode */
  isStreaming?: boolean;
  /** Prompt for streaming generation */
  streamingPrompt?: string;
  /** Screen name for streaming generation */
  streamingScreenName?: string;
  /** Features from planning phase for context-aware design */
  features?: DesignFeature[];
  /** Current screens for follow-up context */
  currentScreens?: CurrentScreen[];
  /** Conversation history for context */
  conversationHistory?: ConversationMessage[];
  /** Names of screens currently being edited (for pulsing border) */
  editingScreenNames?: Set<string>;
  /** Whether new screens are being generated (show streaming preview) */
  hasNewScreenInProgress?: boolean;
  /** Completed streamed HTML screens to display after streaming ends */
  streamedScreens?: ParsedScreen[] | null;
  /** Callback when all HTML streaming completes */
  onStreamComplete?: (screens: ParsedScreen[]) => void;
  /** Callback when a single HTML screen completes during streaming */
  onScreenComplete?: (screen: ParsedScreen) => void;
  /** Callback when a screen edit starts */
  onScreenEditStart?: (screenName: string) => void;
  /** Callback when a NEW screen starts (not edit) */
  onScreenNewStart?: (screenName: string) => void;
  /** Callback when streaming errors */
  onStreamError?: (error: string) => void;
}

function PhoneMockup({ screen, theme }: { screen: GeneratedScreen; theme: GeneratedTheme }) {
  const [contentHeight, setContentHeight] = useState(MIN_PHONE_HEIGHT);

  return (
    <div className="flex flex-col items-start">
      {/* Screen Title */}
      <div className="mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-gray-500" />
        <h3 className="text-white font-medium text-sm">{screen.name}</h3>
      </div>

      {/* Phone Frame */}
      <div
        className="relative bg-black rounded-[44px] p-3 shadow-2xl"
        style={{
          width: PHONE_WIDTH * PHONE_SCALE + 24,
        }}
      >
        {/* Screen Content - use theme background color */}
        <div
          className="relative rounded-[36px] overflow-hidden"
          style={{
            width: PHONE_WIDTH * PHONE_SCALE,
            height: contentHeight * PHONE_SCALE,
            backgroundColor: theme.background || "#ffffff",
          }}
        >
          <div
            style={{
              width: PHONE_WIDTH,
              height: contentHeight,
              transform: `scale(${PHONE_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <ScreenPreview
              code={screen.code}
              cssVariables={theme.cssVariables}
              backgroundColor={theme.background}
              onHeightChange={setContentHeight}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StreamingPhoneMockupProps {
  theme: GeneratedTheme;
  isStreaming: boolean;
  prompt: string;
  screenName?: string;
  features?: DesignFeature[];
  currentScreens?: CurrentScreen[];
  conversationHistory?: ConversationMessage[];
  onStreamComplete?: (screens: ParsedScreen[]) => void;
  onScreenComplete?: (screen: ParsedScreen) => void;
  onScreenEditStart?: (screenName: string) => void;
  onScreenNewStart?: (screenName: string) => void;
  onStreamError?: (error: string) => void;
}

/** Component to display a single completed streamed HTML screen */
const CompletedHtmlScreenPreview = React.memo(function CompletedHtmlScreenPreview({
  screen,
  theme,
  isEditing = false,
}: {
  screen: ParsedScreen;
  theme: GeneratedTheme;
  isEditing?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(MIN_PHONE_HEIGHT);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!iframeRef.current || !screen.html) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    if (!doc) return;

    // Write the complete HTML to the iframe
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${PHONE_WIDTH}, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${theme.cssVariables || ''}
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${PHONE_WIDTH}px;
      min-height: ${MIN_PHONE_HEIGHT}px;
      background-color: ${theme.background || '#ffffff'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .size-4 { width: 1rem; height: 1rem; }
    .size-5 { width: 1.25rem; height: 1.25rem; }
    .size-6 { width: 1.5rem; height: 1.5rem; }
    .size-8 { width: 2rem; height: 2rem; }
    .size-10 { width: 2.5rem; height: 2.5rem; }
    .size-12 { width: 3rem; height: 3rem; }
  </style>
</head>
<body>
${screen.html}
</body>
</html>`);
    doc.close();

    // Measure height after content loads
    setTimeout(() => {
      if (doc.body) {
        const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, MIN_PHONE_HEIGHT);
        setContentHeight(height);
      }
    }, 100);
  }, [screen.html, theme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(screen.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col items-start group">
      <div className="mb-4 flex items-center gap-2">
        {isEditing ? (
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-green-500" />
        )}
        <h3 className="text-white font-medium text-sm">
          {screen.name}
        </h3>
        {isEditing ? (
          <span className="text-xs text-blue-400 ml-2">Updating...</span>
        ) : (
          <span className="text-xs text-green-400 ml-2">Complete</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 ml-2 text-gray-400 hover:text-white hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>

      <div
        className={`relative bg-black rounded-[44px] p-3 shadow-2xl ring-2 ring-offset-2 ring-offset-[#1a1a1a] transition-all duration-300 ${
          isEditing
            ? "ring-blue-500/50 animate-pulse"
            : "ring-green-500/30"
        }`}
        style={{ width: PHONE_WIDTH * PHONE_SCALE + 24 }}
      >
        <div
          className="relative rounded-[36px] overflow-hidden"
          style={{
            width: PHONE_WIDTH * PHONE_SCALE,
            height: contentHeight * PHONE_SCALE,
            backgroundColor: theme.background || "#ffffff",
          }}
        >
          <div
            style={{
              width: PHONE_WIDTH,
              height: contentHeight,
              transform: `scale(${PHONE_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: PHONE_WIDTH,
                height: contentHeight,
                border: "none",
                pointerEvents: "none",
                backgroundColor: theme.background || "#ffffff",
              }}
              title={`${screen.name} Preview`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

function StreamingPhoneMockup({
  theme,
  isStreaming,
  prompt,
  screenName,
  features,
  currentScreens,
  conversationHistory,
  onStreamComplete,
  onScreenComplete,
  onScreenEditStart,
  onScreenNewStart,
  onStreamError,
}: StreamingPhoneMockupProps) {
  const [contentHeight, setContentHeight] = useState(MIN_PHONE_HEIGHT);

  return (
    <div className="flex flex-col items-start">
      {/* Screen Title */}
      <div className="mb-4 flex items-center gap-2">
        {isStreaming ? (
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        )}
        <h3 className="text-white font-medium text-sm">
          {screenName || "Streaming Preview"}
        </h3>
        {isStreaming && (
          <span className="text-xs text-blue-400 ml-2">Generating...</span>
        )}
      </div>

      {/* Phone Frame with streaming indicator */}
      <div
        className={`relative bg-black rounded-[44px] p-3 shadow-2xl transition-all duration-300 ${
          isStreaming ? "ring-2 ring-blue-500/50 ring-offset-2 ring-offset-[#1a1a1a]" : ""
        }`}
        style={{
          width: PHONE_WIDTH * PHONE_SCALE + 24,
        }}
      >
        {/* Screen Content */}
        <div
          className="relative rounded-[36px] overflow-hidden"
          style={{
            width: PHONE_WIDTH * PHONE_SCALE,
            height: contentHeight * PHONE_SCALE,
            backgroundColor: theme.background || "#ffffff",
          }}
        >
          <div
            style={{
              width: PHONE_WIDTH,
              height: contentHeight,
              transform: `scale(${PHONE_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <StreamingScreenPreview
              isStreaming={isStreaming}
              cssVariables={theme.cssVariables}
              backgroundColor={theme.background}
              prompt={prompt}
              screenName={screenName}
              features={features}
              currentScreens={currentScreens}
              conversationHistory={conversationHistory}
              onHeightChange={setContentHeight}
              onStreamComplete={onStreamComplete}
              onScreenComplete={onScreenComplete}
              onScreenEditStart={onScreenEditStart}
              onScreenNewStart={onScreenNewStart}
              onStreamError={onStreamError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Zoom controls component that uses the hook
function ZoomControls({ scale }: { scale: number }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#2a2a2a] rounded-full px-3 py-2 shadow-xl border border-gray-700">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
        onClick={() => zoomOut()}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <div className="px-3 py-1 text-sm text-gray-300 font-medium min-w-[60px] text-center">
        {Math.round(scale * 100)}%
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
        onClick={() => zoomIn()}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="w-px h-4 bg-gray-600 mx-1" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
        onClick={() => resetTransform()}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function DesignCanvas({
  screens,
  theme,
  isStreaming = false,
  streamingPrompt,
  streamingScreenName,
  features,
  currentScreens,
  conversationHistory,
  editingScreenNames,
  hasNewScreenInProgress,
  streamedScreens,
  onStreamComplete,
  onScreenComplete,
  onScreenEditStart,
  onScreenNewStart,
  onStreamError,
}: DesignCanvasProps) {
  const [scale, setScale] = useState(0.99);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track NEW screens that complete during streaming (not edits)
  const [newScreensDuringStreaming, setNewScreensDuringStreaming] = useState<ParsedScreen[]>([]);

  // Reset new screens list when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setNewScreensDuringStreaming([]);
    }
  }, [isStreaming]);

  // Handle when a single HTML screen completes during streaming
  const handleScreenComplete = (screen: ParsedScreen) => {
    // Only add to newScreensDuringStreaming if it's a NEW screen (not an edit)
    if (!screen.isEdit) {
      setNewScreensDuringStreaming(prev => [...prev, screen]);
    }
    onScreenComplete?.(screen);
  };

  // Prevent browser zoom when wheeling over the canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser zoom (Ctrl+wheel or pinch gesture)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-[#1a1a1a] overflow-hidden">
      <TransformWrapper
        initialScale={0.99}
        minScale={0.2}
        maxScale={3}
        centerOnInit
        limitToBounds={false}
        panning={{
          velocityDisabled: true,
          excluded: ["input", "textarea", "button"]
        }}
        wheel={{
          smoothStep: 0.05,
          wheelDisabled: false,
        }}
        pinch={{
          disabled: false,
        }}
        doubleClick={{
          disabled: false,
          mode: "reset",
        }}
        onTransformed={(_, state) => {
          setScale(state.scale);
        }}
      >
        <>
          {/* Canvas Area */}
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              height: "100%",
            }}
            contentStyle={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              padding: "80px",
              gap: "50px",
              minWidth: "max-content",
            }}
          >
            {/* === HTML STREAMING === */}
            {/* Always show existing completed screens (with editing indicator when applicable) */}
            {streamedScreens && streamedScreens.length > 0 && (
              streamedScreens.map((screen, index) => (
                <CompletedHtmlScreenPreview
                  key={`completed-${index}-${screen.name}`}
                  screen={screen}
                  theme={theme}
                  isEditing={editingScreenNames?.has(screen.name) ?? false}
                />
              ))
            )}

            {/* Show NEW screens that complete during streaming (not edits) */}
            {isStreaming && newScreensDuringStreaming.map((screen, index) => (
              <CompletedHtmlScreenPreview
                key={`new-streaming-${index}-${screen.name}`}
                screen={screen}
                theme={theme}
              />
            ))}

            {/* Always render StreamingPhoneMockup when streaming (it handles the API call),
                but only show it visually when generating new screens */}
            {isStreaming && streamingPrompt && (
              <div className={hasNewScreenInProgress || !streamedScreens || streamedScreens.length === 0 ? "" : "hidden"}>
                <StreamingPhoneMockup
                  theme={theme}
                  isStreaming={isStreaming}
                  prompt={streamingPrompt}
                  screenName={streamingScreenName}
                  features={features}
                  currentScreens={currentScreens}
                  conversationHistory={conversationHistory}
                  onStreamComplete={onStreamComplete}
                  onScreenComplete={handleScreenComplete}
                  onScreenEditStart={onScreenEditStart}
                  onScreenNewStart={onScreenNewStart}
                  onStreamError={onStreamError}
                />
              </div>
            )}

            {/* === DEFAULT SCREENS === */}
            {/* Show existing screens (only when not in streaming/streamed mode) */}
            {!isStreaming &&
             (!streamedScreens || streamedScreens.length === 0) &&
             screens.map((screen, index) => (
              <PhoneMockup key={index} screen={screen} theme={theme} />
            ))}
          </TransformComponent>

          {/* Zoom Controls */}
          <ZoomControls scale={scale} />
        </>
      </TransformWrapper>

      {/* Dot Pattern Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
