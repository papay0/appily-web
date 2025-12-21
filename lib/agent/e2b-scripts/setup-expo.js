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
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { initLogger, logOperation } = require('/home/user/e2b-logger.js');

// Main async function
(async function main() {

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // For claude-sdk provider
// Vertex AI credentials (required for Gemini - more stable, higher quotas than consumer API)
const GOOGLE_APPLICATION_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
// Use 'global' for newer models like gemini-2.5-pro and gemini-3-pro-preview
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global';
const AI_PROVIDER = process.env.AI_PROVIDER || 'claude';
const PROJECT_ID = process.env.PROJECT_ID;
const USER_ID = process.env.USER_ID;
const SANDBOX_ID = process.env.SANDBOX_ID;
const E2B_HOSTNAME = process.env.E2B_HOSTNAME;
const REPO_URL = process.env.REPO_URL || 'https://github.com/papay0/appily-expo-go-template';
const PROJECT_DIR = process.env.PROJECT_DIR || '/home/user/project';

// For CLI/Gemini: USER_PROMPT contains combined system+user prompt
// For SDK: SYSTEM_PROMPT and USER_MESSAGE are separate (token optimization)
const USER_PROMPT = process.env.USER_PROMPT;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT;
const USER_MESSAGE = process.env.USER_MESSAGE;

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

  // Step 1.5: Inject Appily configuration into app.json
  console.log('[Setup] Step 1.5: Injecting Appily configuration...');
  await sendSystemMessage('[Setup] 💬 ⚙️ Configuring error reporting...');

  try {
    const appJsonPath = `${PROJECT_DIR}/app.json`;

    // Read existing app.json
    const appJsonContent = fs.readFileSync(appJsonPath, 'utf-8');
    const appJson = JSON.parse(appJsonContent);

    // Inject Appily configuration
    appJson.expo = appJson.expo || {};
    appJson.expo.extra = appJson.expo.extra || {};
    appJson.expo.extra.appilyProjectId = PROJECT_ID;
    appJson.expo.extra.appilyApiUrl = 'https://www.appily.dev';

    // Write back
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log('[Setup] ✓ Appily configuration injected into app.json');
  } catch (configError) {
    console.warn('[Setup] Warning: Could not inject Appily config:', configError.message);
    // Non-fatal - continue with setup even if config injection fails
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

  // Step 2.5: Clear Metro cache to prevent stale module resolution
  console.log('[Setup] Step 2.5: Clearing Metro cache...');
  try {
    execSync(`rm -rf "${PROJECT_DIR}/node_modules/.cache" "${PROJECT_DIR}/.expo" /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true`, { timeout: 30000 });
    console.log('[Setup] ✓ Metro cache cleared');
  } catch (cacheError) {
    console.warn('[Setup] Warning: Could not clear Metro cache:', cacheError.message);
  }

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
  // Set large scrollback buffer (10000 lines) to capture all logs
  await logOperation('metro_start', 'started', '[Setup] 🚀 Starting Metro bundler in tmux session...');
  const expoProcess = spawn('sh', ['-c',
    `tmux new-session -d -s metro -x 200 -y 50 && ` +
    `tmux set-option -t metro history-limit 10000 && ` +
    `tmux send-keys -t metro 'cd ${PROJECT_DIR} && NODE_OPTIONS="--max-old-space-size=3072" npx expo start --tunnel' Enter`
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

  // Step 4.5: Attach log pipe to Metro tmux session (real-time streaming)
  console.log('[Setup] Step 4.5: Attaching log pipe to Metro...');
  await logOperation('log_pipe', 'started', '[Setup] 📡 Attaching real-time log pipe...');

  // Check if metro-log-pipe.js exists (uploaded by cli-executor.ts)
  const logPipePath = '/home/user/metro-log-pipe.js';
  const checkLogPipe = spawn('sh', ['-c', `test -f ${logPipePath} && echo "exists" || echo "missing"`], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  let logPipeExists = false;
  checkLogPipe.stdout.on('data', (data) => {
    logPipeExists = data.toString().trim() === 'exists';
  });

  await new Promise((resolve) => {
    checkLogPipe.on('close', resolve);
  });

  if (logPipeExists) {
    // Use tmux pipe-pane to stream Metro output directly to our log pipe script
    // This captures ALL output in real-time (no polling needed)
    // Write env vars to a file so the pipe script can read them
    const envFilePath = '/home/user/.metro-log-env';
    fs.writeFileSync(envFilePath, `SUPABASE_URL=${SUPABASE_URL}\nSUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}\nPROJECT_ID=${PROJECT_ID}\n`);

    // Use sh -c to properly source env vars and run the script
    const pipeCommand = `sh -c 'export $(cat ${envFilePath} | xargs) && node ${logPipePath}'`;

    const pipeProcess = spawn('sh', ['-c', `tmux pipe-pane -t metro "${pipeCommand}"`], {
      stdio: 'ignore',
    });

    await new Promise((resolve) => {
      pipeProcess.on('close', resolve);
    });

    console.log('[Setup] ✓ Metro log pipe attached');
    await logOperation('log_pipe', 'completed', '[Setup] ✓ Real-time log streaming active');
  } else {
    console.log('[Setup] ⚠️ Metro log pipe script not found, skipping...');
    await logOperation('log_pipe', 'skipped', '[Setup] ⚠️ Log pipe script not found (optional)');
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

  // Step 7: Start AI agent if prompt provided
  console.log(`[Setup] Step 7: Checking AI agent requirements...`);
  console.log(`[Setup] AI_PROVIDER: ${AI_PROVIDER}`);
  console.log(`[Setup] USER_PROMPT length: ${USER_PROMPT ? USER_PROMPT.length : 0}`);
  console.log(`[Setup] SYSTEM_PROMPT length: ${SYSTEM_PROMPT ? SYSTEM_PROMPT.length : 0}`);
  console.log(`[Setup] USER_MESSAGE length: ${USER_MESSAGE ? USER_MESSAGE.length : 0}`);
  console.log(`[Setup] GOOGLE_APPLICATION_CREDENTIALS_JSON present: ${!!GOOGLE_APPLICATION_CREDENTIALS_JSON}`);
  console.log(`[Setup] GOOGLE_CLOUD_PROJECT present: ${!!GOOGLE_CLOUD_PROJECT}`);
  console.log(`[Setup] CLAUDE_CODE_OAUTH_TOKEN present: ${!!CLAUDE_CODE_OAUTH_TOKEN}`);

  const isGemini = AI_PROVIDER === 'gemini';
  const isClaudeSdk = AI_PROVIDER === 'claude-sdk';
  // Gemini requires Vertex AI credentials
  // Claude SDK requires ANTHROPIC_API_KEY
  // Claude CLI requires CLAUDE_CODE_OAUTH_TOKEN
  const hasGeminiCredentials = !!(GOOGLE_APPLICATION_CREDENTIALS_JSON && GOOGLE_CLOUD_PROJECT);
  const hasClaudeSdkCredentials = !!ANTHROPIC_API_KEY;
  const hasClaudeCliCredentials = !!CLAUDE_CODE_OAUTH_TOKEN;

  let hasCredentials;
  if (isGemini) {
    hasCredentials = hasGeminiCredentials;
  } else if (isClaudeSdk) {
    hasCredentials = hasClaudeSdkCredentials;
  } else {
    hasCredentials = hasClaudeCliCredentials;
  }

  console.log(`[Setup] isGemini: ${isGemini}`);
  console.log(`[Setup] isClaudeSdk: ${isClaudeSdk}`);
  console.log(`[Setup] hasGeminiCredentials: ${hasGeminiCredentials}`);
  console.log(`[Setup] hasClaudeSdkCredentials: ${hasClaudeSdkCredentials}`);
  console.log(`[Setup] hasClaudeCliCredentials: ${hasClaudeCliCredentials}`);
  console.log(`[Setup] hasCredentials: ${hasCredentials}`);

  // Check if we have the required prompt:
  // - SDK: needs SYSTEM_PROMPT + USER_MESSAGE
  // - CLI/Gemini: needs USER_PROMPT
  const hasPrompt = isClaudeSdk ? (SYSTEM_PROMPT && USER_MESSAGE) : USER_PROMPT;

  if (hasCredentials && hasPrompt) {
    let modelName, providerDisplayName;
    if (isGemini) {
      modelName = 'Gemini 3 Pro';
      providerDisplayName = 'Gemini';
    } else if (isClaudeSdk) {
      modelName = 'Claude Sonnet 4 (SDK)';
      providerDisplayName = 'Claude SDK';
    } else {
      modelName = 'Claude Sonnet 4';
      providerDisplayName = 'Claude';
    }
    await sendSystemMessage(`[Setup] 💬 🤖 Starting ${providerDisplayName} agent (model: ${modelName})...`);
    console.log(`[Setup] Step 7: Starting ${AI_PROVIDER} agent with model ${modelName}...`);

    // Note: The stream-to-supabase.js script is uploaded by Vercel's executeSetupInE2B function
    // It should already be present at /home/user/stream-to-supabase.js
    // The correct script (Claude CLI, Claude SDK, or Gemini) is uploaded based on AI_PROVIDER
    // If not, the setup script was called incorrectly

    // Determine the expected script path based on provider
    const expectedScriptPath = isClaudeSdk
      ? '/home/user/stream-to-supabase-sdk.js'
      : '/home/user/stream-to-supabase.js';

    // Check if agent script exists
    console.log(`[Setup] Checking for agent script at ${expectedScriptPath}...`);
    const checkScript = spawn('sh', ['-c', `test -f ${expectedScriptPath} && echo "exists" || echo "missing"`], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let scriptExists = false;
    checkScript.stdout.on('data', (data) => {
      const result = data.toString().trim();
      console.log(`[Setup] Script check result: ${result}`);
      scriptExists = result === 'exists';
    });

    await new Promise((resolve) => {
      checkScript.on('close', resolve);
    });

    console.log(`[Setup] Agent script exists: ${scriptExists}`);

    if (!scriptExists) {
      console.error(`[Setup] ✗ ${expectedScriptPath} not found! Cannot start agent.`);
      console.error('[Setup] The setup script should be uploaded before calling this script.');
      await sendSystemMessage(`[Setup] ✗ Agent script missing (${expectedScriptPath}) - cannot start AI agent`, 'error');
    } else {
      // Start the AI agent script (Claude CLI, Claude SDK, or Gemini based on AI_PROVIDER)
      // Use the appropriate script based on provider
      let agentScript;
      let logFile;
      if (isGemini) {
        agentScript = '/home/user/stream-to-supabase.js';
        logFile = '/home/user/gemini-agent.log';
      } else if (isClaudeSdk) {
        agentScript = '/home/user/stream-to-supabase-sdk.js';
        logFile = '/home/user/claude-sdk-agent.log';
      } else {
        agentScript = '/home/user/stream-to-supabase.js';
        logFile = '/home/user/claude-agent.log';
      }

      console.log(`[Setup] Agent script: ${agentScript}`);
      console.log(`[Setup] Log file: ${logFile}`);

      // Build environment variables based on provider
      const agentEnv = {
        ...process.env,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
        PROJECT_ID: PROJECT_ID,
        USER_ID: USER_ID,
        WORKING_DIRECTORY: PROJECT_DIR,
        // R2 credentials for direct E2B saves
        R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
        // NODE_PATH for global npm modules (needed for SDK in E2B)
        NODE_PATH: '/usr/lib/node_modules:/usr/local/lib/node_modules',
      };

      // Add prompt env vars based on provider
      // SDK uses separate SYSTEM_PROMPT + USER_MESSAGE for token optimization
      // CLI/Gemini use combined USER_PROMPT
      if (isClaudeSdk) {
        agentEnv.SYSTEM_PROMPT = SYSTEM_PROMPT;
        agentEnv.USER_MESSAGE = USER_MESSAGE;
        console.log(`[Setup] SDK using SYSTEM_PROMPT (${SYSTEM_PROMPT?.length || 0} chars) + USER_MESSAGE (${USER_MESSAGE?.length || 0} chars)`);
      } else {
        agentEnv.USER_PROMPT = USER_PROMPT;
        console.log(`[Setup] Using combined USER_PROMPT (${USER_PROMPT?.length || 0} chars)`);
      }

      // Add provider-specific credentials
      if (isGemini) {
        // Vertex AI credentials (required)
        agentEnv.GOOGLE_APPLICATION_CREDENTIALS_JSON = GOOGLE_APPLICATION_CREDENTIALS_JSON;
        agentEnv.GOOGLE_CLOUD_PROJECT = GOOGLE_CLOUD_PROJECT;
        agentEnv.GOOGLE_CLOUD_LOCATION = GOOGLE_CLOUD_LOCATION;
        console.log(`[Setup] Added Vertex AI credentials to agent environment (project: ${GOOGLE_CLOUD_PROJECT})`);
      } else if (isClaudeSdk) {
        // SDK requires ANTHROPIC_API_KEY
        agentEnv.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY;
        console.log(`[Setup] Added ANTHROPIC_API_KEY to agent environment`);
      } else {
        // CLI requires CLAUDE_CODE_OAUTH_TOKEN
        agentEnv.CLAUDE_CODE_OAUTH_TOKEN = CLAUDE_CODE_OAUTH_TOKEN;
        console.log(`[Setup] Added CLAUDE_CODE_OAUTH_TOKEN to agent environment`);
      }

      console.log(`[Setup] Spawning agent process...`);
      // NODE_PATH is set in agentEnv and will be inherited by the node process
      // Global npm packages are installed in /usr/lib/node_modules on the E2B base image
      const spawnCommand = `nohup node ${agentScript} > ${logFile} 2>&1 & echo $!`;
      console.log(`[Setup] Spawn command: ${spawnCommand}`);

      const agentProcess = spawn('sh', ['-c', spawnCommand], {
        cwd: PROJECT_DIR,
        env: agentEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let agentPid = '';
      let agentStderr = '';

      agentProcess.stdout.on('data', (data) => {
        agentPid = data.toString().trim();
        console.log(`[Setup] Agent process stdout: ${agentPid}`);
      });

      agentProcess.stderr.on('data', (data) => {
        agentStderr += data.toString();
        console.log(`[Setup] Agent process stderr: ${data.toString()}`);
      });

      await new Promise((resolve) => {
        agentProcess.on('close', (code) => {
          console.log(`[Setup] Agent spawn process exited with code: ${code}`);
          resolve();
        });
      });

      if (agentPid) {
        console.log(`[Setup] ✓ ${providerDisplayName} agent started (PID: ${agentPid})`);
        console.log(`[Setup] ✓ Model: ${modelName}`);
        await sendSystemMessage(`[Setup] ✓ ${providerDisplayName} agent started (PID: ${agentPid})`);

        // Wait a moment and check the agent log for initial output
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`[Setup] Checking agent log after 3 seconds...`);
        const checkLog = spawn('sh', ['-c', `head -n 30 ${logFile} 2>&1 || echo "Log file not found or empty"`], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let logOutput = '';
        checkLog.stdout.on('data', (data) => {
          logOutput += data.toString();
        });

        await new Promise((resolve) => {
          checkLog.on('close', resolve);
        });

        console.log(`[Setup] Agent log (first 30 lines):`);
        console.log(logOutput);

        // Send agent log to Supabase so it's visible in UI
        if (logOutput && logOutput.trim()) {
          await sendSystemMessage(`[Agent Log] First 30 lines:\n${logOutput}`, 'debug');
        }

        // Check if agent process is still running
        const checkPs = spawn('sh', ['-c', `ps -p ${agentPid} -o pid,etime,cmd 2>&1 || echo "Process not found"`], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let psOutput = '';
        checkPs.stdout.on('data', (data) => {
          psOutput += data.toString();
        });

        await new Promise((resolve) => {
          checkPs.on('close', resolve);
        });

        console.log(`[Setup] Agent process status: ${psOutput.trim()}`);

        // For SDK provider, also read the early debug log
        if (isClaudeSdk) {
          console.log(`[Setup] Checking SDK early debug log...`);
          const checkEarlyDebug = spawn('sh', ['-c', `cat /home/user/sdk-early-debug.log 2>&1 || echo "No early debug log found"`], {
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          let earlyDebugOutput = '';
          checkEarlyDebug.stdout.on('data', (data) => {
            earlyDebugOutput += data.toString();
          });

          await new Promise((resolve) => {
            checkEarlyDebug.on('close', resolve);
          });

          console.log(`[Setup] SDK Early Debug Log:`);
          console.log(earlyDebugOutput);

          // Send the early debug log to Supabase so it shows in UI
          if (earlyDebugOutput && earlyDebugOutput.trim() !== 'No early debug log found') {
            await sendSystemMessage(`[SDK Debug] Early startup log:\n${earlyDebugOutput}`, 'debug');
          } else {
            await sendSystemMessage(`[SDK Debug] No early debug log found - script may not have started`, 'warning');
          }
        }
      } else {
        console.error(`[Setup] ✗ Failed to get agent PID`);
        if (agentStderr) {
          console.error(`[Setup] Agent stderr: ${agentStderr}`);
        }
        await sendSystemMessage(`[Setup] ✗ Failed to start ${providerDisplayName} agent`, 'error');
      }
    }
  } else {
    console.log(`[Setup] No ${AI_PROVIDER} agent prompt or credentials provided, skipping agent start`);
    if (!hasCredentials) {
      console.log(`[Setup] Missing credentials for ${AI_PROVIDER}`);
    }
    if (!hasPrompt) {
      if (isClaudeSdk) {
        console.log(`[Setup] Missing SYSTEM_PROMPT (${!!SYSTEM_PROMPT}) or USER_MESSAGE (${!!USER_MESSAGE})`);
      } else {
        console.log(`[Setup] Missing USER_PROMPT`);
      }
    }
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
