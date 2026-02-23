# AI Chat Implementation TODO

## 1. Update Supabase Edge Function (ai-chat/index.ts)
- [x] Read OPENAI_API_KEY from environment
- [x] Parse POST body for `message` and `conversationId`
- [x] Fetch conversation context from Supabase
- [x] Call OpenAI Chat Completions API with gpt-4o-mini model
- [x] Return JSON { "reply": "AI response text" }
- [x] Handle CORS properly
- [x] Add proper error handling and logging

## 2. Update Frontend (Chat.tsx)
- [x] Change function invoke body to { message: userMessage, conversationId: conversation.id }
- [x] Insert AI reply into messages table after successful call

## 3. Deployment and Testing
- [ ] Deploy function using Supabase CLI
- [ ] Set OPENAI_API_KEY in Supabase secrets
- [ ] Test the integration
- [ ] Provide debugging checklist
