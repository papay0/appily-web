# Realtime Subscription Fix - Summary

## What Was Fixed

### Issue: System Messages and QR Code Not Appearing in Real-time

**Root Cause:** The RLS (Row Level Security) policy for `agent_events` was using `session_id` to determine access, but system messages have `session_id = NULL`.

**Why This Happened:**
1. Originally, `agent_events` only had `session_id` column
2. Later, we added `project_id` to support project-level events
3. But we never updated the RLS policy to use the new column
4. The old policy blocked system messages because `NULL = NULL` evaluates to `NULL` (not TRUE) in SQL

### The Fundamental Problem

**Old approach (wrong):**
- Used `session_id` for access control
- Path: `agent_events.session_id` → `agent_sessions` → `users.user_id`
- Problem: Session ID is a Claude implementation detail, not a user-facing boundary
- Breaks for system messages with `session_id = NULL`

**New approach (correct):**
- Uses `project_id` for access control
- Path: `agent_events.project_id` → `projects.user_id`
- Benefit: Project is the actual access control boundary
- Works for ALL events (agent messages AND system messages)

---

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/*_simplify_agent_events_rls_use_project_id.sql`

**Actions:**
- Dropped old RLS policy that used `session_id`
- Created new RLS policy that uses `project_id`
- New policy is simpler (one join instead of two)

**New Policy:**
```sql
CREATE POLICY "Users can read events from their projects"
ON agent_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    JOIN users ON users.id = projects.user_id
    WHERE projects.id = agent_events.project_id
      AND users.clerk_id = (auth.jwt() ->> 'sub')
  )
);
```

### 2. Improved Debug Logging
**Files:**
- `/components/chat-panel.tsx`
- `/app/(app)/home/projects/[projectId]/page.tsx`

**Changes:**
- Added clean event logs: `[ChatPanel] 📨 Received system event: Installing dependencies...`
- Added subscription status logs: `[ChatPanel] ✓ Subscribed to project events`
- Only logs meaningful changes (no spam)

---

## What You Should See Now

### When Creating a New Project

**In the chat (real-time):**
```
🔧 Creating development environment...
📦 Cloning Expo template repository...
✓ Expo Metro bundler started
✓ Ready! Scan the QR code to preview your app on your phone.
🤖 Starting AI agent to build your app...
[Agent starts working...]
```

**QR Code:**
- Should appear automatically when generated (~30 seconds)
- No page refresh needed

**In Console:**
```
[ChatPanel] ✓ Subscribed to project events
[ProjectPage] ✓ Subscribed to project updates
[ChatPanel] 📨 Received system event: 🔧 Creating development environment...
[ProjectPage] 📨 Project updated: qr_code: updated, expo_url: exp://...
[ChatPanel] 📨 Received agent event: assistant
```

---

## Testing Checklist

- [ ] Create a new project
- [ ] See system messages appear in chat in real-time
- [ ] See QR code appear automatically (no refresh)
- [ ] Console shows "✓ Subscribed" messages (not "CLOSED" or "CHANNEL_ERROR")
- [ ] Agent messages still work
- [ ] No 406 errors in console

---

## Why This Is Better

### Before (Complex & Broken)
```
✗ Used session_id for access control
✗ Required 2 joins (agent_events → agent_sessions → users)
✗ Blocked system messages (session_id = NULL)
✗ Misaligned with user mental model
✗ Needed special cases for NULL handling
```

### After (Simple & Correct)
```
✓ Uses project_id for access control
✓ Requires 1 join (agent_events → projects → users)
✓ Works for all events (agent + system)
✓ Aligns with user mental model ("show MY project's events")
✓ No special cases needed
```

---

## Architecture Clarification

### What is session_id?
- **Purpose:** Claude's internal conversation state
- **Use cases:** Resuming conversations, linking messages
- **NOT for:** Access control

### What is project_id?
- **Purpose:** User-facing project boundary
- **Use cases:** Access control, data organization
- **Correct for:** RLS policies, subscriptions

### The Right Abstraction
- ✅ Projects = Access control boundary
- ✅ Users own projects
- ✅ Users can see all events from their projects
- ❌ Sessions = Implementation detail for Claude
- ❌ Should NOT be used for access control

---

## Rollback (If Needed)

If something goes wrong, you can revert the migration:

```sql
-- Restore old policy
DROP POLICY IF EXISTS "Users can read events from their projects" ON agent_events;

CREATE POLICY "Users can read their own agent events"
ON agent_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agent_sessions
    JOIN users ON users.id = agent_sessions.user_id
    WHERE agent_sessions.session_id = agent_events.session_id
      AND users.clerk_id = (auth.jwt() ->> 'sub')
  )
);
```

But you'll lose access to system messages again.

---

## Next Steps

1. **Test the fix** - Create a new project and verify everything works
2. **Monitor console logs** - Check for subscription success/failures
3. **Clean up logging (optional)** - Remove debug logs once verified
4. **Update documentation** - Document that RLS uses project_id for access

---

**Date:** 2025-11-20
**Fixed By:** Architecture simplification - project_id instead of session_id
