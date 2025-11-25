/**
 * API Route: Generate feature suggestions for an app idea
 *
 * POST /api/features/generate
 *
 * This endpoint uses Claude to analyze a user's app idea and generate
 * a list of suggested features with recommendations.
 *
 * Request body:
 * - projectId: string - Project ID to associate features with
 * - appIdea: string - User's description of their app idea
 *
 * Response:
 * - features: Array<{title, description, is_recommended}>
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildFeatureGenerationPrompt } from "@/lib/agent/prompts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GeneratedFeature {
  title: string;
  description: string;
  is_recommended: boolean;
}

interface FeatureGenerationResponse {
  features: GeneratedFeature[];
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { projectId, appIdea } = await request.json();

    if (!projectId || !appIdea) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, appIdea" },
        { status: 400 }
      );
    }

    if (appIdea.trim().length < 10) {
      return NextResponse.json(
        { error: "App idea must be at least 10 characters" },
        { status: 400 }
      );
    }

    console.log(`[API] Generating features for project: ${projectId}`);
    console.log(`[API] App idea length: ${appIdea.length} chars`);

    // Build prompt and call Claude
    const prompt = buildFeatureGenerationPrompt({ appIdea });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text content from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[API] No text content in Claude response");
      return NextResponse.json(
        { error: "Failed to generate features" },
        { status: 500 }
      );
    }

    // Parse JSON response
    let parsed: FeatureGenerationResponse;
    try {
      // Remove potential markdown code blocks if present
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("[API] Failed to parse Claude response:", textBlock.text);
      console.error("[API] Parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to parse feature suggestions" },
        { status: 500 }
      );
    }

    // Validate response structure
    if (!parsed.features || !Array.isArray(parsed.features)) {
      console.error("[API] Invalid response structure:", parsed);
      return NextResponse.json(
        { error: "Invalid feature response structure" },
        { status: 500 }
      );
    }

    // Validate and sanitize features
    const features = parsed.features
      .filter(
        (f): f is GeneratedFeature =>
          typeof f.title === "string" &&
          typeof f.description === "string" &&
          typeof f.is_recommended === "boolean"
      )
      .map((f, index) => ({
        title: f.title.trim(),
        description: f.description.trim(),
        is_recommended: f.is_recommended,
        sort_order: index,
      }));

    console.log(`[API] Generated ${features.length} features`);

    return NextResponse.json({ features });
  } catch (error) {
    console.error("[API] Feature generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
