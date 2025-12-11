import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSandbox } from "@/lib/e2b";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { executeSetupInE2B } from "@/lib/agent/cli-executor";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = (await request.json()) as { projectId?: string };

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Create the sandbox
    const { sandbox, info } = await createSandbox();

    // Update project immediately with "starting" status
    // Note: We keep session_id - the stream-to-supabase script handles graceful fallback
    // if the session can't be resumed (loads conversation history from Supabase)
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_id: info.id,
        e2b_sandbox_status: "starting",
        e2b_sandbox_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    // Run setup entirely on E2B (no Vercel timeout issues)
    // The setup-expo.js script handles R2 restore, npm install, Expo start, and DB updates
    // Pass undefined for userPrompt since this is just sandbox creation, not starting an agent
    const { pid, logFile } = await executeSetupInE2B(
      sandbox,
      projectId,
      userId,
      undefined, // No user prompt - just setting up environment
      'claude'   // Default provider (irrelevant without prompt)
    );

    console.log(`[SandboxCreate] Setup script started on E2B (PID: ${pid}, logs: ${logFile})`);

    return NextResponse.json({
      sandboxId: info.id,
      status: "starting",
      setupPid: pid,
      setupLogFile: logFile,
    });
  } catch (error) {
    console.error("Error creating sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 }
    );
  }
}
