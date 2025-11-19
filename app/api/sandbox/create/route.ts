import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSandbox } from "@/lib/e2b";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Create the sandbox
    const { sandbox, info } = await createSandbox();

    // Update project in database with sandbox info
    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_id: info.id,
        e2b_sandbox_status: "ready",
        e2b_sandbox_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateError) {
      console.error("Failed to update project with sandbox info:", updateError);
      return NextResponse.json(
        { error: "Failed to save sandbox info to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sandboxId: info.id,
      status: info.status,
    });
  } catch (error) {
    console.error("Error creating sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 }
    );
  }
}
