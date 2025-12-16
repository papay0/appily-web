"use client";

import { useMemo, useState, useEffect, useRef, useId } from "react";
import { Loader2 } from "lucide-react";

interface ScreenPreviewProps {
  /** React component code to render */
  code: string;
  /** CSS variables string (full :root block) */
  cssVariables: string;
  /** Callback when content height is measured */
  onHeightChange?: (height: number) => void;
}

// Mobile viewport dimensions (iPhone 14 Pro)
const MOBILE_WIDTH = 390;
const MIN_MOBILE_HEIGHT = 844;

/**
 * Transforms component code to be renderable in iframe
 * - Removes import statements
 * - Removes export default
 * - Extracts component name
 */
function transformCode(code: string): { transformedCode: string; componentName: string } {
  // Remove import statements
  let transformed = code.replace(/import\s+.*?from\s+["'].*?["'];?\s*/g, '');

  // Extract component name and remove export default
  const exportDefaultMatch = transformed.match(/export\s+default\s+function\s+(\w+)/);
  let componentName = 'App';

  if (exportDefaultMatch) {
    componentName = exportDefaultMatch[1];
    // Remove "export default " but keep "function ComponentName"
    transformed = transformed.replace(/export\s+default\s+function/, 'function');
  }

  return { transformedCode: transformed, componentName };
}

/**
 * Renders generated React code in a sandboxed iframe
 * Renders at mobile width with dynamic height based on content
 */
export function ScreenPreview({ code, cssVariables, onHeightChange }: ScreenPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [contentHeight, setContentHeight] = useState(MIN_MOBILE_HEIGHT);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Unique ID for this preview instance to filter messages
  const previewId = useId();

  // Listen for height messages from THIS iframe only
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only process messages from our specific iframe
      if (event.data?.type === 'contentHeight' &&
          event.data?.previewId === previewId &&
          typeof event.data.height === 'number') {
        const newHeight = Math.max(MIN_MOBILE_HEIGHT, event.data.height);
        setContentHeight(newHeight);
        onHeightChange?.(newHeight);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onHeightChange, previewId]);

  // Generate the HTML document for the iframe
  const htmlContent = useMemo(() => {
    const { transformedCode, componentName } = transformCode(code);
    // Escape the previewId for safe inclusion in script
    const escapedPreviewId = JSON.stringify(previewId);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${MOBILE_WIDTH}, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/iconify-icon@2/dist/iconify-icon.min.js"></script>
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    #root {
      width: ${MOBILE_WIDTH}px;
      min-height: ${MIN_MOBILE_HEIGHT}px;
    }

    /* Tailwind v4 compatibility - size utility */
    .size-4 { width: 1rem; height: 1rem; }
    .size-5 { width: 1.25rem; height: 1.25rem; }
    .size-6 { width: 1.5rem; height: 1.5rem; }
    .size-8 { width: 2rem; height: 2rem; }
    .size-10 { width: 2.5rem; height: 2.5rem; }
    .size-12 { width: 3rem; height: 3rem; }
    .size-16 { width: 4rem; height: 4rem; }
    .size-20 { width: 5rem; height: 5rem; }
    .size-24 { width: 6rem; height: 6rem; }
    .size-32 { width: 8rem; height: 8rem; }
    .size-40 { width: 10rem; height: 10rem; }

    /* Hide scrollbar but allow scrolling */
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    /* Remove min-height constraints - let content determine natural height */
    /* We apply min-height via JS after measuring */
    .min-h-screen {
      min-height: auto !important;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    // Icon component using iconify-icon web component
    function Icon({ icon, className, style, ...props }) {
      return React.createElement('iconify-icon', {
        icon: icon,
        class: className,
        style: { display: 'inline-block', verticalAlign: 'middle', ...style },
        ...props
      });
    }

    // Component code
    ${transformedCode}

    // Render the component and report height
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(${componentName}));

    // Unique ID for this preview instance
    const PREVIEW_ID = ${escapedPreviewId};

    // Report actual content height after render
    function measureAndReportHeight() {
      const root = document.getElementById('root');
      if (root) {
        // Get the actual rendered height of content
        const rect = root.getBoundingClientRect();
        const scrollHeight = root.scrollHeight;
        const actualHeight = Math.max(rect.height, scrollHeight);

        // Also check all direct children
        let maxChildHeight = 0;
        for (const child of root.children) {
          const childRect = child.getBoundingClientRect();
          const childScrollHeight = child.scrollHeight;
          maxChildHeight = Math.max(maxChildHeight, childRect.height, childScrollHeight);
        }

        const finalHeight = Math.max(actualHeight, maxChildHeight);
        window.parent.postMessage({ type: 'contentHeight', height: finalHeight, previewId: PREVIEW_ID }, '*');
      }
    }

    // Wait for content to fully render including images
    setTimeout(measureAndReportHeight, 800);
    setTimeout(measureAndReportHeight, 1500);
    setTimeout(measureAndReportHeight, 2500);

    // Also listen for image loads
    document.querySelectorAll('img').forEach(img => {
      img.addEventListener('load', measureAndReportHeight);
      img.addEventListener('error', measureAndReportHeight);
    });
  </script>
</body>
</html>`;
  }, [code, cssVariables, previewId]);

  return (
    <div className="relative" style={{ width: MOBILE_WIDTH, height: contentHeight }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        sandbox="allow-scripts"
        style={{
          width: MOBILE_WIDTH,
          height: contentHeight,
          border: 'none',
          pointerEvents: 'none',
        }}
        onLoad={() => setIsLoading(false)}
        title="Screen Preview"
      />
    </div>
  );
}
