# RefNet - Research Paper Search & Citation Network Visualization

RefNet is a comprehensive tool for searching research papers and visualizing their citation networks. It combines a powerful search interface with an interactive graph visualization and AI-powered analysis to help researchers explore academic literature and understand citation relationships.

## 🤖 AI-Powered Research Analysis

- **Cedar OS + Mastra Backend**: Intelligent chat interface for paper analysis
- **Smart Context**: AI understands your selected papers and graph relationships
- **Research Insights**: Compare papers, identify patterns, and discover research gaps
- **Real-time Analysis**: Ask questions about your selected papers and get instant insights

## Features

### 🔍 **Advanced Search**
- Search research papers by title, authors, topics, and keywords
- Filter results by publication date, citation count, and relevance
- Sort by most cited, relevance score, or publication date
- Paginated results with customizable page sizes
- **Multiselect functionality** - Select multiple papers to build combined citation networks

### 📊 **Interactive Graph Visualization**
- Build citation networks from any research paper or multiple papers
- Interactive D3.js-powered graph with zoom, pan, and drag functionality
- Node selection and highlighting
- Timeline-based color coding
- Light grey/white lines for clean, academic appearance
- Export selected papers and graph data

### 🚀 **Modern Web Interface**
- Responsive design that works on desktop and mobile
- Fast, modern React frontend
- Real-time API integration
- Intuitive user experience

## Quick Start

### Prerequisites
- Python 3.8+ (for search API)
- Node.js 18+ (for Cedar OS + Mastra)
- npm or yarn
- OpenAI API key

### Setup

1. **Set your OpenAI API key:**
   ```bash
   export OPENAI_API_KEY='your-openai-api-key-here'
   ```

2. **Start all services:**
   ```bash
   ./start_cedar_mastra.sh
   ```

   This will start:
   - Flask search API on `http://localhost:8000`
   - Mastra AI backend on `http://localhost:4111`
   - React frontend on `http://localhost:3000`

### Manual Setup (Alternative)

If you prefer to start services manually:

1. **Start Flask search API:**
   ```bash
   python app.py
   ```

2. **Start Mastra AI backend:**
   ```bash
   cd mastra-backend
   npm start
   ```

3. **Start React frontend:**
   ```bash
   cd refnet/frontend
   npm start
   ```

### Production Build

To build the frontend for production:

```bash
cd refnet/frontend
npm run build
```

The built files will be in `refnet/frontend/build/` and will be automatically served by the Flask backend.

## Usage

1. **Search Papers**: Use the landing page to search for research papers by entering keywords, author names, or topics.

2. **Select Papers**: 
   - Use checkboxes to select multiple papers from search results
   - Click "Build Graph" to create a combined citation network from all selected papers
   - Or click "View Graph" on individual papers for single-paper networks

3. **Explore Network**: 
   - Click and drag nodes to rearrange the graph
   - Click nodes to select/deselect them
   - Use the controls to adjust graph parameters (iterations, limits)
   - Export selected papers as JSON

4. **AI Analysis**: 
   - Click the chat button to open the AI research assistant
   - Ask questions about your selected papers
   - Get intelligent insights, comparisons, and research recommendations
   - The AI understands your paper context and graph relationships

5. **Navigate**: Use the back button to return to search results or start a new search.

## API Endpoints

### Search
- `GET /api/search?q=query&page=1&per_page=25&sort=cited_by_count` - Search papers

### Papers
- `GET /api/paper/{paper_id}` - Get paper details
- `GET /api/paper/{paper_id}/citations` - Get paper citations
- `GET /api/paper/{paper_id}/references` - Get paper references

### Graph
- `GET /api/graph/{paper_id}?iterations=3&cited_limit=5&ref_limit=5` - Build citation graph from single paper
- `POST /api/graph/multiple` - Build graph from multiple papers (multiselect)
- `GET /api/graph/data` - Get current graph data
- `POST /api/graph/clear` - Clear current graph

## Project Structure

```
RefNet/
├── app.py                    # Flask search API entry point
├── config.py                # Configuration settings
├── requirements.txt         # Python dependencies
├── mastra-backend/          # Mastra AI backend
│   ├── server.js           # AI agent server
│   └── package.json        # Backend dependencies
├── refnet/
│   ├── api/                # API route blueprints
│   ├── models/             # Data models
│   ├── services/           # Business logic services
│   ├── utils/              # Utility functions
│   └── frontend/           # Cedar OS React frontend
│       ├── src/
│       │   ├── components/
│       │   │   └── FloatingCedarChat.js  # AI chat interface
│       │   ├── cedar/       # Cedar OS configuration
│       │   └── ...
│       ├── public/
│       └── package.json
├── start_cedar_mastra.sh   # Startup script
└── README.md
```

## Technologies Used

### Backend
- **Flask**: Search API framework
- **Mastra**: AI agent orchestration
- **OpenAI GPT-4o**: Research analysis AI
- **OpenAlex API**: Research paper data source
- **NetworkX**: Graph analysis
- **Flask-CORS**: Cross-origin resource sharing

### Frontend
- **Cedar OS**: AI-powered chat interface
- **React 18**: UI framework
- **React Router**: Client-side routing
- **D3.js**: Graph visualization
- **Axios**: HTTP client
- **Tailwind CSS**: Styling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [OpenAlex](https://openalex.org/) for providing research paper data
- [D3.js](https://d3js.org/) for graph visualization capabilities
- The academic research community for inspiration and use cases