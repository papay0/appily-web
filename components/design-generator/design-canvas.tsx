"use client";

import { useState, useEffect, useRef } from "react";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScreenPreview } from "./screen-preview";
import type { GeneratedScreen, GeneratedTheme } from "@/lib/ai/types";

// iPhone 14 Pro dimensions
const PHONE_WIDTH = 390;
const MIN_PHONE_HEIGHT = 844;
const PHONE_SCALE = 0.65; // Scale down for canvas view

interface DesignCanvasProps {
  screens: GeneratedScreen[];
  theme: GeneratedTheme;
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
        {/* Screen Content */}
        <div
          className="relative bg-white rounded-[36px] overflow-hidden"
          style={{
            width: PHONE_WIDTH * PHONE_SCALE,
            height: contentHeight * PHONE_SCALE,
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
              onHeightChange={setContentHeight}
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

export function DesignCanvas({ screens, theme }: DesignCanvasProps) {
  const [scale, setScale] = useState(0.8);
  const containerRef = useRef<HTMLDivElement>(null);

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
        initialScale={0.6}
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
            {screens.map((screen, index) => (
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
