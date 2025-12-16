/**
 * AI Design Generation API
 *
 * POST /api/ai/generate-design
 *
 * Generates multiple React screen designs using Gemini Pro 3.
 * Used by the admin playground for design prototyping.
 * No rate limiting (admin feature only).
 */

import { NextResponse } from "next/server";
import { generateDesignWithGemini } from "@/lib/ai/gemini-client";
import type {
  AIDesignGenerateRequest,
  AIResponse,
  AIDesignData,
  DesignGenerationResult,
} from "@/lib/ai/types";

/**
 * System prompt for design generation
 * Instructs Gemini to generate beautiful, production-quality React designs
 */
const DESIGN_SYSTEM_PROMPT = `You are an expert mobile app UI designer. Your task is to generate beautiful, production-quality React component designs for mobile apps.

CRITICAL RULES:
1. Focus 100% on visual design - NO business logic, NO useState, NO event handlers, NO onClick
2. Use Tailwind CSS for ALL styling - use utility classes extensively
3. Use @iconify/react for icons with the Icon component: <Icon icon="solar:home-bold" className="size-6" />
4. Use Solar icon set primarily (e.g., "solar:heart-bold", "solar:user-bold", "solar:settings-bold")
5. Generate self-contained components that render static, beautiful UI
6. Each screen should be visually polished and app-store ready
7. Auto-determine the most relevant screens based on the app description (typically 3-5 screens)

IMAGES - CRITICAL:
- For ALL images, ONLY use picsum.photos URLs which always work
- Format: https://picsum.photos/seed/{unique-seed}/{width}/{height}
- Examples:
  - Hero image: https://picsum.photos/seed/hero123/400/300
  - Profile avatar: https://picsum.photos/seed/avatar1/100/100
  - Card thumbnail: https://picsum.photos/seed/card456/200/150
  - Background: https://picsum.photos/seed/bg789/800/600
- ALWAYS use a unique seed for each image (e.g., "hero1", "user2", "food3", "nature4")
- NEVER use placeholder.com, unsplash.com direct links, or any other image service
- NEVER use fake URLs or example.com

DESIGN PRINCIPLES:
- Modern, clean aesthetics with generous whitespace
- Consistent color palette using CSS custom properties (var(--primary), var(--secondary), etc.)
- Mobile-first design (assume 390px width viewport)
- Beautiful typography hierarchy with proper font weights
- Subtle shadows, rounded corners, and depth
- Smooth gradients when appropriate for the app vibe
- Professional quality that looks like a real app

COMPONENT STRUCTURE:
Each screen's code must be a complete, self-contained React function component:
- Import Icon from "@iconify/react" at the top
- Export a default function component
- Use inline style for CSS variables at the root div
- Use Tailwind classes for all other styling
- Component should fill the screen (min-h-screen)

OUTPUT FORMAT - Return valid JSON matching this exact structure:
{
  "appName": "App Name Here",
  "theme": {
    "primary": "#hexcolor",
    "secondary": "#hexcolor",
    "background": "#hexcolor",
    "foreground": "#hexcolor",
    "accent": "#hexcolor",
    "cssVariables": ":root { --primary: #hex; --primary-foreground: #hex; --secondary: #hex; --secondary-foreground: #hex; --background: #hex; --foreground: #hex; --accent: #hex; --accent-foreground: #hex; --muted: #hex; --muted-foreground: #hex; --border: #hex; --ring: #hex; }"
  },
  "screens": [
    {
      "name": "Screen Name",
      "description": "Brief description of what this screen shows",
      "code": "import { Icon } from \\"@iconify/react\\";\\n\\nexport default function ScreenName() {\\n  return (\\n    <div style={{ \\"--primary\\": \\"#E11D48\\", \\"--secondary\\": \\"#FFE4E6\\" }} className=\\"min-h-screen bg-[var(--background)] p-4\\">\\n      {/* Your beautiful UI here */}\\n    </div>\\n  );\\n}"
    }
  ]
}

IMPORTANT:
- The "code" field must be a valid JavaScript string with properly escaped quotes and newlines
- Each component should use the theme's CSS variables for colors
- Make the designs BEAUTIFUL - this is the most important requirement
- Screens should feel cohesive and part of the same app
- Include realistic placeholder content (user names, numbers, text)`;

export async function POST(
  request: Request
): Promise<NextResponse<AIResponse<AIDesignData>>> {
  try {
    const body = (await request.json()) as Partial<AIDesignGenerateRequest>;
    const { prompt, currentDesign, conversationHistory } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Prompt is required",
          },
        },
        { status: 400 }
      );
    }

    const isFollowUp = currentDesign !== undefined;

    console.log(
      `[Design Generator] ${isFollowUp ? "Follow-up" : "Initial"} request: ${prompt.substring(0, 100)}...`
    );

    // Build the user prompt based on whether this is a follow-up
    let userPrompt: string;

    if (isFollowUp && currentDesign) {
      // For follow-ups, include the current design and ask for updates
      const screensSummary = currentDesign.screens
        .map((s, i) => `${i + 1}. ${s.name}: ${s.description}`)
        .join("\n");

      // Build conversation context
      const conversationContext = conversationHistory && conversationHistory.length > 0
        ? `\nConversation so far:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n")}\n`
        : "";

      userPrompt = `You are updating an existing mobile app design called "${currentDesign.appName}".
${conversationContext}
Current theme:
- Primary: ${currentDesign.theme.primary}
- Secondary: ${currentDesign.theme.secondary}
- Accent: ${currentDesign.theme.accent}
- Background: ${currentDesign.theme.background}

Current screens:
${screensSummary}

Here is the complete current code for each screen:
${currentDesign.screens.map(s => `\n=== ${s.name} ===\n${s.code}`).join("\n")}

User's request: "${prompt}"

IMPORTANT INSTRUCTIONS:
1. Understand what the user wants to change
2. Identify which screen(s) need to be modified based on the user's request (e.g., "settings screen" or "home page")
3. Make the requested changes while keeping the rest of the design intact
4. Return the COMPLETE updated design JSON with ALL screens (modified and unmodified)
5. Keep the same appName unless the user asks to change it
6. Keep the same theme unless the user asks to change colors
7. Make sure to return valid JSON with the exact same structure`;
    } else {
      // Initial design request
      userPrompt = `Create a beautiful mobile app design for the following app idea:\n\n${prompt}\n\nGenerate 3-5 screens that would be essential for this app. Make them visually stunning and cohesive.`;
    }

    // Call Gemini Pro 3 with design system prompt
    const resultJson = await generateDesignWithGemini(
      userPrompt,
      DESIGN_SYSTEM_PROMPT
    );

    // Parse JSON response
    let design: DesignGenerationResult;
    try {
      design = JSON.parse(resultJson);
    } catch (parseError) {
      console.error("[Design Generator] JSON parse error:", parseError);
      console.error("[Design Generator] Raw response:", resultJson.substring(0, 500));
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate response structure
    if (!design.appName || typeof design.appName !== "string") {
      throw new Error("Invalid design structure: missing appName");
    }

    if (!design.theme || typeof design.theme !== "object") {
      throw new Error("Invalid design structure: missing theme");
    }

    if (!design.screens || !Array.isArray(design.screens) || design.screens.length === 0) {
      throw new Error("Invalid design structure: no screens generated");
    }

    // Validate each screen has required fields
    for (const screen of design.screens) {
      if (!screen.name || !screen.code) {
        throw new Error("Invalid screen structure: missing name or code");
      }
    }

    console.log(
      `[Design Generator] Success! Generated ${design.screens.length} screens for "${design.appName}"`
    );

    return NextResponse.json({
      success: true,
      data: { design },
    });
  } catch (error) {
    console.error("[Design Generator] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle safety filter errors
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
              "Design generation was blocked due to content safety filters. Please modify your prompt.",
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
          message: errorMessage || "Failed to generate design. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
