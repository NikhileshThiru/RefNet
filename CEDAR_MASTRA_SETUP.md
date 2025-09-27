# Cedar OS + Mastra Backend Setup

This project now uses Cedar OS frontend with a Mastra backend for intelligent research paper analysis.

## 🏗️ Architecture

- **Frontend**: Cedar OS (React) - Enhanced chat interface
- **Backend**: Mastra - AI agent orchestration
- **AI**: OpenAI GPT-4o - Research analysis

## 🚀 Quick Start

### 1. Set Environment Variables
```bash
export OPENAI_API_KEY='your-openai-api-key-here'
```

### 2. Start Both Services
```bash
./start_cedar_mastra.sh
```

This will start:
- Mastra backend on `http://localhost:4111`
- React frontend on `http://localhost:3000`

### 3. Test the Backend
```bash
node test_mastra_backend.js
```

## 🤖 How It Works

### Mastra Backend (`mastra-backend/`)
- **Research Analysis Agent**: Analyzes papers and provides insights
- **Context Awareness**: Receives selected papers and graph data
- **Intelligent Responses**: Generates comprehensive analysis

### Cedar OS Frontend (`refnet/frontend/`)
- **FloatingCedarChat**: Enhanced chat interface
- **State Management**: Tracks selected papers and graph context
- **Real-time Communication**: Connects to Mastra backend

## 📊 Features

### Research Analysis
- **Single Paper Analysis**: Deep dive into individual papers
- **Comparative Analysis**: Compare multiple papers
- **Pattern Recognition**: Find common themes and relationships
- **Gap Identification**: Discover research opportunities

### Smart Context
- **Paper Selection**: Automatically receives selected papers
- **Graph Data**: Understands paper relationships
- **Dynamic Responses**: Adapts to different query types

## 🔧 Configuration

### Mastra Backend
- **Port**: 4111 (configurable in `server.js`)
- **CORS**: Enabled for localhost:3000 and localhost:3001
- **Model**: GPT-4o for high-quality analysis

### Cedar OS Frontend
- **Provider**: Mastra backend
- **Base URL**: http://localhost:4111
- **Chat Path**: /chat

## 📝 Usage

1. **Select Papers**: Click on papers in the graph interface
2. **Open Chat**: Click the chat button to open FloatingCedarChat
3. **Ask Questions**: Type questions about the selected papers
4. **Get Insights**: Receive intelligent analysis and comparisons

### Example Queries
- "What do you know about these papers?"
- "Compare the methodologies used"
- "What are the main findings?"
- "Identify research gaps"
- "How do these papers relate to each other?"

## 🛠️ Development

### Backend Development
```bash
cd mastra-backend
npm run dev  # Auto-restart on changes
```

### Frontend Development
```bash
cd refnet/frontend
npm start  # Hot reload enabled
```

### Testing
```bash
# Test Mastra backend
node test_mastra_backend.js

# Test full integration
./start_cedar_mastra.sh
```

## 📁 File Structure

```
RefNet/
├── mastra-backend/           # Mastra backend server
│   ├── server.js            # Main server with research agent
│   └── package.json         # Backend dependencies
├── refnet/frontend/         # Cedar OS frontend
│   ├── src/components/
│   │   └── FloatingCedarChat.js  # Enhanced chat component
│   └── src/cedar/           # Cedar configuration
├── start_cedar_mastra.sh    # Startup script
└── test_mastra_backend.js   # Backend test script
```

## 🔍 Troubleshooting

### Backend Issues
- Check if Mastra backend is running on port 4111
- Verify OpenAI API key is set
- Check console logs for errors

### Frontend Issues
- Ensure backend is running before starting frontend
- Check browser console for connection errors
- Verify CORS settings in backend

### Connection Issues
- Backend URL: http://localhost:4111
- Frontend URL: http://localhost:3000
- Check firewall settings

## 🎯 Benefits

### Over Custom Python Backend
- ✅ **Pure Cedar OS**: Uses official Cedar + Mastra stack
- ✅ **Less Code**: Simpler implementation
- ✅ **Better Integration**: Native Cedar OS features
- ✅ **Easier Maintenance**: Standard framework patterns

### Research Analysis Features
- ✅ **Intelligent Analysis**: GPT-4o powered insights
- ✅ **Context Awareness**: Understands paper relationships
- ✅ **Adaptive Responses**: Different analysis types
- ✅ **Rich Output**: Formatted, structured responses

## 🚀 Next Steps

1. **Start the services**: `./start_cedar_mastra.sh`
2. **Test the integration**: Select papers and ask questions
3. **Customize agents**: Modify `mastra-backend/server.js`
4. **Add features**: Extend the research analysis capabilities

The system is now ready for intelligent research paper analysis! 🎉
