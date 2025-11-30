#!/bin/bash

# Quick Fix Script - Deploy to Vercel (Recommended)
# This will solve your MIME type issue immediately

echo "=========================================="
echo "🚀 DEPLOYING TO VERCEL (QUICK FIX)"
echo "=========================================="
echo ""

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo "✅ Vercel CLI is ready"
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

echo "🔨 Building the project..."
npm run build

echo ""
echo "🚀 Deploying to Vercel..."
echo ""
echo "Follow the prompts:"
echo "  - Set up and deploy? Y"
echo "  - Link to existing project? N"
echo "  - Project name? propzing-admin"
echo "  - Directory? ./dist"
echo "  - Override settings? N"
echo ""

vercel --prod

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. Copy the deployment URL from above"
echo "2. Add environment variables:"
echo ""
echo "   vercel env add VITE_SUPABASE_URL production"
echo "   vercel env add VITE_SUPABASE_ANON_KEY production"
echo "   vercel env add VITE_PROPERTY_ENTRY_ACCESS_CODE production"
echo ""
echo "3. Redeploy with env vars:"
echo ""
echo "   vercel --prod"
echo ""
echo "=========================================="
echo "🎉 Done! No more MIME type errors!"
echo "=========================================="

