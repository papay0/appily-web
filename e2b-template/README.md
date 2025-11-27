# Appily E2B Template

E2B custom template with git, GitHub CLI, and Claude Code CLI pre-installed.
Configured with 8 vCPUs and 8GB RAM for fast Metro compilation.

## What's Included

- **Base**: `e2bdev/base` (Ubuntu with Python, Node.js, npm, git)
- **GitHub CLI** (`gh`) - For creating PRs
- **Claude Code CLI** (`claude`) - For autonomous bug fixing
- **Git configuration** - Pre-configured with "Appily Bot" user
- **tmux** - For terminal multiplexing

## Setup

### First Time Setup

```bash
cd e2b-template
npm install
```

Create a `.env` file with your E2B API key:

```bash
E2B_API_KEY=e2b_***
```

### Development Build

```bash
npm run build:dev
```

### Production Build

```bash
npm run build:prod
```

## Configuration

- **CPU**: 8 vCPUs
- **RAM**: 8GB (8192 MB)
- **Disk**: 20GB (Pro tier)

## Files

- `template.ts` - Template definition using E2B v2 SDK
- `build.dev.ts` - Development build script
- `build.prod.ts` - Production build script
- `e2b.Dockerfile` - Source Dockerfile (reference only)
- `e2b.toml` - Minimal config

## After Building

After running `npm run build:prod`, update `lib/e2b.ts` with the new template ID from the build output.
