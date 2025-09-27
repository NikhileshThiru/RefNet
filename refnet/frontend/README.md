# RefNet Frontend

This is the React frontend for RefNet, a research paper search and citation network visualization tool.

## Features

- **Landing Page**: Search for research papers with filters and sorting
- **Graph Viewer**: Interactive citation network visualization with D3.js
- **Floating Chat**: Create multiple chat windows for selected papers (frontend only)
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
  - `FloatingChat.js`: Floating chat component for selected papers
- `src/services/`: API service layer
  - `api.js`: Axios-based API client for backend communication
- `public/`: Static assets and HTML template

## Floating Chat Feature

The floating chat feature allows users to create multiple chat windows for different sets of selected papers:

### How to Use:
1. **Select Papers**: Click on 2 or more nodes in the graph to select them
2. **Create Chat**: Click the "💬 Start Chat" button that appears in the header
3. **Manage Chats**: 
   - Drag chats around the screen by their header
   - Minimize/maximize chats using the minimize button
   - Close chats temporarily or delete them permanently
   - Switch between active chats using the chat tabs in the header
4. **Chat Interface**: 
   - View selected papers information at the top of each chat
   - Send messages (currently shows placeholder responses)
   - Each chat is independent and can be positioned anywhere

### Features:
- **Multiple Chats**: Create unlimited chat windows for different paper combinations
- **Drag & Drop**: Move chats around the screen freely
- **Minimize/Maximize**: Save screen space by minimizing chats
- **Duplicate Prevention**: Prevents creating duplicate chats for the same paper set
- **Responsive Design**: Chats adapt to different screen sizes

### Future Integration:
This is currently a frontend-only implementation. The Cedar OS integration will be added later to provide actual AI-powered chat functionality.

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
