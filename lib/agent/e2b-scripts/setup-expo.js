/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * E2B Script: Set Up Expo Project in Sandbox
 *
 * This script runs INSIDE E2B sandbox and sets up an Expo project:
 * 1. Clones the Expo template from GitHub
 * 2. Installs npm dependencies
 * 3. Installs @expo/ngrok globally
 * 4. Starts Expo with tunnel mode
 * 5. Generates QR code for the Expo URL
 * 6. Posts expo_url + qr_code to Supabase
 * 7. Sends progress messages to chat
 * 8. Starts Claude agent after setup is complete
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for bypassing RLS
 * - CLAUDE_CODE_OAUTH_TOKEN: OAuth token for Claude CLI
 * - PROJECT_ID: Project ID for linking to database
 * - USER_ID: User ID for session tracking
 * - SANDBOX_ID: E2B sandbox ID
 * - E2B_HOSTNAME: E2B public hostname (for Expo URL)
 * - REPO_URL: GitHub repo URL (default: papay0/appily-expo-go-template)
 * - PROJECT_DIR: Target directory (default: /home/user/project)
 * - USER_PROMPT: Initial prompt for Claude agent
 */

const { spawn, execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { initLogger, logOperation } = require('/home/user/e2b-logger.js');

// Main async function
(async function main() {

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
const PROJECT_ID = process.env.PROJECT_ID;
const USER_ID = process.env.USER_ID;
const SANDBOX_ID = process.env.SANDBOX_ID;
const E2B_HOSTNAME = process.env.E2B_HOSTNAME;
const REPO_URL = process.env.REPO_URL || 'https://github.com/papay0/appily-expo-go-template';
const PROJECT_DIR = process.env.PROJECT_DIR || '/home/user/project';
const USER_PROMPT = process.env.USER_PROMPT;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[Setup] ERROR: Missing Supabase credentials');
  process.exit(1);
}

if (!PROJECT_ID || !USER_ID) {
  console.error('[Setup] ERROR: Missing PROJECT_ID or USER_ID');
  process.exit(1);
}

if (!E2B_HOSTNAME) {
  console.error('[Setup] ERROR: Missing E2B_HOSTNAME');
  process.exit(1);
}

console.log('[Setup] Starting Expo project setup');
console.log(`[Setup] Project ID: ${PROJECT_ID}`);
console.log(`[Setup] Sandbox ID: ${SANDBOX_ID}`);
console.log(`[Setup] Repository: ${REPO_URL}`);
console.log(`[Setup] Target directory: ${PROJECT_DIR}`);

// Initialize Supabase client with service role key
let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Test connection
  const { error: testError } = await supabase.from('projects').select('id').limit(1);
  if (testError) {
    console.error('[Setup] ✗ Supabase connection test failed:', testError.message);
    process.exit(1);
  }

  // Broadcast initial setup context once Supabase client is ready
  await sendSystemMessage(`[Setup] Repository: ${REPO_URL}`, 'info', { log: false });
  await sendSystemMessage(`[Setup] Target directory: ${PROJECT_DIR}`, 'info', { log: false });
  await sendSystemMessage('[Setup] ✓ Supabase client created');
  await sendSystemMessage('[Setup] ✓ Supabase connection verified');

  // Initialize logger for operational logs
  initLogger(supabase, PROJECT_ID, null);
} catch (error) {
  console.error('[Setup] ✗ Failed to create Supabase client:', error.message);
  process.exit(1);
}

/**
 * Send system message to chat
 */
async function sendSystemMessage(message, type = 'info', options = {}) {
  const formattedMessage = message.startsWith('[Setup]') ? message : `[Setup] ${message}`;
  const shouldLog = options.log ?? true;

  if (shouldLog) {
    console.log(formattedMessage);
  }
  try {
    await supabase.from('agent_events').insert({
      project_id: PROJECT_ID,
      session_id: null, // Pre-session message
      event_type: 'system',
      event_data: {
        type: 'system',
        subtype: type,
        message: formattedMessage,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Setup] Failed to send system message:', error.message);
  }
}

/**
 * Update project status in database
 */
async function updateProjectStatus(status, updates = {}) {
  try {
    await supabase
      .from('projects')
      .update({
        e2b_sandbox_status: status,
        ...updates,
      })
      .eq('id', PROJECT_ID);
    const statusMessage = `[Setup] ✓ Project status updated: ${status}`;
    await sendSystemMessage(statusMessage);
  } catch (error) {
    console.error('[Setup] Failed to update project status:', error.message);
  }
}

// Start setup process
try {
  await sendSystemMessage('[Setup] 💬 🔧 Creating development environment...');
  await updateProjectStatus('starting');

  // Step 0: Check for existing R2 snapshots
  console.log('[Setup] Step 0: Checking for existing R2 snapshots...');
  await sendSystemMessage('[Setup] 💬 📦 Checking for saved project...');

  const { data: snapshots } = await supabase
    .from('project_snapshots')
    .select('r2_path, version, created_at, file_count')
    .eq('project_id', PROJECT_ID)
    .order('version', { ascending: false })
    .limit(1);

  let restoredFromR2 = false;

  if (snapshots && snapshots.length > 0) {
    // Restore from R2
    const latestSnapshot = snapshots[0];
    console.log(`[Setup] ✓ Found existing snapshot v${latestSnapshot.version} (${latestSnapshot.file_count} files)`);
    await sendSystemMessage(`[Setup] 💬 📦 Restoring from saved version ${latestSnapshot.version}...`);

    try {
      // Get R2 credentials from environment
      const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
      const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
      const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
      const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

      if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
        throw new Error('R2 credentials not configured');
      }

      // Install AWS SDK if not already installed
      console.log('[Setup] Installing AWS SDK for R2...');
      const awsInstall = spawn('sh', ['-c', 'npm list @aws-sdk/client-s3 2>/dev/null || npm install @aws-sdk/client-s3'], {
        cwd: '/home/user',
        stdio: 'inherit',
      });

      await new Promise((resolve) => {
        awsInstall.on('close', resolve);
      });

      // Use shared R2 restore module
      const { restoreFromR2 } = require('/home/user/r2-restore.js');

      console.log(`[Setup] Restoring from R2 path: ${latestSnapshot.r2_path}`);
      const result = await restoreFromR2({
        r2Path: latestSnapshot.r2_path,
        targetDir: PROJECT_DIR,
        accountId: R2_ACCOUNT_ID,
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
        bucketName: R2_BUCKET_NAME,
        onProgress: (file, index, total) => {
          console.log(`[Setup] ✓ Restored [${index}/${total}]: ${file}`);
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown restore error');
      }

      console.log(`[Setup] ✓ Restored ${result.fileCount} files from R2`);
      await sendSystemMessage(`[Setup] 💬 ✓ Restored ${result.fileCount} files from saved version`);
      restoredFromR2 = true;

    } catch (error) {
      console.error('[Setup] Failed to restore from R2:', error.message);
      await sendSystemMessage('[Setup] ⚠️ Restore failed, falling back to template...');
      restoredFromR2 = false;
    }
  }

  // Step 1: Clone GitHub repository (only if not restored from R2)
  if (!restoredFromR2) {
    await sendSystemMessage('[Setup] 💬 📦 Cloning Expo template repository...');
    const step1Message = `[Setup] Step 1: Cloning repository from ${REPO_URL}...`;
    await sendSystemMessage(step1Message);

    // Parse GitHub URL
    const urlMatch = REPO_URL.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!urlMatch) {
      throw new Error('Invalid GitHub URL format');
    }

    const [, owner, repo] = urlMatch;
    const repoName = repo.replace(/\.git$/, '');
    const tarballUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/main.tar.gz`;

    const downloadMessage = `[Setup] Downloading from: ${tarballUrl}`;
    await sendSystemMessage(downloadMessage);

    const cloneResult = spawn('sh', ['-c', `mkdir -p ${PROJECT_DIR} && cd ${PROJECT_DIR} && curl -L ${tarballUrl} | tar xz --strip-components=1`], {
      stdio: 'inherit',
    });

    await new Promise((resolve, reject) => {
      cloneResult.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Clone failed with exit code ${code}`));
        } else {
          resolve();
        }
      });
      cloneResult.on('error', reject);
    });

    console.log('[Setup] ✓ Repository cloned successfully');
  } else {
    console.log('[Setup] ✓ Skipping template clone (restored from R2)');
  }

  // Step 2: Install npm dependencies
  await sendSystemMessage('[Setup] 💬 📦 Installing dependencies...');
  console.log('[Setup] Step 2: Installing npm dependencies...');

  const installStartTime = Date.now();
  const installResult = spawn('sh', ['-c', `cd ${PROJECT_DIR} && npm install`], {
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    installResult.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm install failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
    installResult.on('error', reject);
  });

  const installDuration = ((Date.now() - installStartTime) / 1000).toFixed(2);
  console.log(`[Setup] ✓ npm install completed in ${installDuration}s`);

  // Step 3: Install @expo/ngrok globally
  await sendSystemMessage('[Setup] 💬 🌐 Setting up Expo tunnel...');
  console.log('[Setup] Step 3: Installing @expo/ngrok globally...');

  const ngrokInstall = spawn('sh', ['-c', 'npm install -g @expo/ngrok@^4.1.0'], {
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    ngrokInstall.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`@expo/ngrok install failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
    ngrokInstall.on('error', reject);
  });

  console.log('[Setup] ✓ @expo/ngrok installed');

  // Step 3.5: Verify tmux is available (pre-installed in E2B template)
  await logOperation('tmux_check', 'started', '[Setup] 💬 🔍 Checking tmux availability...');
  console.log('[Setup] Step 3.5: Verifying tmux...');

  const checkTmux = spawn('sh', ['-c', 'which tmux'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let tmuxPath = '';
  checkTmux.stdout.on('data', (data) => {
    tmuxPath = data.toString().trim();
  });

  await new Promise((resolve) => {
    checkTmux.on('close', resolve);
  });

  const tmuxAvailable = !!tmuxPath;

  if (tmuxAvailable) {
    console.log(`[Setup] ✓ tmux found at: ${tmuxPath}`);
    await logOperation('tmux_check', 'completed', '[Setup] ✓ tmux is available');
  } else {
    console.error('[Setup] ✗ tmux not found (should be pre-installed in template)');
    await logOperation(
      'tmux_check',
      'failed',
      '[Setup] ✗ tmux not found - E2B template may need rebuilding',
      { error: 'tmux not available' }
    );
  }

  // Step 3.6: Fix file permissions before starting Expo
  console.log('[Setup] Step 3.6: Fixing file permissions...');
  try {
    execSync(`chmod -R u+rw "${PROJECT_DIR}" 2>/dev/null || true`, { timeout: 30000 });
    console.log('[Setup] ✓ File permissions fixed');
  } catch (permError) {
    console.warn('[Setup] Warning: Could not fix permissions:', permError.message);
  }

  // Step 4: Start Expo with tunnel mode
  await sendSystemMessage('[Setup] 💬 🚀 Starting Expo Metro bundler...');
  console.log('[Setup] Step 4: Starting Expo with tunnel mode...');

  const expoUrl = `exp://${E2B_HOSTNAME}`;
  console.log(`[Setup] Expo URL will be: ${expoUrl}`);

  // Fail if tmux is not available (required for auto-reload)
  if (!tmuxAvailable) {
    const errorMsg = '[Setup] ✗ tmux is required for Metro auto-reload but installation failed';
    console.error(errorMsg);
    await logOperation('metro_start', 'failed', errorMsg, { error: 'tmux not available' });
    throw new Error('tmux installation failed - cannot start Metro with auto-reload support');
  }

  // Start Expo in tmux session for programmatic control (enables hot reload triggers)
  await logOperation('metro_start', 'started', '[Setup] 🚀 Starting Metro bundler in tmux session...');
  const expoProcess = spawn('tmux', [
    'new-session',
    '-d',
    '-s',
    'metro',
    `cd ${PROJECT_DIR} && NODE_OPTIONS="--max-old-space-size=3072" npx expo start --tunnel`
  ], {
    stdio: 'ignore',
    detached: true,
  });

  expoProcess.unref(); // Let it run independently

  await logOperation('metro_start', 'progress', '[Setup] ⏳ Metro process spawned in tmux, waiting for bundler to be ready...');
  console.log('[Setup] ✓ Expo Metro started in tmux session "metro"');

  // Wait for Expo to be ready (check tmux pane output)
  console.log('[Setup] Waiting for Expo to be ready (60s timeout)...');
  const startTime = Date.now();
  const maxWait = 60000; // 60 seconds

  let expoReady = false;
  while (!expoReady && (Date.now() - startTime) < maxWait) {
    // Check if Metro is ready by capturing tmux pane content
    const checkLogs = spawn('sh', ['-c', 'tmux capture-pane -t metro -p 2>/dev/null || echo ""'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let logOutput = '';
    checkLogs.stdout.on('data', (data) => {
      logOutput += data.toString();
    });

    await new Promise((resolve) => {
      checkLogs.on('close', resolve);
    });

    if (logOutput.includes('Metro') || logOutput.includes('Tunnel ready') || logOutput.includes('exp://')) {
      expoReady = true;
      await logOperation('metro_start', 'completed', '[Setup] ✓ Expo Metro bundler is ready!');
      console.log('[Setup] ✓ Expo is ready!');
    } else {
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!expoReady) {
    await logOperation('metro_start', 'failed', '[Setup] ⚠️ Metro readiness not confirmed within 60s, but proceeding...', { error: 'Timeout waiting for Metro' });
    console.warn('[Setup] Warning: Expo readiness not confirmed within 60s, but proceeding...');
  }

  // Step 5: Generate QR code
  console.log('[Setup] Step 5: Generating QR code...');

  // Install qrcode package
  const qrcodeInstall = spawn('sh', ['-c', 'npm install qrcode'], {
    cwd: '/home/user',
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    qrcodeInstall.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`qrcode install failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
    qrcodeInstall.on('error', reject);
  });

  // Generate QR code
  const QRCode = require('qrcode');
  const qrCodeDataUrl = await QRCode.toDataURL(expoUrl, {
    width: 512,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    type: 'image/png',
  });

  console.log('[Setup] ✓ QR code generated');

  // Step 6: Update database with expo_url and qr_code
  console.log('[Setup] Step 6: Updating database...');

  await updateProjectStatus('ready', {
    expo_url: expoUrl,
    qr_code: qrCodeDataUrl,
    e2b_sandbox_created_at: new Date().toISOString(),
  });

  await sendSystemMessage('[Setup] ✓ Expo Metro bundler started', 'success');
  await sendSystemMessage('[Setup] ✓ Ready! Scan the QR code to preview your app on your phone.', 'success');

  console.log('[Setup] ✓ Setup complete!');
  console.log(`[Setup] Expo URL: ${expoUrl}`);

  // Step 7: Start Claude agent if prompt provided
  if (CLAUDE_CODE_OAUTH_TOKEN && USER_PROMPT) {
    await sendSystemMessage('[Setup] 💬 🤖 Starting AI agent to build your app...');
    console.log('[Setup] Step 7: Starting Claude agent...');

    // Note: The stream-to-supabase.js script is uploaded by Vercel's executeSetupInE2B function
    // It should already be present at /home/user/stream-to-supabase.js
    // If not, the setup script was called incorrectly

    // Check if agent script exists
    const checkScript = spawn('sh', ['-c', 'test -f /home/user/stream-to-supabase.js && echo "exists" || echo "missing"'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let scriptExists = false;
    checkScript.stdout.on('data', (data) => {
      scriptExists = data.toString().trim() === 'exists';
    });

    await new Promise((resolve) => {
      checkScript.on('close', resolve);
    });

    if (!scriptExists) {
      console.error('[Setup] ✗ stream-to-supabase.js not found! Cannot start agent.');
      console.error('[Setup] The setup script should be uploaded before calling this script.');
      await sendSystemMessage('[Setup] ✗ Agent script missing - cannot start AI agent', 'error');
    } else {
      // Start the Claude agent script
      const agentScript = '/home/user/stream-to-supabase.js';
      const agentProcess = spawn('sh', ['-c', `nohup node ${agentScript} > /home/user/claude-agent.log 2>&1 & echo $!`], {
        cwd: PROJECT_DIR,
        env: {
          ...process.env,
          SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
          CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_CODE_OAUTH_TOKEN,
          PROJECT_ID: PROJECT_ID,
          USER_ID: USER_ID,
          USER_PROMPT: USER_PROMPT,
          WORKING_DIRECTORY: PROJECT_DIR,
          // R2 credentials for direct E2B saves
          R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
          R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
          R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
        },
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      let agentPid = '';
      agentProcess.stdout.on('data', (data) => {
        agentPid = data.toString().trim();
      });

      await new Promise((resolve) => {
        agentProcess.on('close', resolve);
      });

      if (agentPid) {
        console.log(`[Setup] ✓ Claude agent started (PID: ${agentPid})`);
      }
    }
  } else {
    console.log('[Setup] No Claude agent prompt provided, skipping agent start');
  }

  console.log('[Setup] ✓ All setup steps completed successfully');
  process.exit(0);

} catch (error) {
  console.error('[Setup] ✗ Setup failed:', error.message);
  console.error('[Setup] Stack trace:', error.stack);

  await sendSystemMessage(
    `[Setup] ✗ Setup failed: ${error.message}`,
    'error'
  );

  await updateProjectStatus('error');

  process.exit(1);
}

})().catch((error) => {
  console.error('[Setup] ✗ FATAL ERROR:', error.message);
  console.error('[Setup] Stack trace:', error.stack);
  process.exit(1);
});
