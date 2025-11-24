# How to Check E2B Logs for Auto-Save

## Where to Find Logs

The auto-save happens **inside E2B**, so you need to check E2B logs, not Vercel logs.

### Option 1: Check Vercel Function Logs

When the `stream-to-supabase.js` script runs, it logs to the function that started it.

1. Go to Vercel Dashboard → Your Project
2. Click on the latest deployment
3. Go to **Functions** tab
4. Find `/api/agents/create` function
5. Look for logs containing:
   - `[E2B] 💾 Triggering auto-save to R2...`
   - `[E2B] ✓ Project saved to R2: v2, 47 files` (success)
   - `[E2B] ✗ Failed to save to R2:` (failure)

### Option 2: Check Database

Check if snapshots are being created:

```sql
SELECT
  version,
  description,
  file_count,
  created_at
FROM project_snapshots
WHERE project_id = 'your-project-id'
ORDER BY version DESC
LIMIT 5;
```

If you see new rows with `description = 'Auto-save after task completion'`, then auto-save is working!

---

## Common Issues

### Issue 1: API_URL Not Set
**Symptom:** `[E2B] ✗ Error triggering save to R2: fetch failed`

**Fix:** Add `API_URL=https://appily.dev` to Vercel env vars and redeploy

---

### Issue 2: Service Key Invalid
**Symptom:** `[E2B] ✗ Failed to save to R2: Unauthorized`

**Fix:** Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel

---

### Issue 3: No Success Event
**Symptom:** No save logs at all

**Cause:** Claude might not be sending a "result success" event

**Check:** Look for `[E2B] ✓ success` in logs. If missing, the task didn't complete successfully.

---

### Issue 4: Testing Locally
**Symptom:** `[E2B] ✗ Error triggering save to R2: fetch failed`

**Cause:** E2B (cloud) can't reach localhost

**Fix:** Either:
- Test in production
- Use ngrok: `ngrok http 3000` and set `API_URL=https://abc123.ngrok.io`
