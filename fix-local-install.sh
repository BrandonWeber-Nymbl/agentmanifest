#!/bin/bash

# Fix local installation for macOS/darwin-arm64

echo "🔧 Fixing local node_modules for your platform..."

# Clean and reinstall validator
echo "📦 Reinstalling validator dependencies..."
cd validator
rm -rf node_modules
npm install
cd ..

# Clean and reinstall registry
echo "📦 Reinstalling registry dependencies..."
cd registry
rm -rf node_modules
npm install
cd ..

# Clean root node_modules if it exists
if [ -d "node_modules" ]; then
  echo "📦 Cleaning root node_modules..."
  rm -rf node_modules
  npm install
fi

echo "✅ Local installation fixed!"
echo ""
echo "Now try running:"
echo "  cd validator"
echo "  npm run cli -- validate https://bakebase.agent-manifest.com"
