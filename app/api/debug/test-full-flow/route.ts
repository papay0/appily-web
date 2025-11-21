/**
 * Debug Route: Test Full E2B → Supabase Flow
 *
 * GET /api/debug/test-full-flow?sandboxId=xxx
 *
 * Tests the complete flow:
 * 1. Upload stream-to-supabase.js script
 * 2. Run it with a test prompt
 * 3. Wait for events to appear in Supabase
 * 4. Verify events were stored correctly
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

    console.log(`[Debug] Testing full flow in sandbox: ${sandboxId}`);

    const results: any = {
      steps: [],
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

    // Create a temporary test project in the database so foreign key constraints work
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
      name: "Test Project (will be deleted)",
      user_id: userData.id,
    });
    results.steps.push({ step: "create_test_project", status: "success" });

    // Step 1: Upload the actual script
    console.log(`[Debug] Step 1: Uploading stream-to-supabase.js...`);
    const scriptPath = join(process.cwd(), "lib/agent/e2b-scripts/stream-to-supabase.js");
    const scriptContent = readFileSync(scriptPath, "utf-8");

    await sandbox.files.write("/home/user/test-stream.js", scriptContent);
    results.steps.push({
      step: "upload_script",
      status: "success",
      scriptSize: scriptContent.length,
    });

    // Step 2: Install @supabase/supabase-js if needed
    console.log(`[Debug] Step 2: Installing dependencies...`);
    await sandbox.commands.run(
      "npm list @supabase/supabase-js || npm install @supabase/supabase-js",
      { cwd: "/home/user", timeoutMs: 30000 }
    );
    results.steps.push({ step: "install_deps", status: "success" });

    // Step 3: Run the script in background with a simple prompt
    console.log(`[Debug] Step 3: Running script in background...`);
    const testPrompt = "Say hello and exit";

    const startResult = await sandbox.commands.run(
      `nohup node /home/user/test-stream.js > /home/user/test-stream.log 2>&1 & echo $!`,
      {
        cwd: "/home/user/project",
        envs: {
          SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN!,
          PROJECT_ID: testProjectId,
          USER_ID: "test-user",
          USER_PROMPT: testPrompt,
          WORKING_DIRECTORY: "/home/user/project",
        },
        timeoutMs: 5000,
      }
    );

    const pid = parseInt(startResult.stdout.trim());
    results.steps.push({
      step: "start_script",
      status: "success",
      pid,
    });
    console.log(`[Debug] Script started with PID: ${pid}`);

    // Step 4: Wait for script to process (give Claude time to respond)
    console.log(`[Debug] Step 4: Waiting for Claude to respond (15 seconds)...`);
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // Step 5: Check the log file
    console.log(`[Debug] Step 5: Reading log file...`);
    const logResult = await sandbox.commands.run(
      "cat /home/user/test-stream.log",
      { timeoutMs: 5000 }
    );
    results.logOutput = logResult.stdout;
    results.steps.push({
      step: "read_logs",
      status: "success",
      logLines: logResult.stdout.split("\n").length,
    });

    // Step 5.5: Check if the process is still running
    console.log(`[Debug] Step 5.5: Checking if script is still running...`);
    const psResult = await sandbox.commands.run(
      `ps -p ${pid} -o pid,etime,stat,cmd || echo "Process not running"`,
      { timeoutMs: 5000 }
    );
    results.processStatus = psResult.stdout;

    // Step 5.6: Try to see if Claude produced any output to stderr
    console.log(`[Debug] Step 5.6: Checking for any Claude stderr output...`);
    const stderrCheck = await sandbox.commands.run(
      "tail -n 50 /home/user/test-stream.log 2>&1",
      { timeoutMs: 5000 }
    );
    results.fullLog = stderrCheck.stdout;

    // Step 6: Check if events were inserted into Supabase
    console.log(`[Debug] Step 6: Checking Supabase for events...`);
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

    // Step 7: Check if session was created
    console.log(`[Debug] Step 7: Checking for session...`);
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

    // Step 8: Clean up test data
    console.log(`[Debug] Step 8: Cleaning up test data...`);
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
