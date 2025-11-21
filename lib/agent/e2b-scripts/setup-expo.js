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

const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

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
  console.log('[Setup] ✓ Supabase client created');

  // Test connection
  const { error: testError } = await supabase.from('projects').select('id').limit(1);
  if (testError) {
    console.error('[Setup] ✗ Supabase connection test failed:', testError.message);
    process.exit(1);
  }
  console.log('[Setup] ✓ Supabase connection verified');
} catch (error) {
  console.error('[Setup] ✗ Failed to create Supabase client:', error.message);
  process.exit(1);
}

/**
 * Send system message to chat
 */
async function sendSystemMessage(message, type = 'info') {
  try {
    await supabase.from('agent_events').insert({
      project_id: PROJECT_ID,
      session_id: null, // Pre-session message
      event_type: 'system',
      event_data: {
        type: 'system',
        subtype: type,
        message,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
    console.log(`[Setup] 💬 ${message}`);
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
    console.log(`[Setup] ✓ Project status updated: ${status}`);
  } catch (error) {
    console.error('[Setup] Failed to update project status:', error.message);
  }
}

// Start setup process
try {
  // Step 1: Clone GitHub repository
  await sendSystemMessage('🔧 Creating development environment...');
  await sendSystemMessage('📦 Cloning Expo template repository...');
  await updateProjectStatus('starting');

  console.log(`[Setup] Step 1: Cloning repository from ${REPO_URL}...`);

  // Parse GitHub URL
  const urlMatch = REPO_URL.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!urlMatch) {
    throw new Error('Invalid GitHub URL format');
  }

  const [, owner, repo] = urlMatch;
  const repoName = repo.replace(/\.git$/, '');
  const tarballUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/main.tar.gz`;

  console.log(`[Setup] Downloading from: ${tarballUrl}`);

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

  // Step 2: Install npm dependencies
  await sendSystemMessage('📦 Installing dependencies...');
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
  await sendSystemMessage('🌐 Setting up Expo tunnel...');
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

  // Step 4: Start Expo with tunnel mode
  await sendSystemMessage('🚀 Starting Expo Metro bundler...');
  console.log('[Setup] Step 4: Starting Expo with tunnel mode...');

  const expoUrl = `exp://${E2B_HOSTNAME}`;
  console.log(`[Setup] Expo URL will be: ${expoUrl}`);

  // Start Expo in background
  const expoProcess = spawn('sh', ['-c', `cd ${PROJECT_DIR} && NODE_OPTIONS="--max-old-space-size=3072" npx expo start --tunnel > /home/user/expo.log 2>&1 &`], {
    stdio: 'ignore',
    detached: true,
  });

  expoProcess.unref(); // Let it run independently

  console.log('[Setup] ✓ Expo process started in background');

  // Wait for Expo to be ready (check logs)
  console.log('[Setup] Waiting for Expo to be ready (60s timeout)...');
  const startTime = Date.now();
  const maxWait = 60000; // 60 seconds

  let expoReady = false;
  while (!expoReady && (Date.now() - startTime) < maxWait) {
    // Check if Metro is ready
    const checkLogs = spawn('sh', ['-c', 'tail -n 20 /home/user/expo.log 2>/dev/null || echo ""'], {
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
      console.log('[Setup] ✓ Expo is ready!');
    } else {
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!expoReady) {
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

  await sendSystemMessage('✓ Expo Metro bundler started', 'success');
  await sendSystemMessage('✓ Ready! Scan the QR code to preview your app on your phone.', 'success');

  console.log('[Setup] ✓ Setup complete!');
  console.log(`[Setup] Expo URL: ${expoUrl}`);

  // Step 7: Start Claude agent if prompt provided
  if (CLAUDE_CODE_OAUTH_TOKEN && USER_PROMPT) {
    await sendSystemMessage('🤖 Starting AI agent to build your app...');
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
      await sendSystemMessage('✗ Agent script missing - cannot start AI agent', 'error');
    } else {
      // Start the Claude agent script
      const agentScript = '/home/user/stream-to-supabase.js';
      const agentProcess = spawn('sh', ['-c', `nohup node ${agentScript} > /home/user/claude-agent.log 2>&1 & echo $!`], {
        cwd: PROJECT_DIR,
        env: {
          ...process.env,
          WORKING_DIRECTORY: PROJECT_DIR,
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
    `✗ Setup failed: ${error.message}`,
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
