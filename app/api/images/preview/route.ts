/**
 * API Route: Generate signed preview URLs for R2 images
 *
 * POST /api/images/preview
 *
 * This endpoint generates temporary signed URLs for displaying R2 images.
 * Used by the build page to display images in the chat UI for auto-started messages.
 *
 * Request body:
 * - imageKeys: string[] - Array of R2 storage keys
 *
 * Response:
 * - previewUrls: string[] - Array of signed URLs (1 hour expiry)
 * - error?: string
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFileSignedUrl } from "@/lib/r2-client";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { imageKeys } = await request.json();

    if (!imageKeys || !Array.isArray(imageKeys)) {
      return NextResponse.json(
        { error: "imageKeys is required and must be an array" },
        { status: 400 }
      );
    }

    if (imageKeys.length === 0) {
      return NextResponse.json({ previewUrls: [] });
    }

    // Validate that all keys are strings
    const validKeys = imageKeys.filter(
      (key): key is string => typeof key === "string" && key.length > 0
    );

    if (validKeys.length === 0) {
      return NextResponse.json({ previewUrls: [] });
    }

    // Generate signed URLs for all images (1 hour expiry)
    const previewUrls = await Promise.all(
      validKeys.map((key) => getFileSignedUrl(key, 3600))
    );

    console.log(`[Images Preview] Generated ${previewUrls.length} signed URLs`);

    return NextResponse.json({ previewUrls });
  } catch (error) {
    console.error("[Images Preview] Error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate preview URLs",
      },
      { status: 500 }
    );
  }
}
