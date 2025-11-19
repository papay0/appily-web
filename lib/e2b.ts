import { Sandbox } from "e2b";
import { Octokit } from "octokit";

export type SandboxStatus = "idle" | "starting" | "ready" | "error";

export interface SandboxInfo {
  id: string;
  status: SandboxStatus;
  createdAt: Date;
  expoUrl?: string;
  error?: string;
}

/**
 * Creates a new E2B sandbox for running Expo/React Native code
 * @returns Sandbox instance and metadata
 */
export async function createSandbox(): Promise<{
  sandbox: Sandbox;
  info: SandboxInfo;
}> {
  const apiKey = process.env.E2B_API_KEY;

  if (!apiKey) {
    throw new Error("E2B_API_KEY is not configured");
  }

  try {
    console.log("[createSandbox] Creating E2B sandbox with template 1fzoj162ooq36dtkcdc1 (4GB RAM)...");
    const sandbox = await Sandbox.create(
      "1fzoj162ooq36dtkcdc1", // appily-autofix-v2 template with 4GB RAM (first parameter)
      {
        apiKey,
      }
    );

    console.log(`[createSandbox] ✓ Sandbox created: ${sandbox.sandboxId}`);

    return {
      sandbox,
      info: {
        id: sandbox.sandboxId,
        status: "ready",
        createdAt: new Date(),
      },
    };
  } catch (error) {
    console.error("[createSandbox] ✗ Error:", error);
    throw new Error(
      `Failed to create E2B sandbox: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Closes an E2B sandbox gracefully
 */
export async function closeSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.kill();
  } catch (error) {
    console.error("Failed to close E2B sandbox:", error);
  }
}

/**
 * Installs npm packages in the sandbox
 */
export async function installPackages(
  sandbox: Sandbox,
  packages: string[]
): Promise<void> {
  const packageList = packages.join(" ");
  await sandbox.commands.run(`npm install ${packageList}`);
}

/**
 * Downloads a GitHub repository as a tarball and extracts it in the sandbox
 * @param sandbox - E2B sandbox instance
 * @param repoUrl - GitHub repository URL (e.g., "https://github.com/owner/repo")
 * @param targetDir - Directory where the repo should be extracted
 */
export async function cloneGitHubRepo(
  sandbox: Sandbox,
  repoUrl: string,
  targetDir: string = "/home/user/project"
): Promise<void> {
  try {
    console.log(`[cloneGitHubRepo] Starting to clone ${repoUrl}`);

    // Parse the GitHub URL to extract owner and repo
    const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!urlMatch) {
      throw new Error("Invalid GitHub URL format");
    }

    const [, owner, repo] = urlMatch;
    const repoName = repo.replace(/\.git$/, "");
    console.log(`[cloneGitHubRepo] Parsed owner: ${owner}, repo: ${repoName}`);

    // Initialize Octokit (no auth needed for public repos)
    const octokit = new Octokit();

    // Get the default branch
    console.log(`[cloneGitHubRepo] Fetching repo info from GitHub API...`);
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo: repoName,
    });

    const defaultBranch = repoData.default_branch;
    console.log(`[cloneGitHubRepo] Default branch: ${defaultBranch}`);

    // Download tarball URL
    const tarballUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/${defaultBranch}.tar.gz`;
    console.log(`[cloneGitHubRepo] Tarball URL: ${tarballUrl}`);

    // Download and extract the tarball in the sandbox
    console.log(`[cloneGitHubRepo] Downloading and extracting to ${targetDir}...`);
    const cloneResult = await sandbox.commands.run(
      `mkdir -p ${targetDir} && cd ${targetDir} && curl -L ${tarballUrl} | tar xz --strip-components=1`
    );

    console.log(`[cloneGitHubRepo] Clone stdout:`, cloneResult.stdout);
    console.log(`[cloneGitHubRepo] Clone stderr:`, cloneResult.stderr);
    console.log(`[cloneGitHubRepo] Clone exit code:`, cloneResult.exitCode);

    if (cloneResult.exitCode !== 0) {
      throw new Error(`Clone failed with exit code ${cloneResult.exitCode}: ${cloneResult.stderr}`);
    }

    console.log(`[cloneGitHubRepo] ✓ Repository ${owner}/${repoName} cloned successfully to ${targetDir}`);
  } catch (error) {
    console.error(`[cloneGitHubRepo] ✗ Error:`, error);
    throw new Error(
      `Failed to clone GitHub repository: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Starts Expo in the sandbox and extracts the public URL
 * @param sandbox - E2B sandbox instance
 * @param projectDir - Directory containing the Expo project
 * @returns The Expo public URL (exp://...)
 */
export async function startExpo(
  sandbox: Sandbox,
  projectDir: string = "/home/user/project"
): Promise<string> {
  try {
    console.log(`[startExpo] Starting Expo setup in ${projectDir}`);

    // Get the E2B public hostname FIRST
    console.log("[startExpo] Getting E2B public hostname...");
    const hostname = await sandbox.getHost(8081);
    console.log(`[startExpo] ✓ E2B public hostname: ${hostname}`);

    // Create a comprehensive debug log file
    await sandbox.commands.run(
      `cd ${projectDir} && echo "=== Appily Debug Log ===" > /home/user/appily-debug.log && echo "Timestamp: $(date)" >> /home/user/appily-debug.log && echo "Hostname: ${hostname}" >> /home/user/appily-debug.log && echo "" >> /home/user/appily-debug.log`
    );

    console.log("[startExpo] Installing npm dependencies...");
    const installStartTime = Date.now();
    const installResult = await sandbox.commands.run(`cd ${projectDir} && npm install 2>&1 | tee -a /home/user/appily-debug.log`, {
      timeoutMs: 0, // No timeout for npm install (can take a while)
    });
    const installDuration = ((Date.now() - installStartTime) / 1000).toFixed(2);

    console.log(`[startExpo] npm install completed in ${installDuration}s`);
    console.log("[startExpo] npm install stdout:", installResult.stdout);
    console.log("[startExpo] npm install stderr:", installResult.stderr);
    console.log("[startExpo] npm install exit code:", installResult.exitCode);

    if (installResult.exitCode !== 0) {
      throw new Error(`npm install failed with exit code ${installResult.exitCode}: ${installResult.stderr}`);
    }

    // Install @expo/ngrok globally for tunnel mode
    console.log("[startExpo] Installing @expo/ngrok for tunnel mode...");
    const ngrokInstallResult = await sandbox.commands.run(`npm install -g @expo/ngrok@^4.1.0 2>&1 | tee -a /home/user/appily-debug.log`, {
      timeoutMs: 60000, // 1 minute timeout
    });

    if (ngrokInstallResult.exitCode !== 0) {
      throw new Error(`@expo/ngrok install failed: ${ngrokInstallResult.stderr}`);
    }
    console.log("[startExpo] ✓ @expo/ngrok installed");

    // Start Expo with tunnel mode - simple and reliable!
    console.log("[startExpo] Starting Expo with tunnel mode...");

    await sandbox.commands.run(
      `cd ${projectDir} && cat > start-expo.sh << 'EOFSCRIPT'
#!/bin/bash
echo "" >> /home/user/appily-debug.log
echo "=== Starting Expo with Tunnel ===" >> /home/user/appily-debug.log
echo "Timestamp: $(date)" >> /home/user/appily-debug.log
echo "" >> /home/user/appily-debug.log

export NODE_OPTIONS="--max-old-space-size=3072"

npx expo start --tunnel >> /home/user/appily-debug.log 2>&1 &
EXPO_PID=$!
echo "Expo PID: $EXPO_PID" >> /home/user/appily-debug.log
echo $EXPO_PID > expo.pid

sleep 10
if ps -p $EXPO_PID > /dev/null; then
  echo "✓ Expo is running with tunnel" >> /home/user/appily-debug.log
else
  echo "✗ Expo died" >> /home/user/appily-debug.log
fi
EOFSCRIPT
chmod +x start-expo.sh
./start-expo.sh`,
      {
        timeoutMs: 30000,
      }
    );

    console.log("[startExpo] ✓ Expo start script executed");

    // Wait for Expo to start
    console.log("[startExpo] Waiting 15 seconds for Expo to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // Check process status and logs
    console.log("[startExpo] Checking Expo status...");
    const statusCheckResult = await sandbox.commands.run(
      `cd ${projectDir} && echo "=== Process Status ===" >> /home/user/appily-debug.log && ps aux | grep expo >> /home/user/appily-debug.log && echo "" >> /home/user/appily-debug.log && echo "=== Port 8081 Status ===" >> /home/user/appily-debug.log && netstat -tuln | grep 8081 >> /home/user/appily-debug.log || echo "Port 8081 not listening" >> /home/user/appily-debug.log`,
      {
        timeoutMs: 5000,
      }
    );

    // Get the complete debug log
    const debugLogResult = await sandbox.commands.run(
      `cat /home/user/appily-debug.log`,
      {
        timeoutMs: 5000,
      }
    );
    console.log("[startExpo] Complete debug log:", debugLogResult.stdout);

    // The Expo URL for scanning with Expo Go
    const expoUrl = `exp://${hostname}`;
    console.log(`[startExpo] ✓ Expo started successfully at: ${expoUrl}`);

    // Add final status to debug log
    await sandbox.commands.run(
      `echo "" >> /home/user/appily-debug.log && echo "=== Setup Complete ===" >> /home/user/appily-debug.log && echo "Expo URL: ${expoUrl}" >> /home/user/appily-debug.log && echo "Timestamp: $(date)" >> /home/user/appily-debug.log`
    );

    return expoUrl;
  } catch (error) {
    console.error("[startExpo] ✗ Error:", error);
    throw new Error(
      `Failed to start Expo: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Sets up an Expo project in the sandbox by cloning the template and starting Expo
 * @param sandbox - E2B sandbox instance
 * @param templateRepoUrl - GitHub URL of the Expo template repository
 * @returns The Expo public URL for QR code generation
 */
export async function setupExpoProject(
  sandbox: Sandbox,
  templateRepoUrl: string = "https://github.com/papay0/appily-expo-go-template"
): Promise<string> {
  console.log("[setupExpoProject] Starting Expo project setup");
  const projectDir = "/home/user/project";

  // Clone the template repository
  console.log("[setupExpoProject] Step 1/2: Cloning template repository...");
  await cloneGitHubRepo(sandbox, templateRepoUrl, projectDir);
  console.log("[setupExpoProject] ✓ Step 1/2 complete");

  // Start Expo and get the public URL
  console.log("[setupExpoProject] Step 2/2: Starting Expo...");
  const expoUrl = await startExpo(sandbox, projectDir);
  console.log("[setupExpoProject] ✓ Step 2/2 complete");

  console.log(`[setupExpoProject] ✓ Expo project setup complete. URL: ${expoUrl}`);
  return expoUrl;
}
