#!/bin/bash

# Start RefNet (Flask API + Mastra AI + React Frontend)
echo "🚀 Starting RefNet"
echo "=================="

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY environment variable not set"
    echo "Please set your OpenAI API key:"
    echo "export OPENAI_API_KEY='your-api-key-here'"
    exit 1
fi

echo "✅ OpenAI API key found"

# Start Flask search API in background
echo "🔍 Starting Flask search API on port 8000..."
python app.py &
FLASK_PID=$!

# Wait a moment for Flask to start
sleep 2

# Start Mastra backend in background
echo "🤖 Starting Mastra AI backend on port 4111..."
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
echo "🎉 All services started!"
echo "📱 Frontend:      http://localhost:3000"
echo "🔍 Flask API:     http://localhost:8000"
echo "🤖 Mastra AI:     http://localhost:4111"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $FLASK_PID 2>/dev/null
    kill $MASTRA_PID 2>/dev/null
    kill $REACT_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
