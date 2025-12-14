/**
 * Convex Management API Client
 *
 * This module handles programmatic creation and management of Convex projects
 * using Convex's official v1 Management API with Team Access Tokens.
 *
 * @see https://docs.convex.dev/management-api
 * @see https://docs.convex.dev/platform-apis
 */

const CONVEX_API_HOST = "https://api.convex.dev/v1";

/**
 * Convex project creation response
 */
export interface ConvexProjectResponse {
  projectId: number;
  deploymentName: string;
  deploymentUrl: string;
  /** Deploy key for CONVEX_DEPLOY_KEY env var */
  deployKey: string;
}

/**
 * Convex project credentials stored in Supabase
 */
export interface ConvexProjectCredentials {
  status: "connecting" | "connected" | "failed";
  projectId?: number;
  deploymentUrl?: string;
  deploymentName?: string;
  /** Deploy key for the sandbox to use with `npx convex dev --once` */
  deployKey?: string;
  errorMessage?: string;
}

/**
 * Get required environment variables for Convex API
 */
function getConvexEnv() {
  const teamAccessToken = process.env.CONVEX_TEAM_ACCESS_TOKEN;
  const teamId = process.env.CONVEX_TEAM_ID;

  if (!teamAccessToken) {
    throw new Error(
      "Missing CONVEX_TEAM_ACCESS_TOKEN. Get it from Convex Dashboard → Team Settings → Access Tokens."
    );
  }

  if (!teamId) {
    throw new Error(
      "Missing CONVEX_TEAM_ID. Find it in Convex Dashboard → Team Settings → Access Tokens."
    );
  }

  return { teamAccessToken, teamId };
}

/**
 * Create a new Convex project under your team
 *
 * Uses Team Access Token to create projects in your own Convex team.
 * All projects are owned by your team, not individual users.
 *
 * @param projectName - Display name for the project (spaces/punctuation allowed)
 * @returns Project creation response with deploy key
 */
export async function createConvexProject(
  projectName: string
): Promise<ConvexProjectResponse> {
  const { teamAccessToken, teamId } = getConvexEnv();

  // Step 1: Create the project
  const createResponse = await fetch(
    `${CONVEX_API_HOST}/teams/${teamId}/create_project`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teamAccessToken}`,
      },
      body: JSON.stringify({
        projectName,
        deploymentType: "dev",
      }),
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("[CONVEX] Failed to create project:", errorText);

    // Try to parse error for better messages
    try {
      const errorData = JSON.parse(errorText) as { code?: string; message?: string };
      if (errorData.code === "ProjectQuotaReached") {
        throw new Error(`Convex project quota reached: ${errorData.message}`);
      }
      throw new Error(errorData.message || errorText);
    } catch (e) {
      if (e instanceof Error && e.message.includes("quota")) {
        throw e;
      }
      throw new Error(`Failed to create Convex project: ${createResponse.status} - ${errorText}`);
    }
  }

  const projectData = (await createResponse.json()) as {
    projectId: number;
    deploymentName: string;
    deploymentUrl: string;
  };

  console.log(`[CONVEX] Created project: ${projectData.deploymentName}`);

  // Step 2: Create a deploy key for this deployment
  const deployKey = await createConvexDeployKey(projectData.deploymentName);

  return {
    projectId: projectData.projectId,
    deploymentName: projectData.deploymentName,
    deploymentUrl: projectData.deploymentUrl,
    deployKey,
  };
}

/**
 * Create a deploy key for a Convex deployment
 *
 * The deploy key is used with CONVEX_DEPLOY_KEY to push code via CLI.
 *
 * @param deploymentName - Deployment name (e.g., "playful-otter-123")
 * @returns Deploy key string for CONVEX_DEPLOY_KEY
 */
async function createConvexDeployKey(deploymentName: string): Promise<string> {
  const { teamAccessToken } = getConvexEnv();

  const response = await fetch(
    `${CONVEX_API_HOST}/deployments/${deploymentName}/create_deploy_key`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teamAccessToken}`,
      },
      body: JSON.stringify({
        name: "appily-agent",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[CONVEX] Failed to create deploy key:", errorText);
    throw new Error(`Failed to create deploy key: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { deployKey: string };
  console.log(`[CONVEX] Created deploy key for ${deploymentName}`);

  return data.deployKey;
}

/**
 * List all projects in your team
 *
 * @returns Array of project details
 */
export async function listConvexProjects(): Promise<
  Array<{
    id: number;
    name: string;
    slug: string;
    teamId: number;
    createTime: number;
  }>
> {
  const { teamAccessToken, teamId } = getConvexEnv();

  const response = await fetch(
    `${CONVEX_API_HOST}/teams/${teamId}/list_projects`,
    {
      headers: {
        Authorization: `Bearer ${teamAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list projects: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Delete a Convex project and all its deployments
 *
 * @param projectId - Numeric project ID to delete
 */
export async function deleteConvexProject(projectId: number): Promise<void> {
  const { teamAccessToken } = getConvexEnv();

  const response = await fetch(
    `${CONVEX_API_HOST}/projects/${projectId}/delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teamAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete project: ${response.status} - ${errorText}`);
  }

  console.log(`[CONVEX] Deleted project: ${projectId}`);
}

/**
 * List deployments for a project
 *
 * @param projectId - Numeric project ID
 * @returns Array of deployment details
 */
export async function listConvexDeployments(projectId: number): Promise<
  Array<{
    name: string;
    createTime: number;
    deploymentType: "dev" | "prod" | "preview";
    projectId: number;
  }>
> {
  const { teamAccessToken } = getConvexEnv();

  const response = await fetch(
    `${CONVEX_API_HOST}/projects/${projectId}/list_deployments`,
    {
      headers: {
        Authorization: `Bearer ${teamAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list deployments: ${response.status} - ${errorText}`);
  }

  return response.json();
}
