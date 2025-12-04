/**
 * API Route: Upload images to R2 storage
 *
 * POST /api/images/upload
 *
 * This endpoint handles image uploads for both project and temporary contexts.
 * Used by both web and mobile clients.
 *
 * Request: multipart/form-data
 * - images: File[] - Image files to upload (max 5)
 * - projectId?: string - Project ID (for project-scoped images)
 * - tempUploadId?: string - Temporary upload ID (for Home page before project creation)
 *
 * Response:
 * - success: boolean
 * - images: Array<{ id, r2Key, size }>
 * - error?: string
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadImageFile } from "@/lib/r2-client";
import {
  generateImageId,
  getImageExtension,
  getR2ImagePath,
  validateImageFiles,
  getContentType,
  DEFAULT_MAX_IMAGES,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from "@/lib/image-utils";

export const runtime = "nodejs";

interface UploadedImage {
  id: string;
  r2Key: string;
  size: number;
  filename: string;
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();

    const projectId = formData.get("projectId") as string | null;
    const tempUploadId = formData.get("tempUploadId") as string | null;

    // Validate context
    if (!projectId && !tempUploadId) {
      return NextResponse.json(
        { error: "Either projectId or tempUploadId is required" },
        { status: 400 }
      );
    }

    // Get all image files
    const imageFiles: File[] = [];
    const entries = formData.getAll("images");

    for (const entry of entries) {
      if (entry instanceof File) {
        imageFiles.push(entry);
      }
    }

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    console.log(`[Images Upload] Processing ${imageFiles.length} images`);
    console.log(`[Images Upload] Context: ${projectId ? `project:${projectId}` : `temp:${tempUploadId}`}`);

    // Validate all files
    const validation = validateImageFiles(imageFiles, {
      maxImages: DEFAULT_MAX_IMAGES,
      maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
      acceptedTypes: ACCEPTED_IMAGE_TYPES,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Upload each image to R2
    const uploadedImages: UploadedImage[] = [];

    for (const file of imageFiles) {
      const imageId = generateImageId();
      const extension = getImageExtension(file.name, file.type);
      const r2Key = getR2ImagePath(imageId, extension, {
        projectId: projectId ?? undefined,
        tempUploadId: tempUploadId ?? undefined,
      });

      // Read file as buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Sanitize filename for metadata (HTTP headers only allow ASCII)
      const sanitizedFilename = file.name
        .replace(/[^\x20-\x7E]/g, "_") // Replace non-ASCII with underscore
        .substring(0, 200); // Limit length

      // Upload to R2 images bucket (public)
      await uploadImageFile({
        key: r2Key,
        body: buffer,
        contentType: getContentType(extension),
        metadata: {
          originalFilename: sanitizedFilename,
          uploadedBy: clerkId,
          uploadedAt: new Date().toISOString(),
        },
      });

      uploadedImages.push({
        id: imageId,
        r2Key,
        size: file.size,
        filename: file.name,
      });

      console.log(`[Images Upload] ✓ Uploaded: ${r2Key} (${(file.size / 1024).toFixed(1)}KB)`);
    }

    console.log(`[Images Upload] Successfully uploaded ${uploadedImages.length} images`);

    return NextResponse.json({
      success: true,
      images: uploadedImages,
    });
  } catch (error) {
    console.error("[Images Upload] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload images",
      },
      { status: 500 }
    );
  }
}
