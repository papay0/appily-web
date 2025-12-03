"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./image-lightbox";

interface ClickableImageGridProps {
  imageUrls: string[];
  thumbnailSize?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
};

export function ClickableImageGrid({
  imageUrls,
  thumbnailSize = "md",
  className,
}: ClickableImageGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (imageUrls.length === 0) return null;

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {imageUrls.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleImageClick(index)}
            className={cn(
              sizeClasses[thumbnailSize],
              "rounded-lg overflow-hidden",
              "ring-1 ring-border hover:ring-2 hover:ring-primary/50",
              "transition-all duration-200",
              "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            )}
          >
            <Image
              src={url}
              alt={`Image ${index + 1}`}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>

      <ImageLightbox
        images={imageUrls}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        startIndex={lightboxIndex}
      />
    </>
  );
}
