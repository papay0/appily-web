/**
 * Cost calculation utility for Claude Agent SDK
 *
 * Pricing based on Claude Sonnet 4.5 (as of December 2025)
 * See: https://platform.claude.com/docs/en/agent-sdk/cost-tracking
 */

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// Claude pricing per million tokens (MTok)
const PRICING: Record<string, {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}> = {
  "claude-sonnet-4-5": {
    input: 3, // $3 per MTok
    output: 15, // $15 per MTok
    cacheWrite: 3.75, // $3.75 per MTok
    cacheRead: 0.3, // $0.30 per MTok
  },
  // Add more models as needed
  "claude-haiku-4-5": {
    input: 1, // $1 per MTok
    output: 5, // $5 per MTok
    cacheWrite: 1.25, // $1.25 per MTok
    cacheRead: 0.1, // $0.10 per MTok
  },
  "claude-opus-4-5": {
    input: 5, // $5 per MTok
    output: 25, // $25 per MTok
    cacheWrite: 6.25, // $6.25 per MTok
    cacheRead: 0.5, // $0.50 per MTok
  },
};

/**
 * Calculate the cost for a given token usage
 *
 * @param usage - Token usage object from SDK
 * @param model - Model name (defaults to claude-sonnet-4-5)
 * @returns Cost in USD
 */
export function calculateCost(
  usage: TokenUsage,
  model = "claude-sonnet-4-5"
): number {
  const pricing = PRICING[model] || PRICING["claude-sonnet-4-5"];

  const inputCost =
    ((usage.input_tokens || 0) / 1_000_000) * pricing.input;
  const outputCost =
    ((usage.output_tokens || 0) / 1_000_000) * pricing.output;
  const cacheWriteCost =
    ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost =
    ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Format cost as a USD string
 *
 * @param cost - Cost in USD
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted string like "$0.0123"
 */
export function formatCost(cost: number, decimals = 4): string {
  return `$${cost.toFixed(decimals)}`;
}

/**
 * Format token count with locale-aware thousands separators
 *
 * @param tokens - Number of tokens
 * @returns Formatted string like "1,234"
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}
