"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Palette, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DesignForBuild } from "@/lib/types/designs";

interface DesignContextCardProps {
  designs: DesignForBuild[];
  className?: string;
  defaultOpen?: boolean;
}

export function DesignContextCard({
  designs,
  className,
  defaultOpen = false,
}: DesignContextCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (designs.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div
      className={cn(
        "border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-md overflow-hidden max-w-xl",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-purple-500" />
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                UI DESIGNS
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {designs.length} {designs.length === 1 ? "screen" : "screens"}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-gray-500 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-gray-200 dark:border-gray-800 pt-2 pb-3">
            {/* Carousel Navigation */}
            <div className="relative px-3">
              {/* Scroll Buttons */}
              {designs.length > 2 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      scroll("left");
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      scroll("right");
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                  </button>
                </>
              )}

              {/* Horizontal Scroll Container */}
              <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide px-1 py-1"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {designs.map((design, index) => (
                  <DesignPreviewCard key={index} design={design} />
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function DesignPreviewCard({ design }: { design: DesignForBuild }) {
  // Memoize the blob URL to prevent recreating on every render
  const blobUrl = useMemo(() => {
    const htmlWithStyles = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; overflow: hidden; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  ${design.html}
</body>
</html>`;

    const blob = new Blob([htmlWithStyles], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [design.html]);

  // Clean up blob URL when component unmounts or design changes
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <div className="flex-shrink-0 w-[120px]">
      {/* Screen Preview */}
      <div className="relative w-[120px] h-[200px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-sm">

        {/* Scaled iframe container */}
        <div className="w-full h-full overflow-hidden">
          <iframe
            src={blobUrl}
            className="origin-top-left"
            style={{
              width: "375px",
              height: "667px",
              transform: "scale(0.32)",
              transformOrigin: "top left",
              border: "none",
              pointerEvents: "none",
            }}
            title={design.screenName}
            sandbox="allow-scripts"
          />
        </div>
      </div>

      {/* Screen Name */}
      <p className="text-[10px] text-center mt-1.5 text-gray-600 dark:text-gray-400 font-medium truncate px-1">
        {design.screenName}
      </p>
    </div>
  );
}
