# RefNet - Research Paper Search & Citation Network Visualization

🏆 **2nd Place Overall Winner at HackGT 12** 🏆

**Team Members:**
- Nikhilesh
- Dhruva
- Shreyas
- Krishna

RefNet is a comprehensive tool for searching research papers and visualizing their citation networks. It combines a powerful search interface with an interactive graph visualization and AI-powered analysis to help researchers explore academic literature and understand citation relationships.

## 🤖 AI-Powered Research Analysis

- **Custom Mastra Backend**: Express.js + OpenAI GPT-4o for intelligent research analysis
- **Smart Context**: AI understands your selected papers and graph relationships
- **Research Insights**: Compare papers, identify patterns, and discover research gaps
- **Real-time Analysis**: Ask questions about your selected papers and get instant insights
- **Review Paper Generation**: AI-powered literature review creation with PDF export

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
- **Graph Rebuild Fallback**: Automatic restoration of previous graph on rebuild failure

### 📄 **AI-Powered Review Paper Generation**
- Generate comprehensive literature reviews from selected papers
- AI-generated sections: Abstract, Introduction, Fundamentals, Types & Categories, State-of-the-Art
- Intelligent title generation based on paper analysis
- PDF export with academic formatting
- Text file fallback for compatibility

### 🚀 **Modern Web Interface**
- Responsive design that works on desktop and mobile
- Fast, modern React frontend
- Real-time API integration
- Intuitive user experience
- **PWA Support**: Manifest.json for progressive web app capabilities

## Quick Start

### Prerequisites
- Python 3.8+ (for search API)
- Node.js 18+ (for Mastra AI backend)
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

### Docker Setup (Production)

```bash
# Set your OpenAI API key
export OPENAI_API_KEY='your-openai-api-key-here'

# Start with Docker Compose
docker-compose up
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

5. **Generate Review Papers**:
   - Select papers from your graph
   - Click "Generate Survey Paper" to create AI-powered literature review
   - Export as PDF or text file

6. **Navigate**: Use the back button to return to search results or start a new search.

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

### AI Backend (Mastra)
- `POST /chat` - AI chat and research analysis
- `GET /health` - Health check

## Project Structure

```
RefNet/
├── app.py                    # Flask search API entry point
├── config.py                # Configuration settings
├── requirements.txt         # Python dependencies
├── mastra-backend/          # Mastra AI backend (Node.js + Express)
│   ├── server.js           # AI agent server
│   ├── package.json        # Backend dependencies
│   └── README.md           # Backend documentation
├── refnet/
│   ├── api/                # API route blueprints
│   │   ├── chat_routes.py  # Chat API routes
│   │   ├── graph_routes.py # Graph API routes
│   │   ├── paper_routes.py # Paper API routes
│   │   └── search_routes.py # Search API routes
│   ├── models/             # Data models
│   │   ├── graph.py        # Graph data models
│   │   └── paper.py        # Paper data models
│   ├── services/           # Business logic services
│   │   ├── graph_service.py # Graph processing
│   │   └── openalex_service.py # OpenAlex API integration
│   ├── utils/              # Utility functions
│   │   ├── rate_limiter.py # API rate limiting
│   │   └── validators.py   # Data validation
│   ├── tests/              # Test files
│   └── frontend/           # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── GraphViewerClean.js    # Main graph visualization
│       │   │   ├── FloatingCedarChat.js   # AI chat interface
│       │   │   ├── LandingPage.js         # Search interface
│       │   │   └── ChatTracker.js         # Chat management
│       │   ├── services/
│       │   │   ├── api.js                 # API client
│       │   │   └── cedarAgent.js          # AI agent service
│       │   ├── cedar/                     # Cedar OS configuration
│       │   └── ...
│       ├── public/
│       │   ├── index.html
│       │   ├── favicon.ico
│       │   ├── logo.svg
│       │   ├── logo192.png
│       │   └── manifest.json              # PWA manifest
│       └── package.json
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile.flask         # Flask API Docker image
├── Dockerfile.mastra        # Mastra AI Docker image
├── start_cedar_mastra.sh    # Development startup script
└── README.md
```

## Technologies Used

### Backend
- **Flask**: Search API framework
- **Express.js**: Mastra AI backend framework
- **OpenAI GPT-4o**: Research analysis AI
- **OpenAlex API**: Research paper data source
- **NetworkX**: Graph analysis and processing
- **Flask-CORS**: Cross-origin resource sharing

### Frontend
- **React 18**: UI framework
- **React Router**: Client-side routing
- **D3.js**: Graph visualization
- **Axios**: HTTP client
- **Tailwind CSS**: Styling
- **PWA**: Progressive Web App capabilities

### Deployment
- **Docker**: Containerization
- **AWS EC2**: Cloud hosting
- **Docker Compose**: Multi-service orchestration
- **Production URLs**:
  - Frontend: `https://refnet.wiki`
  - API: `https://api.refnet.wiki`
  - Mastra AI: `https://api.refnet.wiki/mastra`

## Review Paper Generation

The system generates comprehensive literature reviews using AI-powered content creation:

1. **Paper Selection**: Users select papers from the citation graph
2. **AI Analysis**: Each paper gets an AI-generated summary via GPT-4o
3. **Content Generation**: Creates 5 sections (Abstract, Introduction, Fundamentals, Types & Categories, State-of-the-Art)
4. **PDF Export**: Uses browser print functionality for professional PDF output
5. **Fallback**: Text file export if PDF generation fails

**Tech Stack for Review Generation:**
- **AI Backend**: Mastra (Express.js + OpenAI GPT-4o)
- **PDF Generation**: Browser native print functionality
- **Content Processing**: Custom algorithms for domain detection and title generation
- **Formatting**: HTML-to-PDF with academic styling

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
- [OpenAI](https://openai.com/) for AI-powered research analysis
- The academic research community for inspiration and use cases
- HackGT 12 organizers and judges for the recognition