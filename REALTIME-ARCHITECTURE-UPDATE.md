# Realtime Architecture Update: Project-Scoped Chat

## Summary

Refactored the chat system from **session-based** to **project-based**, improving UX and fixing critical issues with server-side progress messages.

## Problems Fixed

### 1. Missing Progress Messages During Server-Side Setup
**Before:** Server-side Expo setup (clone, install, start Metro) happened silently - user saw nothing for 40+ seconds.

**After:** User sees real-time progress messages:
- "🔧 Creating development environment..."
- "📦 Cloning Expo template repository..."
- "✓ Expo Metro bundler started"
- "✓ Ready! Scan the QR code to preview your app."

### 2. QR Code Not Appearing Until Refresh
**Before:** QR code was stored in database but Realtime subscription didn't catch it due to race condition.

**After:** Added fallback polling (every 2 seconds) that automatically detects QR code updates and stops once found.

### 3. Session-Based Chat Was User-Hostile
**Before:** Chat only showed messages from the current Claude session. Server-side messages (no session yet) were invisible.

**After:** Chat shows ALL events for the project, regardless of session. User sees complete project history.

---

## Architecture Changes

### Database Schema

**Added `project_id` to `agent_events`:**

```sql
ALTER TABLE agent_events
  ADD COLUMN project_id uuid REFERENCES projects(id);

-- Make session_id nullable for project-level messages
ALTER TABLE agent_events
  ALTER COLUMN session_id DROP NOT NULL;

-- Must have either session_id OR project_id
ALTER TABLE agent_events
  ADD CONSTRAINT agent_events_session_or_project_check
  CHECK (session_id IS NOT NULL OR project_id IS NOT NULL);
```

**Event types:**
1. **Session events:** `session_id` set, `project_id` set (from agent)
2. **Project events:** `session_id` NULL, `project_id` set (server-side messages)

### New System Messages Helper

**File:** `/lib/agent/system-messages.ts`

```typescript
await sendSystemMessage(projectId, "Cloning repository...");
await sendSystemMessage(projectId, "✓ Ready!", { type: "success" });
```

Stores events with `project_id` only (no session), visible in chat immediately.

### Updated Chat Subscription

**Before (session-based):**
```typescript
// Only showed messages from ONE session
.filter(`session_id=eq.${sessionId}`)
```

**After (project-based):**
```typescript
// Shows ALL messages for project (any session)
.filter(`project_id=eq.${projectId}`)
```

**Session ID is still tracked** for:
- Sending new messages (resume latest conversation)
- Claude's internal context
- But NOT for filtering what user sees

### Updated Event Storage

**File:** `/lib/agent/ndjson-parser.ts`

```typescript
export async function storeEventInSupabase(
  sessionId: string,
  event: ParsedCLIEvent,
  projectId?: string  // NEW: Optional project_id
)
```

- Stores BOTH `session_id` AND `project_id`
- Auto-looks up `project_id` from session if not provided (backwards compatible)
- Enables project-scoped queries

### Server-Side Progress Messages

**File:** `/app/api/agents/create/route.ts`

Now sends progress messages during Expo setup:

```typescript
await sendSystemMessage(projectId, "🔧 Creating development environment...");
await sendSystemMessage(projectId, "📦 Cloning Expo template repository...");
// ... setup happens ...
await sendSystemMessage(projectId, "✓ Expo Metro bundler started");
await sendSystemMessage(projectId, "✓ Ready! Scan the QR code.");
await sendSystemMessage(projectId, "🤖 Starting AI agent to build your app...");
```

User sees these messages immediately in the chat.

### QR Code Fallback Polling

**File:** `/app/(app)/home/projects/[projectId]/page.tsx`

Added polling mechanism:
- Polls every 2 seconds if QR code is expected but not received
- Stops polling once QR code appears
- Handles race conditions where database update happens before subscription is ready
- Automatic cleanup after QR code is found

---

## User Experience Improvements

### Before
```
User creates project
  ↓
[40 seconds of silence - no feedback]
  ↓
Agent starts talking
  ↓
QR code appears after page refresh
```

### After
```
User creates project
  ↓
"🔧 Creating development environment..."
"📦 Cloning repository..."
  ↓
[~30 seconds with visible progress]
  ↓
"✓ Ready! Scan QR code" + QR appears automatically
  ↓
"🤖 Starting AI agent..."
  ↓
Agent builds features (user already using app!)
```

---

## Migration Notes

### Backwards Compatibility

✅ **Old code still works:**
- `storeEventInSupabase(sessionId, event)` - auto-looks up project_id
- Existing sessions continue to work
- No breaking changes to API

### Required for New Projects

🔄 **Must use new pattern for server-side messages:**
```typescript
import { sendSystemMessage } from "@/lib/agent/system-messages";

await sendSystemMessage(projectId, "Your message here");
```

---

## Testing Checklist

- [ ] Create new project - see progress messages during setup
- [ ] QR code appears without refresh
- [ ] Agent messages appear in real-time
- [ ] Multiple Claude sessions show in same project chat
- [ ] Server-side messages appear before agent starts
- [ ] Refresh page - all messages still visible
- [ ] Send follow-up message - uses latest session

---

## Files Changed

1. **Database:**
   - `supabase/migrations/*_add_project_id_to_agent_events.sql` - Schema update

2. **Backend:**
   - `lib/agent/system-messages.ts` - NEW: Project-level message helper
   - `lib/agent/ndjson-parser.ts` - Added project_id parameter
   - `lib/agent/cli-executor.ts` - Pass project_id to event storage
   - `app/api/agents/create/route.ts` - Send progress messages

3. **Frontend:**
   - `components/chat-panel.tsx` - Project-scoped subscription
   - `app/(app)/home/projects/[projectId]/page.tsx` - QR code polling

---

## Philosophy: User-Centric Architecture

**Key insight:** Users don't care about Claude's internal session IDs. They care about their PROJECT.

- ✅ Chat = All messages for my project
- ✅ QR Code = Ready as soon as it's generated
- ✅ Progress = Visible from second 1
- ❌ Session IDs = Internal implementation detail

This update aligns the architecture with user mental models.
