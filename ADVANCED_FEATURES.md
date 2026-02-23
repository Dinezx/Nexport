# NEXPORT Advanced Features & Security Implementation

This document outlines all the advanced features, security enhancements, and improvements implemented in Phase 9+ of the NEXPORT platform.

## Table of Contents

1. [Security Features (Phase 9)](#security-ph-9)
2. [Advanced Features (Phase 10+)](#advanced-features-ph-10)
3. [Enhanced UI/UX](#enhanced-uiux)
4. [Error Handling](#error-handling)
5. [Testing](#testing)
6. [Implementation Guide](#implementation-guide)

---

## Security (Phase 9)

### Row-Level Security (RLS)

All critical tables now have Row-Level Security policies enforced at the database level:

#### Conversations Table
- **SELECT**: Users can view only conversations where they are `exporter_id` OR `provider_id`
- **INSERT**: Only authenticated users can create conversations (server-side)
- **UPDATE/DELETE**: Restricted to maintain audit trail

```sql
-- Example: User can only see their conversations
SELECT * FROM conversations 
WHERE auth.uid() = exporter_id OR auth.uid() = provider_id;
```

#### Messages Table
- **SELECT**: Users can view messages only in conversations they participate in
- **INSERT**: Users can only insert messages and set themselves as `sender_id`
- **UPDATE/DELETE**: Restricted to maintain message integrity

```sql
-- Example: User can only see messages in their conversations
SELECT * FROM messages
WHERE EXISTS (
  SELECT 1 FROM conversations
  WHERE conversations.id = messages.conversation_id
  AND (conversations.exporter_id = auth.uid() OR conversations.provider_id = auth.uid())
);
```

#### Tracking Events & Live Locations
- **SELECT**: Users can view events/locations for their bookings only
- Based on booking's `exporter_id` or `shipper_id` matching `auth.uid()`

#### Audit Log Table (NEW)
- Records all important database actions
- Admins can view all logs; users see their own actions
- Tracks: user, action type, table name, record ID, changes (JSONB)

---

## Advanced Features (Phase 10+)

### 1. Token Usage Tracking

**File**: `src/lib/tokenUsage.ts`

Track all AI API calls with automatic cost calculation:

```typescript
import { logTokenUsage, getUserTokenStats, formatCost } from '@/lib/tokenUsage';

// Log token usage after AI call
await logTokenUsage(supabase, {
  userId: user.id,
  conversationId: conversation.id,
  inputTokens: 245,
  outputTokens: 512,
  model: 'mistralai/Mistral-7B-Instruct-v0.2',
});

// Get user's usage stats for last 30 days
const stats = await getUserTokenStats(supabase, userId);
// Returns: { totalTokens, totalCost, messageCount, byModel }
```

**Pricing Models**:
- Mistral 7B: $0.14 per 1M input, $0.42 per 1M output
- Mixtral 8x7B: $0.27/$0.81
- Llama 2: $0.08/$0.24
- Custom models with fallback rates

**Database Table**: `token_usage`
- user_id, conversation_id, tokens_consumed, cost, model, timestamp
- Indexed for fast queries by user and time

---

### 2. Rate Limiting

**File**: `src/lib/rateLimit.ts`

Prevent abuse with configurable per-user rate limits:

```typescript
import { checkRateLimit, formatRateLimitStatus } from '@/lib/rateLimit';

// Check if user can send message
const status = await checkRateLimit(supabase, userId, {
  maxMessagesPerWindow: 100,  // 100 messages per hour
  windowSeconds: 3600,
});

if (!status.allowed) {
  console.log(status.message); // "Rate limit exceeded. Reset at 2:30 PM"
}

// Use formatted status in UI
<span>{formatRateLimitStatus(status)}</span>
// Displays: "Rate limited. Resets in 42 minutes"
```

**Database Table**: `rate_limits`
- user_id (unique), message_count, last_reset, window_seconds
- Auto-resets when window expires
- Displayed in Chat UI header

---

### 3. Full-Text Search & Message Indexing

**File**: `src/lib/messageSearch.ts`

Search messages with PostgreSQL full-text search (FTS):

```typescript
import { searchMessages, globalMessageSearch, getTrendingKeywords } from '@/lib/messageSearch';

// Search within a conversation
const results = await searchMessages(supabase, conversationId, 'delivery delay');

// Search across all user's conversations
const globalResults = await globalMessageSearch(supabase, 'customs clearance', 50);

// Extract trending topics
const keywords = await getTrendingKeywords(supabase, conversationId, 10);
// Returns: [{ word: 'delivery', count: 12 }, ...]
```

**Database Tables**:
- `message_search`: Stores `message_id`, `conversation_id`, `content_tsv`
- Trigger auto-populates on message INSERT
- GIN index on `content_tsv` for fast searches

**Supported Operations**:
- Basic search: "customs clearance"
- Websearch: "delivery AND delay" or "shipment OR cargo"
- Context extraction: Highlights matched terms and surrounding text

---

### 4. Container Allocation Logging

**File**: `supabase/migrations/002_advanced_features_and_security.sql`

Audit trail for all container allocations:

```sql
-- New table: container_allocation_log
- container_id
- booking_id
- allocated_cbm
- action: 'allocate' | 'deallocate' | 'return'
- timestamp
```

Users can view allocation history for their bookings with RLS protection.

---

## Enhanced UI/UX

### Chat Component Enhancements

**File**: `src/pages/Chat.tsx`

#### New Features:
1. **Delivery Status Indicators**
   - pending (spinner)
   - sent (single checkmark)
   - delivered (double checkmark, blue)
   - failed (error icon, red)

2. **Typing Indicators**
   - Shows when provider/AI is "typing"
   - Animated three-dot loader
   - Assigned to `typingUsers` state

3. **Rate Limit Warnings**
   - Display remaining messages in header
   - Clear error message when limit exceeded
   - Input disabled when rate limited
   - Countdown to reset

4. **Error Handling**
   - Categorized error messages (network, auth, AI service, etc.)
   - Helpful troubleshooting hints
   - Color-coded alerts (red for errors, yellow for warnings)
   - Specific error for missing HF_MODEL config

5. **Loading States**
   - Animated spinner during AI thinking
   - Button disabled during send
   - Input disabled during rate limit or loading

### Visual Improvements:
- Delivery status shown below each message
- Grouped messages by conversation participant
- Better visual hierarchy with icons
- Responsive layout that works on mobile

---

## Error Handling

**File**: `src/lib/errorHandling.ts`

Centralized, type-safe error handling throughout the app:

```typescript
import {
  parseError,
  ErrorType,
  isRetryableError,
  retryWithBackoff,
  tryCatch,
  ValidationErrors,
} from '@/lib/errorHandling';

// Parse any error into standardized format
const appError = parseError(unknownError);
// Returns: { type, message, userMessage, code, statusCode }

// Check if retryable
if (isRetryableError(appError)) {
  await retryWithBackoff(async () => fetchData());
}

// Go-style error handling
const [data, error] = await tryCatch(() => supabase.from('table').select());
if (error) {
  console.log(error.userMessage); // Show to user
}

// Create validation errors
throw ValidationErrors.required('email');
throw ValidationErrors.minLength('password', 8);
throw ValidationErrors.range('age', 18, 65);
```

### Error Types:
- `NETWORK_ERROR`: Connection issues (retryable)
- `AUTHENTICATION_ERROR`: Session expired
- `AUTHORIZATION_ERROR`: Permission denied
- `RATE_LIMIT_ERROR`: 429 Too Many Requests (retryable)
- `SERVER_ERROR`: 5xx errors (retryable)
- `AI_SERVICE_ERROR`: Hugging Face API issues
- `DATABASE_ERROR`: Query failures
- `VALIDATION_ERROR`: Input validation
- `NOT_FOUND_ERROR`: 404 resource missing
- `CONFLICT_ERROR`: Duplicate entry

### Key Utilities:
- `parseError()`: Converts unknown errors to AppError
- `isRetryableError()`: Checks if error should be retried
- `retryWithBackoff()`: Exponential backoff retry logic
- `withTimeout()`: Execute with timeout
- `tryCatch()`: Promise-based error handling

---

## Testing

### Unit Tests

**File**: `src/__tests__/core.test.ts`

Tests for core functions:
- Error parsing (network, auth, DB, etc.)
- Retry logic and backoff
- Token cost calculations
- Validation error factories
- Rate limiting logic

### Integration Tests

**File**: `src/__tests__/integration.test.ts`

Tests for full user flows:
- Chat message send/receive
- Operational question routing
- AI conversation flow
- Rate limiting enforcement
- Token usage logging
- Booking with smart pricing
- Container allocation
- Live tracking simulation
- Security/RLS enforcement

## To Run Tests

```bash
# Install test runner (if not already installed)
npm install -D vitest

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## Implementation Guide

### 1. Deploy Migrations

```bash
# Apply advanced features and security migration
supabase migration up

# Or manually in Supabase Dashboard:
# SQL Editor > Run migration 002_advanced_features_and_security.sql
```

### 2. Configure Environment Variables

```bash
# In Supabase Dashboard > Settings > Functions > Edge Function Secrets
HF_API_TOKEN=hf_xxxxxxxxxxxx  # Your Hugging Face API token
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2  # Your chosen model

# Optional: Vercel
# In Vercel Dashboard > Settings > Environment Variables
HF_API_TOKEN=hf_xxxxxxxxxxxx
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
```

### 3. Deploy Edge Function

```bash
# Deploy updated ai-chat function with new error handling
supabase functions deploy ai-chat

# Verify deployment
supabase functions list
```

### 4. Test Features Locally

```bash
# Run dev server
npm run dev

# Test token usage:
# 1. Send message in chat
# 2. Check `token_usage` table in Supabase
# 3. Verify cost calculation

# Test rate limiting:
# 1. Send many messages rapidly
# 2. Should hit limit after ~100 in 1 hour
# 3. See countdown in UI

# Test search:
# 1. Send messages with specific keywords
# 2. Use search field to find them
# 3. Verify full-text search results

# Test error handling:
# 1. Disconnect internet -> see network error with retry
# 2. Unset HF_MODEL -> see config error
# 3. Send invalid input -> see validation error
```

---

## Database Schema Summary

```sql
-- Phase 9+ tables created by migration 002
- token_usage: Track AI API costs per user
- rate_limits: Enforce message rate limits per user
- message_search: Full-text search index for messages
- audit_log: Audit trail for admin/compliance
- container_allocation_log: Track container usage history

-- All tables have RLS policies applied
-- All queries go through auth.uid() checks
```

---

## Performance Considerations

### Indexes:
- `token_usage`: (user_id, timestamp) for fast stats
- `rate_limits`: (user_id) unique for fast lookup
- `message_search`: GIN index on `content_tsv` for FTS
- `audit_log`: (user_id, table_name, created_at)
- `container_allocation_log`: (container_id, booking_id, timestamp)

### Query Optimization:
- Use `.select('*')` only when needed
- Leverage indexes on frequently filtered columns
- Implement pagination for large result sets
- Cache user token stats after initial load

---

## Troubleshooting

### Chat messages not appearing?
1. Check HF_MODEL is set in Supabase Functions settings
2. Verify Realtime is enabled on messages table
3. Check browser console for errors
4. Review edge function logs in Supabase Dashboard

### Rate limit not working?
1. Ensure rate_limits table exists (run migration)
2. Check user_id matches auth.uid()
3. Verify window_seconds matches your config

### Search not finding results?
1. Confirm message_search table exists
2. Check trigger is firing (INSERT message, check message_search)
3. Use websearch syntax: "keyword1 AND keyword2"

### High token costs?
1. Use smaller model: openchat/openchat-3.5 (cheaper)
2. Reduce max_new_tokens in ai-chat function
3. Review token_usage table for patterns
4. Implement cost caps per user if needed

---

## Next Steps & Future Enhancements

- [ ] Admin dashboard for token usage analytics
- [ ] Custom rate limit tiers (free/pro/enterprise)
- [ ] Message archival and export
- [ ] Advanced NLP for better trending topics
- [ ] Cost predictions and budget alerts
- [ ] Webhook notifications for important events
- [ ] API rate limiting (separate from message limits)
- [ ] Batch operations for bulk imports
- [ ] Message threading/reply feature
- [ ] Media attachment support (files, images)

---

## Support & Documentation

- Supabase Docs: https://supabase.com/docs
- PostgreSQL FTS: https://www.postgresql.org/docs/current/textsearch.html
- Hugging Face API: https://huggingface.co/api-inference
- VS Code Testing: https://vitest.dev/

---

**Last Updated**: February 17, 2026  
**Status**: Phases 1-9 Complete, Optional Phases 10+ Ready for Implementation
