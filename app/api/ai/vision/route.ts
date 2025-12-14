/**
 * AI Vision Analysis API
 *
 * POST /api/ai/vision
 *
 * Analyzes images using OpenAI GPT-4o vision capabilities.
 * Rate limited per project (30 requests per 30-day period).
 */

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { checkAndIncrementUsage } from "@/lib/ai/rate-limiter";
import type { AIVisionRequest, AIResponse, AIVisionData } from "@/lib/ai/types";

/** UUID regex pattern for validation */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maximum base64 image size (10MB) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse<AIResponse<AIVisionData>>> {
  try {
    const body = (await request.json()) as Partial<AIVisionRequest>;
    const {
      projectId,
      imageUrl,
      imageBase64,
      prompt,
      maxTokens = 1024,
    } = body;

    // Validate required fields
    if (!projectId || !prompt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: projectId and prompt are required",
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

    // Validate image is provided
    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Either imageUrl or imageBase64 must be provided",
          },
        },
        { status: 400 }
      );
    }

    // Validate base64 size if provided
    if (imageBase64 && imageBase64.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_IMAGE",
            message: "Image too large. Maximum size is 10MB.",
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

    console.log(`[AI Vision] Project: ${projectId}, Image type: ${imageUrl ? "URL" : "Base64"}`);

    // Build the image content for the message
    let imageContent: { type: "image"; image: string } | { type: "image"; image: URL };

    if (imageBase64) {
      // Handle base64 image - add data URI prefix if not present
      const base64Data = imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;
      imageContent = { type: "image", image: base64Data };
    } else {
      // Handle URL
      imageContent = { type: "image", image: new URL(imageUrl!) };
    }

    // Generate analysis using Vercel AI SDK with vision
    const result = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            imageContent,
            { type: "text", text: prompt },
          ],
        },
      ],
      maxOutputTokens: maxTokens,
    });

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const totalTokens = result.usage?.totalTokens ?? (inputTokens + outputTokens);

    console.log(`[AI Vision] Success. Tokens used: ${totalTokens}`);

    return NextResponse.json({
      success: true,
      data: {
        analysis: result.text,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: totalTokens,
        },
        remainingRequests: rateLimitResult.remainingRequests,
      },
    });
  } catch (error) {
    console.error("[AI Vision] Error:", error);

    // Check for specific image-related errors
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage.includes("Could not process image") || errorMessage.includes("Invalid image")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_IMAGE",
            message: "Could not process the image. Please try a different image.",
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
          message: "Failed to analyze image. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
