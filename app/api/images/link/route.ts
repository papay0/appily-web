/**
 * API Route: Link temporary images to a project
 *
 * POST /api/images/link
 *
 * This endpoint moves images from temporary storage to project storage.
 * Called after project creation on the Home page flow.
 *
 * Request body:
 * - tempUploadId: string - Temporary upload ID from initial upload
 * - projectId: string - Newly created project ID
 *
 * Response:
 * - success: boolean
 * - linkedCount: number - Number of images linked
 * - newKeys: string[] - New R2 keys under project path
 * - error?: string
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  uploadImageFile,
  downloadImageFile,
  listImageFiles,
  deleteImageFile,
} from "@/lib/r2-client";
import { parseR2ImageKey, getR2ImagePath, getContentType } from "@/lib/image-utils";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { tempUploadId, projectId } = await request.json();

    if (!tempUploadId || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: tempUploadId, projectId" },
        { status: 400 }
      );
    }

    console.log(`[Images Link] Linking images from temp:${tempUploadId} to project:${projectId}`);

    // List all files in temp directory (from images bucket)
    const tempPrefix = `images/temp/${tempUploadId}/`;
    const tempFiles = await listImageFiles(tempPrefix);

    if (tempFiles.length === 0) {
      console.log(`[Images Link] No images found in temp directory`);
      return NextResponse.json({
        success: true,
        linkedCount: 0,
        newKeys: [],
      });
    }

    console.log(`[Images Link] Found ${tempFiles.length} images to link`);

    // Copy each file to project directory
    const newKeys: string[] = [];

    for (const file of tempFiles) {
      try {
        // Parse the temp key to get image info
        const { imageId, extension } = parseR2ImageKey(file.key);

        // Generate new project path
        const newKey = getR2ImagePath(imageId, extension, { projectId });

        // Download from temp (images bucket)
        const fileBuffer = await downloadImageFile(file.key);

        // Upload to project path (images bucket)
        await uploadImageFile({
          key: newKey,
          body: fileBuffer,
          contentType: getContentType(extension),
          metadata: {
            linkedFrom: file.key,
            linkedAt: new Date().toISOString(),
          },
        });

        newKeys.push(newKey);

        // Delete temp file (images bucket)
        await deleteImageFile(file.key);

        console.log(`[Images Link] ✓ Moved: ${file.key} → ${newKey}`);
      } catch (error) {
        console.error(`[Images Link] Failed to link ${file.key}:`, error);
        // Continue with other files
      }
    }

    console.log(`[Images Link] Successfully linked ${newKeys.length} images`);

    // Save image keys to the database - this is REQUIRED for images to work on plan/build pages
    if (newKeys.length > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error: updateError } = await supabase
        .from("projects")
        .update({ image_keys: newKeys })
        .eq("id", projectId);

      if (updateError) {
        console.error(`[Images Link] Failed to save image keys to DB:`, updateError);
        // This is a critical error - images are in R2 but won't be accessible from DB
        return NextResponse.json(
          {
            success: false,
            error: "Failed to save image references to database",
            linkedCount: newKeys.length,
            newKeys, // Return keys anyway in case caller wants to retry
          },
          { status: 500 }
        );
      }

      console.log(`[Images Link] ✓ Saved ${newKeys.length} image keys to database`);
    }

    return NextResponse.json({
      success: true,
      linkedCount: newKeys.length,
      newKeys,
    });
  } catch (error) {
    console.error("[Images Link] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link images",
      },
      { status: 500 }
    );
  }
}
