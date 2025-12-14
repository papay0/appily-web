/**
 * AI Usage/Quota Check API
 *
 * GET /api/ai/usage?projectId=<uuid>
 *
 * Returns the current AI usage quota for a project.
 */

import { NextResponse } from "next/server";
import { getUsage } from "@/lib/ai/rate-limiter";
import type { AIResponse, AIUsageData } from "@/lib/ai/types";

/** UUID regex pattern for validation */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<NextResponse<AIResponse<AIUsageData>>> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Validate projectId is provided
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required query parameter: projectId",
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

    // Get usage data
    let usage;
    try {
      usage = await getUsage(projectId);
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

    if (!usage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "API_ERROR",
            message: "Failed to retrieve usage data",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        requestCount: usage.requestCount,
        maxRequests: usage.maxRequests,
        remainingRequests: usage.remainingRequests,
        periodStart: usage.periodStart.toISOString(),
        periodEnd: usage.periodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error("[AI Usage] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "API_ERROR",
          message: "Failed to retrieve usage data. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
