/**
 * AI API Type Definitions
 *
 * This file defines the interfaces for AI API requests, responses, and rate limiting.
 * Used by the /api/ai/* endpoints.
 */

/**
 * Request body for text generation endpoint
 */
export interface AIGenerateRequest {
  /** Project UUID for rate limiting */
  projectId: string;
  /** The prompt to generate text from */
  prompt: string;
  /** Optional system prompt to set context */
  systemPrompt?: string;
  /** Maximum tokens to generate (default: 1024) */
  maxTokens?: number;
  /** Temperature for randomness (0-2, default: 0.7) */
  temperature?: number;
}

/**
 * Request body for vision analysis endpoint
 */
export interface AIVisionRequest {
  /** Project UUID for rate limiting */
  projectId: string;
  /** URL of the image to analyze */
  imageUrl?: string;
  /** Base64-encoded image data (alternative to imageUrl) */
  imageBase64?: string;
  /** What to analyze about the image */
  prompt: string;
  /** Maximum tokens for the response (default: 1024) */
  maxTokens?: number;
}

/**
 * Token usage information from OpenAI
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Successful response data for text generation
 */
export interface AIGenerateData {
  /** The generated text */
  text: string;
  /** Token usage statistics */
  usage: TokenUsage;
  /** Remaining AI requests for this project */
  remainingRequests: number;
}

/**
 * Successful response data for vision analysis
 */
export interface AIVisionData {
  /** The image analysis result */
  analysis: string;
  /** Token usage statistics */
  usage: TokenUsage;
  /** Remaining AI requests for this project */
  remainingRequests: number;
}

/**
 * Usage/quota information for a project
 */
export interface AIUsageData {
  /** Current number of requests made */
  requestCount: number;
  /** Maximum requests allowed per period */
  maxRequests: number;
  /** Remaining requests in current period */
  remainingRequests: number;
  /** When the current period started */
  periodStart: string;
  /** When the current period ends (quota resets) */
  periodEnd: string;
}

/**
 * Error codes for AI API responses
 */
export type AIErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_PROJECT'
  | 'INVALID_IMAGE'
  | 'API_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Error response structure
 */
export interface AIError {
  code: AIErrorCode;
  message: string;
  /** Remaining requests (included when rate limit exceeded) */
  remainingRequests?: number;
}

/**
 * Generic AI API response wrapper
 */
export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: AIError;
}

/**
 * Result from rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests after this one */
  remainingRequests: number;
  /** When the rate limit period resets */
  resetAt: Date;
}

/**
 * AI usage record from Supabase
 */
export interface AIUsageRecord {
  id: string;
  project_id: string;
  request_count: number;
  max_requests: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}
