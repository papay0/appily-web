import { Template } from "e2b";

// Create template using E2B base image and customize it
export const template = Template()
  // Start from E2B base image (includes Python, Node.js, npm, git)
  .fromBaseImage()

  // Switch to root for system package installation
  .setUser("root")

  // Install GitHub CLI and tmux
  .runCmd(
    `curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | ` +
    `gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg && ` +
    `echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | ` +
    `tee /etc/apt/sources.list.d/github-cli.list > /dev/null && ` +
    `apt-get update && apt-get install -y gh tmux && ` +
    `rm -rf /var/lib/apt/lists/*`
  )

  // Install Claude Code CLI globally (as root)
  .runCmd("npm install -g @anthropic-ai/claude-code")

  // Install Gemini CLI globally (as root)
  .runCmd("npm install -g @google/gemini-cli")

  // Configure git globally
  .runCmd(`git config --global user.name "Appily Bot" && git config --global user.email "bot@appily.dev"`)

  // Switch to user and set workdir
  .setUser("user")
  .setWorkdir("/home/user");
