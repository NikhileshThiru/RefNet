# RefNet Frontend

This is the React frontend for RefNet, a research paper search and citation network visualization tool.

## Features

- **Landing Page**: Search for research papers with filters and sorting
- **Graph Viewer**: Interactive citation network visualization with D3.js
- **API Integration**: Seamless communication with the Flask backend
- **Responsive Design**: Works on desktop and mobile devices

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Development

The frontend runs on `http://localhost:3000` in development mode and automatically proxies API calls to the Flask backend running on `http://localhost:5000`.

## Project Structure

- `src/components/`: React components
  - `LandingPage.js`: Search interface and paper listing
  - `GraphViewerClean.js`: Interactive citation network visualization
- `src/services/`: API service layer
  - `api.js`: Axios-based API client for backend communication
- `public/`: Static assets and HTML template

## API Integration

The frontend communicates with the Flask backend through the following endpoints:

- `GET /api/search`: Search for research papers
- `GET /api/paper/:id`: Get paper details
- `GET /api/graph/:id`: Build citation graph from a paper
- `POST /api/graph/multiple`: Build graph from multiple papers

## Technologies Used

- React 18
- React Router DOM
- D3.js for graph visualization
- Axios for API calls
- CSS3 for styling
