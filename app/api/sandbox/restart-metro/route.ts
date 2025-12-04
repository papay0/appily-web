import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "e2b";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateQRCode } from "@/lib/qrcode";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sandboxId, projectId } = await request.json();

    if (!sandboxId || !projectId) {
      return NextResponse.json(
        { error: "Sandbox ID and Project ID required" },
        { status: 400 }
      );
    }

    console.log(`[restart-metro] Restarting Metro for sandbox ${sandboxId}`);

    // Connect to the sandbox
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });

    // Kill any existing tmux session and Expo/Metro processes
    console.log("[restart-metro] Stopping existing Metro...");
    try {
      await sandbox.commands.run("tmux kill-session -t metro 2>/dev/null || true");
      await sandbox.commands.run("pkill -f 'expo start' 2>/dev/null || true");
      await sandbox.commands.run("pkill -f 'node.*metro' 2>/dev/null || true");
    } catch {
      // Ignore errors if no processes/sessions found
    }

    // Wait for processes to die
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the E2B public hostname
    const hostname = await sandbox.getHost(8081);
    console.log(`[restart-metro] Starting Expo in tmux session on ${hostname}...`);

    // Start Expo in tmux session (matching setup-expo.js approach for metro-control.js compatibility)
    // Note: tmux passes the command as a single argument, so we use single quotes to avoid escaping issues
    await sandbox.commands.run(
      `tmux new-session -d -s metro 'cd /home/user/project && NODE_OPTIONS="--max-old-space-size=3072" npx expo start --tunnel'`
    );

    // Wait for Expo to be ready by polling tmux pane output
    const startTime = Date.now();
    const maxWait = 60000; // 60 seconds
    let expoReady = false;

    while (!expoReady && Date.now() - startTime < maxWait) {
      const result = await sandbox.commands.run(
        'tmux capture-pane -t metro -p 2>/dev/null || echo ""'
      );

      const output = result.stdout || "";
      if (
        output.includes("Metro") ||
        output.includes("Tunnel ready") ||
        output.includes("exp://") ||
        (output.includes("tunnel") && output.includes("ready"))
      ) {
        expoReady = true;
        console.log("[restart-metro] ✓ Expo is ready!");
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!expoReady) {
      console.warn("[restart-metro] Warning: Expo readiness not confirmed within 60s, proceeding anyway...");
    }

    // Generate new QR code
    const expoUrl = `exp://${hostname}`;
    const qrCodeDataUrl = await generateQRCode(expoUrl);

    // Update project in database
    await supabaseAdmin
      .from("projects")
      .update({
        expo_url: expoUrl,
        qr_code: qrCodeDataUrl,
        e2b_sandbox_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    console.log(`[restart-metro] ✓ Restarted successfully on ${expoUrl}`);
    return NextResponse.json({
      success: true,
      expoUrl,
      message: "Metro server restarted successfully",
    });
  } catch (error) {
    console.error("Error restarting Metro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restart Metro" },
      { status: 500 }
    );
  }
}
