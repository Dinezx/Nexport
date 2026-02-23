# Quick Fix for Console Errors

## Current Issues & Solutions

### 1. ❌ "Could not find the table 'public.rate_limits'"
**Status**: NOT YET APPLIED
**Cause**: Migration 002 wasn't applied to Supabase project
**Fix**: 
```bash
supabase migration up
```
This will create: rate_limits, token_usage, message_search, audit_log, container_allocation_log tables

### 2. ❌ "process is not defined" in Chat.tsx
**Status**: ✅ FIXED
**Cause**: Using `process.env` in browser (should use `import.meta.env`)
**Solution**: Changed to `import.meta.env.VITE_HF_MODEL`

### 3. ⚠️ React Router Future Flags Warning
**Status**: EXPECTED (informational)
**Cause**: React Router library version
**Impact**: None - just a notice about v7 compatibility
**Action**: Can ignore or suppress later

### 4. ❌ Live locations 403 Forbidden
**Status**: EXPECTED due to RLS
**Cause**: Row-Level Security policy active
**Will resolve**: Once migration is applied and user is authenticated properly

## Immediate Action Items

### Step 1: Apply Migration (Required)
```bash
cd d:\Nexport\nexport-flow-pro-main

# Option A: Use Supabase CLI (recommended)
supabase migration up

# Option B: Manual in Supabase Dashboard
# → SQL Editor
# → Copy entire content of: supabase/migrations/002_advanced_features_and_security.sql
# → Execute
```

### Step 2: Configure Supabase Functions
Go to Supabase Dashboard:
1. Select project: slhqugstyiidafeezwev
2. Settings → Functions → Edge Function Secrets
3. Add or update:
   - `HF_API_TOKEN` = your Hugging Face token
   - `HF_MODEL` = mistralai/Mistral-7B-Instruct-v0.2

### Step 3: Redeploy Edge Function
```bash
supabase functions deploy ai-chat
```

### Step 4: Verify Setup
```bash
# Start dev server
npm run dev

# Open browser console (F12)
# Send a chat message
# Verify no errors appear
```

## Expected Behavior After Fix

- ✅ Chat messages send successfully
- ✅ Rate limits tracked in `rate_limits` table
- ✅ Token usage logged in `token_usage` table
- ✅ No 404 errors for new tables
- ✅ Delivery status shows in chat UI
- ✅ Rate limit countdown appears in header

## If Issues Persist

### Check 1: Is Migration Applied?
```bash
# In Supabase Dashboard:
# → Database → Tables
# Look for: rate_limits, token_usage, message_search, audit_log, container_allocation_log
# If missing → Migration not applied yet
```

### Check 2: Are Env Vars Set?
```bash
# In Supabase Dashboard:
# → Settings → Functions → Edge Function Secrets
# Should show: HF_API_TOKEN and HF_MODEL
# If missing → Add them
```

### Check 3: Is RLS Blocking?
```bash
# In Supabase Dashboard:
# → Database → Rate Limits table
# → RLS Policies tab
# Should show: "Users can view their own rate limits"
# If policies are too restrictive → May need adjustment
```

### Check 4: Test Edge Function
```bash
# In Supabase Dashboard:
# → Edge Functions → ai-chat → Logs
# Send a chat message from app
# Look for logs showing request/response
```

## Support Info

- **Project ID**: slhqugstyiidafeezwev
- **Frontend Env File**: .env.local
- **Migration File**: supabase/migrations/002_advanced_features_and_security.sql
- **New Libs**: src/lib/tokenUsage.ts, src/lib/rateLimit.ts, src/lib/messageSearch.ts, src/lib/errorHandling.ts

---

**Once migration is applied, all console errors should resolve!**
