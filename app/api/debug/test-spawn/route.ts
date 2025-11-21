/**
 * Debug Route: Test Spawning Claude from Node.js
 *
 * GET /api/debug/test-spawn?sandboxId=xxx
 *
 * Tests if spawning Claude from Node.js works at all.
 * This isolates the problem to see if it's the spawn itself or our script logic.
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

    console.log(`[Debug] Testing Claude spawn in sandbox: ${sandboxId}`);

    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });

    // Create a minimal test script that spawns Claude
    const testScript = `
const { spawn } = require('child_process');

console.log('[Test] Starting minimal Claude spawn test...');
console.log('[Test] CLAUDE_CODE_OAUTH_TOKEN present:', !!process.env.CLAUDE_CODE_OAUTH_TOKEN);

const args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', 'Say hello'];

console.log('[Test] Spawning: claude', args.join(' '));

const claude = spawn('claude', args, {
  cwd: '/home/user/project',
  env: {
    ...process.env,
    CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
    HOME: process.env.HOME || '/home/user',
    PATH: process.env.PATH,
  },
  stdio: ['ignore', 'pipe', 'pipe'], // stdin=ignore, stdout=pipe, stderr=pipe
});

let stdoutData = '';
let stderrData = '';
let eventCount = 0;

claude.stdout.on('data', (data) => {
  stdoutData += data.toString();
  console.log('[Test] stdout chunk:', data.toString().substring(0, 100));
  eventCount++;
});

claude.stderr.on('data', (data) => {
  stderrData += data.toString();
  console.error('[Test] stderr:', data.toString());
});

claude.on('close', (code) => {
  console.log('[Test] Process exited with code:', code);
  console.log('[Test] Total stdout chunks:', eventCount);
  console.log('[Test] Stdout length:', stdoutData.length);
  console.log('[Test] Stderr length:', stderrData.length);

  if (stdoutData.length > 0) {
    console.log('[Test] First 200 chars of stdout:', stdoutData.substring(0, 200));
  }
  if (stderrData.length > 0) {
    console.log('[Test] stderr content:', stderrData);
  }

  process.exit(code);
});

claude.on('error', (error) => {
  console.error('[Test] Spawn error:', error.message);
  process.exit(1);
});

// Timeout after 20 seconds
setTimeout(() => {
  console.log('[Test] Timeout reached after 20 seconds');
  console.log('[Test] Events received so far:', eventCount);
  claude.kill();
  process.exit(1);
}, 20000);
`;

    await sandbox.files.write("/home/user/test-spawn.js", testScript);

    // Run the test script (foreground with timeout)
    const result = await sandbox.commands.run(
      "node /home/user/test-spawn.js",
      {
        cwd: "/home/user",
        envs: {
          CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN!,
        },
        timeoutMs: 30000, // 30 seconds
        onExit: false,
      }
    );

    return NextResponse.json({
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      analysis: {
        claudeProducedOutput: result.stdout.includes("stdout chunk"),
        exitedCleanly: result.exitCode === 0,
        hadErrors: result.stderr.length > 0,
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
