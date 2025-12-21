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
 * Design reference for the build prompt
 */
export interface DesignReference {
  screenName: string;
  html: string;
}

/**
 * Feature context for the build prompt
 */
export interface FeatureContext {
  appIdea: string;
  includedFeatures: Feature[];
  excludedFeatures: Feature[];
  designs?: DesignReference[];
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

  // Build design reference section if designs are available
  let designSection = "";
  if (context.designs && context.designs.length > 0) {
    const screenNames = context.designs.map((d) => d.screenName).join(", ");
    const designsText = context.designs
      .map(
        (d) => `### ${d.screenName}
\`\`\`html
${d.html}
\`\`\``
      )
      .join("\n\n");

    designSection = `

**IMPORTANT: UI DESIGNS PROVIDED - YOU MUST FOLLOW THESE EXACTLY**
You have been given ${context.designs.length} pre-designed screen mockups: ${screenNames}.

**YOUR FIRST RESPONSE MUST START WITH:**
"I see you have ${context.designs.length} screen designs: ${screenNames}. I'll implement these screens in React Native, matching the visual design as closely as possible."

**DESIGN MATCHING REQUIREMENTS:**
These HTML mockups represent the EXACT visual design the user wants. Your job is to faithfully convert them to React Native while preserving:
- The exact layout structure and hierarchy
- Colors (convert Tailwind colors: blue-600 → #2563EB, gray-50 → #F9FAFB, etc.)
- Spacing (p-4 → padding: 16, m-2 → margin: 8, gap-4 → gap: 16)
- Border radius (rounded-xl → borderRadius: 12, rounded-2xl → borderRadius: 16, rounded-full → borderRadius: 9999)
- Font sizes (text-xs → 12, text-sm → 14, text-base → 16, text-lg → 18, text-xl → 20, text-2xl → 24)
- Shadows (shadow-md → shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6)
- Gradients (bg-gradient-to-r from-blue-600 to-purple-600 → use expo-linear-gradient)

**Element Conversion:**
- <div> → <View>
- <span>, <p>, <h1-h6> → <Text>
- <button> → <Pressable>
- <img> → <Image>
- <input> → <TextInput>
- Tailwind flex classes → flexDirection, alignItems, justifyContent

**SCREENS TO IMPLEMENT:**
${designsText}

---`;
  }

  return `I want to build a mobile app based on this idea:

${context.appIdea}

**FEATURES TO BUILD:**
${included || "- No specific features selected"}

**FEATURES NOT TO BUILD:**
${excluded || "- None excluded"}
${designSection}
---

My request: ${userMessage}`;
}
