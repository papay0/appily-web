/**
 * API Route: Report Runtime Errors from Expo Go
 *
 * POST /api/errors/report
 *
 * This endpoint receives runtime errors from Expo Go apps and stores
 * them in the agent_events table for display in the chat interface.
 *
 * Request body:
 * - projectId: string - Project ID (UUID)
 * - error: RuntimeError - Error details
 * - deviceInfo?: object - Device platform info
 *
 * No authentication required (errors should report even if auth fails)
 * Rate limited by project to prevent spam
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface RuntimeError {
  message: string;
  stack?: string;
  componentStack?: string;
  filename?: string;
  lineNumber?: number;
  columnNumber?: number;
  errorType: "js_error" | "react_error" | "unhandled_promise";
  timestamp: string;
}

interface ErrorReportRequest {
  projectId: string;
  error: RuntimeError;
  deviceInfo?: {
    platform: string;
    version: string;
  };
}

// Simple in-memory rate limiting per project
// In production, consider using Redis for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 errors per minute per project

function checkRateLimit(projectId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(projectId);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(projectId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  limit.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ErrorReportRequest;

    // Validate required fields
    if (!body.projectId || !body.error?.message) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, error.message" },
        { status: 400 }
      );
    }

    // Validate projectId format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.projectId)) {
      return NextResponse.json(
        { error: "Invalid projectId format" },
        { status: 400 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(body.projectId)) {
      console.log(
        `[ErrorReport] Rate limit exceeded for project ${body.projectId}`
      );
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 10 errors per minute." },
        { status: 429 }
      );
    }

    // Verify project exists and get session_id
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, session_id")
      .eq("id", body.projectId)
      .single();

    if (projectError || !project) {
      console.error("[ErrorReport] Project not found:", body.projectId);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    console.log(
      `[ErrorReport] Received ${body.error.errorType} from project ${body.projectId}`
    );
    console.log(`[ErrorReport] Error: ${body.error.message}`);

    // Format error message for display in chat
    const friendlyMessage = formatErrorMessage(body.error);

    // Store error in agent_events table
    const { error: insertError } = await supabaseAdmin
      .from("agent_events")
      .insert({
        project_id: body.projectId,
        session_id: project.session_id, // Link to current session if exists
        event_type: "runtime_error",
        event_data: {
          type: "runtime_error",
          subtype: body.error.errorType,
          message: friendlyMessage,
          fullError: {
            message: body.error.message,
            stack: truncateString(body.error.stack, 5000),
            componentStack: truncateString(body.error.componentStack, 5000),
            filename: body.error.filename,
            lineNumber: body.error.lineNumber,
            columnNumber: body.error.columnNumber,
          },
          deviceInfo: body.deviceInfo,
          timestamp: body.error.timestamp,
          canFix: true, // Flag to show "Fix this error" button
        },
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[ErrorReport] Failed to store error:", insertError);
      return NextResponse.json(
        { error: "Failed to store error" },
        { status: 500 }
      );
    }

    console.log("[ErrorReport] ✓ Error stored in agent_events");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ErrorReport] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Format error message for display in chat
 */
function formatErrorMessage(error: RuntimeError): string {
  let message = error.message;

  // Add location info if available
  if (error.filename && error.lineNumber) {
    // Extract just the filename from the path
    const filename = error.filename.split("/").pop() || error.filename;
    message += `\n\nLocation: ${filename}:${error.lineNumber}`;
    if (error.columnNumber) {
      message += `:${error.columnNumber}`;
    }
  }

  return message;
}

/**
 * Truncate string to max length with ellipsis
 */
function truncateString(str: string | undefined, maxLength: number): string | undefined {
  if (!str) return undefined;
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "\n... (truncated)";
}
