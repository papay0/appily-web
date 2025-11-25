/**
 * Feature Types
 *
 * Type definitions for the feature planning system.
 */

/**
 * A feature suggestion for an app project
 */
export interface Feature {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_included: boolean;
  is_recommended: boolean;
  is_custom: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Feature data for creating a new feature (without DB-generated fields)
 */
export interface FeatureInsert {
  project_id: string;
  title: string;
  description?: string;
  is_included?: boolean;
  is_recommended?: boolean;
  is_custom?: boolean;
  sort_order?: number;
}

/**
 * Feature data from AI generation (before DB insert)
 */
export interface GeneratedFeature {
  title: string;
  description: string;
  is_recommended: boolean;
  sort_order?: number;
}

/**
 * Response from the feature generation API
 */
export interface FeatureGenerationResponse {
  features: GeneratedFeature[];
}

/**
 * Feature context for the build prompt
 */
export interface FeatureContext {
  appIdea: string;
  includedFeatures: Feature[];
  excludedFeatures: Feature[];
}

/**
 * Build an enhanced prompt with feature context
 */
export function buildEnhancedPrompt(
  userMessage: string,
  context: FeatureContext
): string {
  const included = context.includedFeatures
    .map((f) => `- ${f.title}: ${f.description || ""}`)
    .join("\n");

  const excluded = context.excludedFeatures.map((f) => `- ${f.title}`).join("\n");

  return `I want to build a mobile app based on this idea:

${context.appIdea}

**FEATURES TO BUILD:**
${included || "- No specific features selected"}

**FEATURES NOT TO BUILD:**
${excluded || "- None excluded"}

---

My request: ${userMessage}`;
}
