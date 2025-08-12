#!/bin/bash

echo "🎬 Starting Unified Movie Score Server..."
echo "📦 Installing dependencies..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "🚀 Starting server on port 3000..."
echo "🌐 Open http://localhost:3000 in your browser"
echo "🔍 API endpoint: http://localhost:3000/api/movie/:title"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
node server.js
