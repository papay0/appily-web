/**
 * Agent configuration and presets
 *
 * This file centralizes all agent configuration to follow the DRY principle.
 * Configuration is separated into reusable presets for different agent types.
 *
 * Educational note: Centralizing config makes it easy to:
 * - Update behavior across all agents from one place
 * - Create specialized agents with different tool access
 * - Maintain consistent security policies (allowed/disallowed tools)
 *
 * @see https://docs.claude.com/en/api/agent-sdk/typescript#options
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";

/**
 * Default agent options shared across all agents
 *
 * These settings provide a secure baseline that works for most use cases:
 * - Latest Claude Sonnet model for best performance
 * - Reasonable turn limit to prevent runaway loops
 * - Project context from CLAUDE.md (settingSources: ['project'])
 * - Carefully selected tool whitelist for security
 */
export const DEFAULT_AGENT_OPTIONS: Partial<Options> = {
  // Model configuration
  model: "claude-sonnet-4-5",

  // Conversation control
  maxTurns: 20, // Prevents infinite loops while allowing complex multi-step tasks

  // Context management
  settingSources: ["project"], // Automatically loads .claude/CLAUDE.md

  // Tool whitelist - allows common development operations
  // Using wildcards for npm/npx/git commands to allow all subcommands
  allowedTools: [
    "Read", // Read files
    "Write", // Create/overwrite files
    "Edit", // Modify specific lines in files
    "MultiEdit", // Edit multiple sections efficiently
    "Glob", // Find files by pattern
    "Grep", // Search file contents
    "Bash(npm:*)", // All npm commands (install, run, etc.)
    "Bash(npx:*)", // All npx commands (expo, etc.)
    "Bash(git:*)", // All git commands (clone, commit, etc.)
    "Bash(curl:*)", // HTTP requests
  ],
};

/**
 * Expo builder agent preset
 *
 * Specialized configuration for building Expo/React Native mobile apps.
 * This agent knows how to:
 * - Clone template repositories
 * - Install dependencies (including @expo/ngrok globally)
 * - Start Expo with tunnel mode for external device access
 * - Implement features in React Native/Expo projects
 *
 * The system prompt provides context about Expo best practices and
 * integrates with the project's CLAUDE.md guide automatically.
 */
export const EXPO_BUILDER_OPTIONS: Partial<Options> = {
  ...DEFAULT_AGENT_OPTIONS,

  // Custom system prompt for Expo development expertise
  systemPrompt: `You are an expert Expo/React Native mobile app developer.

Your primary responsibility is to help users build native mobile apps by:

1. **Repository Setup**
   - Clone Expo template repositories using git
   - Understand the project structure from CLAUDE.md

2. **Dependency Management**
   - Install project dependencies: npm install
   - Install @expo/ngrok globally for tunnel mode: npm install -g @expo/ngrok
   - IMPORTANT: Always use latest version (no version lock) for @expo/ngrok

3. **Development Server**
   - Start Expo with tunnel mode: npx expo start --tunnel
   - Wait for Metro to start (look for "Metro" or "Bundler" in the output)
   - IMPORTANT: You are running inside an E2B sandbox
   - The Expo URL will be provided to you in the prompt
   - E2B URL format: exp://[hostname] (e.g., exp://8081-sandbox-id.exp.direct)
   - DO NOT try to extract the URL from ngrok API, curl requests, or Expo output
   - Simply use the exact URL provided in your task instructions

4. **Feature Implementation**
   - Implement user-requested features following React Native/Expo patterns
   - Use TypeScript for type safety
   - Follow the coding standards from CLAUDE.md
   - Create modular, reusable components

**Critical Notes:**
- You are running in an E2B sandbox with automatic port forwarding
- The tunnel URL is provided by E2B, NOT by ngrok or Expo
- Just wait for Metro to start, then return the E2B tunnel URL
- Report progress clearly so users can see what's happening
- If errors occur, read the error messages and try alternative approaches`,
};

/**
 * Helper function to create agent options with custom working directory
 *
 * Use this to create agent options for a specific project directory.
 * The working directory sets the context for all file operations and bash commands.
 *
 * @param workingDir - Absolute path to the project directory
 * @param customOptions - Additional options to merge (optional)
 * @returns Merged agent options ready for query()
 *
 * @example
 * ```typescript
 * const options = getAgentOptions("/home/user/my-expo-app", {
 *   maxTurns: 10,
 *   systemPrompt: "Custom prompt here"
 * });
 * ```
 */
export function getAgentOptions(
  workingDir: string,
  customOptions?: Partial<Options>
): Partial<Options> {
  return {
    ...DEFAULT_AGENT_OPTIONS,
    cwd: workingDir, // Correct option name: cwd (current working directory)
    ...customOptions,
  };
}

/**
 * Security note: Disallowed tools
 *
 * For production deployments, consider adding disallowedTools to prevent
 * destructive operations:
 *
 * disallowedTools: [
 *   "Bash(rm:*)",     // Prevent file deletion
 *   "Bash(sudo:*)",   // Prevent privilege escalation
 *   "Bash(chmod:*)",  // Prevent permission changes
 * ]
 *
 * This is currently not set to allow maximum flexibility during development,
 * but should be configured based on your security requirements.
 */
