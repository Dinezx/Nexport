# Setup Guide for Advanced Features

## Installation

### 1. Install Test Dependencies
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom happy-dom
```

### 2. Apply Database Migrations
```bash
# Navigate to project root
cd nexport-flow-pro-main

# Apply migration 002 (advanced features)
supabase migration up

# Or manually in Supabase Dashboard:
# Go to SQL Editor and run: supabase/migrations/002_advanced_features_and_security.sql
```

### 3. Configure Environment Variables

**In Supabase Dashboard** → Settings → Functions → Edge Function Secrets:
```
HF_API_TOKEN=hf_your_token_here
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

**In Vercel Dashboard** (if using Vercel API route):
```
HF_API_TOKEN=hf_your_token_here
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

### 4. Deploy Updated Edge Function
```bash
supabase functions deploy ai-chat
```

### 5. Enable Realtime on New Tables (in Supabase Dashboard)
- Database → Replication
- Enable Realtime for: `token_usage`, `rate_limits`, `message_search`, `audit_log`, `container_allocation_log`
- Already enabled: `messages`, `tracking_events`

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Generate coverage report
npm run test -- --coverage

# Run tests with UI
npm run test:ui
```

## Known Errors & Non-Issues

### ✓ Fixed Errors (Now Resolved)
- ✅ calculateCost, estimateTokens, and other utility functions now properly exported
- ✅ Supabase client type assertions added to all new library files
- ✅ Chat.tsx updated with proper type casting for Supabase calls

### ⚠ Expected Non-Issues (Safe to Ignore)
1. **Deno Runtime Errors** in `supabase/functions/ai-chat/index.ts`:
   - "Cannot find module 'https://esm.sh/@supabase/supabase-js@2'"
   - "Cannot find name 'Deno'"
   - These are normal for Deno edge functions - they use ESM imports and Deno globals

2. **Missing vitest** in test files:
   - This is expected until you run `npm install -D vitest`
   - Once installed, all test errors will resolve

3. **Code Style Suggestions** (Sourcery):
   - These are optional code quality suggestions, not errors
   - Safe to ignore or apply as you prefer

## Troubleshooting

### Chat messages not appearing
1. Verify HF_MODEL is set: Supabase Dashboard → Settings → Functions
2. Check Realtime is enabled on messages table
3. Redeploy function: `supabase functions deploy ai-chat`
4. Check browser console for errors

### Rate limiting not working
1. Ensure migration 002 was applied
2. Verify rate_limits table exists in Supabase
3. Check user_id matches authenticated user ID

### Tests won't run
1. Install vitest: `npm install -D vitest`
2. Run: `npm run test`
3. If still issues, check vitest.config.ts path aliases

### High AI costs
1. Switch to cheaper model: `openchat/openchat-3.5`
2. Reduce max_new_tokens in edge function (currently 256)
3. Review token_usage table for heavy users

## File Reference

### New Files Created
- `src/lib/tokenUsage.ts` - Token tracking & cost calculation
- `src/lib/rateLimit.ts` - Rate limiting middleware
- `src/lib/messageSearch.ts` - Full-text search & indexing
- `src/lib/errorHandling.ts` - Centralized error management
- `src/__tests__/core.test.ts` - Unit tests
- `src/__tests__/integration.test.ts` - Integration tests
- `supabase/migrations/002_advanced_features_and_security.sql` - Database schema
- `vitest.config.ts` - Test runner configuration
- `ADVANCED_FEATURES.md` - Complete documentation

### Modified Files
- `src/pages/Chat.tsx` - Enhanced with rate limiting, token logging, delivery status
- `src/lib/tokenUsage.ts` - Now exports calculateCost & estimateTokens
- `supabase/functions/ai-chat/index.ts` - Already supports AI and context (no changes needed)

## Next Steps

1. **Test Locally**:
   - Run dev server: `npm run dev`
   - Test chat: Send a message and verify it appears
   - Test rate limiting: Send 101+ messages to hit limit
   - Watch token_usage table: See tokens logged

2. **Deploy**:
   ```bash
   npm run build
   # Deploy to your hosting (Vercel, Netlify, etc.)
   ```

3. **Monitor**:
   - Check token_usage table for cost trends
   - Monitor rate_limits for abuse patterns
   - Review audit_log for important actions
   - Track container_allocation_log for capacity issues

---

**All critical errors have been fixed!** The remaining "errors" are either expected (Deno environment) or temporary (missing dev dependencies that will resolve once installed).

Feel free to proceed with testing and deployment. 🚀
