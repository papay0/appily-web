/**
 * Debug Route: Test E2B Script Execution
 *
 * GET /api/debug/test-script?sandboxId=xxx
 *
 * Creates and runs a minimal test script in E2B to verify:
 * 1. Node.js works
 * 2. File uploads work
 * 3. @supabase/supabase-js works
 * 4. Environment variables work
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

    console.log(`[Debug] Testing script execution in sandbox: ${sandboxId}`);

    // Connect to sandbox
    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });

    const results: any = {};

    // Test 1: Simple Node.js script
    console.log(`[Debug] Test 1: Simple Node.js script...`);
    const simpleScript = `
console.log('Hello from E2B!');
console.log('Node version:', process.version);
console.log('ENV vars passed:', process.env.TEST_VAR);
process.exit(0);
`;

    await sandbox.files.write("/home/user/test-simple.js", simpleScript);
    const simpleTest = await sandbox.commands.run("node /home/user/test-simple.js", {
      envs: { TEST_VAR: "it-works" },
      timeoutMs: 5000,
    });

    results.simpleScript = {
      stdout: simpleTest.stdout,
      stderr: simpleTest.stderr,
      exitCode: simpleTest.exitCode,
    };
    console.log(`[Debug] Simple script:`, results.simpleScript);

    // Test 2: Supabase connection
    console.log(`[Debug] Test 2: Supabase connection test...`);
    const supabaseScript = `
const { createClient } = require('@supabase/supabase-js');

console.log('[Test] Creating Supabase client...');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
console.log('[Test] ✓ Client created');

(async () => {
  try {
    console.log('[Test] Testing connection...');
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('[Test] ✗ Connection failed:', error.message);
      process.exit(1);
    }
    console.log('[Test] ✓ Connection successful');
    process.exit(0);
  } catch (err) {
    console.error('[Test] ✗ Error:', err.message);
    process.exit(1);
  }
})();
`;

    await sandbox.files.write("/home/user/test-supabase.js", supabaseScript);

    // First ensure @supabase/supabase-js is installed
    await sandbox.commands.run(
      "npm list @supabase/supabase-js || npm install @supabase/supabase-js",
      { cwd: "/home/user", timeoutMs: 30000 }
    );

    const supabaseTest = await sandbox.commands.run("node /home/user/test-supabase.js", {
      envs: {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      timeoutMs: 10000,
    });

    results.supabaseScript = {
      stdout: supabaseTest.stdout,
      stderr: supabaseTest.stderr,
      exitCode: supabaseTest.exitCode,
    };
    console.log(`[Debug] Supabase script:`, results.supabaseScript);

    // Test 3: Test child_process.spawn
    console.log(`[Debug] Test 3: Testing child_process.spawn...`);
    const spawnScript = `
const { spawn } = require('child_process');

console.log('[Test] Spawning echo command...');
const proc = spawn('echo', ['Hello from spawn!']);

proc.stdout.on('data', (data) => {
  console.log('[Test] stdout:', data.toString().trim());
});

proc.stderr.on('data', (data) => {
  console.error('[Test] stderr:', data.toString().trim());
});

proc.on('close', (code) => {
  console.log('[Test] Process exited with code:', code);
  process.exit(code);
});

proc.on('error', (err) => {
  console.error('[Test] Spawn error:', err.message);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('[Test] Timeout!');
  proc.kill();
  process.exit(1);
}, 5000);
`;

    await sandbox.files.write("/home/user/test-spawn.js", spawnScript);
    const spawnTest = await sandbox.commands.run("node /home/user/test-spawn.js", {
      timeoutMs: 10000,
    });

    results.spawnScript = {
      stdout: spawnTest.stdout,
      stderr: spawnTest.stderr,
      exitCode: spawnTest.exitCode,
    };
    console.log(`[Debug] Spawn script:`, results.spawnScript);

    return NextResponse.json({
      success: true,
      sandboxId,
      results,
      summary: {
        nodeWorks: results.simpleScript.exitCode === 0,
        envVarsWork: results.simpleScript.stdout.includes("it-works"),
        supabaseWorks: results.supabaseScript.exitCode === 0,
        spawnWorks: results.spawnScript.exitCode === 0,
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
