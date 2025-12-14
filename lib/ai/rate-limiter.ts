/**
 * AI API Rate Limiter
 *
 * Handles per-project rate limiting for AI API requests.
 * Uses Supabase to track usage counts with automatic period resets.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { RateLimitResult, AIUsageRecord } from "./types";

/** Default rate limit: 30 requests per project */
const DEFAULT_MAX_REQUESTS = 30;

/** Period duration in milliseconds (30 days) */
const PERIOD_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Check if a project exists in the database
 *
 * @param projectId - The project UUID to validate
 * @returns true if project exists, false otherwise
 */
async function validateProject(projectId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  return !!data;
}

/**
 * Check and increment AI usage for a project
 *
 * This function:
 * 1. Validates the project exists
 * 2. Gets or creates the usage record
 * 3. Resets the period if expired
 * 4. Checks if rate limit is exceeded
 * 5. Increments the usage count
 *
 * @param projectId - The project UUID
 * @returns Rate limit result with allowed status and remaining count
 * @throws Error with message 'INVALID_PROJECT' if project doesn't exist
 */
export async function checkAndIncrementUsage(
  projectId: string
): Promise<RateLimitResult> {
  // 1. Validate project exists
  const projectExists = await validateProject(projectId);
  if (!projectExists) {
    throw new Error("INVALID_PROJECT");
  }

  const now = new Date();

  // 2. Get existing usage record
  const { data: existingUsage, error: selectError } = await supabaseAdmin
    .from("ai_usage")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    // PGRST116 = no rows found, which is expected for new projects
    console.error("[Rate Limiter] Error fetching usage:", selectError);
    throw new Error("API_ERROR");
  }

  // 3. If no record exists, create one with initial count of 1
  if (!existingUsage) {
    const periodEnd = new Date(now.getTime() + PERIOD_DURATION_MS);

    const { error: insertError } = await supabaseAdmin.from("ai_usage").insert({
      project_id: projectId,
      request_count: 1,
      max_requests: DEFAULT_MAX_REQUESTS,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
    });

    if (insertError) {
      console.error("[Rate Limiter] Error creating usage record:", insertError);
      throw new Error("API_ERROR");
    }

    return {
      allowed: true,
      remainingRequests: DEFAULT_MAX_REQUESTS - 1,
      resetAt: periodEnd,
    };
  }

  const usage = existingUsage as AIUsageRecord;
  const periodEnd = new Date(usage.period_end);

  // 4. If period has expired, reset the counter
  if (periodEnd < now) {
    const newPeriodEnd = new Date(now.getTime() + PERIOD_DURATION_MS);

    const { error: updateError } = await supabaseAdmin
      .from("ai_usage")
      .update({
        request_count: 1,
        period_start: now.toISOString(),
        period_end: newPeriodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("project_id", projectId);

    if (updateError) {
      console.error("[Rate Limiter] Error resetting period:", updateError);
      throw new Error("API_ERROR");
    }

    return {
      allowed: true,
      remainingRequests: usage.max_requests - 1,
      resetAt: newPeriodEnd,
    };
  }

  // 5. Check if rate limit exceeded
  if (usage.request_count >= usage.max_requests) {
    return {
      allowed: false,
      remainingRequests: 0,
      resetAt: periodEnd,
    };
  }

  // 6. Increment the usage count
  const { error: incrementError } = await supabaseAdmin
    .from("ai_usage")
    .update({
      request_count: usage.request_count + 1,
      updated_at: now.toISOString(),
    })
    .eq("project_id", projectId);

  if (incrementError) {
    console.error("[Rate Limiter] Error incrementing usage:", incrementError);
    throw new Error("API_ERROR");
  }

  return {
    allowed: true,
    remainingRequests: usage.max_requests - usage.request_count - 1,
    resetAt: periodEnd,
  };
}

/**
 * Get current usage for a project without incrementing
 *
 * @param projectId - The project UUID
 * @returns Usage data or null if no record exists
 * @throws Error with message 'INVALID_PROJECT' if project doesn't exist
 */
export async function getUsage(projectId: string): Promise<{
  requestCount: number;
  maxRequests: number;
  remainingRequests: number;
  periodStart: Date;
  periodEnd: Date;
} | null> {
  // Validate project exists
  const projectExists = await validateProject(projectId);
  if (!projectExists) {
    throw new Error("INVALID_PROJECT");
  }

  const { data, error } = await supabaseAdmin
    .from("ai_usage")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Rate Limiter] Error fetching usage:", error);
    throw new Error("API_ERROR");
  }

  if (!data) {
    // No usage record yet - return default values
    const now = new Date();
    return {
      requestCount: 0,
      maxRequests: DEFAULT_MAX_REQUESTS,
      remainingRequests: DEFAULT_MAX_REQUESTS,
      periodStart: now,
      periodEnd: new Date(now.getTime() + PERIOD_DURATION_MS),
    };
  }

  const usage = data as AIUsageRecord;
  const now = new Date();
  const periodEnd = new Date(usage.period_end);

  // If period has expired, return reset values
  if (periodEnd < now) {
    return {
      requestCount: 0,
      maxRequests: usage.max_requests,
      remainingRequests: usage.max_requests,
      periodStart: now,
      periodEnd: new Date(now.getTime() + PERIOD_DURATION_MS),
    };
  }

  return {
    requestCount: usage.request_count,
    maxRequests: usage.max_requests,
    remainingRequests: usage.max_requests - usage.request_count,
    periodStart: new Date(usage.period_start),
    periodEnd: periodEnd,
  };
}
