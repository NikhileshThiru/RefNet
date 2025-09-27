#!/bin/bash

# Start RefNet with Cedar OS + Mastra Backend
echo "🚀 Starting RefNet with Cedar OS + Mastra Backend"
echo "=================================================="

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY environment variable not set"
    echo "Please set your OpenAI API key:"
    echo "export OPENAI_API_KEY='your-api-key-here'"
    exit 1
fi

echo "✅ OpenAI API key found"

# Start Mastra backend in background
echo "🤖 Starting Mastra backend on port 4111..."
cd mastra-backend
npm start &
MASTRA_PID=$!
cd ..

# Wait a moment for Mastra to start
sleep 3

# Start React frontend
echo "⚛️  Starting React frontend on port 3000..."
cd refnet/frontend
npm start &
REACT_PID=$!
cd ../..

echo ""
echo "🎉 Both services started!"
echo "📱 Frontend: http://localhost:3000"
echo "🤖 Mastra Backend: http://localhost:4111"
echo ""
echo "Press Ctrl+C to stop both services"

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $MASTRA_PID 2>/dev/null
    kill $REACT_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
