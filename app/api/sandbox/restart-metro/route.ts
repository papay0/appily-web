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

    // Kill any existing Expo/Metro processes
    console.log("[restart-metro] Stopping Expo...");
    try {
      await sandbox.commands.run("pkill -f 'expo start'");
      await sandbox.commands.run("pkill -f 'node.*metro'");
    } catch {
      // Ignore errors if no processes found
    }

    // Wait a bit for processes to die
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the E2B public hostname and restart Expo
    const hostname = await sandbox.getHost(8081);
    console.log(`[restart-metro] Starting Expo on ${hostname}...`);

    // Create a Promise that resolves when Expo is ready
    const expoReadyPromise = new Promise<void>(async (resolve) => {
      let resolved = false;

      await sandbox.commands.run(
        `cd /home/user/project && NODE_OPTIONS="--max-old-space-size=3072" npx expo start --tunnel`,
        {
          background: true,
          timeoutMs: 0,
          onStdout: (data) => {
            // Only log important messages
            if (data.includes("Metro") || data.includes("Tunnel") || data.includes("error") || data.includes("Error")) {
              console.log("[Expo]", data.trim());
            }

            if (
              !resolved &&
              (data.includes("Metro") ||
                data.includes("Tunnel ready") ||
                data.includes("exp://") ||
                (data.includes("tunnel") && data.includes("ready")))
            ) {
              resolved = true;
              console.log("[restart-metro] ✓ Expo is ready!");
              resolve();
            }
          },
          onStderr: (data) => {
            // Only log errors
            if (data.includes("error") || data.includes("Error") || data.includes("failed")) {
              console.error("[Expo]", data.trim());
            }
          },
        }
      );
    });

    // Wait for Expo to be ready with 60 second timeout
    try {
      await Promise.race([
        expoReadyPromise,
        new Promise<void>((_, rejectPromise) =>
          setTimeout(() => rejectPromise(new Error("Expo startup timeout after 60 seconds")), 60000)
        ),
      ]);
    } catch (error) {
      console.error("[restart-metro] Expo failed to start:", error);
      await sandbox.kill();
      return NextResponse.json(
        { error: "Failed to restart Metro server" },
        { status: 500 }
      );
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

    await sandbox.kill();

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
