import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { graphAPI, paperAPI } from '../services/api';
import './GraphViewer.css';

const GraphViewerClean = () => {
  const { paperId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const selectedPapersRef = useRef(new Set());
  const [selectedPapers, setSelectedPapers] = useState([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [paperDetails, setPaperDetails] = useState(null);
  const [iterations, setIterations] = useState(2);
  const [citedLimit, setCitedLimit] = useState(2);
  const [refLimit, setRefLimit] = useState(1);

  // Get initial paper IDs from location state or params
  const initialPaperIds = location.state?.paperIds || (paperId ? [paperId] : []);

  // NO React state updates at all - keep everything in D3/refs only
  
  // Function to update selected info display using direct DOM manipulation
  const updateSelectedInfo = () => {
    const container = document.getElementById('selected-info-container');
    if (!container) return;
    
    const selectedCount = selectedPapersRef.current.size;
    if (selectedCount > 0) {
      const selectedPapers = Array.from(selectedPapersRef.current);
      const selectedList = selectedPapers.map(paperId => {
        const paper = graphData.nodes.find(p => p.id === paperId);
        return paper ? `${paper.authors?.[0]?.split(' ')[0] || 'No Author'}, ${paper.year}` : '';
      }).filter(Boolean);
      
      container.innerHTML = `
        <div class="selected-info">
          <div class="selected-count">
            <strong>${selectedCount} selected</strong>
          </div>
          <div class="selected-list">
            ${selectedList.map(item => `<div class="selected-item">${item}</div>`).join('')}
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  };

  // Simplified timeline color function - solid colors with opacity
  const getTimelineColor = (year, isSelected) => {
    if (graphData.nodes.length === 0) return isSelected ? 'rgba(124, 58, 237, 0.8)' : 'rgba(255, 215, 0, 0.8)';
    
    const years = graphData.nodes.map(n => n.year).filter(y => y);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const normalizedYear = (year - minYear) / (maxYear - minYear);
    
    // Calculate transparency based on age (newer = more opaque)
    const opacity = 0.3 + (normalizedYear * 0.7); // 0.3 to 1.0 opacity
    
    if (isSelected) {
      // Selected nodes: solid purple with opacity
      return `rgba(124, 58, 237, ${opacity})`;
    } else {
      // Unselected nodes: solid gold with opacity
      return `rgba(255, 215, 0, ${opacity})`;
    }
  };

  // Get timeline years for keymap
  const getTimelineYears = () => {
    const years = graphData.nodes.map(p => p.year).filter(y => y).sort((a, b) => a - b);
    const uniqueYears = [...new Set(years)];
    return uniqueYears;
  };

  // Load graph data from API
  const loadGraphData = async () => {
    if (initialPaperIds.length === 0) {
      setError('No paper ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let response;
      if (initialPaperIds.length === 1) {
        response = await graphAPI.buildGraph(initialPaperIds[0], iterations, citedLimit, refLimit);
      } else {
        response = await graphAPI.buildMultipleGraph(initialPaperIds, iterations, citedLimit, refLimit);
      }

      if (response && response.nodes) {
        setGraphData({
          nodes: response.nodes || [],
          links: response.edges || []  // Backend returns 'edges', not 'links'
        });
      } else {
        throw new Error('Invalid graph data received');
      }
    } catch (err) {
      console.error('Error loading graph data:', err);
      setError(err.response?.data?.error || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  // Load paper details for the main paper
  const loadPaperDetails = async () => {
    if (!paperId) return;

    try {
      const response = await paperAPI.getPaper(paperId);
      setPaperDetails(response);
    } catch (err) {
      console.error('Error loading paper details:', err);
    }
  };

  // Rebuild graph with new parameters
  const rebuildGraph = async () => {
    await loadGraphData();
  };

  // Use API data instead of mock data
  const papers = graphData.nodes || [];
  const citations = graphData.links || [];

  // Search functionality
  const filteredPapers = papers.filter(paper =>
    paper.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.authors?.some(author => author.toLowerCase().includes(searchQuery.toLowerCase())) ||
    paper.topics?.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Event handlers
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleGraphClick = (event) => {
    if (event.target === event.currentTarget) {
      setSelectedPapers(new Set());
      setShowAIPanel(false);
    }
  };

  const handleExport = () => {
    const selectedIds = Array.from(selectedPapersRef.current);
    const selectedPapers = papers.filter(node => selectedIds.includes(node.id));
    
    const exportData = {
      selected_papers: selectedPapers,
      export_date: new Date().toISOString(),
      graph_parameters: {
        iterations,
        cited_limit: citedLimit,
        ref_limit: refLimit
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refnet-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBackToSearch = () => {
    navigate('/');
  };

  // Load initial data
  useEffect(() => {
    loadGraphData();
    loadPaperDetails();
  }, [paperId]);

  // Update dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - 300, // Account for sidebar
        height: window.innerHeight
      });
    };

    // Set initial dimensions
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Create and update the graph - Clean D3 implementation
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous graph

    // Create main group
    const g = svg.append('g');

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Prepare data - all papers from backend are already filtered
    const nodes = graphData.nodes
      .map(paper => {
        const processedPaper = {
          id: paper.id,
          title: paper.title || 'Untitled',
          authors: paper.authors && paper.authors.length > 0 ? paper.authors : ['No Authors'],
          year: paper.year || new Date().getFullYear(),
          citations: paper.citations || 0
        };
        
        // Debug: Log if we're creating a paper with "No Authors"
        if (processedPaper.authors.includes('No Authors')) {
          console.warn('Creating paper with No Authors:', {
            id: paper.id,
            title: paper.title,
            originalAuthors: paper.authors,
            processedAuthors: processedPaper.authors
          });
        }
        
        return processedPaper;
      });

    console.log('Original graphData.nodes:', graphData.nodes.length);
    console.log('Filtered nodes:', nodes.length);
    console.log('Original graphData.links:', graphData.links.length);
    
    // Debug: Check what's in the raw data
    console.log('Raw graphData.nodes sample:', graphData.nodes.slice(0, 2).map(n => ({
      id: n.id,
      title: n.title?.substring(0, 30),
      authors: n.authors,
      authorsType: typeof n.authors
    })));

    // Create a set of valid node IDs for filtering links
    const validNodeIds = new Set(nodes.map(node => node.id));

    // Filter links to only include those where both source and target exist in the filtered nodes
    const links = graphData.links
      .filter(link => validNodeIds.has(link.source) && validNodeIds.has(link.target))
      .map(link => {
        // Find the actual node objects for D3.js
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        return {
          source: sourceNode,
          target: targetNode
        };
      })
      .filter(link => link.source && link.target); // Ensure both source and target exist

    console.log(`Graph data: ${nodes.length} nodes, ${links.length} links`);
    console.log('Node IDs:', nodes.map(n => n.id));
    console.log('Link sources/targets:', links.map(l => `${l.source?.id || l.source} -> ${l.target?.id || l.target}`));
    console.log('Valid node IDs set:', Array.from(validNodeIds));
    console.log('Original links before filtering:', graphData.links.map(l => `${l.source} -> ${l.target}`));
    
    // Check if links reference valid nodes
    const invalidLinks = links.filter(l => !l.source || !l.target);
    if (invalidLinks.length > 0) {
      console.warn('Invalid links found (missing source or target):', invalidLinks);
    }

    // Create force simulation with proper link handling
    let simulation;
    try {
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.5)) // Proper link force
        .force('charge', d3.forceManyBody().strength(-300)) // Moderate repulsion
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force('x', d3.forceX(dimensions.width / 2).strength(0.1))
        .force('y', d3.forceY(dimensions.height / 2).strength(0.1));
    } catch (error) {
      console.error('Error creating D3 simulation:', error);
      return;
    }

    // Store simulation reference
    simulationRef.current = simulation;

    // Create links - simple lines without arrows
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#cccccc')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    // Create nodes with size based on citations
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', d => Math.max(8, Math.min(25, Math.sqrt(d.citations) * 0.8)))
      .attr('data-id', d => d.id)
      .attr('data-selected', d => selectedPapersRef.current.has(d.id) ? 'true' : 'false')
      .attr('fill', d => getTimelineColor(d.year, selectedPapersRef.current.has(d.id)))
      .attr('stroke', 'none')
      .style('filter', d => selectedPapersRef.current.has(d.id) ? 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))' : 'none')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add labels positioned above nodes with better styling
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -25) // Position above the node
      .attr('data-id', d => d.id)
      .style('font-size', '11px') // Slightly bigger for better readability
      .style('fill', '#ffffff') // Pure white text for maximum readability
      .style('font-weight', '600') // Bolder for better visibility
      .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.9)') // Stronger shadow for contrast
      .style('pointer-events', 'none')
      .style('opacity', 1.0) // Full opacity for maximum visibility
      .text(d => {
        const firstAuthor = d.authors && d.authors.length > 0 ? d.authors[0].split(' ')[0] : 'No Author';
        const year = d.year && d.year !== 2025 ? d.year : 'N/A';
        return `${firstAuthor}, ${year}`;
      });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Add end event to log simulation completion
    simulation.on('end', () => {
      console.log('D3 simulation completed');
      console.log('Final node positions:', nodes.map(n => ({id: n.id, x: n.x, y: n.y})));
    });

    // Drag functions
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Hover handlers - highlight connected nodes and dim others
    node.on('mouseover', function(event, d) {
      // Find connected node IDs
      const connectedNodeIds = new Set();
      const connectedLinkIds = new Set();
      
      // Find connected nodes through links
      links.forEach(link => {
        if (link.source.id === d.id) {
          connectedNodeIds.add(link.target.id);
          connectedLinkIds.add(`${link.source.id}-${link.target.id}`);
        } else if (link.target.id === d.id) {
          connectedNodeIds.add(link.source.id);
          connectedLinkIds.add(`${link.source.id}-${link.target.id}`);
        }
      });
      
      // Dim all nodes except hovered and connected ones
      node.style('opacity', nodeData => {
        if (nodeData.id === d.id || connectedNodeIds.has(nodeData.id)) {
          return 1; // Keep hovered and connected nodes fully visible
        } else {
          return 0.1; // Dim unconnected nodes
        }
      });
      
      // Hide text for unconnected nodes
      labels.style('opacity', nodeData => {
        if (nodeData.id === d.id || connectedNodeIds.has(nodeData.id)) {
          return 0.8; // Keep text visible for hovered and connected nodes
        } else {
          return 0; // Hide text for unconnected nodes
        }
      });
      
      // Highlight connected links, dim others
      link.style('opacity', linkData => {
        const linkId = `${linkData.source.id}-${linkData.target.id}`;
        if (connectedLinkIds.has(linkId)) {
          return 0.8; // Highlight connected links
        } else {
          return 0.1; // Dim unconnected links
        }
      });
      
      // Create or update hover tooltip
      let tooltip = d3.select('body').select('.hover-tooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('class', 'hover-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', '#ffd700')
          .style('padding', '8px 12px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .style('opacity', 0)
          .style('border', '1px solid #ffd700');
      }
      
      tooltip
        .html(`
          <div><strong>${d.title}</strong></div>
          <div>${d.authors.join(', ')}</div>
          <div>${d.year} • ${d.citations} citations</div>
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1);
    });

    node.on('mouseout', function(event, d) {
      // Reset all nodes to full opacity
      node.style('opacity', 1);
      
      // Reset all text to normal opacity
      labels.style('opacity', 0.8);
      
      // Reset all links to normal opacity
      link.style('opacity', 0.6);
      
      // Remove tooltip
      d3.select('body').select('.hover-tooltip')
        .transition()
        .duration(200)
        .style('opacity', 0)
        .remove();
    });

    // Click handler - using ONLY direct DOM manipulation, NO React state updates
    node.on('click', function(event, d) {
      // Get current selection from the node's data
      const isCurrentlySelected = d3.select(this).attr('data-selected') === 'true';
      
      // Toggle selection in the DOM
      d3.select(this)
        .attr('data-selected', !isCurrentlySelected)
        .attr('fill', getTimelineColor(d.year, !isCurrentlySelected))
        .style('filter', !isCurrentlySelected ? 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))' : 'none');
      
      // Update text color to match selection state
      const textElement = d3.select(`text[data-id="${d.id}"]`);
      textElement.style('fill', '#ffffff'); // Pure white text for maximum readability
      
      // Update ref immediately
      if (isCurrentlySelected) {
        selectedPapersRef.current.delete(d.id);
      } else {
        selectedPapersRef.current.add(d.id);
      }
      
      // Update the corresponding reference item in the left panel
      const referenceItem = document.querySelector(`[data-paper-id="${d.id}"]`);
      if (referenceItem) {
        if (isCurrentlySelected) {
          referenceItem.classList.remove('active');
        } else {
          referenceItem.classList.add('active');
        }
      } else {
        console.log('Reference item not found for paper ID:', d.id);
      }
      
      // Update selected info display
      updateSelectedInfo();
      
      // NO React state updates to prevent re-renders
      // The AI panel and other UI will be updated separately if needed
    });

    // Cleanup
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
      // Clean up any remaining tooltips
      d3.select('body').selectAll('.hover-tooltip').remove();
    };
  }, [graphData.nodes, graphData.links, dimensions]);

  if (loading) {
    return (
      <div className="graph-viewer-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-viewer-container">
        <div className="error-container">
          <h3>Error Loading Graph</h3>
          <p>{error}</p>
          <button onClick={handleBackToSearch} className="back-button">
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-viewer-container">
      {/* Header */}
      <div className="graph-header">
        <button onClick={handleBackToSearch} className="back-button">
          ← Back to Search
        </button>
        <h1>Citation Network Graph</h1>
        {paperDetails && (
          <div className="main-paper-info">
            <h3>{paperDetails.title}</h3>
            <p>{paperDetails.authors?.join(', ')} • {paperDetails.year}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="graph-controls">
        <div className="control-group">
          <label>Iterations:</label>
          <input
            type="number"
            min="1"
            max="5"
            value={iterations}
            onChange={(e) => setIterations(parseInt(e.target.value))}
          />
        </div>
        <div className="control-group">
          <label>Cited Limit:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={citedLimit}
            onChange={(e) => setCitedLimit(parseInt(e.target.value))}
          />
        </div>
        <div className="control-group">
          <label>Ref Limit:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={refLimit}
            onChange={(e) => setRefLimit(parseInt(e.target.value))}
          />
        </div>
        <button onClick={rebuildGraph} className="rebuild-button">
          Rebuild Graph
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Enter Keyword, DOI"
          className="search-input"
        />
        <button className="search-btn">🔍</button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* References Panel */}
        <div className="references-panel">
          <h3 className="panel-title">References ({filteredPapers.length})</h3>
          
          <div id="selected-info-container"></div>
          
          <div className="references-list">
            {filteredPapers.map((paper, index) => (
              <div
                key={paper.id}
                data-paper-id={paper.id}
                className="reference-item"
                onClick={(event) => {
                  const isCurrentlySelected = selectedPapersRef.current.has(paper.id);
                  
                  // Update ref
                  if (isCurrentlySelected) {
                    selectedPapersRef.current.delete(paper.id);
                  } else {
                    selectedPapersRef.current.add(paper.id);
                  }
                  
                  // Update the corresponding node in the graph
                  const graphNode = d3.select(`circle[data-id="${paper.id}"]`);
                  if (!graphNode.empty()) {
                    const isSelected = !isCurrentlySelected;
                    graphNode
                      .attr('data-selected', isSelected ? 'true' : 'false')
                      .attr('fill', getTimelineColor(paper.year, isSelected))
                      .style('filter', isSelected ? 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))' : 'none');
                  }
                  
                  // Update the text color to match selection state
                  const textElement = d3.select(`text[data-id="${paper.id}"]`);
                  textElement.style('fill', '#ffffff'); // Pure white text for maximum readability
                  
                  // Update this reference item's visual state directly
                  const isSelected = !isCurrentlySelected;
                  if (isSelected) {
                    event.currentTarget.classList.add('active');
                  } else {
                    event.currentTarget.classList.remove('active');
                  }
                  
                  // Update selected info display
                  updateSelectedInfo();
                  
                  // NO React state updates to prevent re-renders
                }}
              >
                <div className="reference-title">
                  {index + 1}. {paper.title || 'Untitled Paper'}
                </div>
                <div className="reference-authors">
                  {paper.authors?.join(', ') || 'No Authors'}
                </div>
                <div className="reference-year">
                  {paper.year} • {paper.citations || 0} citations
                </div>
                {paper.topics && paper.topics.length > 0 && (
                  <div className="reference-topics">
                    {paper.topics.slice(0, 3).map(topic => (
                      <span key={topic} className="topic-tag">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {filteredPapers.length === 0 && (
              <div className="no-results">
                No papers found. Try a different search term.
              </div>
            )}
          </div>
          
          <button className="export-btn" onClick={handleExport}>
            Export
          </button>
        </div>

        {/* Graph Visualization */}
        <div className="graph-container" onClick={handleGraphClick}>
          {/* Instructions */}
          <div className="graph-instructions">
            <div className="instruction-item">🖱️ Click & drag to move nodes</div>
            <div className="instruction-item">🖱️ Click to select/unselect nodes</div>
          </div>
          
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="graph-svg"
          />
          
        </div>

        {/* AI Panel - Removed */}
      </div>

      {/* Timeline Keymap - Clean centered design */}
      {getTimelineYears().length > 0 && (
        <div className="timeline-keymap" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '25px 40px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3)',
          border: '1px solid #ffd700',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '15px',
          zIndex: 1000
        }}>
          <div style={{ 
            width: '250px', 
            height: '12px', 
            background: 'linear-gradient(to right, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 1.0))',
            borderRadius: '6px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: '0',
              top: '15px',
              fontSize: '12px',
              color: '#ffd700',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}>
              {getTimelineYears()[0]}
            </div>
            <div style={{
              position: 'absolute',
              right: '0',
              top: '15px',
              fontSize: '12px',
              color: '#ffd700',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}>
              {getTimelineYears()[getTimelineYears().length - 1]}
            </div>
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#ffd700', 
            fontWeight: '500',
            opacity: 0.8,
            textAlign: 'center'
          }}>
            Older → Newer
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphViewerClean;
