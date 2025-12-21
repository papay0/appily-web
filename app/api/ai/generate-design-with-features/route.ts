/**
 * AI Design Streaming Generation with Features Context API
 *
 * POST /api/ai/generate-design-with-features
 *
 * Generates HTML+Tailwind designs using Gemini Pro with streaming.
 * Enhanced version that accepts features from the plan phase to generate
 * more targeted and feature-aware UI designs.
 *
 * Returns Server-Sent Events (SSE) for real-time UI updates.
 */

import { generateDesignStreamingWithGemini } from "@/lib/ai/gemini-client";

interface FeatureInput {
  title: string;
  description: string | null;
  is_included: boolean;
}

interface CurrentScreen {
  name: string;
  html: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  prompt: string;
  projectId?: string;
  features?: FeatureInput[];
  screenName?: string;
  /** Current screens for follow-up context */
  currentScreens?: CurrentScreen[];
  /** Conversation history for context */
  conversationHistory?: ConversationMessage[];
}

/**
 * Build the system prompt for design generation
 * Includes features context when available for better designs
 */
function buildDesignSystemPrompt(
  features?: FeatureInput[],
  isFollowUp?: boolean
): string {
  const basePrompt = `You are an expert mobile app UI designer. Your task is to generate beautiful, production-quality HTML designs for mobile apps using Tailwind CSS.

CRITICAL OUTPUT RULES:
1. Output ONLY raw HTML - NO markdown code blocks, NO backticks, NO explanations, NO preamble
2. Generate all the screens that would be essential for the app
3. Separate each screen with delimiters: <!-- SCREEN_START: Screen Name --> and <!-- SCREEN_END -->
4. The HTML will be streamed chunk by chunk and rendered in real-time

HTML DESIGN RULES:
1. Use Tailwind CSS classes for ALL styling - use utility classes extensively
2. Do NOT use React, JSX syntax, or any JavaScript
3. Do NOT use onclick, onchange, or any event handlers
4. Use static HTML only - no dynamic content or state

ICONS - Use inline SVG or Unicode:
- For icons, use inline SVG or unicode characters
- Example chevron: <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
- Example heart: <span class="text-xl">❤️</span>
- Or use Heroicons inline SVG patterns

IMAGES - CRITICAL:
- For ALL images, ONLY use picsum.photos URLs which always work
- Format: https://picsum.photos/seed/{unique-seed}/{width}/{height}
- Examples:
  - Hero image: https://picsum.photos/seed/hero123/400/300
  - Profile avatar: https://picsum.photos/seed/avatar1/100/100
  - Card thumbnail: https://picsum.photos/seed/card456/200/150
- ALWAYS use a unique seed for each image
- NEVER use placeholder.com, unsplash.com direct links, or any other image service

DESIGN PRINCIPLES:
- Modern, clean aesthetics with generous whitespace
- Mobile-first design (assume 390px width viewport)
- Beautiful typography hierarchy with proper font weights
- Subtle shadows (shadow-sm, shadow-md), rounded corners (rounded-lg, rounded-xl)
- Use Tailwind color palette (e.g., bg-blue-500, text-gray-800)
- Professional quality that looks like a real app
- Each screen should fill the screen height (min-h-screen)
- All screens should feel cohesive and part of the same app (consistent colors, style)

STRUCTURE FOR EACH SCREEN:
- Start with a container div: <div class="min-h-screen bg-... p-4">
- Do NOT include iOS status bar (time, battery, signal icons) - the real device already shows one!
- Add appropriate top padding (pt-12 or pt-14) to account for the device's status bar
- Include bottom navigation if appropriate
- Use semantic HTML (header, main, nav, section, article)`;

  // Add features context if available
  let featuresContext = "";
  if (features && features.length > 0) {
    const includedFeatures = features.filter((f) => f.is_included);
    if (includedFeatures.length > 0) {
      featuresContext = `

IMPORTANT - APP FEATURES TO INCORPORATE:
This app has the following planned features. Design UI screens that will support ALL of these features.
Make sure your designs include UI elements for each feature (buttons, forms, lists, etc.):

${includedFeatures
  .map(
    (f, i) =>
      `${i + 1}. ${f.title}${f.description ? `: ${f.description}` : ""}`
  )
  .join("\n")}

Generate screens that cover these features comprehensively. Each feature should have a clear place in your UI design.`;
    }
  }

  const outputFormat = `

OUTPUT FORMAT - Generate screens like this:
<!-- SCREEN_START: Home -->
<div class="min-h-screen bg-gray-50">
  <header class="bg-white px-4 py-3 shadow-sm">
    <h1 class="text-xl font-bold text-gray-800">App Title</h1>
  </header>
  <main class="p-4">
    <!-- Beautiful home content here -->
  </main>
</div>
<!-- SCREEN_END -->

<!-- SCREEN_START: Profile -->
<div class="min-h-screen bg-gray-50">
  <!-- Beautiful profile content here -->
</div>
<!-- SCREEN_END -->

<!-- SCREEN_START: Settings -->
<div class="min-h-screen bg-gray-50">
  <!-- Beautiful settings content here -->
</div>
<!-- SCREEN_END -->

IMPORTANT:
- Start IMMEDIATELY with <!-- SCREEN_START: First Screen Name -->
- Each screen must have both SCREEN_START and SCREEN_END comments
- Make the designs BEAUTIFUL - this is the most important requirement
- Include realistic placeholder content (user names, numbers, text)
- Auto-determine the most relevant screens based on the app description and features

SUMMARY - REQUIRED AT THE END:
After all screens are complete, include a brief summary comment:
<!-- SUMMARY: [Brief 1-2 sentence description of the screens you created] -->
Example: <!-- SUMMARY: Created 5 screens for a fitness tracking app: Home with workout stats, Exercise Library with categorized exercises, Workout Session with timer and reps, Progress charts, and Profile with settings. -->`;

  return basePrompt + featuresContext + outputFormat;
}

export async function POST(request: Request): Promise<Response> {
  console.log("[Design Stream + Features] POST request received");

  try {
    const body = (await request.json()) as RequestBody;
    console.log(
      "[Design Stream + Features] Request body:",
      JSON.stringify(
        {
          prompt: body.prompt?.substring(0, 100),
          featuresCount: body.features?.length || 0,
          projectId: body.projectId,
        },
        null,
        2
      )
    );

    const { prompt, features, screenName, currentScreens, conversationHistory } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      console.log("[Design Stream + Features] Invalid prompt - returning 400");
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Detect if this is a follow-up request (has existing screens)
    const isFollowUp = currentScreens && currentScreens.length > 0;

    console.log(
      `[Design Stream + Features] Starting stream for: ${prompt.substring(0, 100)}...`
    );
    console.log(
      `[Design Stream + Features] Features context: ${features?.length || 0} features`
    );
    console.log(
      `[Design Stream + Features] Is follow-up: ${isFollowUp}, current screens: ${currentScreens?.length || 0}`
    );

    // Build the system prompt with features context
    const systemPrompt = buildDesignSystemPrompt(features, isFollowUp);

    // Build the user prompt - include current design context for follow-ups
    let userPrompt: string;

    if (isFollowUp && currentScreens) {
      // Build context from existing screens
      const screensSummary = currentScreens
        .map((s, i) => `${i + 1}. ${s.name}`)
        .join("\n");

      // Build conversation context if available
      const conversationContext = conversationHistory && conversationHistory.length > 0
        ? `\nConversation so far:\n${conversationHistory
            .slice(-6) // Keep last 6 messages for context
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n")}\n`
        : "";

      // Include the full HTML of existing screens so Gemini can modify them
      const screensCode = currentScreens
        .map(s => `\n=== ${s.name} ===\n${s.html}`)
        .join("\n");

      userPrompt = `You are updating an existing mobile app design.
${conversationContext}
Current screens:
${screensSummary}

Here is the complete current HTML code for each screen:
${screensCode}

User's request: "${prompt}"

CRITICAL INSTRUCTIONS FOR MODIFICATIONS:
- Carefully analyze the user's request to understand what changes they want
- Output ONLY the screens that need changes - do NOT output unchanged screens
- Preserve the overall design style and color scheme unless asked to change it

DELIMITER RULES - THIS IS VERY IMPORTANT:
- For EDITING an existing screen, use: <!-- SCREEN_EDIT: ExactScreenName --> and <!-- SCREEN_END -->
- For adding a NEW screen, use: <!-- SCREEN_START: NewScreenName --> and <!-- SCREEN_END -->
- The screen name in SCREEN_EDIT must EXACTLY match one of the existing screen names listed above
- Do NOT include screens that don't need changes

EXAMPLES:
If user says "change the Home title to Dashboard":
<!-- SCREEN_EDIT: Home -->
<div class="min-h-screen...">
  <h1>Dashboard</h1>
  ...rest of modified Home screen...
</div>
<!-- SCREEN_END -->

If user says "add a Settings screen":
<!-- SCREEN_START: Settings -->
<div class="min-h-screen...">
  ...new Settings screen...
</div>
<!-- SCREEN_END -->

If user says "change the title on Home and Profile":
<!-- SCREEN_EDIT: Home -->
...modified Home...
<!-- SCREEN_END -->

<!-- SCREEN_EDIT: Profile -->
...modified Profile...
<!-- SCREEN_END -->

SUMMARY - REQUIRED AT THE END:
After all screen HTML is complete, you MUST include a brief summary comment explaining what you did:
<!-- SUMMARY: [Your explanation here in 1-2 sentences] -->

Examples:
- <!-- SUMMARY: Changed the header title from "Home" to "Dashboard" and updated the navigation bar color to match. -->
- <!-- SUMMARY: Added a new Settings screen with profile preferences, notification toggles, and a logout button. -->
- <!-- SUMMARY: Updated the Home and Profile screens to use a dark blue color scheme with improved contrast. -->

Now respond to the user's request. Remember: use SCREEN_EDIT for existing screens, SCREEN_START for new screens, and always end with a SUMMARY comment.`;
    } else if (screenName) {
      userPrompt = `Create a beautiful mobile app screen for "${screenName}" with the following description:\n\n${prompt}\n\nMake it visually stunning with a modern mobile app design.`;
    } else {
      userPrompt = `Create beautiful mobile app screens for the following app idea:\n\n${prompt}\n\nGenerate screens that represent the core functionality of this app.`;
    }

    console.log("[Design Stream + Features] Creating ReadableStream...");

    // Create a readable stream using SSE format
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let chunkCount = 0;

        console.log(
          "[Design Stream + Features] Stream started, calling Gemini..."
        );

        try {
          // Stream chunks from Gemini
          for await (const chunk of generateDesignStreamingWithGemini(
            userPrompt,
            systemPrompt
          )) {
            chunkCount++;
            if (chunkCount <= 3 || chunkCount % 10 === 0) {
              console.log(
                `[Design Stream + Features] Chunk ${chunkCount} received (${chunk.length} chars)`
              );
            }

            // Send chunk as SSE data
            const sseData = `data: ${JSON.stringify({ chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Send completion signal
          const doneData = `data: ${JSON.stringify({ done: true })}\n\n`;
          controller.enqueue(encoder.encode(doneData));

          console.log(
            `[Design Stream + Features] Stream completed successfully with ${chunkCount} chunks`
          );
        } catch (error) {
          console.error("[Design Stream + Features] Streaming error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const errorData = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Design Stream + Features] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
