/**
 * API Route: Read E2B Sandbox Logs
 *
 * POST /api/sandbox/logs
 *
 * Reads log files from an E2B sandbox for debugging purposes.
 * Useful for seeing what's happening with the Claude agent.
 *
 * Request body:
 * - sandboxId: string - E2B sandbox ID
 * - logFile: string (optional) - Log file path (default: /home/user/claude-agent.log)
 * - lines: number (optional) - Number of lines to read (default: 100)
 *
 * Response:
 * - logs: string - Log file contents
 * - success: boolean
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { sandboxId, logFile, lines } = await request.json();

    if (!sandboxId) {
      return NextResponse.json(
        { error: "Missing required field: sandboxId" },
        { status: 400 }
      );
    }

    const filePath = logFile || "/home/user/claude-agent.log";
    const numLines = lines || 100;

    console.log(`[API] Reading logs from sandbox: ${sandboxId}`);
    console.log(`[API] Log file: ${filePath}`);
    console.log(`[API] Lines: ${numLines}`);

    // Connect to sandbox
    const { Sandbox } = await import("e2b");
    let sandbox;

    try {
      sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      });
      console.log(`[API] ✓ Connected to sandbox: ${sandboxId}`);
    } catch (error) {
      console.error(`[API] Failed to connect to sandbox:`, error);
      return NextResponse.json(
        { error: "Sandbox not found or expired", success: false },
        { status: 404 }
      );
    }

    // Read log file
    try {
      const result = await sandbox.commands.run(
        `tail -n ${numLines} ${filePath} 2>/dev/null || echo "Log file not found"`,
        { timeoutMs: 5000 }
      );

      if (result.exitCode !== 0 && !result.stdout) {
        return NextResponse.json({
          logs: "",
          error: "Log file not found or empty",
          success: false,
        });
      }

      console.log(`[API] ✓ Read ${result.stdout.split("\n").length} lines from log file`);

      return NextResponse.json({
        logs: result.stdout,
        success: true,
      });
    } catch (error) {
      console.error(`[API] Failed to read log file:`, error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to read logs",
          success: false,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] Error reading sandbox logs:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read sandbox logs",
        success: false,
      },
      { status: 500 }
    );
  }
}
