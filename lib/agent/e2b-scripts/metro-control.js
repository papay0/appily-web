/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Metro Bundler Control Module (RUNS INSIDE E2B SANDBOX)
 *
 * This module provides programmatic control over the Expo Metro bundler
 * running in a tmux session. It allows triggering hot reloads without
 * manual intervention.
 *
 * Prerequisites:
 * - Metro must be started in a tmux session named "metro"
 * - tmux must be installed in the E2B sandbox
 *
 * Usage:
 *   const { triggerMetroReload } = require('/home/user/metro-control.js');
 *   await triggerMetroReload();
 */

const { spawn } = require('child_process');

/**
 * Trigger Metro bundler reload by sending "r" key to the tmux session
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function triggerMetroReload() {
  try {
    console.log('[MetroReload] Checking if Metro tmux session exists...');

    // Check if tmux session "metro" exists
    const checkSession = spawn('tmux', ['has-session', '-t', 'metro'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let hasError = false;
    checkSession.stderr.on('data', () => {
      hasError = true;
    });

    await new Promise((resolve) => checkSession.on('close', resolve));

    if (hasError) {
      console.log('[MetroReload] Metro tmux session not found');
      return { success: false, error: 'Metro tmux session not running' };
    }

    console.log('[MetroReload] ✓ Metro session found, sending reload command...');

    // Send "r" key followed by Enter to trigger reload
    const sendKeys = spawn('tmux', ['send-keys', '-t', 'metro', 'r', 'Enter'], {
      stdio: 'inherit',
    });

    const exitCode = await new Promise((resolve) => {
      sendKeys.on('close', resolve);
    });

    if (exitCode !== 0) {
      console.error('[MetroReload] ✗ Failed to send keys to Metro session');
      return { success: false, error: 'Failed to send keys to tmux session' };
    }

    console.log('[MetroReload] ✓ Reload command sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[MetroReload] ✗ Error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  triggerMetroReload,
};
