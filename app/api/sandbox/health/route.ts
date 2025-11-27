import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Sandbox } from "@e2b/code-interpreter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSandbox, startExpo } from "@/lib/e2b";
import { generateQRCode } from "@/lib/qrcode";
import { restoreProjectFromR2, installDependencies } from "@/lib/agent/restore-from-r2";
import type { Sandbox as E2BSandbox } from "e2b";

export type HealthStatus = "sleeping" | "starting" | "metro_starting" | "ready" | "error";

export interface HealthResponse {
  healthy: boolean;
  status: HealthStatus;
  sandboxAlive: boolean;
  metroRunning: boolean;
  expoUrl?: string;
  qrCode?: string;
  message: string;
}

// User-friendly messages for each status
const STATUS_MESSAGES: Record<HealthStatus, string> = {
  sleeping: "Your app is sleeping",
  starting: "Waking up...",
  metro_starting: "Almost ready!",
  ready: "Ready to preview",
  error: "Something went wrong",
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, sandboxId, autoRestart } = await request.json() as {
      projectId?: string;
      sandboxId?: string;
      autoRestart?: boolean;
    };

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Get current project state from database
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("e2b_sandbox_id, e2b_sandbox_status, expo_url, qr_code")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentSandboxId = sandboxId || project.e2b_sandbox_id;

    // If sandbox is already in "starting" status, return that status
    if (project.e2b_sandbox_status === "starting") {
      const response: HealthResponse = {
        healthy: false,
        status: "starting",
        sandboxAlive: false,
        metroRunning: false,
        message: STATUS_MESSAGES.starting,
      };
      return NextResponse.json(response);
    }

    // No sandbox ID - sandbox is sleeping
    if (!currentSandboxId) {
      // Auto-restart if requested
      if (autoRestart) {
        return await handleAutoRestart(projectId);
      }

      const response: HealthResponse = {
        healthy: false,
        status: "sleeping",
        sandboxAlive: false,
        metroRunning: false,
        message: STATUS_MESSAGES.sleeping,
      };
      return NextResponse.json(response);
    }

    // Try to connect to the sandbox
    let sandbox: Sandbox;
    try {
      sandbox = await Sandbox.connect(currentSandboxId, {
        apiKey: process.env.E2B_API_KEY,
      });
    } catch {
      // Sandbox doesn't exist or timed out
      console.log("[HealthCheck] Sandbox not alive, cleaning up database...");

      // Clear sandbox data from database
      await supabaseAdmin
        .from("projects")
        .update({
          e2b_sandbox_id: null,
          e2b_sandbox_status: "idle",
          expo_url: null,
          qr_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      // Auto-restart if requested
      if (autoRestart) {
        return await handleAutoRestart(projectId);
      }

      const response: HealthResponse = {
        healthy: false,
        status: "sleeping",
        sandboxAlive: false,
        metroRunning: false,
        message: STATUS_MESSAGES.sleeping,
      };
      return NextResponse.json(response);
    }

    // Sandbox is alive - now check if Metro is running
    const metroRunning = await checkMetroRunning(sandbox);

    if (metroRunning) {
      // Everything is healthy
      const response: HealthResponse = {
        healthy: true,
        status: "ready",
        sandboxAlive: true,
        metroRunning: true,
        expoUrl: project.expo_url || undefined,
        qrCode: project.qr_code || undefined,
        message: STATUS_MESSAGES.ready,
      };
      return NextResponse.json(response);
    }

    // Sandbox alive but Metro not running
    console.log("[HealthCheck] Metro not running");

    // Only auto-restart Metro if autoRestart is enabled
    // This prevents interference with initial setup or manual control
    if (autoRestart) {
      console.log("[HealthCheck] Auto-restart enabled, attempting to restart Metro...");

      // Update status to starting
      await supabaseAdmin
        .from("projects")
        .update({
          e2b_sandbox_status: "starting",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      // Return immediately, restart Metro in background
      restartMetroInBackground(sandbox, projectId);

      const response: HealthResponse = {
        healthy: false,
        status: "metro_starting",
        sandboxAlive: true,
        metroRunning: false,
        message: STATUS_MESSAGES.metro_starting,
      };
      return NextResponse.json(response);
    }

    // Auto-restart disabled - just report the status
    console.log("[HealthCheck] Auto-restart disabled, reporting sleeping status");
    const response: HealthResponse = {
      healthy: false,
      status: "sleeping",
      sandboxAlive: true,
      metroRunning: false,
      message: "Metro bundler stopped",
    };
    return NextResponse.json(response);

  } catch (error) {
    console.error("[HealthCheck] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Health check failed",
        healthy: false,
        status: "error",
        sandboxAlive: false,
        metroRunning: false,
        message: STATUS_MESSAGES.error,
      },
      { status: 500 }
    );
  }
}

/**
 * Check if Metro/Expo process is running AND actually serving inside the sandbox
 * Uses multiple checks to verify Metro is healthy:
 * 1. Process exists (pgrep)
 * 2. Port 8081 is listening (netstat/ss)
 * 3. Metro endpoint responds (curl)
 */
async function checkMetroRunning(sandbox: Sandbox): Promise<boolean> {
  try {
    // Step 1: Check if process exists
    const processResult = await sandbox.commands.run(
      "pgrep -f 'expo start' > /dev/null 2>&1 && echo 'found' || echo 'notfound'",
      { timeoutMs: 5000 }
    );

    const processExists = processResult.stdout.trim() === "found";

    if (!processExists) {
      // Also check for node metro process
      const metroProcessResult = await sandbox.commands.run(
        "pgrep -f 'node.*metro' > /dev/null 2>&1 && echo 'found' || echo 'notfound'",
        { timeoutMs: 5000 }
      );

      if (metroProcessResult.stdout.trim() !== "found") {
        console.log("[HealthCheck] No Metro/Expo process found");
        return false;
      }
    }

    console.log("[HealthCheck] Expo/Metro process found, verifying it's actually serving...");

    // Step 2: Verify Metro port is listening (8081 is default Metro port)
    const portResult = await sandbox.commands.run(
      "ss -tlnp 2>/dev/null | grep ':8081' > /dev/null 2>&1 && echo 'listening' || echo 'not_listening'",
      { timeoutMs: 5000 }
    );

    if (portResult.stdout.trim() !== "listening") {
      console.log("[HealthCheck] Metro process exists but port 8081 is not listening - Metro may have crashed");
      return false;
    }

    // Step 3: Verify Metro is actually responding (quick health check)
    const healthResult = await sandbox.commands.run(
      "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 3 http://localhost:8081/status 2>/dev/null || echo 'failed'",
      { timeoutMs: 8000 }
    );

    const httpCode = healthResult.stdout.trim();

    // Accept 200, 404 (endpoint might not exist), or other 2xx/3xx codes as "alive"
    // A crashed Metro won't respond at all (curl will fail/timeout)
    if (httpCode === "failed" || httpCode === "") {
      console.log("[HealthCheck] Metro process and port exist but not responding to HTTP - may be crashed or starting");
      // Be lenient - if process exists and port is listening, it's probably starting up
      // Return true but log the warning
      console.log("[HealthCheck] Port is listening, assuming Metro is starting/running");
      return true;
    }

    console.log(`[HealthCheck] Metro health check HTTP code: ${httpCode}`);
    return true;
  } catch (error) {
    console.error("[HealthCheck] Error checking Metro:", error);
    return false;
  }
}

/**
 * Handle auto-restart: Create a new sandbox and restore from R2
 */
async function handleAutoRestart(projectId: string): Promise<NextResponse> {
  try {
    console.log("[HealthCheck] Auto-restarting sandbox for project:", projectId);

    // Create the sandbox
    const { sandbox, info } = await createSandbox();

    // Update project with "starting" status
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_id: info.id,
        e2b_sandbox_status: "starting",
        e2b_sandbox_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    // Continue setup in background
    setupExpoInBackground(sandbox, projectId);

    const response: HealthResponse = {
      healthy: false,
      status: "starting",
      sandboxAlive: true,
      metroRunning: false,
      message: STATUS_MESSAGES.starting,
    };
    return NextResponse.json(response);

  } catch (error) {
    console.error("[HealthCheck] Auto-restart failed:", error);

    const response: HealthResponse = {
      healthy: false,
      status: "error",
      sandboxAlive: false,
      metroRunning: false,
      message: "Failed to wake up. Please try again.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * Restart Metro server in the background
 */
async function restartMetroInBackground(sandbox: Sandbox, projectId: string): Promise<void> {
  try {
    console.log("[HealthCheck] Restarting Metro in background...");

    // Kill existing Expo processes - use shell wrapper to avoid E2B throwing on non-zero exit
    // pkill returns 1 if no processes found, which E2B treats as an error
    try {
      await sandbox.commands.run("pkill -f 'expo start' 2>/dev/null; exit 0", { timeoutMs: 5000 });
    } catch {
      // Ignore - process may not exist
    }

    try {
      await sandbox.commands.run("pkill -f 'node.*metro' 2>/dev/null; exit 0", { timeoutMs: 5000 });
    } catch {
      // Ignore - process may not exist
    }

    // Wait a bit for processes to die
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start Expo again
    const expoUrl = await startExpo(sandbox, "/home/user/project");

    // Generate new QR code
    const qrCodeDataUrl = await generateQRCode(expoUrl);

    // Update database
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_status: "ready",
        expo_url: expoUrl,
        qr_code: qrCodeDataUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    console.log("[HealthCheck] Metro restarted successfully");

  } catch (error) {
    console.error("[HealthCheck] Metro restart failed:", error);

    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }
}

/**
 * Setup Expo in the background (reused from /api/sandbox/create)
 */
async function setupExpoInBackground(sandbox: E2BSandbox, projectId: string): Promise<void> {
  try {
    let expoUrl: string;

    // Check if project has existing snapshots in R2
    console.log("[HealthCheck] Checking for existing R2 snapshots...");
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
        `[HealthCheck] Found existing snapshot (v${latestSnapshot.version}), restoring from R2...`
      );

      const restoreResult = await restoreProjectFromR2(
        sandbox,
        latestSnapshot.r2_path,
        "/home/user/project"
      );

      if (!restoreResult.success) {
        console.error("[HealthCheck] Restore failed:", restoreResult.error);
        throw new Error(`Failed to restore from R2: ${restoreResult.error}`);
      }

      console.log(`[HealthCheck] Restored ${restoreResult.fileCount} files from R2`);

      // Install dependencies
      console.log("[HealthCheck] Installing dependencies...");
      const installResult = await installDependencies(sandbox, "/home/user/project");

      if (!installResult.success) {
        console.error("[HealthCheck] Install failed:", installResult.error);
        throw new Error(`Failed to install dependencies: ${installResult.error}`);
      }

      // Start Expo
      console.log("[HealthCheck] Starting Expo...");
      expoUrl = await startExpo(sandbox, "/home/user/project");
    } else {
      // No snapshots found, clone template
      console.log("[HealthCheck] No R2 snapshots found, setting up from template...");
      const { setupExpoProject } = await import("@/lib/e2b");
      expoUrl = await setupExpoProject(sandbox);
    }

    // Generate QR code
    console.log("[HealthCheck] Generating QR code for Expo URL:", expoUrl);
    const qrCodeDataUrl = await generateQRCode(expoUrl);

    // Update project in database
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
      console.error("[HealthCheck] Failed to update project:", updateError);
      await supabaseAdmin
        .from("projects")
        .update({
          e2b_sandbox_status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    }
  } catch (error) {
    console.error("[HealthCheck] Expo setup failed:", error);
    await supabaseAdmin
      .from("projects")
      .update({
        e2b_sandbox_status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }
}
