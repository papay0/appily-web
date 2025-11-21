/**
 * Debug Route: Test Claude CLI in E2B
 *
 * GET /api/debug/test-claude?sandboxId=xxx
 *
 * Tests Claude CLI execution in foreground mode to see actual output.
 * This helps debug why background mode isn't producing events.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

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

    console.log(`[Debug] Testing Claude CLI in sandbox: ${sandboxId}`);

    // Connect to sandbox
    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });

    console.log(`[Debug] ✓ Connected to sandbox`);

    const results: any = {};

    // Test 1: Check if Claude CLI is available
    console.log(`[Debug] Test 1: Checking Claude CLI...`);
    const versionTest = await sandbox.commands.run("which claude && claude --version", {
      timeoutMs: 10000,
    });
    results.claudeVersion = {
      stdout: versionTest.stdout,
      stderr: versionTest.stderr,
      exitCode: versionTest.exitCode,
    };
    console.log(`[Debug] Claude CLI test:`, results.claudeVersion);

    // Test 2: Check environment variable
    console.log(`[Debug] Test 2: Checking CLAUDE_CODE_OAUTH_TOKEN...`);
    const envTest = await sandbox.commands.run(
      "echo $CLAUDE_CODE_OAUTH_TOKEN | head -c 20",
      {
        timeoutMs: 5000,
        envs: { CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN! }
      }
    );
    results.oauthToken = {
      present: envTest.stdout.trim().length > 0,
      preview: envTest.stdout.substring(0, 20) + "...",
    };
    console.log(`[Debug] OAuth token test:`, results.oauthToken);

    // Test 3: Run Claude with a simple prompt (FOREGROUND, 30 second timeout)
    // Correct syntax: -p flag first, then options, then prompt as positional arg at the end
    console.log(`[Debug] Test 3: Running Claude with simple prompt...`);
    try {
      const claudeTest = await sandbox.commands.run(
        'claude -p --output-format stream-json --verbose --dangerously-skip-permissions "Say hello"',
        {
          cwd: "/home/user/project",
          envs: { CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN! },
          timeoutMs: 30000, // 30 seconds
          onExit: false, // Don't throw on non-zero exit
        }
      );

      results.claudeExecution = {
        stdout: claudeTest.stdout,
        stderr: claudeTest.stderr,
        exitCode: claudeTest.exitCode,
        stdoutLines: claudeTest.stdout.split('\n').length,
        stderrLines: claudeTest.stderr.split('\n').length,
      };
    } catch (error: any) {
      // Capture error but continue
      results.claudeExecution = {
        error: error.message,
        stdout: error.result?.stdout || '',
        stderr: error.result?.stderr || '',
        exitCode: error.result?.exitCode || -1,
        stdoutLines: (error.result?.stdout || '').split('\n').length,
        stderrLines: (error.result?.stderr || '').split('\n').length,
      };
    }
    console.log(`[Debug] Claude execution test:`, {
      exitCode: results.claudeExecution.exitCode,
      stdoutLines: results.claudeExecution.stdoutLines,
      stderrLines: results.claudeExecution.stderrLines,
      hasError: !!results.claudeExecution.error,
    });

    // Test 4: Check if background script is still running
    console.log(`[Debug] Test 4: Checking background script status...`);
    const psTest = await sandbox.commands.run(
      "ps aux | grep stream-to-supabase | grep -v grep",
      { timeoutMs: 5000 }
    );
    results.backgroundScript = {
      running: psTest.exitCode === 0,
      processes: psTest.stdout,
    };
    console.log(`[Debug] Background script test:`, results.backgroundScript);

    // Test 5: Read the log file
    console.log(`[Debug] Test 5: Reading log file...`);
    const logTest = await sandbox.commands.run(
      "tail -n 100 /home/user/claude-agent.log 2>&1",
      { timeoutMs: 5000 }
    );
    results.logFile = {
      content: logTest.stdout,
      lines: logTest.stdout.split('\n').length,
    };
    console.log(`[Debug] Log file has ${results.logFile.lines} lines`);

    return NextResponse.json({
      success: true,
      sandboxId,
      results,
      summary: {
        claudeAvailable: results.claudeVersion.exitCode === 0,
        oauthTokenSet: results.oauthToken.present,
        claudeProducedOutput: results.claudeExecution.stdoutLines > 1,
        backgroundScriptRunning: results.backgroundScript.running,
        logFileLines: results.logFile.lines,
      }
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
