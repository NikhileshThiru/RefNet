#!/bin/bash

# RefNet Application Startup Script
echo "🚀 Starting RefNet Application..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Please create one with your OpenAI API key:"
    echo "   OPENAI_API_KEY=your_openai_api_key_here"
    exit 1
fi

# Start backend
echo "📡 Starting backend server..."
python app.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend started successfully"

# Start frontend
echo "🎨 Starting frontend server..."
cd refnet/frontend
export NODE_OPTIONS="--openssl-legacy-provider"
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 10

# Check if frontend is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Frontend started successfully"
echo ""
echo "🌐 Application is running at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   Health Check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
