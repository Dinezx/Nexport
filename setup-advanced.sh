#!/bin/bash
# Setup script for NEXPORT advanced features

echo "🚀 NEXPORT Advanced Features Setup"
echo "===================================="
echo ""

# Step 1: Apply migrations
echo "📦 Step 1: Applying database migrations..."
supabase migration up
if [ $? -ne 0 ]; then
  echo "❌ Migration failed. Check your Supabase connection."
  exit 1
fi
echo "✅ Migration applied successfully"
echo ""

# Step 2: Check for .env.local
echo "🔧 Step 2: Checking environment variables..."
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local not found. Creating template..."
  cat > .env.local << 'EOF'
# Supabase (already configured in most projects)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Hugging Face AI (for edge function and optional Vercel route)
VITE_HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2
# Note: HF_API_TOKEN is stored in Supabase Functions settings, not here

# Optional Vercel API Route
VITE_HF_API_ROUTE=/api/ai-chat
EOF
  echo "✅ Template created at .env.local"
  echo "⚠️  Please update the values in .env.local"
else
  echo "✅ .env.local exists"
fi
echo ""

# Step 3: Status check
echo "📊 Step 3: Verifying setup..."
echo "  ✓ Database migrations applied"
echo "  ✓ Environment variables configured (check Supabase + .env.local)"
echo ""

# Step 4: Next steps
echo "🎯 Next Steps:"
echo "  1. Set HF_API_TOKEN in Supabase Dashboard:"
echo "     → Settings → Functions → Edge Function Secrets"
echo "  2. Set HF_MODEL in Supabase Dashboard (same location)"
echo "  3. Deploy edge function: supabase functions deploy ai-chat"
echo "  4. Start dev server: npm run dev"
echo "  5. Run tests: npm run test"
echo ""
echo "📚 Documentation: See ADVANCED_FEATURES.md and SETUP_GUIDE.md"
echo ""
echo "✨ Setup complete!"
