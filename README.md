# RefNet - Research Paper Search & Citation Network Visualization

RefNet is a comprehensive tool for searching research papers and visualizing their citation networks. It combines a powerful search interface with an interactive graph visualization to help researchers explore academic literature and understand citation relationships.

## Features

### 🔍 **Advanced Search**
- Search research papers by title, authors, topics, and keywords
- Filter results by publication date, citation count, and relevance
- Sort by most cited, relevance score, or publication date
- Paginated results with customizable page sizes

### 📊 **Interactive Graph Visualization**
- Build citation networks from any research paper
- Interactive D3.js-powered graph with zoom, pan, and drag functionality
- Node selection and highlighting
- Timeline-based color coding
- Export selected papers and graph data

### 🚀 **Modern Web Interface**
- Responsive design that works on desktop and mobile
- Fast, modern React frontend
- Real-time API integration
- Intuitive user experience

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Flask backend:**
   ```bash
   python app.py
   ```

   The API will be available at `http://localhost:5000`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd refnet/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

   The frontend will be available at `http://localhost:3000`

### Production Build

To build the frontend for production:

```bash
cd refnet/frontend
npm run build
```

The built files will be in `refnet/frontend/build/` and will be automatically served by the Flask backend.

## Usage

1. **Search Papers**: Use the landing page to search for research papers by entering keywords, author names, or topics.

2. **View Graph**: Click "View Graph" on any paper to build and visualize its citation network.

3. **Explore Network**: 
   - Click and drag nodes to rearrange the graph
   - Click nodes to select/deselect them
   - Use the controls to adjust graph parameters (iterations, limits)
   - Export selected papers as JSON

4. **Navigate**: Use the back button to return to search results or start a new search.

## API Endpoints

### Search
- `GET /api/search?q=query&page=1&per_page=25&sort=cited_by_count` - Search papers

### Papers
- `GET /api/paper/{paper_id}` - Get paper details
- `GET /api/paper/{paper_id}/citations` - Get paper citations
- `GET /api/paper/{paper_id}/references` - Get paper references

### Graph
- `GET /api/graph/{paper_id}?iterations=3&cited_limit=5&ref_limit=5` - Build citation graph
- `POST /api/graph/multiple` - Build graph from multiple papers
- `GET /api/graph/stats` - Get graph statistics
- `POST /api/graph/clear` - Clear current graph

## Project Structure

```
RefNet/
├── app.py                 # Flask application entry point
├── config.py             # Configuration settings
├── requirements.txt      # Python dependencies
├── refnet/
│   ├── api/             # API route blueprints
│   ├── models/          # Data models
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── frontend/        # React frontend
│       ├── src/
│       │   ├── components/
│       │   ├── services/
│       │   └── ...
│       ├── public/
│       └── package.json
└── README.md
```

## Technologies Used

### Backend
- **Flask**: Web framework
- **OpenAlex API**: Research paper data source
- **NetworkX**: Graph analysis
- **Flask-CORS**: Cross-origin resource sharing

### Frontend
- **React 18**: UI framework
- **React Router**: Client-side routing
- **D3.js**: Graph visualization
- **Axios**: HTTP client
- **CSS3**: Styling

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