"use client";

import { X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/hooks/use-image-upload";
import Image from "next/image";

interface ImagePreviewGridProps {
  images: UploadedImage[];
  onRemove: (imageId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ImagePreviewGrid({
  images,
  onRemove,
  disabled = false,
  className,
}: ImagePreviewGridProps) {
  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 p-3 border-b border-border/50",
        className
      )}
    >
      {images.map((image) => (
        <div
          key={image.id}
          className={cn(
            "relative group",
            "w-[60px] h-[60px] rounded-lg overflow-hidden",
            "ring-1 ring-border/50 transition-all duration-200",
            image.uploadStatus === "error" && "ring-destructive ring-2",
            image.uploadStatus === "uploaded" && "hover:ring-primary/50"
          )}
        >
          {/* Image thumbnail */}
          <Image
            src={image.previewUrl}
            alt={image.file.name}
            fill
            className="object-cover"
            unoptimized
          />

          {/* Loading overlay */}
          {(image.uploadStatus === "pending" || image.uploadStatus === "uploading") && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          )}

          {/* Error overlay */}
          {image.uploadStatus === "error" && (
            <div className="absolute inset-0 bg-destructive/20 backdrop-blur-sm flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
          )}

          {/* Remove button */}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(image.id)}
              className={cn(
                "absolute -top-1 -right-1 z-10",
                "w-5 h-5 rounded-full",
                "bg-foreground/90 hover:bg-foreground text-background",
                "flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
              )}
              aria-label={`Remove ${image.file.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Filename tooltip on hover */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 px-1 py-0.5",
              "bg-background/80 backdrop-blur-sm",
              "text-[10px] text-foreground truncate",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            )}
          >
            {image.file.name}
          </div>
        </div>
      ))}
    </div>
  );
}
