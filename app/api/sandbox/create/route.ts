import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Sandbox } from "e2b";
import { createSandbox, setupExpoProject } from "@/lib/e2b";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateQRCode } from "@/lib/qrcode";

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
    // Setup Expo project in the sandbox (clone template + start Expo)
    console.log("Setting up Expo project in sandbox...");
    const expoUrl = await setupExpoProject(sandbox);

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
