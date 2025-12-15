/**
 * AI Image Generation API
 *
 * POST /api/ai/generate-image
 *
 * Generates or edits images using Gemini 3 Pro Image Preview (Nano Banana Pro).
 * Supports both text-to-image generation and image editing.
 * Rate limited per project (30 requests per 30-day period, shared with other AI endpoints).
 */

import { NextResponse } from "next/server";
import { checkAndIncrementUsage } from "@/lib/ai/rate-limiter";
import {
  generateImageFromPrompt,
  editImageWithPrompt,
} from "@/lib/ai/gemini-client";
import type {
  AIImageGenerateRequest,
  AIResponse,
  AIImageData,
  ImageAspectRatio,
  ImageResolution,
} from "@/lib/ai/types";

/** UUID regex pattern for validation */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valid aspect ratios */
const VALID_ASPECT_RATIOS: ImageAspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
];

/** Valid resolutions */
const VALID_RESOLUTIONS: ImageResolution[] = ["1K", "2K"];

/** Max base64 image size (10MB) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function POST(
  request: Request
): Promise<NextResponse<AIResponse<AIImageData>>> {
  try {
    const body = (await request.json()) as Partial<AIImageGenerateRequest>;
    const {
      projectId,
      prompt,
      imageBase64,
      aspectRatio = "1:1",
      resolution = "1K",
    } = body;

    // Validate required fields
    if (!projectId || !prompt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Missing required fields: projectId and prompt are required",
          },
        },
        { status: 400 }
      );
    }

    // Validate UUID format
    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid projectId format. Must be a valid UUID.",
          },
        },
        { status: 400 }
      );
    }

    // Validate prompt is not empty
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Prompt cannot be empty",
          },
        },
        { status: 400 }
      );
    }

    // Validate aspect ratio
    if (!VALID_ASPECT_RATIOS.includes(aspectRatio as ImageAspectRatio)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid aspect ratio. Must be one of: ${VALID_ASPECT_RATIOS.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate resolution
    if (!VALID_RESOLUTIONS.includes(resolution as ImageResolution)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate image size if provided
    if (imageBase64) {
      // Remove data: prefix for size calculation
      const base64Data = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      // Calculate approximate size (base64 is ~4/3 of original size)
      const approximateSize = (base64Data.length * 3) / 4;

      if (approximateSize > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_IMAGE",
              message: "Image size exceeds maximum allowed (10MB)",
            },
          },
          { status: 400 }
        );
      }
    }

    // Check rate limit
    let rateLimitResult;
    try {
      rateLimitResult = await checkAndIncrementUsage(projectId);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PROJECT") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_PROJECT",
              message: "Project not found",
            },
          },
          { status: 404 }
        );
      }
      throw error;
    }

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Rate limit exceeded. Quota resets on ${rateLimitResult.resetAt.toISOString()}`,
            remainingRequests: 0,
          },
        },
        { status: 429 }
      );
    }

    const isEditing = !!imageBase64;
    console.log(
      `[AI Image] Project: ${projectId}, Mode: ${isEditing ? "edit" : "generate"}, Prompt length: ${prompt.length}`
    );

    // Generate or edit image
    const result = imageBase64
      ? await editImageWithPrompt(imageBase64, prompt, {
          aspectRatio: aspectRatio as ImageAspectRatio,
          resolution: resolution as ImageResolution,
        })
      : await generateImageFromPrompt(prompt, {
          aspectRatio: aspectRatio as ImageAspectRatio,
          resolution: resolution as ImageResolution,
        });

    console.log(
      `[AI Image] Success. Image size: ${Math.round(result.imageBase64.length / 1024)}KB`
    );

    return NextResponse.json({
      success: true,
      data: {
        imageBase64: result.imageBase64,
        mimeType: result.mimeType,
        text: result.text,
        remainingRequests: rateLimitResult.remainingRequests,
      },
    });
  } catch (error) {
    console.error("[AI Image] Error:", error);

    // Handle specific Gemini errors
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (
      errorMessage.includes("SAFETY") ||
      errorMessage.includes("blocked") ||
      errorMessage.includes("unsafe")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Image generation was blocked due to content safety filters. Please modify your prompt.",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "API_ERROR",
          message: "Failed to generate image. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
