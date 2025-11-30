#!/bin/bash

# Property Entry Form - Quick Setup Script
# This script helps you get started quickly

echo "🚀 Property Entry Form - Quick Setup"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local already exists"
else
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local and add your Supabase credentials"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Deploy the Edge Function: supabase functions deploy property-entry"
echo "3. Run the dev server: npm run dev"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Main documentation"
echo "   - DEPLOYMENT.md - Deployment guide"
echo "   - SAMPLE_DATA.md - Test data"
echo ""
echo "🔗 The app will run at: http://localhost:5173"
echo ""

