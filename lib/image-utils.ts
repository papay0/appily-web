import { generateId } from "./uuid";

// Supported image formats
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
] as const;

export const ACCEPTED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

// Default limits
export const DEFAULT_MAX_IMAGES = 5;
export const DEFAULT_MAX_FILE_SIZE_MB = 10;
export const DEFAULT_MAX_FILE_SIZE_BYTES = DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Generate a unique image ID
 */
export function generateImageId(): string {
  return generateId();
}

/**
 * Get file extension from filename or MIME type
 */
export function getImageExtension(filename: string, mimeType?: string): string {
  // Try to get from filename first
  const filenameExt = filename.split(".").pop()?.toLowerCase();
  if (filenameExt && ACCEPTED_IMAGE_EXTENSIONS.includes(filenameExt as typeof ACCEPTED_IMAGE_EXTENSIONS[number])) {
    return filenameExt;
  }

  // Fall back to MIME type
  if (mimeType) {
    const mimeExt = mimeType.split("/").pop()?.toLowerCase();
    if (mimeExt === "jpeg") return "jpg";
    if (mimeExt && ACCEPTED_IMAGE_EXTENSIONS.includes(mimeExt as typeof ACCEPTED_IMAGE_EXTENSIONS[number])) {
      return mimeExt;
    }
  }

  // Default to png
  return "png";
}

/**
 * Generate R2 storage path for an image
 */
export function getR2ImagePath(
  imageId: string,
  extension: string,
  options: { projectId?: string; tempUploadId?: string }
): string {
  const { projectId, tempUploadId } = options;

  if (projectId) {
    return `images/projects/${projectId}/${imageId}.${extension}`;
  }

  if (tempUploadId) {
    return `images/temp/${tempUploadId}/${imageId}.${extension}`;
  }

  throw new Error("Either projectId or tempUploadId must be provided");
}

/**
 * Parse R2 key to extract image info
 */
export function parseR2ImageKey(key: string): {
  imageId: string;
  extension: string;
  projectId?: string;
  tempUploadId?: string;
} {
  const parts = key.split("/");
  const filename = parts[parts.length - 1];
  const [imageId, extension] = filename.split(".");

  if (parts[1] === "projects" && parts.length >= 4) {
    return {
      imageId,
      extension,
      projectId: parts[2],
    };
  }

  if (parts[1] === "temp" && parts.length >= 4) {
    return {
      imageId,
      extension,
      tempUploadId: parts[2],
    };
  }

  return { imageId, extension };
}

/**
 * Validate an image file
 */
export function validateImageFile(
  file: File,
  options: {
    maxSizeBytes?: number;
    acceptedTypes?: readonly string[];
  } = {}
): ImageValidationResult {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const acceptedTypes = options.acceptedTypes ?? ACCEPTED_IMAGE_TYPES;

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file type
  if (!acceptedTypes.includes(file.type as typeof ACCEPTED_IMAGE_TYPES[number])) {
    return {
      valid: false,
      error: `Invalid file type. Accepted types: ${ACCEPTED_IMAGE_EXTENSIONS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate multiple image files
 */
export function validateImageFiles(
  files: File[],
  options: {
    maxImages?: number;
    maxSizeBytes?: number;
    acceptedTypes?: readonly string[];
    existingCount?: number;
  } = {}
): ImageValidationResult {
  const maxImages = options.maxImages ?? DEFAULT_MAX_IMAGES;
  const existingCount = options.existingCount ?? 0;
  const totalCount = existingCount + files.length;

  // Check total count
  if (totalCount > maxImages) {
    return {
      valid: false,
      error: `Maximum ${maxImages} images allowed`,
    };
  }

  // Validate each file
  for (const file of files) {
    const result = validateImageFile(file, options);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Get content type for an image extension
 */
export function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return contentTypes[extension.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Create a preview URL from a File object
 */
export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke a preview URL to free memory
 */
export function revokeImagePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
