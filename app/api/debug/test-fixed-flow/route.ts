/**
 * Debug Route: Test FIXED E2B → Supabase Flow
 *
 * GET /api/debug/test-fixed-flow?sandboxId=xxx
 *
 * Tests the complete flow with the FIXED stream-to-supabase.js script
 * (stdio: ignore stdin, explicit HOME/PATH, better debugging)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sandboxId = searchParams.get("sandboxId");

    if (!sandboxId) {
      return NextResponse.json(
        { error: "Missing sandboxId parameter" },
        { status: 400 }
      );
    }

    console.log(`[Debug] Testing FIXED flow in sandbox: ${sandboxId}`);

    const results: any = {
      steps: [],
      fixes_applied: [
        "stdio: ['ignore', 'pipe', 'pipe'] to prevent stdin blocking",
        "Explicit HOME and PATH environment variables",
        "Better debugging with chunk counters",
        "60-second safety timeout",
        "Exit event handler for early feedback"
      ]
    };

    // Connect to sandbox
    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    results.steps.push({ step: "connect", status: "success", sandboxId });

    // Create a test project ID (must be a valid UUID)
    const { randomUUID } = await import("crypto");
    const testProjectId = randomUUID();
    console.log(`[Debug] Using test project ID: ${testProjectId}`);
    results.testProjectId = testProjectId;

    // Create a temporary test project in the database
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .limit(1)
      .single();

    if (!userData) {
      throw new Error("No users found in database - cannot create test project");
    }

    await supabaseAdmin.from("projects").insert({
      id: testProjectId,
      name: "Test Project - FIXED (will be deleted)",
      user_id: userData.id,
    });
    results.steps.push({ step: "create_test_project", status: "success" });

    // Upload the FIXED script
    console.log(`[Debug] Uploading FIXED stream-to-supabase.js...`);
    const scriptPath = join(process.cwd(), "lib/agent/e2b-scripts/stream-to-supabase.js");
    const scriptContent = readFileSync(scriptPath, "utf-8");

    await sandbox.files.write("/home/user/test-fixed-stream.js", scriptContent);
    results.steps.push({
      step: "upload_fixed_script",
      status: "success",
      scriptSize: scriptContent.length,
      scriptContainsStdioFix: scriptContent.includes("stdio: ['ignore', 'pipe', 'pipe']"),
    });

    // Install @supabase/supabase-js if needed
    console.log(`[Debug] Installing dependencies...`);
    await sandbox.commands.run(
      "npm list @supabase/supabase-js || npm install @supabase/supabase-js",
      { cwd: "/home/user", timeoutMs: 30000 }
    );
    results.steps.push({ step: "install_deps", status: "success" });

    // Run the script in background with a simple prompt
    console.log(`[Debug] Running FIXED script in background...`);
    const testPrompt = "Say hello";

    const startResult = await sandbox.commands.run(
      `nohup node /home/user/test-fixed-stream.js > /home/user/test-fixed.log 2>&1 & echo $!`,
      {
        cwd: "/home/user/project",
        envs: {
          SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN!,
          PROJECT_ID: testProjectId,
          USER_ID: userData.id,
          USER_PROMPT: testPrompt,
          WORKING_DIRECTORY: "/home/user/project",
        },
        timeoutMs: 5000,
      }
    );

    const pid = parseInt(startResult.stdout.trim());
    results.steps.push({
      step: "start_fixed_script",
      status: "success",
      pid,
    });
    console.log(`[Debug] FIXED script started with PID: ${pid}`);

    // Wait for Claude to respond (20 seconds to be safe)
    console.log(`[Debug] Waiting 20 seconds for Claude to respond...`);
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Check the log file
    console.log(`[Debug] Reading log file...`);
    const logResult = await sandbox.commands.run(
      "cat /home/user/test-fixed.log",
      { timeoutMs: 5000 }
    );
    results.logOutput = logResult.stdout;
    results.steps.push({
      step: "read_logs",
      status: "success",
      logLines: logResult.stdout.split("\n").length,
    });

    // Parse log for key indicators
    const logIndicators = {
      processSpawned: logResult.stdout.includes("Claude process spawned, PID:"),
      firstStdoutChunk: logResult.stdout.includes("Received first stdout chunk"),
      sessionInitialized: logResult.stdout.includes("Session initialized:"),
      timeout: logResult.stdout.includes("TIMEOUT: No output"),
      processExited: logResult.stdout.includes("Claude process exited:"),
      processClosed: logResult.stdout.includes("Claude process closed"),
    };
    results.logAnalysis = logIndicators;

    // Check if the process is still running
    console.log(`[Debug] Checking if script is still running...`);
    const psResult = await sandbox.commands.run(
      `ps -p ${pid} -o pid,etime,stat,cmd || echo "Process not running"`,
      { timeoutMs: 5000 }
    );
    results.processStatus = psResult.stdout;

    // Check if events were inserted into Supabase
    console.log(`[Debug] Checking Supabase for events...`);
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("agent_events")
      .select("*")
      .eq("project_id", testProjectId)
      .order("created_at", { ascending: true });

    if (eventsError) {
      console.error("[Debug] Failed to query events:", eventsError);
      results.steps.push({
        step: "check_supabase",
        status: "error",
        error: eventsError.message,
      });
    } else {
      console.log(`[Debug] Found ${events?.length || 0} events in Supabase`);
      results.steps.push({
        step: "check_supabase",
        status: "success",
        eventCount: events?.length || 0,
      });
      results.events = events?.map((e) => ({
        event_type: e.event_type,
        session_id: e.session_id,
        created_at: e.created_at,
      }));
    }

    // Check if session was created
    console.log(`[Debug] Checking for session...`);
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from("agent_sessions")
      .select("*")
      .eq("project_id", testProjectId);

    if (sessionsError) {
      console.error("[Debug] Failed to query sessions:", sessionsError);
      results.steps.push({
        step: "check_sessions",
        status: "error",
        error: sessionsError.message,
      });
    } else {
      console.log(`[Debug] Found ${sessions?.length || 0} sessions`);
      results.steps.push({
        step: "check_sessions",
        status: "success",
        sessionCount: sessions?.length || 0,
      });
      results.sessions = sessions?.map((s) => ({
        session_id: s.session_id,
        status: s.status,
        created_at: s.created_at,
      }));
    }

    // Clean up test data
    console.log(`[Debug] Cleaning up test data...`);
    await supabaseAdmin
      .from("agent_events")
      .delete()
      .eq("project_id", testProjectId);
    await supabaseAdmin
      .from("agent_sessions")
      .delete()
      .eq("project_id", testProjectId);
    await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", testProjectId);
    results.steps.push({ step: "cleanup", status: "success" });

    // Summary
    const allStepsSucceeded = results.steps.every(
      (s: any) => s.status === "success"
    );
    const eventsStored = (events?.length || 0) > 0;
    const sessionsCreated = (sessions?.length || 0) > 0;

    return NextResponse.json({
      success: allStepsSucceeded && eventsStored && sessionsCreated,
      results,
      summary: {
        scriptWorked: allStepsSucceeded,
        eventsStoredInSupabase: eventsStored,
        sessionsCreated: sessionsCreated,
        totalEvents: events?.length || 0,
        totalSessions: sessions?.length || 0,
        fixVerified: logIndicators.processSpawned && logIndicators.firstStdoutChunk,
      },
    });
  } catch (error) {
    console.error("[Debug] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Test failed",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
