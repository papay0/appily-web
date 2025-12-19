/**
 * Design Types
 *
 * Type definitions for the design generation system.
 * Used for storing and passing HTML screen designs between plan, design, and build phases.
 */

/**
 * A saved design screen from the database
 */
export interface ProjectDesign {
  id: string;
  project_id: string;
  screen_name: string;
  html_content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Design data for creating a new design (without DB-generated fields)
 */
export interface DesignInsert {
  project_id: string;
  screen_name: string;
  html_content: string;
  sort_order?: number;
}

/**
 * Simplified design structure passed to the build agent
 * Contains just the screen name and HTML content
 */
export interface DesignForBuild {
  screenName: string;
  html: string;
}

/**
 * Context passed to the design page for generation
 */
export interface DesignGenerationContext {
  appIdea: string;
  features: Array<{
    title: string;
    description: string | null;
    is_included: boolean;
  }>;
  existingScreens?: ProjectDesign[];
}

/**
 * Design context passed to the build page and agent
 */
export interface DesignContext {
  screens: DesignForBuild[];
}

/**
 * Convert ProjectDesign array to DesignForBuild array
 */
export function toDesignForBuild(designs: ProjectDesign[]): DesignForBuild[] {
  return designs.map((d) => ({
    screenName: d.screen_name,
    html: d.html_content,
  }));
}

/**
 * Response from the design generation API
 */
export interface DesignGenerationResponse {
  screens: Array<{
    name: string;
    html: string;
  }>;
}

/**
 * A design chat message from the database
 */
export interface DesignMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/**
 * Design message data for creating a new message (without DB-generated fields)
 */
export interface DesignMessageInsert {
  project_id: string;
  role: "user" | "assistant";
  content: string;
}
