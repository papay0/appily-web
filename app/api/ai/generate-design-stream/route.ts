/**
 * AI Design Streaming Generation API
 *
 * POST /api/ai/generate-design-stream
 *
 * Generates HTML+Tailwind designs using Gemini Pro 3 with streaming.
 * Returns Server-Sent Events (SSE) for real-time UI updates.
 * Used by the admin playground for streaming design prototyping.
 */

import { generateDesignStreamingWithGemini } from "@/lib/ai/gemini-client";

/**
 * System prompt for streaming HTML design generation
 * Instructs Gemini to generate plain HTML+Tailwind (not React) for multiple screens
 */
const HTML_DESIGN_SYSTEM_PROMPT = `You are an expert mobile app UI designer. Your task is to generate beautiful, production-quality HTML designs for mobile apps using Tailwind CSS.

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
- Include a status bar area at top if appropriate
- Include navigation at bottom if appropriate
- Use semantic HTML (header, main, nav, section, article)

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
- Auto-determine the most relevant screens based on the app description

SUMMARY - REQUIRED AT THE END:
After all screens are complete, include a brief summary comment:
<!-- SUMMARY: [Brief 1-2 sentence description of the screens you created] -->
Example: <!-- SUMMARY: Created 5 screens for a fitness tracking app: Home with workout stats, Exercise Library with categorized exercises, Workout Session with timer and reps, Progress charts, and Profile with settings. -->`;

export async function POST(request: Request): Promise<Response> {
  console.log("[Design Stream] POST request received");

  try {
    const body = await request.json();
    console.log("[Design Stream] Request body:", JSON.stringify(body, null, 2));

    const { prompt, screenName } = body as { prompt: string; screenName?: string };

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      console.log("[Design Stream] Invalid prompt - returning 400");
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Design Stream] Starting stream for: ${prompt.substring(0, 100)}...`);

    // Build the user prompt
    const userPrompt = screenName
      ? `Create a beautiful mobile app screen for "${screenName}" with the following description:\n\n${prompt}\n\nMake it visually stunning with a modern mobile app design.`
      : `Create a beautiful mobile app screen for the following idea:\n\n${prompt}\n\nGenerate ONE stunning screen that represents the core of this app.`;

    console.log("[Design Stream] Creating ReadableStream...");

    // Create a readable stream using SSE format
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let chunkCount = 0;

        console.log("[Design Stream] Stream started, calling Gemini...");

        try {
          // Stream chunks from Gemini
          for await (const chunk of generateDesignStreamingWithGemini(
            userPrompt,
            HTML_DESIGN_SYSTEM_PROMPT
          )) {
            chunkCount++;
            console.log(`[Design Stream] Chunk ${chunkCount} received (${chunk.length} chars): ${chunk.substring(0, 50)}...`);

            // Send chunk as SSE data
            const sseData = `data: ${JSON.stringify({ chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Send completion signal
          const doneData = `data: ${JSON.stringify({ done: true })}\n\n`;
          controller.enqueue(encoder.encode(doneData));

          console.log(`[Design Stream] Stream completed successfully with ${chunkCount} chunks`);
        } catch (error) {
          console.error("[Design Stream] Streaming error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Design Stream] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
