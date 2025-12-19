"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

/** Represents a single parsed screen from the stream */
export interface ParsedScreen {
  name: string;
  html: string;
  /** Whether this is an edit to an existing screen (vs a new screen) */
  isEdit?: boolean;
}

/** Feature input for context-aware design generation */
export interface DesignFeature {
  title: string;
  description: string | null;
  is_included: boolean;
}

/** Current screen for follow-up context */
export interface CurrentScreen {
  name: string;
  html: string;
}

/** Conversation message for context */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface StreamingScreenPreviewProps {
  /** CSS variables string for theming */
  cssVariables?: string;
  /** Background color for the screen (hex) */
  backgroundColor?: string;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Callback when content height is measured */
  onHeightChange?: (height: number) => void;
  /** Called to get the stream reader when streaming starts */
  streamUrl?: string;
  /** The prompt to send to the API */
  prompt?: string;
  /** Optional screen name for the prompt */
  screenName?: string;
  /** Features from planning phase for context-aware design */
  features?: DesignFeature[];
  /** Current screens for follow-up context */
  currentScreens?: CurrentScreen[];
  /** Conversation history for context */
  conversationHistory?: ConversationMessage[];
  /** Callback when streaming completes with all screens */
  onStreamComplete?: (screens: ParsedScreen[]) => void;
  /** Callback when a single screen completes during streaming */
  onScreenComplete?: (screen: ParsedScreen) => void;
  /** Callback when a screen edit starts (before it completes) */
  onScreenEditStart?: (screenName: string) => void;
  /** Callback when a NEW screen starts (not an edit) */
  onScreenNewStart?: (screenName: string) => void;
  /** Callback when an error occurs */
  onStreamError?: (error: string) => void;
  /** Callback when AI summary is received */
  onSummaryReceived?: (summary: string) => void;
}

// Mobile viewport dimensions (iPhone 14 Pro)
const MOBILE_WIDTH = 390;
const MIN_MOBILE_HEIGHT = 844;

/**
 * Renders streaming HTML content in a sandboxed iframe using document.write()
 * The browser's HTML parser handles incomplete tags gracefully
 */
export function StreamingScreenPreview({
  cssVariables = "",
  backgroundColor = "#ffffff",
  isStreaming,
  onHeightChange,
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
  onSummaryReceived,
}: StreamingScreenPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(MIN_MOBILE_HEIGHT);
  const [isInitialized, setIsInitialized] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Multi-screen state
  const [currentScreenName, setCurrentScreenName] = useState<string | null>(null);
  const [currentScreenHtml, setCurrentScreenHtml] = useState("");

  // Callback ref to know when iframe is mounted
  const iframeCallbackRef = useCallback((node: HTMLIFrameElement | null) => {
    if (node !== null) {
      (iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = node;
      setIframeReady(true);
    }
  }, []);

  // Initialize the iframe document when streaming starts and iframe is ready
  useEffect(() => {
    if (!isStreaming || !iframeRef.current || !iframeReady || isInitialized) {
      return;
    }

    const iframe = iframeRef.current;

    // Try to access contentDocument - may fail if cross-origin or sandbox issues
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch (err) {
      onStreamError?.("Cannot access iframe content. Check sandbox settings.");
      return;
    }

    if (!doc) {
      onStreamError?.("Iframe document not available");
      return;
    }

    // Open the document and write the initial HTML structure
    try {
      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${MOBILE_WIDTH}, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssVariables}

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: ${MOBILE_WIDTH}px;
      min-height: ${MIN_MOBILE_HEIGHT}px;
      background-color: ${backgroundColor};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    /* Tailwind v4 compatibility - size utility */
    .size-4 { width: 1rem; height: 1rem; }
    .size-5 { width: 1.25rem; height: 1.25rem; }
    .size-6 { width: 1.5rem; height: 1.5rem; }
    .size-8 { width: 2rem; height: 2rem; }
    .size-10 { width: 2.5rem; height: 2.5rem; }
    .size-12 { width: 3rem; height: 3rem; }

    /* Hide scrollbar but allow scrolling */
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    /* Streaming indicator animation */
    @keyframes pulse-border {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
      50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2); }
    }
  </style>
</head>
<body>
`);
    } catch (err) {
      onStreamError?.("Failed to write to iframe document");
      return;
    }

    setIsInitialized(true);

    // Start fetching the stream
    if (prompt) {
      startStreaming(doc);
    }
  }, [isStreaming, cssVariables, backgroundColor, isInitialized, iframeReady, prompt]);

  // Function to start streaming from the API
  const startStreaming = async (doc: Document) => {
    if (!prompt) {
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Track all screens and current screen being parsed
    const completedScreens: ParsedScreen[] = [];
    let currentName: string | null = null;
    let currentHtml = "";
    let currentIsEdit = false; // Track if current screen is an edit vs new
    let rawBuffer = ""; // Buffer for unparsed content
    let summaryExtracted = false; // Track if we've already extracted the summary

    // Helper to reinitialize iframe for a new screen
    const reinitializeIframe = () => {
      if (!iframeRef.current) return;
      const newDoc = iframeRef.current.contentDocument;
      if (!newDoc) return;

      newDoc.open();
      newDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${MOBILE_WIDTH}, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssVariables}
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${MOBILE_WIDTH}px;
      min-height: ${MIN_MOBILE_HEIGHT}px;
      background-color: ${backgroundColor};
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
`);
      return newDoc;
    };

    try {
      // Use feature-aware endpoint when features are provided or when we have current screens (follow-up)
      const hasContext = (features && features.length > 0) || (currentScreens && currentScreens.length > 0);
      const apiEndpoint = hasContext
        ? "/api/ai/generate-design-with-features"
        : "/api/ai/generate-design-stream";

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          screenName,
          features,
          currentScreens,
          conversationHistory,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let sseBuffer = "";
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        sseBuffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = sseBuffer.split("\n\n");
        sseBuffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.chunk) {
                chunkCount++;
                rawBuffer += data.chunk;

                // Parse screen delimiters from the buffer
                while (true) {
                  // Look for SCREEN_START (new screen) or SCREEN_EDIT (update existing)
                  const startMatch = rawBuffer.match(/<!-- SCREEN_START: (.+?) -->/);
                  const editMatch = rawBuffer.match(/<!-- SCREEN_EDIT: (.+?) -->/);
                  const endMatch = rawBuffer.match(/<!-- SCREEN_END -->/);

                  // Determine which delimiter comes first (if both exist)
                  let activeMatch: RegExpMatchArray | null = null;
                  let isEdit = false;

                  if (startMatch && editMatch) {
                    // Both exist, use whichever comes first
                    if ((startMatch.index ?? Infinity) < (editMatch.index ?? Infinity)) {
                      activeMatch = startMatch;
                      isEdit = false;
                    } else {
                      activeMatch = editMatch;
                      isEdit = true;
                    }
                  } else if (editMatch) {
                    activeMatch = editMatch;
                    isEdit = true;
                  } else if (startMatch) {
                    activeMatch = startMatch;
                    isEdit = false;
                  }

                  if (activeMatch && (!currentName || activeMatch.index === 0)) {
                    // Found a screen start/edit
                    const startIndex = activeMatch.index!;
                    const startTagEnd = startIndex + activeMatch[0].length;

                    // If there's content before the start tag, write it
                    if (startIndex > 0 && currentName) {
                      const beforeContent = rawBuffer.substring(0, startIndex);
                      currentHtml += beforeContent;
                      doc.write(beforeContent);
                    }

                    // Start new/edit screen
                    currentName = activeMatch[1];
                    currentIsEdit = isEdit;
                    setCurrentScreenName(currentName);

                    // Notify when an edit or new screen starts
                    if (isEdit) {
                      onScreenEditStart?.(currentName);
                    } else {
                      onScreenNewStart?.(currentName);
                    }

                    // Remove processed content from buffer
                    rawBuffer = rawBuffer.substring(startTagEnd);
                    continue;
                  }

                  if (endMatch && currentName) {
                    // Found screen end
                    const endIndex = endMatch.index!;

                    // Get content before the end tag
                    const screenContent = rawBuffer.substring(0, endIndex);
                    currentHtml += screenContent;
                    doc.write(screenContent);

                    // Complete the current screen
                    const completedScreen: ParsedScreen = {
                      name: currentName,
                      html: currentHtml.trim(),
                      isEdit: currentIsEdit,
                    };
                    completedScreens.push(completedScreen);

                    // Notify about completed screen
                    onScreenComplete?.(completedScreen);

                    // Close current iframe document
                    doc.write("</body></html>");
                    doc.close();
                    measureHeight();

                    // Reset for next screen
                    currentName = null;
                    currentHtml = "";
                    currentIsEdit = false;
                    setCurrentScreenHtml("");

                    // Remove processed content from buffer
                    rawBuffer = rawBuffer.substring(endIndex + endMatch[0].length);

                    // Check if summary is in the remaining buffer
                    if (!summaryExtracted) {
                      const summaryMatch = rawBuffer.match(/<!-- SUMMARY: ([\s\S]+?) -->/);
                      console.log("[StreamingPreview] After SCREEN_END, checking for summary. Buffer length:", rawBuffer.length);
                      if (summaryMatch) {
                        console.log("[StreamingPreview] Found summary after SCREEN_END:", summaryMatch[1]);
                        onSummaryReceived?.(summaryMatch[1].trim());
                        summaryExtracted = true;
                      }
                    }

                    // Reinitialize iframe for next screen
                    const newDoc = reinitializeIframe();
                    if (newDoc) {
                      doc = newDoc;
                    }
                    continue;
                  }

                  // No more complete delimiters found
                  // Write safe content (leave some buffer for potential partial delimiters)
                  if (currentName && rawBuffer.length > 50) {
                    // Check if buffer might contain partial delimiter
                    const potentialDelimiter = rawBuffer.lastIndexOf("<!--");
                    const safeEndIndex = potentialDelimiter > rawBuffer.length - 50
                      ? potentialDelimiter
                      : rawBuffer.length;

                    if (safeEndIndex > 0) {
                      const safeContent = rawBuffer.substring(0, safeEndIndex);
                      currentHtml += safeContent;
                      doc.write(safeContent);
                      setCurrentScreenHtml(currentHtml);
                      rawBuffer = rawBuffer.substring(safeEndIndex);
                      measureHeight();
                    }
                  }
                  break;
                }
              }

              if (data.done) {
                console.log("[StreamingPreview] Stream done. rawBuffer length:", rawBuffer.length);
                console.log("[StreamingPreview] rawBuffer content (last 500 chars):", rawBuffer.slice(-500));

                // Write any remaining buffer content
                if (rawBuffer.trim() && currentName) {
                  currentHtml += rawBuffer;
                  doc.write(rawBuffer);

                  // Complete the final screen if one was in progress
                  const finalScreen: ParsedScreen = {
                    name: currentName,
                    html: currentHtml.trim(),
                    isEdit: currentIsEdit,
                  };
                  completedScreens.push(finalScreen);
                  onScreenComplete?.(finalScreen);
                }

                // Try to extract summary from remaining buffer if not already done
                if (!summaryExtracted) {
                  const summaryMatch = rawBuffer.match(/<!-- SUMMARY: ([\s\S]+?) -->/);
                  console.log("[StreamingPreview] Summary match result:", summaryMatch ? summaryMatch[1] : "NO MATCH");
                  if (summaryMatch) {
                    onSummaryReceived?.(summaryMatch[1].trim());
                    summaryExtracted = true;
                  }
                }

                // Close the document
                doc.write("</body></html>");
                doc.close();
                setIsInitialized(false);
                measureHeight();

                onStreamComplete?.(completedScreens);
                return;
              }

              if (data.error) {
                console.error("[StreamingPreview] Error from server:", data.error);
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error("[StreamingPreview] Error parsing SSE data:", parseError, "Line:", line);
            }
          }
        }
      }

      // If we reach here without a done signal, finalize
      if (currentName && currentHtml) {
        const finalScreen: ParsedScreen = {
          name: currentName,
          html: currentHtml.trim(),
          isEdit: currentIsEdit,
        };
        completedScreens.push(finalScreen);
        onScreenComplete?.(finalScreen);
      }

      doc.write("</body></html>");
      doc.close();
      setIsInitialized(false);
      onStreamComplete?.(completedScreens);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Write error message to the document
      doc.write(`
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center p-4">
            <div class="text-red-500 text-lg font-medium">Error</div>
            <div class="text-gray-500 text-sm mt-2">${errorMessage}</div>
          </div>
        </div>
      `);
      doc.write("</body></html>");
      doc.close();
      setIsInitialized(false);
      onStreamError?.(errorMessage);
    }
  };

  // Measure the content height
  const measureHeight = () => {
    if (!iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc || !doc.body) return;

    const height = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
      MIN_MOBILE_HEIGHT
    );

    setContentHeight(height);
    onHeightChange?.(height);
  };

  // Reset when streaming stops
  useEffect(() => {
    if (!isStreaming && isInitialized) {
      // Abort any ongoing fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Close the document if still open
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        try {
          doc.write("</body></html>");
          doc.close();
        } catch {
          // Document may already be closed
        }
      }
      setIsInitialized(false);
      setIframeReady(false); // Reset so we can re-initialize on next stream
    }
  }, [isStreaming, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="relative" style={{ width: MOBILE_WIDTH, height: contentHeight }}>
      {isStreaming && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{currentScreenName ? `Generating ${currentScreenName}...` : "Streaming..."}</span>
        </div>
      )}
      <iframe
        ref={iframeCallbackRef}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: MOBILE_WIDTH,
          height: contentHeight,
          border: "none",
          pointerEvents: "none",
          backgroundColor: backgroundColor,
        }}
        title="Streaming Screen Preview"
      />
    </div>
  );
}
