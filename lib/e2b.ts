import { Sandbox } from "@e2b/code-interpreter";

export type SandboxStatus = "idle" | "starting" | "ready" | "error";

export interface SandboxInfo {
  id: string;
  status: SandboxStatus;
  createdAt: Date;
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
  const apiKey = process.env.NEXT_PUBLIC_E2B_API_KEY;

  if (!apiKey) {
    throw new Error("E2B_API_KEY is not configured");
  }

  try {
    const sandbox = await Sandbox.create({
      apiKey,
    });

    return {
      sandbox,
      info: {
        id: sandbox.sandboxId,
        status: "ready",
        createdAt: new Date(),
      },
    };
  } catch (error) {
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
 * Runs code in the E2B sandbox
 */
export async function runCode(sandbox: Sandbox, code: string) {
  return await sandbox.runCode(code, { language: "js" });
}
