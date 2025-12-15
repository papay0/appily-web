import { NextRequest, NextResponse } from "next/server";

// Test endpoint for Claude Agent SDK
// This runs directly in Vercel to debug SDK usage before deploying to E2B

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Missing prompt" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log("[SDK-Test] Starting SDK test with prompt:", prompt.substring(0, 100));
    console.log("[SDK-Test] API Key present:", !!apiKey);

    // Dynamic import of SDK
    let query;
    try {
      const sdk = await import("@anthropic-ai/claude-agent-sdk");
      query = sdk.query;
      console.log("[SDK-Test] SDK imported successfully");
    } catch (importError) {
      console.error("[SDK-Test] Failed to import SDK:", importError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to import SDK: ${importError instanceof Error ? importError.message : String(importError)}`
        },
        { status: 500 }
      );
    }

    const messages: Array<{
      type: string;
      subtype?: string;
      content?: string;
      session_id?: string;
      timestamp: string;
    }> = [];

    console.log("[SDK-Test] Starting query...");

    try {
      // Use SDK query() with minimal options
      for await (const message of query({
        prompt,
        options: {
          cwd: "/tmp",
          allowedTools: ["Read", "Glob", "Grep"], // Read-only tools for safety
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 3, // Limit turns for testing
        },
      })) {
        // Extract subtype if it exists (only on certain message types)
        const subtype = "subtype" in message ? (message as { subtype?: string }).subtype : undefined;
        const sessionId = "session_id" in message ? (message as { session_id?: string }).session_id : undefined;

        console.log("[SDK-Test] Received message:", message.type, subtype || "");

        messages.push({
          type: message.type,
          subtype,
          content: JSON.stringify(message).substring(0, 500),
          session_id: sessionId,
          timestamp: new Date().toISOString(),
        });

        // Stop after result
        if (message.type === "result") {
          console.log("[SDK-Test] Got result, stopping");
          break;
        }
      }

      console.log("[SDK-Test] Query completed. Messages:", messages.length);

      return NextResponse.json({
        success: true,
        messageCount: messages.length,
        messages,
      });

    } catch (queryError) {
      console.error("[SDK-Test] Query failed:", queryError);
      return NextResponse.json(
        {
          success: false,
          error: `Query failed: ${queryError instanceof Error ? queryError.message : String(queryError)}`,
          stack: queryError instanceof Error ? queryError.stack : undefined,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("[SDK-Test] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple ping test
export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  let sdkAvailable = false;
  try {
    await import("@anthropic-ai/claude-agent-sdk");
    sdkAvailable = true;
  } catch {
    sdkAvailable = false;
  }

  return NextResponse.json({
    status: "ok",
    hasApiKey,
    sdkAvailable,
    timestamp: new Date().toISOString(),
  });
}
