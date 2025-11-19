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

    // Connect to existing sandbox and kill it
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });

    await sandbox.kill();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error closing sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close sandbox" },
      { status: 500 }
    );
  }
}
