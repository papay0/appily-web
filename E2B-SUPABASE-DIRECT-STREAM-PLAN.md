# E2B → Supabase Direct Stream Implementation Plan

**Date:** 2025-11-20
**Goal:** Move Claude CLI event streaming from Vercel callbacks to E2B-native execution

---

## Problem Statement

Current implementation uses callbacks (`onStdout`, `onStderr`) that run in Vercel's Node.js process. When Vercel returns the HTTP response, these callbacks stop firing, causing agent execution to stop prematurely on production.

**Timeline:**
- Works locally (Vercel never returns until completion)
- Breaks on deployment (Vercel times out or returns early)

---

## Solution Architecture

### Flow
```
User → Vercel API → E2B (runs Node.js script) → Supabase → Frontend (realtime updates)
         ↓ returns immediately
```

### Key Components

1. **E2B Script** (`/lib/agent/e2b-scripts/stream-to-supabase.js`)
   - Runs INSIDE E2B sandbox
   - Spawns `claude` CLI
   - Parses NDJSON output
   - Posts directly to Supabase using service role key

2. **Modified Executor** (`/lib/agent/cli-executor.ts`)
   - Reads script file from filesystem
   - Uploads to E2B using `sandbox.files.write()`
   - Runs script with `background: true`
   - Returns immediately with PID

3. **Updated API Routes**
   - `/app/api/agents/create/route.ts`
   - `/app/api/agents/message/route.ts`
   - Call new executor, return HTTP response immediately

---

## Implementation Checklist

### ✅ Phase 1: Create E2B Script
- [x] Create `/lib/agent/e2b-scripts/` directory
- [x] Create `stream-to-supabase.js` with:
  - [x] Environment variable validation
  - [x] Supabase client initialization
  - [x] Claude CLI spawn logic
  - [x] NDJSON parsing
  - [x] Event storage in `agent_events` table
  - [x] Session tracking in `agent_sessions` table
  - [x] Error handling
  - [x] Process cleanup

### 🔄 Phase 2: Modify CLI Executor
- [ ] Create new function `executeClaudeInE2B()` in `/lib/agent/cli-executor.ts`
  - [ ] Read script file using `fs.readFileSync()`
  - [ ] Upload script to E2B using `sandbox.files.write()`
  - [ ] Install `@supabase/supabase-js` in E2B (if not in template)
  - [ ] Run script with `background: true` and env vars
  - [ ] Return immediately with PID and sandbox ID

- [ ] Deprecate old `executeClaudeCLI()` function
  - [ ] Add deprecation comment
  - [ ] Keep for reference during migration

### ⏳ Phase 3: Update API Routes
- [ ] Update `/app/api/agents/create/route.ts`
  - [ ] Replace `executeCLIInBackground` with `executeClaudeInE2B`
  - [ ] Remove background Promise handling
  - [ ] Return HTTP response immediately after script starts

- [ ] Update `/app/api/agents/message/route.ts`
  - [ ] Same changes as create route
  - [ ] Ensure session resumption works

### ⏳ Phase 4: Testing & Deployment
- [ ] Test locally
  - [ ] Create new project
  - [ ] Send message
  - [ ] Verify events in Supabase
  - [ ] Check realtime updates in frontend

- [ ] Test on Vercel
  - [ ] Deploy to preview
  - [ ] Verify E2B script runs independently
  - [ ] Confirm events stream to Supabase
  - [ ] Check frontend updates

- [ ] Optional: Update E2B template Dockerfile
  - [ ] Pre-install `@supabase/supabase-js`
  - [ ] Faster runtime execution

- [ ] Clean up old code
  - [ ] Remove `executeCLIInBackground` function
  - [ ] Remove callback-based logic
  - [ ] Update comments and documentation

---

## Environment Variables Required

### Passed to E2B Script:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)
- `CLAUDE_CODE_OAUTH_TOKEN` - Claude CLI OAuth token
- `PROJECT_ID` - Project ID for linking events
- `USER_ID` - User ID (optional)
- `USER_PROMPT` - The prompt to send to Claude
- `SESSION_ID` - Session ID for resuming (optional)
- `WORKING_DIRECTORY` - Working directory for Claude

### Already in Vercel:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `CLAUDE_CODE_OAUTH_TOKEN`
- ✅ `E2B_API_KEY`

---

## Benefits of This Approach

✅ **Vercel returns in <1 second** (no timeout issues)
✅ **E2B runs for up to 1 hour** independently
✅ **Events stream to Supabase** in real-time
✅ **Frontend gets updates** via existing realtime subscriptions
✅ **No polling needed**
✅ **Simpler architecture** (no Vercel lifecycle dependency)
✅ **Type-safe script** (compiled by Next.js build)
✅ **Easy to debug** (real file, not inline string)

---

## Files Modified

1. **Created:**
   - `/lib/agent/e2b-scripts/stream-to-supabase.js`
   - `E2B-SUPABASE-DIRECT-STREAM-PLAN.md` (this file)

2. **To Modify:**
   - `/lib/agent/cli-executor.ts`
   - `/app/api/agents/create/route.ts`
   - `/app/api/agents/message/route.ts`

3. **Optional:**
   - E2B template Dockerfile (add npm install @supabase/supabase-js)

---

## Testing Scenarios

### Scenario 1: New Project Creation
1. User creates new project with prompt: "Build a todo app"
2. Vercel creates E2B sandbox
3. Vercel uploads script to E2B
4. Vercel runs script in background
5. Vercel returns HTTP 200 immediately
6. E2B script spawns Claude CLI
7. Events stream to Supabase
8. Frontend shows real-time updates
9. Claude completes task
10. Session marked as completed in database

### Scenario 2: Follow-up Message
1. User sends follow-up: "Add dark mode"
2. Vercel connects to existing sandbox
3. Vercel uploads script with SESSION_ID
4. Script resumes conversation
5. Rest of flow same as Scenario 1

### Scenario 3: Long-Running Task (15+ minutes)
1. User sends complex prompt
2. Vercel returns immediately
3. E2B continues for 15+ minutes
4. Events continue streaming
5. Frontend shows progress throughout
6. Task completes successfully

---

## Rollback Plan

If issues occur, revert to callback-based approach:
1. Restore old `cli-executor.ts`
2. Restore old API routes
3. Accept Vercel timeout limitations
4. Consider alternative solutions (Edge runtime, queues)

---

## Next Steps After Implementation

1. Monitor E2B sandbox usage and costs
2. Optimize script performance
3. Add retry logic for Supabase failures
4. Add metrics and logging
5. Consider caching script upload (if same script used repeatedly)

---

**Status:** In Progress
**Last Updated:** 2025-11-20
**Current Phase:** Phase 1 Complete, Starting Phase 2
