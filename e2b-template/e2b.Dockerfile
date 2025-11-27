# E2B Custom Template for Appily Auto-Fix
# e2bdev/base already includes: Python, Node.js, npm, git
FROM e2bdev/base:latest

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally as user
USER user
RUN npm install -g @anthropic-ai/claude-code
USER root

# Configure git for commits
RUN git config --global user.name "Appily Bot" && \
    git config --global user.email "bot@appily.dev"

# Set working directory to user's home
WORKDIR /home/user
