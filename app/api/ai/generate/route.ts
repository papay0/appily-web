/**
 * AI Text Generation API
 *
 * POST /api/ai/generate
 *
 * Generates text using OpenAI GPT-5 mini via Vercel AI SDK.
 * Rate limited per project (30 requests per 30-day period).
 */

import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { checkAndIncrementUsage } from "@/lib/ai/rate-limiter";
import type { AIGenerateRequest, AIResponse, AIGenerateData } from "@/lib/ai/types";

/** UUID regex pattern for validation */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<NextResponse<AIResponse<AIGenerateData>>> {
  try {
    const body = (await request.json()) as Partial<AIGenerateRequest>;
    const {
      projectId,
      prompt,
      systemPrompt,
      maxTokens = 1024,
      temperature = 0.7,
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

    console.log(`[AI Generate] Project: ${projectId}, Prompt length: ${prompt.length}`);

    // Generate text using Vercel AI SDK
    const result = await generateText({
      model: openai("gpt-5-mini"),
      prompt,
      system: systemPrompt,
      maxOutputTokens: maxTokens,
      temperature,
    });

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const totalTokens = result.usage?.totalTokens ?? (inputTokens + outputTokens);

    console.log(`[AI Generate] Success. Tokens used: ${totalTokens}`);

    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: totalTokens,
        },
        remainingRequests: rateLimitResult.remainingRequests,
      },
    });
  } catch (error) {
    console.error("[AI Generate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "API_ERROR",
          message: "Failed to generate text. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
