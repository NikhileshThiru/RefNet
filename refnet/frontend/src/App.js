import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import GraphViewerClean from './components/GraphViewerClean';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/graph/:paperId" element={<GraphViewerClean />} />
          <Route path="/graph" element={<GraphViewerClean />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;