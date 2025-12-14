# Convex Integration for Appily Generated Apps

**Version:** 1.0
**Date:** 2025-12-13
**Purpose:** Document the integration of Convex as the backend for Appily-generated Expo React Native apps

---

## Table of Contents

1. [Overview](#overview)
2. [Convex Architecture](#convex-architecture)
3. [Management API](#management-api)
4. [Embedded Dashboard](#embedded-dashboard)
5. [Integration with E2B + Claude Code](#integration-with-e2b--claude-code)
6. [Environment Variables](#environment-variables)
7. [Pricing & Scaling](#pricing--scaling)
8. [Implementation Checklist](#implementation-checklist)

---

## Overview

### What is Convex?

Convex is a reactive backend-as-a-service that provides:
- **Real-time database** with automatic sync
- **TypeScript server functions** (queries, mutations, actions)
- **Built-in file storage**
- **Scheduled functions** (cron jobs)
- **Authentication integrations** (Clerk, Auth0, etc.)

### Why Convex for Appily?

1. **Real-time by default** - Perfect for mobile apps needing live updates
2. **TypeScript end-to-end** - Matches Expo/React Native stack
3. **No backend setup** - Users get a working backend instantly
4. **Programmatic provisioning** - Can create projects via API (like Chef does)
5. **Embeddable dashboard** - Users can manage their data in Appily UI

### Current State

- **Appily itself** uses Supabase for its own data (users, chats, sessions)
- **Generated apps** currently have NO backend
- **Goal**: Add Convex as the backend for generated Expo apps

---

## Convex Architecture

### Server Functions

| Type | Purpose | Characteristics |
|------|---------|-----------------|
| **Query** | Read data | Cached, real-time reactive, deterministic |
| **Mutation** | Write data | Transactional, ACID compliant |
| **Action** | External APIs | Can call third-party services, non-deterministic |

### File Structure in Generated Apps

```
my-app/
├── convex/
│   ├── _generated/       # Auto-generated types
│   ├── schema.ts         # Database schema
│   ├── functions.ts      # Server functions
│   └── ...
├── app/
│   └── ...               # Expo app code
└── convex.json           # Convex config
```

### React Native Integration

```typescript
// In Expo app
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <YourApp />
    </ConvexProvider>
  );
}
```

---

## Management API

### Authentication

Convex uses OAuth for programmatic access. Appily needs:
- OAuth client credentials from Convex team
- User's access token (obtained via OAuth flow)

### Create Project

**Endpoint:** `POST https://api.convex.dev/api/create_project`

```typescript
const response = await fetch("https://api.convex.dev/api/create_project", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,  // User's OAuth token
  },
  body: JSON.stringify({
    team: teamSlug,           // "appily" (our team)
    projectName: "My App",    // User's app name
    deploymentType: "dev",    // or "prod"
  }),
});

// Response
const data = {
  projectSlug: "my-app-xyz",
  projectId: 12345,
  teamSlug: "appily",
  deploymentName: "cheerful-elephant-123",
  prodUrl: "https://cheerful-elephant-123.convex.cloud",  // Actually the dev URL
  adminKey: "...",           // For deployment
  projectsRemaining: 38,     // Quota tracking
};
```

### Create Deploy Key

**Endpoint:** `POST https://api.convex.dev/api/dashboard/authorize`

```typescript
const response = await fetch("https://api.convex.dev/api/dashboard/authorize", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    authn_token: accessToken,
    projectId: projectId,
    oauthApp: {
      clientId: process.env.CONVEX_OAUTH_CLIENT_ID,
      clientSecret: process.env.CONVEX_OAUTH_CLIENT_SECRET,
    },
  }),
});

// Response
const data = { accessToken: "..." };

// Construct deploy key
const projectDeployKey = `project:${teamSlug}:${projectSlug}|${data.accessToken}`;
```

### Other Useful Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/dashboard/teams` | List user's teams |
| `GET /api/teams/{slug}/projects` | List projects in team |
| `DELETE /api/dashboard/delete_project/{id}` | Delete project |
| `POST /api/hosting/deploy?deploymentName=X` | Deploy code (zip file) |

---

## Embedded Dashboard

### How It Works

Convex provides an embeddable dashboard at `https://dashboard-embedded.convex.dev/`.

1. Embed an iframe pointing to the dashboard URL
2. Listen for `dashboard-credentials-request` message
3. Respond with `dashboard-credentials` containing authentication

### Implementation

```tsx
// components/convex-dashboard.tsx
"use client";

import { useEffect, useRef } from "react";

interface ConvexDashboardProps {
  deploymentUrl: string;      // e.g., "https://cheerful-elephant-123.convex.cloud"
  deploymentName: string;     // e.g., "cheerful-elephant-123"
  adminKey: string;           // Project deploy key
  path?: string;              // Dashboard path, e.g., "data" or "functions"
  visiblePages?: string[];    // Optional: limit visible sidebar items
}

export function ConvexDashboard({
  deploymentUrl,
  deploymentName,
  adminKey,
  path = "data",
  visiblePages,
}: ConvexDashboardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "dashboard-credentials-request") {
        return;
      }

      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "dashboard-credentials",
          adminKey,
          deploymentUrl,
          deploymentName,
          ...(visiblePages && { visiblePages }),
        },
        "*"
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [deploymentUrl, adminKey, deploymentName, visiblePages]);

  const dashboardUrl = `https://dashboard-embedded.convex.dev/${path}`;

  return (
    <iframe
      ref={iframeRef}
      src={dashboardUrl}
      className="w-full h-full border-none"
      allow="clipboard-write"
    />
  );
}
```

### Dashboard Pages

Available paths for the embedded dashboard:

| Path | Description |
|------|-------------|
| `data` | Browse and edit database tables |
| `functions` | View and test server functions |
| `logs` | View function execution logs |
| `files` | Manage file storage |
| `settings` | Deployment settings |
| `history` | Function execution history |

### Visible Pages Control

Limit which pages users can access:

```tsx
<ConvexDashboard
  // ...
  visiblePages={["data", "functions", "logs"]}  // Hide settings, files, etc.
/>
```

---

## Integration with E2B + Claude Code CLI

### How Appily Runs Claude Code

Appily uses the **Claude Code CLI** (not the SDK) inside E2B sandboxes:

```bash
claude -p "user prompt here" --output-format stream-json
```

**Why CLI instead of SDK?**
- Uses `CLAUDE_CODE_OAUTH_TOKEN` (free with Claude Code subscription)
- SDK requires API keys and doesn't support OAuth tokens
- CLI has excellent streaming via `--output-format stream-json`
- E2B has pre-built templates for Claude Code

This means we **cannot** add custom tools programmatically. Instead, we use **system prompt instructions** to tell Claude when and how to deploy Convex functions.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Appily Web                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Chat UI       │  │  Preview Panel  │  │  Dashboard  │ │
│  │                 │  │   (Expo Web)    │  │  (Convex)   │ │
│  └────────┬────────┘  └────────▲────────┘  └──────▲──────┘ │
│           │                    │                   │        │
│           ▼                    │                   │        │
│  ┌─────────────────────────────┴───────────────────┴──────┐ │
│  │                    E2B Sandbox                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │ Claude Code  │→ │ Expo App     │  │ Convex CLI   │  │ │
│  │  │   CLI        │  │ (Files)      │  │ (Deploy)     │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Convex Cloud        │
                    │   (User's Backend)    │
                    └───────────────────────┘
```

### Flow: Creating a New App with Convex

1. **User starts new chat** → Appily creates a new Convex project via Management API
2. **Store credentials** → Save `deploymentUrl`, `deploymentName`, `adminKey` in Supabase
3. **E2B Sandbox starts** → Pass Convex credentials as environment variables
4. **Claude Code generates code** → Writes both Expo app and Convex functions
5. **Claude deploys to Convex** → Runs `npx convex dev --once` via Bash (instructed by system prompt)
6. **Claude sees errors** → If deploy fails, Claude fixes and retries
7. **Preview updates** → Expo app connects to Convex, real-time sync works
8. **Dashboard available** → User can view/edit data in embedded dashboard

### Deployment Strategy: System Prompt Instructions

Since we use CLI (not SDK), we instruct Claude via system prompt to deploy Convex when ready.

**Key insight:** Claude should deploy when it's *ready to test*, not after every file edit. This allows Claude to:
1. Write multiple Convex files
2. Deploy once
3. See any errors
4. Fix and retry

This mirrors how Claude already uses `npm run build` or `tsc` - it runs checks when code is ready, not after every keystroke.

### System Prompt Addition for Convex

Add this to the agent's system prompt (in `lib/agent/prompts.ts`):

```markdown
## Convex Backend

This app uses Convex as its backend. Convex is already configured with these environment variables:
- `CONVEX_DEPLOY_KEY` - For deploying functions
- `EXPO_PUBLIC_CONVEX_URL` - For client connection (already set in the app)

### When to Use Convex

Use Convex when the app needs:
- Data persistence (todos, users, posts, etc.)
- Real-time updates
- Server-side logic

### How to Create Convex Functions

1. Create `convex/schema.ts` with your database schema
2. Create server functions in `convex/` directory (e.g., `convex/todos.ts`)
3. Use `useQuery` and `useMutation` hooks in React Native components

### Deploying Convex Functions

After you finish writing or editing files in the `convex/` directory, deploy by running:

\`\`\`bash
npx convex dev --once --typecheck=disable
\`\`\`

Review the output for errors. If there are errors, fix them and deploy again.

**Important:** Deploy when you're ready to test, not after every single file edit. Batch your Convex changes, then deploy once.

### Example Schema

\`\`\`typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
    createdAt: v.number(),
  }),
});
\`\`\`

### Example Functions

\`\`\`typescript
// convex/todos.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("todos").order("desc").collect();
  },
});

export const create = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("todos", {
      text: args.text,
      completed: false,
      createdAt: Date.now(),
    });
  },
});
\`\`\`

### Using Convex in React Native

\`\`\`typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function TodoList() {
  const todos = useQuery(api.todos.list);
  const createTodo = useMutation(api.todos.create);

  // todos automatically updates in real-time!
  return (
    <FlatList
      data={todos}
      renderItem={({ item }) => <Text>{item.text}</Text>}
    />
  );
}
\`\`\`
```

---

## Environment Variables

### Appily Server (Required)

```env
# Convex OAuth credentials (obtain from Convex team)
CONVEX_OAUTH_CLIENT_ID=your_oauth_client_id
CONVEX_OAUTH_CLIENT_SECRET=your_oauth_client_secret

# Convex API host
CONVEX_API_HOST=https://api.convex.dev
```

### E2B Sandbox (Per User App)

```env
# Passed to E2B sandbox for each generated app
CONVEX_DEPLOY_KEY=project:appily:user-app-slug|access_token_here
EXPO_PUBLIC_CONVEX_URL=https://cheerful-elephant-123.convex.cloud
```

### Storage in Supabase

Store Convex credentials per chat/project:

```sql
-- Add to existing schema
ALTER TABLE chats ADD COLUMN convex_project jsonb;

-- Structure:
-- {
--   "projectSlug": "my-app-xyz",
--   "teamSlug": "appily",
--   "deploymentUrl": "https://cheerful-elephant-123.convex.cloud",
--   "deploymentName": "cheerful-elephant-123",
--   "adminKey": "project:appily:my-app-xyz|..."
-- }
```

---

## Pricing & Scaling

### Convex Pricing Tiers

| Tier | Price | Project Limit | Notes |
|------|-------|---------------|-------|
| **Starter** | Free | 40 projects | Good for testing |
| **Professional** | $25/dev/month | 120 projects | Per team |
| **Enterprise** | Custom | Unlimited | Contact Convex |

### Scaling Considerations

- **1M+ apps goal** requires Enterprise agreement with Convex
- Bloom (YC startup) has similar arrangement for their AI tool
- Contact Convex team to discuss:
  - Higher project limits
  - Bulk pricing
  - API rate limits
  - Support SLA

### Cost Model for Appily

Projects themselves are free to create. Users pay for usage:
- Database reads/writes
- Function executions
- File storage
- Bandwidth

Option: Appily could absorb costs and bill users, or have users connect their own Convex accounts.

---

## Implementation Checklist

### Phase 1: Foundation

- [ ] Contact Convex team for OAuth app credentials
- [ ] Create `CONVEX_OAUTH_CLIENT_ID` and `CONVEX_OAUTH_CLIENT_SECRET` env vars
- [ ] Add Convex project storage to Supabase schema
- [ ] Implement project creation API route (`/api/convex/create-project`)
- [ ] Implement deploy key creation

### Phase 2: E2B Integration

- [ ] Pass Convex env vars to E2B sandbox (`CONVEX_DEPLOY_KEY`, `EXPO_PUBLIC_CONVEX_URL`)
- [ ] Update Claude Code agent system prompt with Convex guidelines (see "System Prompt Addition" section)
- [ ] Ensure Convex CLI is available in E2B template (or install via `npx`)
- [ ] Test end-to-end: create app → generate Convex code → Claude deploys → preview works

### Phase 3: Dashboard Embedding

- [ ] Create `ConvexDashboard` component
- [ ] Add dashboard panel to workbench UI
- [ ] Store and retrieve admin keys securely
- [ ] Test credential postMessage flow

### Phase 4: User Experience

- [ ] Add "Connect to Convex" UI flow (if users need own accounts)
- [ ] Show Convex deployment status in UI
- [ ] Handle errors gracefully (quota reached, deploy failed, etc.)
- [ ] Add documentation for users about Convex in their apps

---

## References

- [Convex Documentation](https://docs.convex.dev)
- [Convex React Native Quickstart](https://docs.convex.dev/quickstart/react-native)
- [Embedded Dashboard Docs](https://docs.convex.dev/platform-apis/embedded-dashboard)
- [Chef Codebase](https://github.com/get-convex/chef) - Convex's open-source vibe coding platform
- [Convex Pricing](https://www.convex.dev/pricing)

---

## Appendix: Chef's Implementation Details

Chef (Convex's vibe coding platform) provides a reference implementation:

### Key Files in Chef

| File | Purpose |
|------|---------|
| `convex/convexProjects.ts` | Project provisioning logic |
| `app/components/workbench/Dashboard.tsx` | Embedded dashboard |
| `app/lib/.server/llm/convex-agent.ts` | AI agent for code generation |
| `chef-agent/prompts/` | 1,830 lines of Convex-specific prompts |

### Chef's Agent Architecture

- Uses Vercel AI SDK with tool-use
- Supports multiple models (Claude, GPT, Gemini)
- Has tools: `deploy`, `edit`, `view`, `npmInstall`, `lookupDocs`
- Iterative loop: generate → deploy → see errors → fix → repeat
- Runs in WebContainer (browser-based sandbox)

### Appily's Approach (Different from Chef)

Appily uses **Claude Code CLI** in E2B instead of a custom SDK agent:
- Simpler: no custom tool definitions needed
- Uses system prompt to guide Claude's Convex usage
- Claude's built-in Bash tool handles `npx convex dev --once`
- Same iterative loop: generate → deploy → see errors → fix → repeat
