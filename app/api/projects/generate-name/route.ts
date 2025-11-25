/**
 * API Route: Generate a project name from an app idea
 *
 * POST /api/projects/generate-name
 *
 * This endpoint uses Claude to generate a short, memorable project name
 * based on the user's app idea and optional feature list.
 *
 * Request body:
 * - appIdea: string - User's description of their app idea
 * - features?: Array<{title, description}> - Optional feature list for context
 *
 * Response:
 * - name: string - Generated project name (2-4 words, Title Case)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildProjectNamePrompt } from "@/lib/agent/prompts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Feature {
  title: string;
  description: string;
}

interface GenerateNameRequest {
  appIdea: string;
  features?: Feature[];
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body: GenerateNameRequest = await request.json();
    const { appIdea, features } = body;

    if (!appIdea) {
      return NextResponse.json(
        { error: "Missing required field: appIdea" },
        { status: 400 }
      );
    }

    if (appIdea.trim().length < 10) {
      return NextResponse.json(
        { error: "App idea must be at least 10 characters" },
        { status: 400 }
      );
    }

    console.log(`[API] Generating project name for app idea: ${appIdea.substring(0, 50)}...`);

    // Build prompt and call Claude
    const prompt = buildProjectNamePrompt({ appIdea, features });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50, // Short response expected
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text content from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[API] No text content in Claude response");
      return NextResponse.json(
        { error: "Failed to generate name" },
        { status: 500 }
      );
    }

    // Clean up the response - remove quotes, extra whitespace, etc.
    let name = textBlock.text
      .trim()
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/[.!?]$/, "") // Remove trailing punctuation
      .trim();

    // Validate name length (should be 2-4 words)
    const wordCount = name.split(/\s+/).length;
    if (wordCount > 6) {
      // If too long, truncate to first 4 words
      name = name.split(/\s+/).slice(0, 4).join(" ");
    }

    console.log(`[API] Generated project name: "${name}"`);

    return NextResponse.json({ name });
  } catch (error) {
    console.error("[API] Project name generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
