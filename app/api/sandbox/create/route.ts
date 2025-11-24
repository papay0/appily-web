import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Sandbox } from "e2b";
import { createSandbox, setupExpoProject, startExpo } from "@/lib/e2b";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateQRCode } from "@/lib/qrcode";
import { restoreProjectFromR2, installDependencies } from "@/lib/agent/restore-from-r2";

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
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_id: info.id,
        e2b_sandbox_status: "starting",
        e2b_sandbox_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    // Return immediately - don't wait for Expo setup
    const response = NextResponse.json({
      sandboxId: info.id,
      status: "starting",
    });

    // Continue setup in the background (don't await)
    setupExpoInBackground(sandbox, projectId);

    return response;
  } catch (error) {
    console.error("Error creating sandbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 }
    );
  }
}

// Background function to complete Expo setup
async function setupExpoInBackground(sandbox: Sandbox, projectId: string) {
  try {
    let expoUrl: string;

    // Check if project has existing snapshots in R2
    console.log("[SandboxCreate] Checking for existing R2 snapshots...");
    const { data: snapshots } = await supabaseAdmin
      .from("project_snapshots")
      .select("r2_path, version, created_at")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1);

    if (snapshots && snapshots.length > 0) {
      // Restore from R2
      const latestSnapshot = snapshots[0];
      console.log(
        `[SandboxCreate] Found existing snapshot (v${latestSnapshot.version}), restoring from R2...`
      );

      const restoreResult = await restoreProjectFromR2(
        sandbox,
        latestSnapshot.r2_path,
        "/home/user/project"
      );

      if (!restoreResult.success) {
        console.error("[SandboxCreate] Restore failed:", restoreResult.error);
        throw new Error(`Failed to restore from R2: ${restoreResult.error}`);
      }

      console.log(`[SandboxCreate] ✓ Restored ${restoreResult.fileCount} files from R2`);

      // Install dependencies
      console.log("[SandboxCreate] Installing dependencies...");
      const installResult = await installDependencies(sandbox, "/home/user/project");

      if (!installResult.success) {
        console.error("[SandboxCreate] Install failed:", installResult.error);
        throw new Error(`Failed to install dependencies: ${installResult.error}`);
      }

      // Start Expo
      console.log("[SandboxCreate] Starting Expo...");
      expoUrl = await startExpo(sandbox, "/home/user/project");
    } else {
      // No snapshots found, clone template as usual
      console.log("[SandboxCreate] No R2 snapshots found, setting up from template...");
      expoUrl = await setupExpoProject(sandbox);
    }

    // Generate QR code for the Expo URL
    console.log("Generating QR code for Expo URL:", expoUrl);
    const qrCodeDataUrl = await generateQRCode(expoUrl);

    // Update project in database with final status
    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_status: "ready",
        expo_url: expoUrl,
        qr_code: qrCodeDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateError) {
      console.error("Failed to update project with Expo info:", updateError);
      // Update status to error
      await supabaseAdmin
        .from("projects")
        .update({
          e2b_sandbox_status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    }
  } catch (error) {
    console.error("Error setting up Expo in background:", error);
    // Update status to error
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }
}
