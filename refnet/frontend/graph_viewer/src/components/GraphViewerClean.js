import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './GraphViewer.css';

const GraphViewerClean = () => {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const selectedPapersRef = useRef(new Set());
  const [selectedPapers, setSelectedPapers] = useState([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // NO React state updates at all - keep everything in D3/refs only
  
  // Function to update selected info display using direct DOM manipulation
  const updateSelectedInfo = () => {
    const container = document.getElementById('selected-info-container');
    if (!container) return;
    
    const selectedCount = selectedPapersRef.current.size;
    if (selectedCount > 0) {
      const selectedPapers = Array.from(selectedPapersRef.current);
      const selectedList = selectedPapers.map(paperId => {
        const paper = mockPapers.find(p => p.id === paperId);
        return paper ? `${paper.authors[0]?.split(' ')[0] || 'Unknown'}, ${paper.year}` : '';
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
    const minYear = 2019;
    const maxYear = 2023;
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
    const years = mockPapers.map(p => p.year).sort((a, b) => a - b);
    const uniqueYears = [...new Set(years)];
    return uniqueYears;
  };

  // Mock data - Expanded with more papers and connections
  const mockPapers = [
    {
      id: 'paper1',
      title: 'Deep Learning for Computer Vision',
      authors: ['John Smith', 'Jane Doe'],
      year: 2023,
      citations: 150,
      topics: ['Computer Vision', 'Deep Learning', 'CNN']
    },
    {
      id: 'paper2',
      title: 'Neural Networks in Natural Language Processing',
      authors: ['Alice Johnson', 'Bob Wilson'],
      year: 2022,
      citations: 89,
      topics: ['NLP', 'Neural Networks', 'Language Models']
    },
    {
      id: 'paper3',
      title: 'Reinforcement Learning Applications',
      authors: ['Charlie Brown', 'Diana Prince'],
      year: 2023,
      citations: 67,
      topics: ['Reinforcement Learning', 'AI', 'Robotics']
    },
    {
      id: 'paper4',
      title: 'Graph Neural Networks',
      authors: ['Eve Adams', 'Frank Miller'],
      year: 2021,
      citations: 234,
      topics: ['Graph Neural Networks', 'Deep Learning', 'Graph Theory']
    },
    {
      id: 'paper5',
      title: 'Transformer Architecture',
      authors: ['Grace Lee', 'Henry Davis'],
      year: 2022,
      citations: 312,
      topics: ['Transformers', 'Attention Mechanism', 'NLP']
    },
    {
      id: 'paper6',
      title: 'Convolutional Neural Networks for Image Recognition',
      authors: ['Michael Chen', 'Sarah Wilson'],
      year: 2020,
      citations: 445,
      topics: ['CNN', 'Image Recognition', 'Computer Vision']
    },
    {
      id: 'paper7',
      title: 'Attention Mechanisms in Deep Learning',
      authors: ['David Kim', 'Lisa Zhang'],
      year: 2021,
      citations: 178,
      topics: ['Attention', 'Deep Learning', 'Neural Networks']
    },
    {
      id: 'paper8',
      title: 'Generative Adversarial Networks',
      authors: ['Robert Taylor', 'Emma Brown'],
      year: 2019,
      citations: 523,
      topics: ['GAN', 'Generative Models', 'Deep Learning']
    },
    {
      id: 'paper9',
      title: 'Recurrent Neural Networks for Sequence Modeling',
      authors: ['Alex Rodriguez', 'Maria Garcia'],
      year: 2020,
      citations: 267,
      topics: ['RNN', 'Sequence Modeling', 'NLP']
    },
    {
      id: 'paper10',
      title: 'Self-Supervised Learning in Computer Vision',
      authors: ['James Wilson', 'Anna Thompson'],
      year: 2022,
      citations: 189,
      topics: ['Self-Supervised Learning', 'Computer Vision', 'Representation Learning']
    },
    {
      id: 'paper11',
      title: 'Federated Learning: A Survey',
      authors: ['Kevin Lee', 'Rachel Green'],
      year: 2021,
      citations: 156,
      topics: ['Federated Learning', 'Privacy', 'Distributed Learning']
    },
    {
      id: 'paper12',
      title: 'Explainable AI: Methods and Applications',
      authors: ['Tom Anderson', 'Sophie Martin'],
      year: 2023,
      citations: 98,
      topics: ['Explainable AI', 'Interpretability', 'Machine Learning']
    }
  ];

  const mockCitations = [
    // Original connections
    { source: 'paper1', target: 'paper2' },
    { source: 'paper1', target: 'paper3' },
    { source: 'paper2', target: 'paper4' },
    { source: 'paper3', target: 'paper5' },
    { source: 'paper4', target: 'paper5' },
    
    // Computer Vision cluster
    { source: 'paper1', target: 'paper6' },
    { source: 'paper6', target: 'paper10' },
    { source: 'paper1', target: 'paper10' },
    
    // NLP cluster
    { source: 'paper2', target: 'paper5' },
    { source: 'paper2', target: 'paper9' },
    { source: 'paper5', target: 'paper7' },
    { source: 'paper9', target: 'paper7' },
    
    // Deep Learning cluster
    { source: 'paper4', target: 'paper7' },
    { source: 'paper4', target: 'paper8' },
    { source: 'paper7', target: 'paper8' },
    { source: 'paper1', target: 'paper4' },
    
    // Cross-domain connections
    { source: 'paper3', target: 'paper8' },
    { source: 'paper5', target: 'paper8' },
    { source: 'paper6', target: 'paper8' },
    
    // AI Ethics and Applications
    { source: 'paper11', target: 'paper12' },
    { source: 'paper3', target: 'paper12' },
    { source: 'paper8', target: 'paper12' },
    
    // Additional connections for richer graph
    { source: 'paper2', target: 'paper11' },
    { source: 'paper4', target: 'paper11' },
    { source: 'paper6', target: 'paper1' },
    { source: 'paper9', target: 'paper2' },
    { source: 'paper10', target: 'paper6' }
  ];

  // Search functionality
  const filteredPapers = mockPapers.filter(paper =>
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.authors.some(author => author.toLowerCase().includes(searchQuery.toLowerCase())) ||
    paper.topics.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase()))
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
    console.log('Exporting selected papers:', Array.from(selectedPapers));
  };

  // Update dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - (showAIPanel ? 300 : 0),
        height: window.innerHeight
      });
    };

    // Set initial dimensions
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [showAIPanel]);

  // Create and update the graph - Clean D3 implementation
  useEffect(() => {
    if (!dimensions.width || !dimensions.height || mockPapers.length === 0) return;

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

    // Prepare data
    const nodes = mockPapers.map(paper => ({
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      citations: paper.citations
    }));

    const links = mockCitations.map(citation => ({
      source: citation.source,
      target: citation.target
    }));

    // Create force simulation with collision detection for larger nodes
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(200)) // Increased link distance
      .force('charge', d3.forceManyBody().strength(-800)) // Stronger repulsion
      .force('collision', d3.forceCollide().radius(d => Math.max(12, Math.min(35, Math.sqrt(d.citations) * 1.5)) + 15).strength(1.2)) // Larger collision radius and stronger
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2));

    // Store simulation reference
    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#ffd700')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1);

    // Create nodes with size based on citations
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', d => Math.max(12, Math.min(35, Math.sqrt(d.citations) * 1.5)))
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
      .text(d => `${d.authors[0]?.split(' ')[0] || 'Unknown'}, ${d.year}`);

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
          return 1; // Highlight connected links
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
      link.style('opacity', 0.4);
      
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
  }, [mockPapers, mockCitations, dimensions]);

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
            2019
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
            2023
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
    </div>
  );
};

export default GraphViewerClean;
