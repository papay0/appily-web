import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "e2b";

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

    // Connect to the sandbox
    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      });

      // Check if Metro/Expo process is running
      let metroIsRunning = false;
      try {
        const psResult = await sandbox.commands.run(
          "ps aux | grep 'expo start' | grep -v grep",
          { timeoutMs: 5000 }
        );
        metroIsRunning = psResult.exitCode === 0 && psResult.stdout.trim().length > 0;
      } catch (error) {
        console.log("[health] Error checking Metro process:", error);
        metroIsRunning = false;
      }

      if (!metroIsRunning) {
        // Metro is not running - we should restart it
        await sandbox.kill();
        return NextResponse.json({
          healthy: false,
          sandboxAlive: true,
          metroRunning: false,
          message: "Metro server is not running",
        });
      }

      // Check if port 8081 is actually responding
      try {
        const hostname = await sandbox.getHost(8081);

        await sandbox.kill();
        return NextResponse.json({
          healthy: true,
          sandboxAlive: true,
          metroRunning: true,
          hostname,
        });
      } catch (error) {
        await sandbox.kill();
        return NextResponse.json({
          healthy: false,
          sandboxAlive: true,
          metroRunning: true,
          portAccessible: false,
          message: "Port 8081 not accessible",
        });
      }
    } catch (error) {
      console.log("Failed to connect to sandbox:", error);
      return NextResponse.json({
        healthy: false,
        sandboxAlive: false,
        message: "Sandbox is not running",
      });
    }
  } catch (error) {
    console.error("Error checking sandbox health:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check sandbox health" },
      { status: 500 }
    );
  }
}
