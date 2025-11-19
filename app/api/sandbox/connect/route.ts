import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "@e2b/code-interpreter";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sandboxId } = await request.json();

    if (!sandboxId) {
      return NextResponse.json({ error: "Sandbox ID required" }, { status: 400 });
    }

    // Try to connect to existing sandbox
    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      });

      // If connection succeeds, sandbox is alive
      return NextResponse.json({
        connected: true,
        status: "ready",
        sandboxId: sandbox.sandboxId,
      });
    } catch (error) {
      // Sandbox doesn't exist or timed out
      console.log("Failed to connect to sandbox:", error);
      return NextResponse.json({
        connected: false,
        status: "idle",
      });
    }
  } catch (error) {
    console.error("Error connecting to sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect to sandbox" },
      { status: 500 }
    );
  }
}
