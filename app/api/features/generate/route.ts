/**
 * API Route: Generate feature suggestions for an app idea
 *
 * POST /api/features/generate
 *
 * This endpoint uses Gemini 2.5 Flash to analyze a user's app idea and generate
 * a list of suggested features with recommendations. Uses Flash model for
 * fast response times.
 *
 * Request body:
 * - projectId: string - Project ID to associate features with
 * - appIdea: string - User's description of their app idea
 * - imageKeys: string[] - Optional R2 keys for reference images
 *
 * Response:
 * - features: Array<{title, description, is_recommended}>
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildFeatureGenerationPrompt } from "@/lib/agent/prompts";
import { downloadFile } from "@/lib/r2-client";
import { generateFeaturesWithGemini } from "@/lib/ai/gemini-client";

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
    const { projectId, appIdea, imageKeys } = await request.json();

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

    // Validate imageKeys
    const validatedImageKeys: string[] = Array.isArray(imageKeys)
      ? imageKeys.filter((k: unknown) => typeof k === "string")
      : [];

    console.log(`[API] Generating features for project: ${projectId}`);
    console.log(`[API] App idea length: ${appIdea.length} chars`);
    console.log(`[API] Image keys: ${validatedImageKeys.length}`);

    // Fetch images from R2 as base64 for Gemini Vision API
    const images: Array<{
      base64: string;
      mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    }> = [];
    for (const key of validatedImageKeys) {
      try {
        const buffer = await downloadFile(key);
        const ext = key.split(".").pop()?.toLowerCase();
        const mimeType: "image/png" | "image/gif" | "image/webp" | "image/jpeg" =
          ext === "png"
            ? "image/png"
            : ext === "gif"
              ? "image/gif"
              : ext === "webp"
                ? "image/webp"
                : "image/jpeg";
        images.push({
          base64: buffer.toString("base64"),
          mimeType,
        });
        console.log(`[API] ✓ Loaded image: ${key}`);
      } catch (error) {
        console.error(`[API] ✗ Failed to load image ${key}:`, error);
        // Continue without this image
      }
    }

    // Build prompt for Gemini
    const hasImages = images.length > 0;
    const prompt = buildFeatureGenerationPrompt({ appIdea, hasImages });

    // Call Gemini 2.5 Flash for fast feature generation
    const responseText = await generateFeaturesWithGemini({
      prompt,
      images: hasImages ? images : undefined,
    });

    // Parse JSON response
    let parsed: FeatureGenerationResponse;
    try {
      // Remove potential markdown code blocks if present
      let jsonText = responseText.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("[API] Failed to parse Gemini response:", responseText);
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
