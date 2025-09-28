# RefNet Graph Viewer

A graph visualization component for RefNet, built with React and D3.js.

## Features

- **Interactive Graph Visualization**: Force-directed layout with drag-and-drop nodes
- **Real-time Search**: Filter papers by title, authors, or topics
- **Node Interactions**: Hover effects, click to select, and detailed tooltips
- **Multiple Views**: Switch between Papers, Edges, and Tags views
- **AI Integration**: OpenAI-powered summarization panel
- **Export Functionality**: Export graph data as JSON
- **Responsive Design**: Works on desktop and mobile devices

## Installation

```bash
cd refnet/frontend/graph_viewer
npm install
```

## Development

```bash
npm start
```

Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Testing

```bash
npm test
```

Launches the test runner in interactive watch mode.

## Building for Production

```bash
npm run build
```

Builds the app for production to the `build` folder.

## Components

### GraphViewer
The main graph visualization component using D3.js for:
- Force-directed layout simulation
- Interactive node and edge rendering
- Zoom and pan functionality
- Hover effects and selection

### SearchBar
Real-time search functionality with:
- Input validation
- Debounced search
- Clear button

### ReferencesPanel
Side panel showing:
- List of papers with metadata
- Active selection highlighting
- Export functionality

### ControlPanel
View switching controls:
- Papers view (P)
- Edges view (E) 
- Tags view (T)

### AIPanel
AI-powered features:
- Paper summarization
- Context-aware responses
- OpenAI integration

## Graph Features

### Interactive Features
- **Node Size**: Based on citation count
- **Node Color**: Changes based on selection/hover state
- **Edge Highlighting**: Connected nodes highlight on hover
- **Smooth Animations**: All interactions are smoothly animated
- **Force Simulation**: Nodes naturally arrange themselves

### Navigation
- **Zoom**: Mouse wheel or pinch to zoom
- **Pan**: Click and drag to move around
- **Node Dragging**: Drag individual nodes to reposition
- **Auto-layout**: Force simulation keeps nodes organized

## Data Structure

### Paper Object
```javascript
{
  id: 'paper1',
  title: 'Paper Title',
  authors: ['Author 1', 'Author 2'],
  year: 2023,
  abstract: 'Paper abstract...',
  citations: 45,
  doi: '10.1000/test',
  topics: ['AI', 'ML', 'NLP']
}
```

### Citation Object
```javascript
{
  source: 'paper1',
  target: 'paper2',
  type: 'cites'
}
```

## Styling

The component uses a modern dark theme:
- Dark background (#1e1e1e)
- Purple accent color (#7c3aed)
- Subtle borders and shadows
- Smooth transitions and hover effects

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

- React 18.2.0
- D3.js 7.8.5
- React Testing Library
- Jest
