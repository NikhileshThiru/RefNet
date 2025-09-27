# RefNet Mastra Backend

AI-powered research paper analysis backend using Express.js and OpenAI.

## Features

- **Real AI Analysis**: Uses OpenAI GPT-4o to analyze selected research papers
- **Context Awareness**: Receives paper data and graph context from frontend
- **Intelligent Responses**: Provides comprehensive analysis and insights
- **REST API**: Simple Express.js endpoints for easy integration

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set OpenAI API key:**
   ```bash
   export OPENAI_API_KEY='your-openai-api-key-here'
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## API Endpoints

### Health Check
```bash
GET /health
```

### Chat Analysis
```bash
POST /chat
Content-Type: application/json

{
  "prompt": "What do you know about these papers?",
  "additionalContext": {
    "selectedPapers": [
      {
        "title": "Paper Title",
        "authors": ["Author 1", "Author 2"],
        "year": 2023,
        "citations": 50,
        "topics": ["AI", "ML"],
        "abstract": "Paper abstract..."
      }
    ],
    "graphData": {
      "totalNodes": 1,
      "totalLinks": 0
    }
  }
}
```

## How It Works

1. **Receives Context**: Gets selected papers and graph data from Cedar OS frontend
2. **AI Analysis**: Uses OpenAI GPT-4o to analyze the papers
3. **Comprehensive Response**: Provides detailed analysis, comparisons, and insights
4. **Returns Results**: Sends formatted response back to frontend

## Integration

This backend is designed to work with:
- **Cedar OS Frontend**: Receives context and displays responses
- **RefNet Graph**: Gets paper selection and network data
- **OpenAI API**: Performs the actual AI analysis

The backend automatically handles different types of queries:
- Single paper analysis
- Multiple paper comparisons
- Research gap identification
- Methodology analysis
- Trend analysis
