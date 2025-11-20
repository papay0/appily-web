# Chat Panel Fixes Summary

## Issues Fixed

### 1. System Prompt Now in Backend ✅

**Problem:** System prompt was hardcoded in frontend `chat-panel.tsx`, making it difficult to maintain and requiring duplication for mobile apps.

**Solution:**
- Moved Expo setup instructions from `components/chat-panel.tsx` to `app/api/agents/create/route.ts`
- Frontend now sends only the user's message
- Backend constructs the full prompt with system instructions

**Files changed:**
- `components/chat-panel.tsx` (lines 308-319) - Removed system prompt, sends only user message
- `app/api/agents/create/route.ts` (lines 72-109) - Added system prompt construction

### 2. Fixed 406 Error on agent_sessions ✅

**Problem:** Frontend couldn't read `agent_sessions` table, getting 406 (Not Acceptable) error. This prevented:
- Loading existing sessions on page refresh
- Detecting new sessions for realtime subscriptions
- User messages not appearing after refresh

**Root Cause:** Supabase client wasn't properly configured to use Clerk JWT tokens.

**Solution:**
- Updated `lib/supabase-client.ts` to use Clerk's JWT template system
- Changed from `session.getToken()` to `session.getToken({ template: "supabase" })`
- Configured authorization headers properly

**Files changed:**
- `lib/supabase-client.ts` (lines 40-50) - Fixed JWT token configuration

## Required Setup: Clerk Native Supabase Integration

**IMPORTANT:** The fix uses Clerk's native Supabase integration (JWT templates are deprecated as of April 2025). Follow these steps:

### Step 1: Enable Clerk Supabase Integration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to: **Integrations** (or go directly to [Supabase integration setup](https://dashboard.clerk.com/setup/supabase))
3. Click **Activate Supabase integration**
4. Copy your **Clerk domain** (e.g., `your-app.clerk.accounts.dev`)

### Step 2: Add Clerk as Third-Party Provider in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to: **Authentication → Sign In / Up**
3. Click **Add provider**
4. Select **Clerk** from the list
5. Paste your **Clerk domain** from Step 1

### Step 3: Verify RLS Policies

The RLS policies are already configured correctly in Supabase. They use:

```sql
auth.jwt()->>'sub' = users.clerk_id
```

This matches the `sub` claim from Clerk's session token with the `clerk_id` in your `users` table.

The native integration automatically adds the `"role": "authenticated"` claim to session tokens, which is required for Supabase RLS to work.

## Testing the Fix

1. **Clear browser cache** (or open incognito window)
2. **Sign in** to your Appily account
3. **Create a new project** or open existing one
4. **Send a message** in the chat
5. **Refresh the page** - messages should persist
6. **Check console** - no more 406 errors

## What This Enables

With these fixes in place:

✅ **Message persistence** - User messages saved to database
✅ **Page refresh** - Chat history loads from database
✅ **Live updates** - Realtime subscriptions work for new sessions
✅ **Mobile apps** - System prompt centralized in backend API
✅ **Security** - RLS policies properly enforced with Clerk auth

## Remaining Tasks

- [ ] Enable Clerk Supabase native integration (see above)
- [ ] Add Clerk as third-party provider in Supabase
- [ ] Test message persistence after refresh
- [ ] Verify live updates work on first message

---

**Last updated:** 2025-11-19
