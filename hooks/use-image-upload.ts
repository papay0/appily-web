"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { generateId } from "@/lib/uuid";
import {
  validateImageFiles,
  createImagePreviewUrl,
  revokeImagePreviewUrl,
  DEFAULT_MAX_IMAGES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from "@/lib/image-utils";
import { toast } from "sonner";

export type ImageUploadStatus = "pending" | "uploading" | "uploaded" | "error";

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  r2Key?: string;
  uploadStatus: ImageUploadStatus;
  error?: string;
}

interface UseImageUploadOptions {
  projectId?: string;
  tempUploadId?: string;
  maxImages?: number;
  maxFileSizeBytes?: number;
  acceptedTypes?: readonly string[];
  onUploadComplete?: (image: UploadedImage) => void;
  onError?: (error: string) => void;
}

interface UseImageUploadReturn {
  images: UploadedImage[];
  addImages: (files: FileList | File[]) => Promise<void>;
  removeImage: (imageId: string) => void;
  clearImages: () => void;
  isUploading: boolean;
  uploadError: string | null;
  getUploadedKeys: () => string[];
  linkImagesToProject: (projectId: string) => Promise<string[]>;
  /** Stable temp upload ID - use this for Home page flow */
  currentTempUploadId: string;
}

export function useImageUpload(
  options: UseImageUploadOptions = {}
): UseImageUploadReturn {
  const {
    projectId,
    tempUploadId: providedTempUploadId,
    maxImages = DEFAULT_MAX_IMAGES,
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
    acceptedTypes = ACCEPTED_IMAGE_TYPES,
    onUploadComplete,
    onError,
  } = options;

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Generate stable tempUploadId if not provided and no projectId
  const tempUploadIdRef = useRef<string>(providedTempUploadId || generateId());
  const currentTempUploadId = projectId ? "" : tempUploadIdRef.current;

  // Track mounted state
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup preview URLs on unmount
      images.forEach((img) => {
        revokeImagePreviewUrl(img.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Validate files
      const validation = validateImageFiles(fileArray, {
        maxImages,
        maxSizeBytes: maxFileSizeBytes,
        acceptedTypes,
        existingCount: images.length,
      });

      if (!validation.valid) {
        const errorMsg = validation.error || "Invalid files";
        setUploadError(errorMsg);
        onError?.(errorMsg);
        toast.error(errorMsg);
        return;
      }

      setUploadError(null);
      setIsUploading(true);

      // Create pending image entries with preview URLs
      const newImages: UploadedImage[] = fileArray.map((file) => ({
        id: generateId(),
        file,
        previewUrl: createImagePreviewUrl(file),
        uploadStatus: "pending" as const,
      }));

      // Add to state immediately for preview
      setImages((prev) => [...prev, ...newImages]);

      // Upload each image
      for (const image of newImages) {
        if (!isMountedRef.current) break;

        // Update status to uploading
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, uploadStatus: "uploading" } : img
          )
        );

        try {
          const formData = new FormData();
          formData.append("images", image.file);

          if (projectId) {
            formData.append("projectId", projectId);
          } else {
            formData.append("tempUploadId", currentTempUploadId);
          }

          const response = await fetch("/api/images/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Upload failed");
          }

          const data = await response.json();

          if (!isMountedRef.current) return;

          // Update image with R2 key
          const uploadedImageData = data.images[0];
          setImages((prev) =>
            prev.map((img) =>
              img.id === image.id
                ? {
                    ...img,
                    r2Key: uploadedImageData.r2Key,
                    uploadStatus: "uploaded",
                  }
                : img
            )
          );

          onUploadComplete?.({ ...image, r2Key: uploadedImageData.r2Key, uploadStatus: "uploaded" });
        } catch (error) {
          console.error("[useImageUpload] Upload error:", error);

          if (!isMountedRef.current) return;

          const errorMsg = error instanceof Error ? error.message : "Upload failed";

          setImages((prev) =>
            prev.map((img) =>
              img.id === image.id
                ? { ...img, uploadStatus: "error", error: errorMsg }
                : img
            )
          );

          toast.error(`Failed to upload ${image.file.name}`);
          onError?.(errorMsg);
        }
      }

      if (isMountedRef.current) {
        setIsUploading(false);
      }
    },
    [
      projectId,
      currentTempUploadId,
      maxImages,
      maxFileSizeBytes,
      acceptedTypes,
      images.length,
      onUploadComplete,
      onError,
    ]
  );

  const removeImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === imageId);
      if (image) {
        revokeImagePreviewUrl(image.previewUrl);
      }
      return prev.filter((img) => img.id !== imageId);
    });
  }, []);

  const clearImages = useCallback((revokeUrls: boolean = false) => {
    setImages((prev) => {
      // Only revoke URLs if explicitly requested
      // When submitting, we keep the URLs so they can be displayed in chat
      if (revokeUrls) {
        prev.forEach((img) => revokeImagePreviewUrl(img.previewUrl));
      }
      return [];
    });
    setUploadError(null);
  }, []);

  const getUploadedKeys = useCallback((): string[] => {
    return images
      .filter((img) => img.uploadStatus === "uploaded" && img.r2Key)
      .map((img) => img.r2Key!);
  }, [images]);

  const linkImagesToProject = useCallback(
    async (newProjectId: string): Promise<string[]> => {
      if (!currentTempUploadId) {
        console.log("[useImageUpload] No temp upload ID, nothing to link");
        return getUploadedKeys();
      }

      const uploadedKeys = getUploadedKeys();
      if (uploadedKeys.length === 0) {
        console.log("[useImageUpload] No images to link");
        return [];
      }

      try {
        const response = await fetch("/api/images/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tempUploadId: currentTempUploadId,
            projectId: newProjectId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to link images");
        }

        const data = await response.json();
        console.log(`[useImageUpload] Linked ${data.linkedCount} images to project ${newProjectId}`);

        // Update images with new keys
        if (isMountedRef.current && data.newKeys) {
          setImages((prev) =>
            prev.map((img, index) => ({
              ...img,
              r2Key: data.newKeys[index] || img.r2Key,
            }))
          );
        }

        return data.newKeys || [];
      } catch (error) {
        console.error("[useImageUpload] Link error:", error);
        toast.error("Failed to link images to project");
        return uploadedKeys; // Return original keys as fallback
      }
    },
    [currentTempUploadId, getUploadedKeys]
  );

  return {
    images,
    addImages,
    removeImage,
    clearImages,
    isUploading,
    uploadError,
    getUploadedKeys,
    linkImagesToProject,
    currentTempUploadId,
  };
}
