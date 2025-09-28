import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAPI } from '../services/api';
import './LandingPage.css';

const LandingPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [sortBy, setSortBy] = useState('relevance_score');
  const [perPage, setPerPage] = useState(25);
  const [selectedPapers, setSelectedPapers] = useState(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  
  const navigate = useNavigate();

  // Function to handle import of JSON file
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            importGraphData(importData);
          } catch (error) {
            alert('Invalid JSON file: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Function to import and navigate to graph with imported data
  const importGraphData = (importData) => {
    try {
      console.log('🔄 Starting import process...');
      console.log('📄 Import data structure:', importData);
      
      // Check if we have complete graph data or fall back to selected papers (for backward compatibility)
      let importedNodes, importedLinks;
      
      if (importData.graph_data && importData.graph_data.nodes && importData.graph_data.links) {
        // Use complete graph data (new format)
        importedNodes = importData.graph_data.nodes;
        importedLinks = importData.graph_data.links;
        console.log('✅ Using new format with complete graph data');
      } else if (importData.selected_papers && Array.isArray(importData.selected_papers)) {
        // Fall back to selected papers only (old format for backward compatibility)
        importedNodes = importData.selected_papers;
        importedLinks = [];
        console.log('✅ Using old format with selected papers only');
      } else {
        throw new Error('Invalid JSON format: missing graph_data or selected_papers');
      }
      
      // Validate that papers have required fields
      const validPapers = importedNodes.filter(paper => 
        paper.id && paper.title && paper.authors && paper.year
      );
      
      console.log(`📊 Validated ${validPapers.length} papers out of ${importedNodes.length} total`);
      
      if (validPapers.length === 0) {
        throw new Error('No valid papers found in the imported data');
      }

      // Store the imported data directly in navigation state
      const graphData = {
        nodes: validPapers,
        links: importedLinks,
        parameters: importData.graph_parameters || {}
      };
      
      console.log('💾 Imported graph data:', graphData);
      console.log('📊 Number of nodes:', graphData.nodes.length);
      console.log('📊 Number of links:', graphData.links.length);
      
      // Navigate to graph viewer with the data directly in state
      console.log('🚀 Navigating to graph viewer with imported data...');
      navigate('/graph', {
        state: {
          importedGraphData: graphData,
          isImport: true,
          // Don't set paperIds to prevent API loading
        }
      });
      
      alert(`Successfully imported ${validPapers.length} papers! Redirecting to graph...`);
      
    } catch (error) {
      console.error('❌ Import error:', error);
      alert('Failed to import graph data: ' + error.message);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setPage(1);
    setSelectedPapers(new Set()); // Clear selections on new search
    setHasSearched(true); // Mark that a search has been performed

    try {
      const response = await searchAPI.searchPapers(query, 1, perPage, sortBy);
      setResults(response.papers || []);
      setTotalPages(response.total_pages || 0);
      setTotalResults(response.total_results || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;

    setLoading(true);
    try {
      const response = await searchAPI.searchPapers(query, newPage, perPage, sortBy);
      setResults(response.papers || []);
      setPage(newPage);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load page.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaperClick = (paperId) => {
    // Extract just the paper ID from the full OpenAlex URL
    const paperIdOnly = paperId.replace('https://openalex.org/', '');
    navigate(`/graph/${paperIdOnly}`, { state: { searchQuery: query } });
  };

  const handlePaperSelect = (paperId) => {
    const newSelected = new Set(selectedPapers);
    if (newSelected.has(paperId)) {
      newSelected.delete(paperId);
    } else {
      newSelected.add(paperId);
    }
    setSelectedPapers(newSelected);
  };

  const handleBuildGraph = () => {
    if (selectedPapers.size === 0) return;
    
    // Extract paper IDs from full URLs
    const paperIdsOnly = Array.from(selectedPapers).map(id => id.replace('https://openalex.org/', ''));
    
    if (paperIdsOnly.length === 1) {
      navigate(`/graph/${paperIdsOnly[0]}`, { state: { searchQuery: query } });
    } else {
      navigate('/graph', { state: { paperIds: paperIdsOnly, searchQuery: query } });
    }
  };

  const clearSelection = () => {
    setSelectedPapers(new Set());
  };

  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return 'No Authors';
    if (authors.length <= 3) return authors.join(', ');
    return `${authors.slice(0, 3).join(', ')} et al.`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      return new Date(dateString).getFullYear().toString();
    } catch {
      return 'Unknown Date';
    }
  };

  return (
    <div className="landing-page">
      {/* Sticky Logo in top left */}
      <div className="sticky-logo-container">
        <img src="/logo.svg" alt="RefNet Logo" className="sticky-logo" />
      </div>
      
      <main className="landing-main">
        <div className="logo-section">
          <h1 className="logo">Ref Net</h1>
          <p className="logo-subtitle">Literature Reviews Made Easy</p>
        </div>
        
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-container">
              <button 
                onClick={handleImport}
                className="search-container-import"
                title="Import a previously exported graph"
                type="button"
              >
                <svg className="import-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for research papers, authors, or topics..."
                className="search-container-input"
                disabled={loading}
              />
              
              <button 
                type="submit" 
                className="search-container-send"
                disabled={loading || !query.trim()}
              >
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="close-error">×</button>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h2>Search Results</h2>
              <div className="results-count-and-filters">
                <p className="results-count">
                  {totalResults.toLocaleString()} papers found
                </p>
                <div className="search-filters">
                  <div className="filter-group">
                    <label htmlFor="sort-select">Sort by:</label>
                    <select
                      id="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="filter-select"
                    >
                      <option value="cited_by_count">Most Cited</option>
                      <option value="relevance_score">Relevance</option>
                      <option value="publication_date">Publication Date</option>
                    </select>
                  </div>
                  
                  <div className="filter-group">
                    <label htmlFor="per-page-select">Results per page:</label>
                    <select
                      id="per-page-select"
                      value={perPage}
                      onChange={(e) => setPerPage(parseInt(e.target.value))}
                      className="filter-select"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>
              {selectedPapers.size > 0 && (
                <div className="selection-controls">
                  <span className="selection-count">
                    {selectedPapers.size} paper{selectedPapers.size !== 1 ? 's' : ''} selected
                  </span>
                  <button 
                    onClick={handleBuildGraph}
                    className="build-graph-button"
                  >
                    Build Graph ({selectedPapers.size})
                  </button>
                  <button 
                    onClick={clearSelection}
                    className="clear-selection-button"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>

            <div className="papers-list">
              {results.map((paper, index) => (
                <div 
                  key={paper.id || index} 
                  className={`paper-card ${selectedPapers.has(paper.id) ? 'selected' : ''}`}
                >
                  <div className="paper-header">
                    <div className="paper-title-section">
                      <input
                        type="checkbox"
                        checked={selectedPapers.has(paper.id)}
                        onChange={() => handlePaperSelect(paper.id)}
                        className="paper-checkbox"
                      />
                      <h3 className="paper-title" onClick={() => handlePaperClick(paper.id)}>
                        {paper.title || 'Untitled Paper'}
                      </h3>
                    </div>
                    <div className="paper-actions">
                      <button
                        onClick={() => handlePaperClick(paper.id)}
                        className="action-button primary"
                      >
                        View Graph
                      </button>
                    </div>
                  </div>
                  
                  <div className="paper-meta">
                    <p className="paper-authors">
                      {formatAuthors(paper.authors)}
                    </p>
                    <p className="paper-year">
                      {formatDate(paper.publication_date)} • {paper.cited_by_count || 0} citations
                    </p>
                  </div>
                  
                  {paper.abstract && (
                    <p className="paper-abstract">
                      {paper.abstract.length > 300 
                        ? `${paper.abstract.substring(0, 300)}...` 
                        : paper.abstract
                      }
                    </p>
                  )}
                  
                  {paper.topics && paper.topics.length > 0 && (
                    <div className="paper-topics">
                      {paper.topics.slice(0, 5).map((topic, idx) => (
                        <span key={idx} className="topic-tag">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || loading}
                  className="page-button"
                >
                  Previous
                </button>
                
                <span className="page-info">
                  Page {page} of {totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages || loading}
                  className="page-button"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && results.length === 0 && hasSearched && (
          <div className="no-results">
            <h3>No papers found</h3>
            <p>Try adjusting your search terms or filters.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default LandingPage;