import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "@e2b/code-interpreter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sandboxId, projectId } = await request.json();

    if (!sandboxId) {
      return NextResponse.json({ error: "Sandbox ID required" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Connect to existing sandbox and kill it
    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      });
      await sandbox.kill();
    } catch (error) {
      console.log("Sandbox already killed or not found:", error);
      // Continue anyway to clear database
    }

    // Clear sandbox info from database
    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_id: null,
        e2b_sandbox_status: "idle",
        e2b_sandbox_created_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateError) {
      console.error("Failed to clear project sandbox info:", updateError);
      return NextResponse.json(
        { error: "Failed to clear sandbox info from database" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error closing sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close sandbox" },
      { status: 500 }
    );
  }
}
