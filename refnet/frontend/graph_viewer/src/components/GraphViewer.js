import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './GraphViewer.css';

const GraphViewer = () => {
  const svgRef = useRef();
  const simulationRef = useRef(null);
  const nodesRef = useRef([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedPapers, setSelectedPapers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState('papers');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const selectedPapersRef = useRef(new Set());

  // Keep ref updated with current selected papers
  useEffect(() => {
    selectedPapersRef.current = selectedPapers;
  }, [selectedPapers]);

  // Mock data for testing - replace with actual API calls
  const mockPapers = [
    {
      id: 'paper1',
      title: 'Deep Learning for Natural Language Processing',
      authors: ['John Smith', 'Jane Doe'],
      year: 2023,
      abstract: 'This paper presents novel approaches to NLP using deep learning techniques...',
      citations: 45,
      doi: '10.1000/test1',
      topics: ['NLP', 'Deep Learning', 'AI']
    },
    {
      id: 'paper2',
      title: 'Transformer Architecture in Modern AI',
      authors: ['Alice Johnson', 'Bob Wilson'],
      year: 2022,
      abstract: 'We explore the transformer architecture and its applications...',
      citations: 78,
      doi: '10.1000/test2',
      topics: ['Transformers', 'AI', 'Architecture']
    },
    {
      id: 'paper3',
      title: 'Attention Mechanisms in Neural Networks',
      authors: ['Charlie Brown', 'Diana Prince'],
      year: 2023,
      abstract: 'This work investigates attention mechanisms and their effectiveness...',
      citations: 32,
      doi: '10.1000/test3',
      topics: ['Attention', 'Neural Networks', 'AI']
    },
    {
      id: 'paper4',
      title: 'Graph Neural Networks for Knowledge Graphs',
      authors: ['Eve Adams', 'Frank Miller'],
      year: 2022,
      abstract: 'We propose new methods for applying GNNs to knowledge graphs...',
      citations: 56,
      doi: '10.1000/test4',
      topics: ['GNN', 'Knowledge Graphs', 'Graph Theory']
    },
    {
      id: 'paper5',
      title: 'Reinforcement Learning in Multi-Agent Systems',
      authors: ['Grace Lee', 'Henry Chen'],
      year: 2023,
      abstract: 'This paper explores RL applications in multi-agent environments...',
      citations: 28,
      doi: '10.1000/test5',
      topics: ['RL', 'Multi-Agent', 'AI']
    }
  ];

  // Mock citation relationships
  const mockCitations = [
    { source: 'paper1', target: 'paper2', type: 'cites' },
    { source: 'paper2', target: 'paper3', type: 'cites' },
    { source: 'paper3', target: 'paper1', type: 'cites' },
    { source: 'paper4', target: 'paper1', type: 'cites' },
    { source: 'paper4', target: 'paper2', type: 'cites' },
    { source: 'paper5', target: 'paper1', type: 'cites' },
    { source: 'paper5', target: 'paper4', type: 'cites' }
  ];

  // Filter papers based on search query
  const filteredPapers = mockPapers.filter(paper =>
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.authors.some(author => 
      author.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    paper.topics.some(topic => 
      topic.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Update dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Create and update the graph
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || mockPapers.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous graph

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Create zoom behavior with smooth interaction
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .filter(event => {
        // Allow zoom on wheel, but prevent during node dragging
        return !isDragging && (event.type === 'wheel' || event.type === 'dblclick');
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Prepare data for D3 - preserve existing positions if available
    const existingNodes = nodesRef.current;
    const nodes = mockPapers.map(paper => {
      const existing = existingNodes.find(n => n.id === paper.id);
      return {
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        citations: paper.citations,
        topics: paper.topics,
        x: existing?.x || Math.random() * dimensions.width,
        y: existing?.y || Math.random() * dimensions.height,
        fx: existing?.fx || null,
        fy: existing?.fy || null,
        ...paper
      };
    });

    const links = mockCitations.map(citation => ({
      source: citation.source,
      target: citation.target,
      type: citation.type
    }));

    // Store nodes for position preservation
    nodesRef.current = nodes;

    // Create force simulation with optimized parameters for smooth movement
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(300))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05))
      .force('collision', d3.forceCollide().radius(30).strength(0.5))
      .alphaDecay(0.01)
      .velocityDecay(0.6)
      .alpha(0.3);

    // Store simulation reference
    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('class', 'link')
      .style('stroke', '#555')
      .style('stroke-opacity', 0.6)
      .style('stroke-width', 1);

    // Create nodes as circles (like Observable example)
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('class', 'node')
      .attr('r', d => Math.max(8, Math.min(20, Math.sqrt(d.citations) * 2)))
      .style('fill', d => {
        if (selectedPapersRef.current.has(d.id)) return '#7c3aed'; // Purple for selected
        return '#6b7280'; // Gray for normal
      })
      .style('stroke', d => {
        if (selectedPapersRef.current.has(d.id)) return '#7c3aed'; // Purple for selected
        return '#9ca3af'; // Light gray for normal
      })
      .style('stroke-width', d => {
        if (selectedPapersRef.current.has(d.id)) return 3;
        return 1;
      })
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add labels as separate elements (positioned in tick function)
    const nodeLabels = g.append('g')
      .attr('class', 'node-labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('font-size', '10px')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .text(d => `${d.authors[0]?.split(' ')[0] || 'Unknown'}, ${d.year}`);

    // Add hover effects with improved performance - using ONLY direct DOM manipulation
    let currentHoveredNode = null;
    
    node
      .on('mouseover', function(event, d) {
        if (!isDragging && currentHoveredNode?.id !== d.id) {
          // Clear any existing timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
          
          currentHoveredNode = d;
          
          // NO React state updates - only direct DOM manipulation
          // Update node colors directly - use current selection state from ref
          const currentSelected = selectedPapersRef.current;
          node.select('circle')
            .style('fill', n => {
              if (currentSelected.has(n.id)) return '#7c3aed'; // Purple for selected (priority)
              if (n.id === d.id) return '#a855f7'; // Light purple for hovered
              return '#6b7280'; // Gray for normal
            })
            .style('stroke', n => {
              if (currentSelected.has(n.id)) return '#7c3aed'; // Purple for selected (priority)
              if (n.id === d.id) return '#a855f7'; // Light purple for hovered
              return '#9ca3af'; // Light gray for normal
            });
          
          // Highlight connected nodes
          const connectedNodes = new Set();
          links.forEach(link => {
            if (link.source.id === d.id) connectedNodes.add(link.target.id);
            if (link.target.id === d.id) connectedNodes.add(link.source.id);
          });

          // Direct style updates for better performance - only dim non-connected nodes
          node.style('opacity', n => 
            n.id === d.id || connectedNodes.has(n.id) ? 1 : 0.5
          );

          link.style('opacity', l => 
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.3
          );
        }
      })
      .on('mouseout', function(event) {
        if (!isDragging) {
          hoverTimeoutRef.current = setTimeout(() => {
            currentHoveredNode = null;
            
            // Restore node colors directly - use current selection state from ref
            const currentSelected = selectedPapersRef.current;
            node.select('circle')
              .style('fill', n => {
                if (currentSelected.has(n.id)) return '#7c3aed'; // Purple for selected
                return '#6b7280'; // Gray for normal
              })
              .style('stroke', n => {
                if (currentSelected.has(n.id)) return '#7c3aed'; // Purple for selected
                return '#9ca3af'; // Light gray for normal
              });
            
            // Direct style updates for better performance
            node.style('opacity', 1);
            link.style('opacity', 0.6);
          }, 100); // Slightly longer delay to prevent flashing
        }
      })
      .on('mousedown', function(event, d) {
        // Clear hover effects immediately on mousedown
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        currentHoveredNode = null;
        
        // Reset all node styles to their proper selection state
        const currentSelected = selectedPapersRef.current;
        node.select('circle')
          .style('fill', n => {
            if (currentSelected.has(n.id)) return '#7c3aed'; // Purple for selected
            return '#6b7280'; // Gray for normal
          })
          .style('stroke', n => {
            if (currentSelected.has(n.id)) return '#7c3aed'; // Purple for selected
            return '#9ca3af'; // Light gray for normal
          });
        
        // Reset all node and link opacity
        node.style('opacity', 1);
        link.style('opacity', 0.6);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        
        // Clear any hover timeout to prevent interference
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        
        // Clear hover effects immediately
        currentHoveredNode = null;
        
        // Use the exact same logic as references panel
        setSelectedPapers(prevSelected => {
          const newSelected = new Set(prevSelected);
          
          console.log('Click on node:', d.id);
          console.log('Previous selection:', Array.from(prevSelected));
          console.log('Is node currently selected?', prevSelected.has(d.id));
          
          if (newSelected.has(d.id)) {
            // Unselect if already selected
            console.log('Unselecting node:', d.id);
            newSelected.delete(d.id);
          } else {
            // Select if not selected
            console.log('Selecting node:', d.id);
            newSelected.add(d.id);
          }
          
          console.log('New selection:', Array.from(newSelected));
          
          // Update the ref with the new selection
          selectedPapersRef.current = newSelected;
          
          // Show AI panel if any nodes are selected
          if (newSelected.size > 0) {
            setShowAIPanel(true);
          } else {
            setShowAIPanel(false);
          }
          
          return newSelected;
        });
      });

    // Update positions on simulation tick - no transitions during dragging for smoothness
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      // Update node positions (circles) - like Observable example
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      // Update label positions
      nodeLabels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag functions - Exactly like Observable example
    function dragstarted(event) {
      setIsDragging(true);
      
      // Clear any pending hover timeouts
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      
      // If not selected, select this node (for dragging)
      const currentSelected = selectedPapersRef.current;
      if (!currentSelected.has(event.subject.id)) {
        const newSelected = new Set(currentSelected);
        newSelected.add(event.subject.id);
        selectedPapersRef.current = newSelected;
        setSelectedPapers(newSelected);
        setShowAIPanel(true);
      }
      
      // Reheat the simulation when drag starts, and fix the subject position
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      // Update the subject (dragged node) position during drag
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      setIsDragging(false);
      
      // Restore the target alpha so the simulation cools after dragging ends
      // Unfix the subject position now that it's no longer being dragged
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }


    // Cleanup
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, [mockPapers, mockCitations, dimensions]); // Removed selectedPapers, hoveredNode, isDragging to prevent unnecessary re-renders

  // Handle selection changes without recreating simulation
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const node = svg.selectAll('.node');
    
    // Update node styles based on selection - only when selection changes
    const currentSelected = selectedPapersRef.current;
    node.select('circle')
      .style('fill', d => {
        if (currentSelected.has(d.id)) return '#7c3aed'; // Purple for selected
        return '#6b7280'; // Gray for normal
      })
      .style('stroke', d => {
        if (currentSelected.has(d.id)) return '#7c3aed'; // Purple for selected
        return '#9ca3af'; // Light gray for normal
      })
      .style('stroke-width', d => {
        if (currentSelected.has(d.id)) return 3;
        return 1;
      });
  }, [selectedPapers]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleExport = () => {
    const exportData = {
      papers: mockPapers,
      citations: mockCitations,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'refnet-graph-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSummarize = () => {
    if (selectedPapers.size > 0 && aiInput.trim()) {
      const selectedPaperTitles = Array.from(selectedPapers).map(id => 
        mockPapers.find(p => p.id === id)?.title
      ).join(', ');
      console.log(`Summarizing "${selectedPaperTitles}" with query: "${aiInput}"`);
      // Here you would call your AI service
    }
  };

  // Add click handler to clear selection when clicking on empty space
  const handleGraphClick = (event) => {
    if (event.target === event.currentTarget) {
      setSelectedPapers(new Set());
      setShowAIPanel(false);
    }
  };


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        selectedPapersRef.current = new Set();
        setSelectedPapers(new Set());
        setShowAIPanel(false);
      } else if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const allSelected = new Set(mockPapers.map(p => p.id));
        selectedPapersRef.current = allSelected;
        setSelectedPapers(allSelected);
        setShowAIPanel(true);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const currentSelected = selectedPapersRef.current;
        if (currentSelected.size > 0) {
          // In a real app, this would delete the selected papers
          console.log('Delete selected papers:', Array.from(currentSelected));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mockPapers]);


  return (
    <div className="graph-viewer-container">
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
          <h3 className="panel-title">References</h3>
          
          <div className="references-list">
            {filteredPapers.map((paper, index) => (
              <div
                key={paper.id}
                className={`reference-item ${
                  selectedPapers.has(paper.id) ? 'active' : ''
                }`}
                onClick={() => {
                  // Toggle selection for references panel
                  setSelectedPapers(prevSelected => {
                    const newSelected = new Set(prevSelected);
                    
                    if (newSelected.has(paper.id)) {
                      newSelected.delete(paper.id);
                    } else {
                      newSelected.add(paper.id);
                    }
                    
                    // Update the ref with the new selection
                    selectedPapersRef.current = newSelected;
                    
                    // Show AI panel if any nodes are selected
                    if (newSelected.size > 0) {
                      setShowAIPanel(true);
                    } else {
                      setShowAIPanel(false);
                    }
                    
                    return newSelected;
                  });
                }}
              >
                <div className="reference-title">
                  {index + 1}. {paper.title}
                </div>
                <div className="reference-authors">
                  {paper.authors.join(', ')}
                </div>
                <div className="reference-year">
                  {paper.year} • {paper.citations} citations
                </div>
                <div className="reference-topics">
                  {paper.topics.slice(0, 3).map(topic => (
                    <span key={topic} className="topic-tag">
                      {topic}
                    </span>
                  ))}
                </div>
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
          {/* Selection Counter */}
          {selectedPapers.size > 0 && (
            <div className="selection-counter">
              {selectedPapers.size} selected
            </div>
          )}
          
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
          
          {hoveredNode && (
            <div className="node-details visible">
              <div className="node-details-title">{hoveredNode.title}</div>
              <div className="node-details-authors">
                {hoveredNode.authors.join(', ')}
              </div>
              <div className="node-details-year">
                {hoveredNode.year} • {hoveredNode.citations} citations
              </div>
              <div className="node-details-topics">
                {hoveredNode.topics.map(topic => (
                  <span key={topic} className="topic-tag">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div className="control-panel">
          <button
            className={`control-btn ${currentView === 'papers' ? 'active' : ''}`}
            onClick={() => setCurrentView('papers')}
            title="Papers View"
          >
            P
          </button>
          <button
            className={`control-btn ${currentView === 'edges' ? 'active' : ''}`}
            onClick={() => setCurrentView('edges')}
            title="Edges View"
          >
            E
          </button>
          <button
            className={`control-btn ${currentView === 'tags' ? 'active' : ''}`}
            onClick={() => setCurrentView('tags')}
            title="Tags View"
          >
            T
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAIPanel && (
        <div className="ai-panel visible">
          <div className="ai-header">
            <span className="ai-title">OpenAI O4-mini</span>
            <button className="close-btn" onClick={() => setShowAIPanel(false)}>
              ×
            </button>
          </div>
          
          {selectedPapers.size > 0 && (
            <div className="selected-paper-info">
              {selectedPapers.size === 1 ? (
                <>
                  <div className="selected-paper-title">
                    {mockPapers.find(p => p.id === Array.from(selectedPapers)[0])?.title}
                  </div>
                  <div className="selected-paper-authors">
                    {mockPapers.find(p => p.id === Array.from(selectedPapers)[0])?.authors.join(', ')}
                  </div>
                </>
              ) : (
                <div className="selected-paper-title">
                  {selectedPapers.size} papers selected
                </div>
              )}
            </div>
          )}
          
          <div className="ai-input-container">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Begin Typing..."
              className="ai-input"
            />
            <button className="summarize-btn" onClick={handleSummarize}>
              ⭐ Summarize
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphViewer;