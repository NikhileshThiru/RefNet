import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { graphAPI, paperAPI } from '../services/api';
import { cedarAgent } from '../services/cedarAgent';
import FloatingChat from './FloatingChat';
import ChatTracker from './ChatTracker';
import './GraphViewer.css';
// import jsPDF from 'jspdf';

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
  const [graphReady, setGraphReady] = useState(false);
  const [paperDetails, setPaperDetails] = useState(null);
  const [iterations, setIterations] = useState(2);
  const [citedLimit, setCitedLimit] = useState(3);
  const [refLimit, setRefLimit] = useState(3);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [lastInteractionTime, setLastInteractionTime] = useState({});
  const [chatConnections, setChatConnections] = useState({});
  const [nextChatId, setNextChatId] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [hasProcessedImport, setHasProcessedImport] = useState(false);
  const [isGeneratingSurvey, setIsGeneratingSurvey] = useState(false);

  // Get initial paper IDs from location state or params
  const initialPaperIds = location.state?.paperIds || (paperId ? [paperId] : []);
  const initialPapers = location.state?.papers || [];
  const originalSearchQuery = location.state?.searchQuery || '';
  
  // Check if this is an import scenario
  const isImportScenario = location.state?.isImport || (initialPaperIds.length === 0 && !paperId);
  const importedGraphData = location.state?.importedGraphData;
  const [textBoxes, setTextBoxes] = useState([]);
  const [nextTextBoxId, setNextTextBoxId] = useState(1);
  const [draggedTextBox, setDraggedTextBox] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingTextBox, setResizingTextBox] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [editingHeader, setEditingHeader] = useState(null);
  
  // AI Discovery State (for chat integration)
  const [aiDiscovering, setAIDiscovering] = useState(false);

  // AI Paper Discovery for Chat Integration
  const discoverAndAddAIPapers = async (selectedPapers, count = 5, discoveryType = 'similar') => {
    console.log('🔍 discoverAndAddAIPapers called with:', { selectedPapers: selectedPapers.length, count, discoveryType });
    console.log('🔍 Original search query:', originalSearchQuery);
    console.log('🔍 COUNT PARAMETER:', count, 'type:', typeof count);
    
    if (!selectedPapers || selectedPapers.length === 0) {
      console.log('❌ No papers selected for AI discovery');
      return { success: false, message: 'No papers selected for AI discovery' };
    }

    try {
      setAIDiscovering(true);
      
      // Initialize Cedar agent if not already done
      await cedarAgent.initialize();
      
      let suggestions = [];
      
      if (selectedPapers.length === 1) {
        // Single paper: find similar papers to that specific paper
        const targetPaper = selectedPapers[0];
        
        switch (discoveryType) {
          case 'similar':
            suggestions = await cedarAgent.findSimilarPapers(targetPaper, count, originalSearchQuery);
            break;
          case 'citing':
            suggestions = await cedarAgent.findSimilarPapers({
              ...targetPaper,
              title: `papers citing "${targetPaper.title}"`
            }, count, originalSearchQuery);
            break;
          case 'methodology':
            suggestions = await cedarAgent.findSimilarPapers({
              ...targetPaper,
              title: `papers with similar methods to "${targetPaper.title}"`
            }, count, originalSearchQuery);
            break;
          default:
            suggestions = await cedarAgent.findSimilarPapers(targetPaper, count, originalSearchQuery);
        }
      } else {
        // Multiple papers: analyze connections and find bridging papers
        console.log('🔗 Analyzing connections between', selectedPapers.length, 'selected papers');
        
        // Create a combined research context from all selected papers
        const combinedContext = {
          title: `Research connecting ${selectedPapers.length} papers: ${selectedPapers.map(p => p.title?.substring(0, 30)).join(', ')}`,
          authors: [...new Set(selectedPapers.flatMap(p => p.authors || []))],
          year: Math.round(selectedPapers.reduce((sum, p) => sum + (p.year || 0), 0) / selectedPapers.length),
          abstract: `Papers in this research cluster: ${selectedPapers.map(p => p.title).join('; ')}`,
          topics: [...new Set(selectedPapers.flatMap(p => p.topics || []))],
          combinedResearch: true
        };
        
        switch (discoveryType) {
          case 'similar':
            // Find papers that bridge or relate to multiple selected papers
            suggestions = await cedarAgent.findBridgingPapers(selectedPapers, count, originalSearchQuery);
            break;
          case 'citing':
            // Find papers that cite multiple papers in the cluster
            suggestions = await cedarAgent.findSimilarPapers({
              ...combinedContext,
              title: `papers citing multiple papers in this research cluster: ${selectedPapers.map(p => p.title?.substring(0, 20)).join(', ')}`
            }, count, originalSearchQuery);
            break;
          case 'methodology':
            // Find papers using similar methodologies across the cluster
            suggestions = await cedarAgent.findSimilarPapers({
              ...combinedContext,
              title: `papers with methodologies similar to this research cluster: ${selectedPapers.map(p => p.title?.substring(0, 20)).join(', ')}`
            }, count, originalSearchQuery);
            break;
          default:
            suggestions = await cedarAgent.findBridgingPapers(selectedPapers, count, originalSearchQuery);
        }
      }
      
      console.log('📄 AI suggestions received:', suggestions?.length || 0, 'papers');
      console.log('📄 First few suggestions:', suggestions?.slice(0, 2));
      
      // Check if we have suggestions
      if (!suggestions || suggestions.length === 0) {
        console.log('❌ No suggestions received from AI');
        return {
          success: false,
          message: 'No similar papers found. Try a different search or check your selected papers.',
          addedPapers: []
        };
      }
      
      // Filter out papers that are already in the graph
      const existingPaperIds = new Set(graphData.nodes.map(node => node.id));
      const filteredSuggestions = suggestions.filter(paper => 
        !existingPaperIds.has(paper.id)
      );
      
      console.log('📄 Filtered suggestions (excluding existing):', filteredSuggestions.length, 'papers');
      
      if (filteredSuggestions.length === 0) {
        console.log('❌ All suggestions already exist in graph');
        return {
          success: false,
          message: 'All suggested papers are already in the graph',
          addedPapers: []
        };
      }
      
      // Take only the requested number of papers
      const papersToAdd = filteredSuggestions.slice(0, count);
      const addedPapers = [];
      
      console.log('📄 Processing', papersToAdd.length, 'papers to add to graph');
      
      // Process all papers first
      for (const paper of papersToAdd) {
        const processedPaper = {
          id: paper.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: paper.title || 'Untitled AI Paper',
          authors: paper.authors || ['AI Discovered'],
          year: paper.year || new Date().getFullYear(),
          citations: paper.citations || 0,
          abstract: paper.abstract || '',
          source: 'ai_discovery',
          aiGenerated: true,
          relevanceScore: paper.relevanceScore || 0.8,
          doi: paper.doi || null,
          topics: paper.topics || []
        };
        
        addedPapers.push(processedPaper);
      }
      
      // Add all papers to the graph at once
      const newNodes = addedPapers.map(paper => paper);
      
      // Create links from AI papers to selected papers
      const newLinks = [];
      for (const aiPaper of addedPapers) {
        for (const selectedPaper of selectedPapers) {
          newLinks.push({
            source: selectedPaper.id,
            target: aiPaper.id,
            type: 'ai_discovered',
            strength: aiPaper.relevanceScore || 0.8
          });
        }
      }
      
      // Update the graph data state with all papers at once
      console.log('🔧 Graph update details:', {
        currentNodes: graphData.nodes.length,
        newNodes: newNodes.length,
        newLinks: newLinks.length,
        currentLinks: graphData.links.length,
        addedPapers: addedPapers.length,
        requestedCount: count
      });
      console.log('🔧 Added papers titles:', addedPapers.map(p => p.title));
      
      const updatedGraph = {
        ...graphData,
        nodes: [...graphData.nodes, ...newNodes],
        links: [...graphData.links, ...newLinks]
      };
      
      console.log('🔧 Final graph state:', {
        totalNodes: updatedGraph.nodes.length,
        totalLinks: updatedGraph.links.length,
        aiNodes: updatedGraph.nodes.filter(n => n.source === 'ai_discovery').length
      });
      
      setGraphData(updatedGraph);
      
      console.log('✅ Graph state updated successfully!');
      console.log('✅ Updated graph with AI papers:', {
        originalNodes: graphData.nodes.length,
        newNodes: newNodes.length,
        totalNodes: updatedGraph.nodes.length,
        addedPapers: addedPapers.map(p => ({ id: p.id, title: p.title, source: p.source }))
      });
      
      // Force a small delay to ensure state update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const analysisType = selectedPapers.length === 1 
        ? `similar to "${selectedPapers[0].title?.substring(0, 50)}..."`
        : `connecting ${selectedPapers.length} research papers`;
      
      return {
        success: true,
        message: `Successfully added ${addedPapers.length} AI-discovered papers ${analysisType}`,
        addedPapers: addedPapers,
        analysisType: selectedPapers.length === 1 ? 'single_paper' : 'multi_paper'
      };
      
    } catch (error) {
      console.error('Error in AI discovery:', error);
      return { 
        success: false, 
        message: `Failed to discover papers: ${error.message}` 
      };
    } finally {
      setAIDiscovering(false);
    }
  };

  // Comprehensive color palette for text boxes
  const textBoxColors = [
    // Primary Colors
    { name: 'Purple', value: '#8b5cf6', border: '#8b5cf6', header: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)' },
    { name: 'Purple Dark', value: '#7c3aed', border: '#7c3aed', header: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' },
    { name: 'Blue', value: '#3b82f6', border: '#3b82f6', header: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' },
    { name: 'Green', value: '#10b981', border: '#10b981', header: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' },
    { name: 'Red', value: '#ef4444', border: '#ef4444', header: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' },
    { name: 'Orange', value: '#f97316', border: '#f97316', header: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)' },
    { name: 'Pink', value: '#ec4899', border: '#ec4899', header: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' },
    { name: 'Teal', value: '#14b8a6', border: '#14b8a6', header: 'linear-gradient(135deg, #14b8a6 0%, #5eead4 100%)' },
    
    // Additional Colors
    { name: 'Indigo', value: '#6366f1', border: '#6366f1', header: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' },
    { name: 'Cyan', value: '#06b6d4', border: '#06b6d4', header: 'linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%)' },
    { name: 'Lime', value: '#84cc16', border: '#84cc16', header: 'linear-gradient(135deg, #84cc16 0%, #bef264 100%)' },
    { name: 'Yellow', value: '#eab308', border: '#eab308', header: 'linear-gradient(135deg, #eab308 0%, #fde047 100%)' },
    { name: 'Rose', value: '#f43f5e', border: '#f43f5e', header: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)' },
    { name: 'Violet', value: '#8b5cf6', border: '#8b5cf6', header: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' },
    { name: 'Emerald', value: '#059669', border: '#059669', header: 'linear-gradient(135deg, #059669 0%, #6ee7b7 100%)' },
    { name: 'Sky', value: '#0ea5e9', border: '#0ea5e9', header: 'linear-gradient(135deg, #0ea5e9 0%, #7dd3fc 100%)' },
    
    // Darker Tones
    { name: 'Dark Blue', value: '#1e40af', border: '#1e40af', header: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' },
    { name: 'Dark Green', value: '#047857', border: '#047857', header: 'linear-gradient(135deg, #047857 0%, #10b981 100%)' },
    { name: 'Dark Red', value: '#dc2626', border: '#dc2626', header: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' },
    { name: 'Dark Purple', value: '#7c2d12', border: '#7c2d12', header: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)' },
    { name: 'Dark Gray', value: '#374151', border: '#374151', header: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)' },
    { name: 'Charcoal', value: '#1f2937', border: '#1f2937', header: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' },
    
    // Pastel Colors
    { name: 'Light Blue', value: '#dbeafe', border: '#dbeafe', header: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' },
    { name: 'Light Green', value: '#dcfce7', border: '#dcfce7', header: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' },
    { name: 'Light Pink', value: '#fce7f3', border: '#fce7f3', header: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)' },
    { name: 'Light Yellow', value: '#fef3c7', border: '#fef3c7', header: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' },
    { name: 'Light Purple', value: '#ede9fe', border: '#ede9fe', header: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' },
    { name: 'Light Orange', value: '#fed7aa', border: '#fed7aa', header: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)' }
  ];

  // Generate header text from selected papers
  const getHeaderText = () => {
    // If we have a search query, use it as the base
    if (originalSearchQuery) {
      return `Research Network: "${originalSearchQuery}"`;
    }
    
    // First try initialPapers from location state
    if (initialPapers.length > 0) {
      if (initialPapers.length === 1) {
        const paper = initialPapers[0];
        const title = paper.title || 'Untitled Paper';
        return `Research Network: ${title}`;
      }
      
      if (initialPapers.length <= 3) {
        const titles = initialPapers.map(paper => {
          const title = paper.title || 'Untitled Paper';
          return title;
        }).join(' • ');
        return `Research Network: ${titles}`;
      }
      
      // For more than 3 papers, show first few and count
      const firstThree = initialPapers.slice(0, 3).map(paper => {
        const title = paper.title || 'Untitled Paper';
        return title;
      }).join(' • ');
      
      return `Research Network: ${firstThree} • +${initialPapers.length - 3} more papers`;
    }
    
    // Fallback to paperDetails if available
    if (paperDetails && paperDetails.title) {
      return `Research Network: ${paperDetails.title}`;
    }
    
    // Fallback to first paper from graph data
    if (graphData.nodes && graphData.nodes.length > 0) {
      const firstPaper = graphData.nodes[0];
      if (firstPaper && firstPaper.title) {
        return `Research Network: ${firstPaper.title}`;
      }
    }
    
    // Final fallback
    return "Research Network Graph";
  };

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
        return paper ? `${paper.authors?.[0]?.split(' ')[0] || 'No Author'}, ${paper.year || 'Unknown'}` : '';
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
    
    // Update React state for selected papers count (for chat button visibility)
    setSelectedPapers(Array.from(selectedPapersRef.current));
  };

  // Enhanced timeline color function with AI paper distinction
  const getTimelineColor = (year, isSelected, isAIPaper = false) => {
    if (graphData.nodes.length === 0) {
      if (isAIPaper) {
        return isSelected ? 'rgba(16, 185, 129, 0.9)' : 'rgba(16, 185, 129, 0.6)'; // Green for AI papers
      }
      return isSelected ? 'rgba(236, 72, 153, 0.8)' : 'rgba(139, 92, 246, 0.8)'; // Pink for selected, purple for unselected
    }
    
    const years = graphData.nodes.map(n => n.year).filter(y => y);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const normalizedYear = (year - minYear) / (maxYear - minYear);
    
    // Calculate transparency based on age (newer = more opaque) - more dramatic gradient
    const opacity = 0.1 + (normalizedYear * 0.9); // 0.1 to 1.0 opacity for much more obvious difference
    
    // AI papers get green colors with dotted border effect
    if (isAIPaper) {
    if (isSelected) {
        return `rgba(16, 185, 129, ${opacity + 0.3})`; // Bright green for selected AI papers
      }
      return `rgba(16, 185, 129, ${opacity})`; // Green for AI papers
    }
    
    if (isSelected) {
      // Selected nodes: solid pink (no opacity based on age)
      return 'rgba(236, 72, 153, 1.0)';
    } else {
      // Unselected nodes: solid purple with opacity based on age
      return `rgba(139, 92, 246, ${opacity})`;
    }
  };

  // Get timeline years for keymap
  const getTimelineYears = () => {
    const years = graphData.nodes.map(p => p.year).filter(y => y).sort((a, b) => a - b);
    const uniqueYears = [...new Set(years)];
    return uniqueYears;
  };

  // Add click outside listener for export dropdown
  useEffect(() => {
    if (showExportModal) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showExportModal]);

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
      setGraphReady(false);

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

  // Function to convert paper to BibTeX format
  const paperToBibTeX = (paper) => {
    // Generate a unique key for the citation
    const firstAuthor = paper.authors && paper.authors.length > 0 
      ? paper.authors[0].split(' ').pop() // Last name
      : 'Unknown';
    const year = paper.year || new Date().getFullYear();
    const key = `${firstAuthor}${year}`;
    
    // Clean and format title
    const title = paper.title || 'Untitled';
    
    // Format authors (BibTeX format: Last, First and Last, First)
    const authors = paper.authors && paper.authors.length > 0
      ? paper.authors.map(author => {
          const nameParts = author.trim().split(' ');
          if (nameParts.length >= 2) {
            const lastName = nameParts.pop();
            const firstName = nameParts.join(' ');
            return `${lastName}, ${firstName}`;
          }
          return author;
        }).join(' and ')
      : 'Unknown';
    
    // Format journal/venue (if available)
    const journal = paper.journal || paper.venue || 'Unknown Journal';
    
    // Format DOI (if available)
    const doi = paper.doi ? `doi = {${paper.doi}},` : '';
    
    // Format URL (if available)
    const url = paper.url ? `url = {${paper.url}},` : '';
    
    // Format abstract (if available)
    const abstract = paper.abstract ? `abstract = {${paper.abstract}},` : '';
    
    // Format keywords (if available)
    const keywords = paper.topics && paper.topics.length > 0 
      ? `keywords = {${paper.topics.join(', ')}},` 
      : '';
    
    return `@article{${key},
  title = {${title}},
  author = {${authors}},
  journal = {${journal}},
  year = {${year}},${doi ? '\n  ' + doi : ''}${url ? '\n  ' + url : ''}${abstract ? '\n  ' + abstract : ''}${keywords ? '\n  ' + keywords : ''}
}`;
  };

  // Function to convert paper data to MLA format
  const paperToMLA = (paper) => {
    const authors = paper.authors && paper.authors.length > 0 ? paper.authors : null;
    const year = paper.year || null;
    const title = paper.title || null;
    const journal = paper.journal || paper.venue || null;
    const doi = paper.doi ? `https://doi.org/${paper.doi}` : '';
    const url = paper.openalex_url || paper.pdf_url || doi || '';
    
    let citation = '';
    
    // Add authors if available
    if (authors && authors.length > 0) {
      if (authors.length === 1) {
        citation += `${authors[0]}.`;
      } else if (authors.length === 2) {
        citation += `${authors[0]} and ${authors[1]}.`;
      } else if (authors.length > 2) {
        citation += `${authors[0]} et al.`;
      }
    }
    
    // Add title if available
    if (title) {
      if (citation) citation += ' ';
      citation += `"${title}."`;
    }
    
    // Add journal if available
    if (journal) {
      if (citation) citation += ' ';
      citation += `<em>${journal}</em>`;
    }
    
    // Add year if available
    if (year) {
      if (citation) citation += ', ';
      citation += `${year}`;
    }
    
    // Add URL if available
    if (url) {
      if (citation) citation += ', ';
      citation += url;
    }
    
    // Add period at the end
    if (citation) {
      citation += '.';
    } else {
      citation = 'Citation information unavailable.';
    }
    
    return citation;
  };

  // Function to copy text to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (fallbackErr) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  };

  // Function to handle MLA citation copy
  const handleMLACopy = async (paper, event) => {
    const mlaCitation = paperToMLA(paper);
    const success = await copyToClipboard(mlaCitation);
    
    if (success) {
      // Show temporary success message
      const button = event.target;
      const originalText = button.textContent;
      button.textContent = '✓ Copied!';
      button.style.backgroundColor = '#8b5cf6';
      button.style.color = '#ffffff';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
        button.style.color = '';
      }, 2000);
    } else {
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  // Function to open export modal
  const handleExportClick = () => {
    setShowExportModal(true);
  };

  // Function to generate AI summary for a paper
  const generatePaperSummary = async (paper) => {
    try {
          const response = await fetch('https://api.refnet.wiki/mastra/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Please provide a concise summary (2-3 paragraphs) of this research paper, focusing on:
1. The main research question/problem addressed
2. Key methodology and approach
3. Main findings and contributions
4. Significance and implications

Please provide a clear, academic-style summary suitable for a survey paper.`,
          additionalContext: {
            selectedPapers: [paper],
            graphData: {}
          }
        })
      });

      if (!response.ok) {
        throw new Error(`AI backend error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.content || data.response || 'AI summary generation failed - no response received';
      return markdownToHtml(content);
    } catch (error) {
      console.error('Error generating summary:', error);
      if (error.message.includes('fetch')) {
        return 'AI backend unavailable - please ensure the AI service is running on port 4111';
      }
      
      // Fallback: Generate a basic summary from available data
      const fallbackSummary = `This paper by ${paper.authors?.join(', ') || 'Unknown authors'} (${paper.year || 'Unknown year'}) presents research on ${paper.title}. Published in ${paper.journal || paper.venue || 'Unknown journal'}, this work contributes to the field with ${paper.citations || 0} citations. The research addresses key questions in the domain and provides insights that advance our understanding of the subject matter.`;
      
      return `Summary generation failed: ${error.message}. Fallback summary: ${fallbackSummary}`;
    }
  };

  // Function to group papers by topics
  const groupPapersByTopics = (papers) => {
    const topicGroups = {};
    
    papers.forEach(paper => {
      const topics = paper.topics || ['General'];
      topics.forEach(topic => {
        if (!topicGroups[topic]) {
          topicGroups[topic] = [];
        }
        topicGroups[topic].push(paper);
      });
    });

    // If no topics, group by year
    if (Object.keys(topicGroups).length === 0 || 
        (Object.keys(topicGroups).length === 1 && Object.keys(topicGroups)[0] === 'General')) {
      const yearGroups = {};
      papers.forEach(paper => {
        const year = paper.year || 'Unknown Year';
        if (!yearGroups[year]) {
          yearGroups[year] = [];
        }
        yearGroups[year].push(paper);
      });
      return yearGroups;
    }

    return topicGroups;
  };

  // Function to generate a relevant title based on the selected papers
  const generateRelevantTitle = (papers) => {
    console.log('🔍 Generating title for papers:', papers);
    
    if (!papers || papers.length === 0) {
      console.log('📝 No papers provided, using fallback title');
      return 'Research Overview: A Comprehensive Survey';
    }

    // Extract meaningful phrases and keywords from paper titles
    let allTitles = papers.map(p => p.title || '').join(' ').toLowerCase();
    
    // Define research domain keywords with weights
    const domainKeywords = {
      'machine learning': 10, 'deep learning': 10, 'neural networks': 9, 'artificial intelligence': 9,
      'computer vision': 8, 'natural language processing': 8, 'nlp': 7, 'reinforcement learning': 8,
      'convolutional neural networks': 9, 'cnn': 8, 'recurrent neural networks': 9, 'rnn': 8,
      'long short-term memory': 8, 'lstm': 8, 'transformer': 8, 'attention mechanism': 8,
      'generative adversarial networks': 9, 'gan': 8, 'autoencoder': 7, 'variational': 7,
      'blockchain': 9, 'cryptocurrency': 8, 'distributed systems': 7, 'consensus': 6,
      'smart contracts': 8, 'ethereum': 7, 'bitcoin': 7, 'decentralized': 7,
      'cybersecurity': 8, 'privacy': 7, 'encryption': 6, 'authentication': 6,
      'data mining': 7, 'big data': 7, 'analytics': 6, 'visualization': 6,
      'data science': 7, 'statistical learning': 7, 'pattern recognition': 7,
      'mobile': 6, 'wireless': 6, 'networks': 6, 'communication': 6,
      'internet of things': 8, 'iot': 7, 'edge computing': 7, 'cloud computing': 7,
      'optimization': 6, 'algorithms': 6, 'computational': 5, 'efficient': 5,
      'robotics': 7, 'autonomous': 6, 'sensors': 5, 'control': 5,
      'bioinformatics': 7, 'genomics': 6, 'medical': 6, 'healthcare': 6,
      'social networks': 6, 'recommendation': 6, 'collaborative': 5, 'crowdsourcing': 5,
      'graph neural networks': 8, 'gnn': 7, 'knowledge graphs': 7, 'semantic web': 7
    };

    // Find domain matches - prioritize longer phrases first
    const domainScores = {};
    const sortedDomains = Object.keys(domainKeywords).sort((a, b) => b.length - a.length);
    
    sortedDomains.forEach(domain => {
      const regex = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = allTitles.match(regex);
      if (matches) {
        domainScores[domain] = matches.length * domainKeywords[domain];
        // Remove matched domain from titles to avoid double counting
        allTitles = allTitles.replace(regex, ' ').replace(/\s+/g, ' ').trim();
      }
    });

    console.log('📝 Domain scores:', domainScores);
    console.log('📝 Cleaned titles after domain removal:', allTitles);

    // Get top domains
    const topDomains = Object.entries(domainScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([domain]) => domain);

    console.log('📝 Top domains:', topDomains);

    // Extract common meaningful words from the cleaned titles (after domain removal)
    const allWords = allTitles
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4) // Longer words are more meaningful
      .filter(word => word.length < 20); // Avoid very long words that might be artifacts

    // Count word frequency with emphasis on longer words
    const wordCount = {};
    allWords.forEach(word => {
      const weight = word.length > 6 ? 2 : 1; // Longer words get more weight
      wordCount[word] = (wordCount[word] || 0) + weight;
    });

    // Enhanced stop words list
    const stopWords = ['the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'they', 'have', 'been', 'will', 'their', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'there', 'when', 'your', 'can', 'said', 'she', 'use', 'how', 'our', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part', 'using', 'based', 'approach', 'method', 'system', 'model', 'framework', 'technique', 'analysis', 'study', 'research', 'paper', 'work', 'proposed', 'novel', 'new', 'improved', 'enhanced', 'better', 'effective', 'efficient', 'performance', 'results', 'experimental', 'empirical', 'theoretical', 'practical', 'application', 'applications'];
    
    const commonWords = Object.entries(wordCount)
      .filter(([word, count]) => count > 1 && !stopWords.includes(word))
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);

    console.log('📝 Common words:', commonWords);

    // Get year range
    const years = papers.map(p => p.year).filter(y => y && y > 1900);
    const yearRange = years.length > 0 ? 
      `${Math.min(...years)}-${Math.max(...years)}` : 
      new Date().getFullYear().toString();

    console.log('📝 Year range:', yearRange);

    // Generate title based on domains and themes
    let title;
    if (topDomains.length >= 2) {
      title = `A Comprehensive Review of ${topDomains[0]} and ${topDomains[1]} (${yearRange})`;
    } else if (topDomains.length === 1) {
      title = `A Comprehensive Review of ${topDomains[0]} (${yearRange})`;
    } else if (commonWords.length >= 2) {
      title = `A Comprehensive Review of ${commonWords[0]} and ${commonWords[1]} (${yearRange})`;
    } else if (commonWords.length === 1) {
      title = `A Comprehensive Review of ${commonWords[0]} (${yearRange})`;
    } else {
      // Fallback: use paper count and year range
      title = `A Comprehensive Review of ${papers.length} Research Papers (${yearRange})`;
    }

    console.log('📝 Generated title:', title);
    return title;
  };

  // Function to generate survey paper
  const generateSurveyPaper = async () => {
    // Get the selected papers from the ref - same logic as BibTeX export
    const selectedIds = Array.from(selectedPapersRef.current);
    const selectedPapers = graphData.nodes.filter(node => selectedIds.includes(node.id));
    
    if (selectedPapers.length === 0) {
      alert('Please select at least one paper to generate a survey paper.');
      return;
    }

    setIsGeneratingSurvey(true);
    
    try {
      // Generate summaries for each paper
      const papersWithSummaries = await Promise.all(
        selectedPapers.map(async (paper) => ({
          ...paper,
          summary: await generatePaperSummary(paper)
        }))
      );

      // Generate PDF directly - no grouping, just simple list
      await generatePDF(null, papersWithSummaries);
      
    } catch (error) {
      console.error('Error generating survey paper:', error);
      alert('Failed to generate survey paper: ' + error.message);
    } finally {
      setIsGeneratingSurvey(false);
      setShowExportModal(false);
    }
  };


  // Function to generate PDF from survey content using browser print
  const generatePDF = async (groupedPapers, papersWithSummaries) => {
    try {
      // Create HTML content for PDF generation
      const htmlContent = await generateHTMLContent(groupedPapers, papersWithSummaries);
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
        throw new Error('Unable to open print window. Please allow popups for this site and try again.');
      }
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${generateRelevantTitle(papersWithSummaries)}</title>
          <style>
            @media print {
              @page { 
                margin: 1in; 
                size: A4;
              }
              body { 
                font-family: 'Times New Roman', serif; 
                line-height: 1.6; 
                color: #000; 
                font-size: 12pt;
                max-width: 6.5in;
                margin: 0 auto;
              }
              h1 { 
                color: #000; 
                font-size: 18pt; 
                font-weight: bold; 
                margin-bottom: 12pt; 
                text-align: center;
              }
              h2 { 
                color: #000; 
                font-size: 14pt; 
                font-weight: bold;
                margin-top: 24pt; 
                margin-bottom: 12pt; 
                border-bottom: 1pt solid #000; 
                padding-bottom: 3pt; 
              }
              h3 { 
                color: #000; 
                font-size: 12pt; 
                font-weight: bold;
                margin-top: 18pt; 
                margin-bottom: 8pt; 
              }
              h4 { 
                color: #000; 
                font-size: 11pt; 
                font-weight: bold;
                margin-bottom: 6pt; 
              }
              h5 { 
                color: #000; 
                font-size: 10pt; 
                font-weight: bold;
                margin-bottom: 4pt; 
              }
              p { 
                margin: 0 0 12pt 0; 
                text-align: justify;
              }
              ul, ol { 
                margin: 0 0 12pt 0; 
                padding-left: 20pt;
              }
              li { 
                margin-bottom: 6pt; 
              }
              .paper-section { 
                margin-bottom: 18pt; 
                padding: 12pt; 
                border-left: 2pt solid #000; 
                background-color: #f9f9f9; 
              }
              .metadata { 
                font-size: 9pt; 
                color: #333; 
                margin-bottom: 6pt;
              }
              .summary { 
                text-align: justify; 
                font-size: 10pt;
              }
              .footer { 
                text-align: center; 
                color: #666; 
                font-style: italic; 
                font-size: 8pt; 
                margin-top: 24pt; 
              }
            }
            @media screen {
              body { 
                font-family: 'Times New Roman', serif; 
                line-height: 1.6; 
                color: #000; 
                max-width: 8.5in; 
                margin: 0 auto; 
                padding: 1in; 
                background-color: #fff;
              }
              h1 { 
                color: #000; 
                font-size: 18pt; 
                font-weight: bold; 
                margin-bottom: 12pt; 
                text-align: center;
              }
              h2 { 
                color: #000; 
                font-size: 14pt; 
                font-weight: bold;
                margin-top: 24pt; 
                margin-bottom: 12pt; 
                border-bottom: 1pt solid #000; 
                padding-bottom: 3pt; 
              }
              h3 { 
                color: #000; 
                font-size: 12pt; 
                font-weight: bold;
                margin-top: 18pt; 
                margin-bottom: 8pt; 
              }
              h4 { 
                color: #000; 
                font-size: 11pt; 
                font-weight: bold;
                margin-bottom: 6pt; 
              }
              h5 { 
                color: #000; 
                font-size: 10pt; 
                font-weight: bold;
                margin-bottom: 4pt; 
              }
              p { 
                margin: 0 0 12pt 0; 
                text-align: justify;
              }
              ul, ol { 
                margin: 0 0 12pt 0; 
                padding-left: 20pt;
              }
              li { 
                margin-bottom: 6pt; 
              }
              .paper-section { 
                margin-bottom: 18pt; 
                padding: 12pt; 
                border-left: 2pt solid #000; 
                background-color: #f9f9f9; 
              }
              .metadata { 
                font-size: 9pt; 
                color: #333; 
                margin-bottom: 6pt;
              }
              .summary { 
                text-align: justify; 
                font-size: 10pt;
              }
              .footer { 
                text-align: center; 
                color: #666; 
                font-style: italic; 
                font-size: 8pt; 
                margin-top: 24pt; 
              }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load, then trigger print dialog
      printWindow.onload = () => {
        setTimeout(() => {
          // Check if window is still open before printing
          if (!printWindow.closed) {
            printWindow.focus();
            printWindow.print();
            // Close the window after printing
            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 1000);
          }
        }, 1000);
      };
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Show user-friendly error message
      const userMessage = error.message.includes('popup') 
        ? 'PDF generation failed: Popup blocked. Please allow popups for this site and try again.'
        : `PDF generation failed: ${error.message}`;
      
      alert(userMessage + '\n\nFalling back to text file export...');
      
      // Fallback: Generate text content and download
      try {
        const textContent = generateTextContent(groupedPapers, papersWithSummaries);
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RefNet-Review-Paper-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (fallbackError) {
        console.error('Fallback export also failed:', fallbackError);
        alert('Both PDF and text export failed. Please try again later.');
      }
    }
  };


  // Function to generate text content for fallback export
  const generateTextContent = (groupedPapers, papersWithSummaries) => {
    const papers = papersWithSummaries || [];
    
    const relevantTitle = generateRelevantTitle(papers);
    let content = `${relevantTitle.toUpperCase()}\n`;
    content += `Generated on: ${new Date().toLocaleDateString()}\n`;
    content += `Number of Papers: ${papers.length}\n`;
    content += `\n${'='.repeat(50)}\n\n`;
    
    // Selected References section
    content += `SELECTED REFERENCES\n\n`;
    papers.forEach((paper, index) => {
      content += `${index + 1}. ${paper.title}\n`;
      content += `   Authors: ${paper.authors?.join(', ') || 'Unknown'}\n`;
      content += `   Year: ${paper.year || 'Unknown'}\n`;
      content += `   Journal: ${paper.journal || paper.venue || 'Unknown'}\n`;
      content += `   Citations: ${paper.citations || 0}\n\n`;
    });
    
    content += `\n${'='.repeat(50)}\n\n`;
    
    // Abstract
    content += `ABSTRACT\n\n`;
    content += `This review paper synthesizes findings from ${papers.length} selected research papers `;
    content += `spanning from ${Math.min(...papers.map(p => p.year || 0))} to ${Math.max(...papers.map(p => p.year || 0))}. `;
    content += `The papers collectively represent significant contributions to their respective fields, `;
    content += `with a total of ${papers.reduce((sum, p) => sum + (p.citations || 0), 0)} citations. `;
    content += `This comprehensive analysis provides insights into the evolution of research in this domain `;
    content += `and highlights key trends, methodologies, and findings across the selected literature.\n\n`;
    
    // Individual Paper Analysis
    content += `DETAILED PAPER ANALYSIS\n\n`;
    papers.forEach((paper, index) => {
      content += `${index + 1}. ${paper.title}\n`;
      content += `${'='.repeat(paper.title.length)}\n\n`;
      content += `Authors: ${paper.authors?.join(', ') || 'Unknown'}\n`;
      content += `Year: ${paper.year || 'Unknown'}\n`;
      content += `Journal: ${paper.journal || paper.venue || 'Unknown'}\n`;
      content += `Citations: ${paper.citations || 0}\n\n`;
      content += `Summary:\n${paper.summary || 'Summary not available'}\n\n`;
      content += `${'-'.repeat(50)}\n\n`;
    });
    
    // Conclusion
    content += `CONCLUSION\n\n`;
    content += `This review of ${papers.length} selected papers reveals significant insights into the `;
    content += `research landscape. The papers demonstrate diverse methodological approaches and `;
    content += `contribute substantially to their respective fields. The high citation counts `;
    content += `indicate the impact and relevance of these works within the academic community.\n\n`;
    
    content += `Generated by RefNet - Research Network Visualization Tool\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    
    return content;
  };

  // Function to convert Markdown formatting to HTML
  const markdownToHtml = (text) => {
    if (!text) return '';
    
    return text
      // Convert **text** to <strong>text</strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert *text* to <em>text</em>
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert ### Headers to <h3>headers</h3>
      .replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; margin-top: 20px; margin-bottom: 10px; color: #2c3e50;">$1</h3>')
      // Convert ## Headers to <h2>headers</h2>
      .replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; margin-top: 25px; margin-bottom: 15px; color: #2c3e50;">$1</h2>')
      // Convert # Headers to <h1>headers</h1>
      .replace(/^# (.*$)/gim, '<h1 style="font-size: 20px; margin-top: 30px; margin-bottom: 20px; color: #2c3e50;">$1</h1>')
      // Convert line breaks to <br>
      .replace(/\n/g, '<br>');
  };

  // Function to generate AI-powered content for each section
  const generateAIContent = async (prompt, papers) => {
    try {
          const response = await fetch('https://api.refnet.wiki/mastra/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          additionalContext: { selectedPapers: papers, graphData: {} }
        })
      });
      const data = await response.json();
      const content = data.content || 'Content generation failed.';
      return markdownToHtml(content);
    } catch (error) {
      console.error('AI content generation error:', error);
      return 'Content generation failed due to AI service error.';
    }
  };

  // Function to generate HTML content for PDF generation
  const generateHTMLContent = async (groupedPapers, papersWithSummaries) => {
    const currentDate = new Date().toLocaleDateString();
    const totalPapers = papersWithSummaries.length;
    const yearRange = papersWithSummaries.length > 0 ? 
      `${Math.min(...papersWithSummaries.map(p => p.year || 0))} to ${Math.max(...papersWithSummaries.map(p => p.year || 0))}` : 
      'Unknown';
    const relevantTitle = generateRelevantTitle(papersWithSummaries);
    console.log('🎯 HTML Content - Generated title:', relevantTitle);

    // Generate AI-powered content for each section
    const abstract = await generateAIContent(
      `Write a comprehensive abstract (200-300 words) for a review paper that synthesizes findings from ${totalPapers} research papers spanning ${yearRange}. The abstract should provide a clear overview of the research domain, highlight the scope and methodology of the review, summarize key findings and contributions, and mention the significance and implications.`,
      papersWithSummaries
    );

    const introduction = await generateAIContent(
      `Write a comprehensive introduction (400-500 words) for a review paper that provides background context for the research domain, explains the importance and relevance of the field, describes the scope and objectives of the review, and outlines the structure and organization of the paper.`,
      papersWithSummaries
    );

    const fundamentals = await generateAIContent(
      `Write a comprehensive section on fundamentals (500-600 words) that explains the core concepts and theoretical foundations, describes fundamental principles and methodologies, discusses key theoretical frameworks, explains the underlying science and mechanisms, and provides context for understanding the field.`,
      papersWithSummaries
    );

    const typesAndCategories = await generateAIContent(
      `Write a comprehensive section on types and categories (400-500 words) that classifies different types, approaches, or methodologies, explains the characteristics of each category, discusses the relationships between different types, provides examples from the literature, and explains when to use each type or approach.`,
      papersWithSummaries
    );

    const stateOfArt = await generateAIContent(
      `Write a comprehensive section on state-of-the-art applications (500-600 words) that describes the most advanced and recent applications, highlights cutting-edge technologies and methods, discusses current limitations and challenges, explains recent breakthroughs and innovations, and identifies emerging trends and future directions.`,
      papersWithSummaries
    );

    // Removed applications section as it's not needed
    
    let html = `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #2c3e50;">${relevantTitle}</h1>
        <p style="font-size: 16px; color: #7f8c8d; font-style: italic; margin: 0;">Generated by RefNet Research Network Visualization Tool</p>
        <p style="font-size: 14px; color: #95a5a6; margin: 5px 0 0 0;">${currentDate}</p>
      </div>
      
      <div style="margin-bottom: 30px; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #3498db;">
        <h2 style="font-size: 20px; margin-bottom: 15px; color: #2c3e50;">Abstract</h2>
        <p style="text-align: justify; line-height: 1.6; margin: 0;">${abstract}</p>
      </div>
      
      <div style="margin-bottom: 30px; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #e74c3c;">
        <h2 style="font-size: 20px; margin-bottom: 15px; color: #2c3e50;">Selected References</h2>
        <p style="margin-bottom: 15px; color: #7f8c8d; font-style: italic;">The following ${totalPapers} papers were selected for this comprehensive review:</p>
        <ol style="margin: 0; padding-left: 20px;">
    `;
    
    // Add numbered references at the top
    papersWithSummaries.forEach((paper, index) => {
      const authors = paper.authors?.join(', ') || 'Unknown authors';
      const year = paper.year || 'n.d.';
      const journal = paper.journal || paper.venue || 'Unknown journal';
      const doi = paper.doi ? `https://doi.org/${paper.doi}` : '';
      
      html += `
        <li style="margin-bottom: 10px; line-height: 1.4;">
          <strong>${authors}</strong> (${year}). ${paper.title}. <em>${journal}</em>. ${doi ? `DOI: ${doi}` : ''}
        </li>
      `;
    });
    
    html += `
        </ol>
      </div>
      
      <h2 style="font-size: 22px; margin-top: 40px; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">1. Introduction</h2>
      <div style="text-align: justify; line-height: 1.6; margin-bottom: 30px;">
        ${introduction}
      </div>
      
      <h2 style="font-size: 22px; margin-top: 40px; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">2. Fundamentals</h2>
      <div style="text-align: justify; line-height: 1.6; margin-bottom: 30px;">
        ${fundamentals}
      </div>
      
      <h2 style="font-size: 22px; margin-top: 40px; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">3. Types and Categories</h2>
      <div style="text-align: justify; line-height: 1.6; margin-bottom: 30px;">
        ${typesAndCategories}
      </div>
      
      <h2 style="font-size: 22px; margin-top: 40px; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">4. State-of-the-Art Applications</h2>
      <div style="text-align: justify; line-height: 1.6; margin-bottom: 30px;">
        ${stateOfArt}
      </div>
      
      <h2 style="font-size: 22px; margin-top: 40px; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">5. Discussion and Future Directions</h2>
      <div style="text-align: justify; line-height: 1.6; margin-bottom: 30px;">
        <p>This comprehensive review of ${totalPapers} selected papers reveals significant insights into the current state and evolution of the field. The papers collectively demonstrate the richness and diversity of research approaches, from fundamental theoretical contributions to cutting-edge applications.</p>
        
        <p>The analysis reveals several key themes: the importance of theoretical foundations, the value of methodological diversity, the growing emphasis on practical applications, and the critical role of collaboration in advancing knowledge. These insights provide a solid foundation for understanding the current state of the field and identifying future research directions.</p>
        
        <p>As the field continues to evolve, it will be important to maintain the balance between theoretical rigor and practical relevance, while fostering continued collaboration and interdisciplinary approaches. The papers reviewed here provide excellent examples of how this balance can be achieved and offer valuable guidance for future research efforts.</p>
      </div>
    `;

    // Add references section
    html += `
      <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #e74c3c;">
        <h2 style="font-size: 20px; margin-bottom: 15px; color: #2c3e50;">References</h2>
        <p style="margin-bottom: 15px; color: #7f8c8d; font-style: italic;">Complete list of papers analyzed in this review:</p>
        <ol style="margin: 0; padding-left: 20px;">
    `;
    
    // Add formatted references
    papersWithSummaries.forEach((paper, index) => {
      const authors = paper.authors?.join(', ') || 'Unknown authors';
      const year = paper.year || 'n.d.';
      const journal = paper.journal || paper.venue || 'Unknown journal';
      const doi = paper.doi ? `https://doi.org/${paper.doi}` : '';
      
      html += `
        <li style="margin-bottom: 10px; line-height: 1.4; text-align: justify;">
          <strong>${authors}</strong> (${year}). ${paper.title}. <em>${journal}</em>. ${doi ? `DOI: ${doi}` : ''}
        </li>
      `;
    });
    
    html += `
        </ol>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding: 20px; background-color: #ecf0f1; border-radius: 4px;">
        <p style="margin: 0; color: #7f8c8d; font-size: 14px;">Generated by RefNet - Research Network Visualization Tool</p>
        <p style="margin: 5px 0 0 0; color: #95a5a6; font-size: 12px;">This review paper synthesizes findings from ${totalPapers} selected research papers</p>
      </div>
    `;

    return html;
  };

  // Function to generate Markdown content for survey paper
  const generateMarkdownContent = (groupedPapers, papersWithSummaries) => {
    const currentDate = new Date().toLocaleDateString();
    const totalPapers = papersWithSummaries.length;
    const relevantTitle = generateRelevantTitle(papersWithSummaries);
    
    let content = `# ${relevantTitle}
*Generated by RefNet on ${currentDate}*

## Executive Summary

This survey paper presents an overview of ${totalPapers} selected research papers, organized by topic areas. Each paper has been analyzed and summarized to provide a comprehensive understanding of the current state of research in the selected domain.

## Table of Contents

`;

    // Add table of contents
    Object.keys(groupedPapers).forEach((topic, index) => {
      content += `${index + 1}. ${topic} (${groupedPapers[topic].length} papers)\n`;
    });

    content += `\n---\n\n`;

    // Add each topic section
    Object.entries(groupedPapers).forEach(([topic, papersInTopic], topicIndex) => {
      content += `## ${topicIndex + 1}. ${topic}\n\n`;
      content += `*${papersInTopic.length} paper${papersInTopic.length !== 1 ? 's' : ''} in this category*\n\n`;

      papersInTopic.forEach((paper, paperIndex) => {
        const paperWithSummary = papersWithSummaries.find(p => p.id === paper.id);
        content += `### ${paperIndex + 1}. ${paper.title}\n\n`;
        content += `**Authors:** ${paper.authors?.join(', ') || 'Unknown'}\n\n`;
        content += `**Year:** ${paper.year || 'Unknown'}\n\n`;
        content += `**Journal:** ${paper.journal || paper.venue || 'Unknown'}\n\n`;
        content += `**Citations:** ${paper.citations || 0}\n\n`;
        
        if (paper.doi) {
          content += `**DOI:** [${paper.doi}](https://doi.org/${paper.doi})\n\n`;
        }
        
        if (paper.url || paper.openalex_url) {
          const url = paper.url || paper.openalex_url;
          content += `**URL:** [View Paper](${url})\n\n`;
        }
        
        content += `**Summary:**\n\n${paperWithSummary?.summary || 'Summary not available'}\n\n`;
        content += `---\n\n`;
      });
    });

    content += `## Conclusion\n\n`;
    content += `This survey paper has examined ${totalPapers} research papers across ${Object.keys(groupedPapers).length} topic areas. `;
    content += `The papers span from ${Math.min(...papersWithSummaries.map(p => p.year || 0))} to ${Math.max(...papersWithSummaries.map(p => p.year || 0))}, `;
    content += `providing a comprehensive view of the research landscape in this domain.\n\n`;
    content += `*Generated by RefNet - Research Network Visualization Tool*\n`;

    return content;
  };

  /* Original PDF generation code - keeping for future reference
  const generatePDFOriginal = async (groupedPapers, papersWithSummaries) => {
    try {
      // Dynamic import to avoid build issues
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (2 * margin);
      let yPosition = margin;
    
      // Helper function to add text with word wrapping
      const addText = (text, x, y, options = {}) => {
        const { fontSize = 12, fontStyle = 'normal', color = '#000000', maxWidth = contentWidth } = options;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(color);
        
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * (fontSize * 0.4));
      };
      
      // Helper function to add a new page if needed
      const checkNewPage = (requiredSpace) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Title
      const relevantTitle = generateRelevantTitle(papersWithSummaries);
      yPosition = addText(relevantTitle, margin, yPosition, { 
        fontSize: 20, 
        fontStyle: 'bold',
        color: '#2c3e50'
      });
      yPosition += 10;
      
      // Subtitle
      yPosition = addText(`Generated by RefNet on ${new Date().toLocaleDateString()}`, margin, yPosition, {
        fontSize: 10,
        fontStyle: 'italic',
        color: '#7f8c8d'
      });
      yPosition += 15;
      
      // Executive Summary
      yPosition = addText('Executive Summary', margin, yPosition, { 
        fontSize: 16, 
        fontStyle: 'bold',
        color: '#2c3e50'
      });
      yPosition += 5;
      
      const totalPapers = papersWithSummaries.length;
      const summaryText = `This survey paper presents an overview of ${totalPapers} selected research papers, organized by topic areas. Each paper has been analyzed and summarized to provide a comprehensive understanding of the current state of research in the selected domain.`;
      yPosition = addText(summaryText, margin, yPosition, { fontSize: 11 });
      yPosition += 15;
      
      // Table of Contents
      yPosition = addText('Table of Contents', margin, yPosition, { 
        fontSize: 16, 
        fontStyle: 'bold',
        color: '#2c3e50'
      });
      yPosition += 5;
      
      Object.keys(groupedPapers).forEach((topic, index) => {
        const tocText = `${index + 1}. ${topic} (${groupedPapers[topic].length} papers)`;
        yPosition = addText(tocText, margin + 10, yPosition, { fontSize: 11 });
      });
      yPosition += 15;
      
      // Add separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      // Add each topic section
      Object.entries(groupedPapers).forEach(([topic, papersInTopic], topicIndex) => {
        // Check if we need a new page
        checkNewPage(30);
        
        // Topic header
        yPosition = addText(`${topicIndex + 1}. ${topic}`, margin, yPosition, { 
          fontSize: 14, 
          fontStyle: 'bold',
          color: '#34495e'
        });
        yPosition += 3;
        
        // Topic description
        const topicDesc = `${papersInTopic.length} paper${papersInTopic.length !== 1 ? 's' : ''} in this category`;
        yPosition = addText(topicDesc, margin, yPosition, { 
          fontSize: 10, 
          fontStyle: 'italic',
          color: '#7f8c8d'
        });
        yPosition += 10;
        
        // Add papers in this topic
        papersInTopic.forEach((paper, paperIndex) => {
          const paperWithSummary = papersWithSummaries.find(p => p.id === paper.id);
          
          // Check if we need a new page for this paper
          checkNewPage(50);
          
          // Paper title
          yPosition = addText(`${paperIndex + 1}. ${paper.title}`, margin + 10, yPosition, { 
            fontSize: 12, 
            fontStyle: 'bold',
            color: '#2c3e50'
          });
          yPosition += 5;
          
          // Paper metadata
          const authors = paper.authors?.join(', ') || 'Unknown';
          const year = paper.year || 'Unknown';
          const journal = paper.journal || paper.venue || 'Unknown';
          const citations = paper.citations || 0;
          
          yPosition = addText(`Authors: ${authors}`, margin + 15, yPosition, { fontSize: 10 });
          yPosition = addText(`Year: ${year}`, margin + 15, yPosition, { fontSize: 10 });
          yPosition = addText(`Journal: ${journal}`, margin + 15, yPosition, { fontSize: 10 });
          yPosition = addText(`Citations: ${citations}`, margin + 15, yPosition, { fontSize: 10 });
          
          if (paper.doi) {
            yPosition = addText(`DOI: ${paper.doi}`, margin + 15, yPosition, { fontSize: 10 });
          }
          
          yPosition += 5;
          
          // Summary
          yPosition = addText('Summary:', margin + 15, yPosition, { 
            fontSize: 11, 
            fontStyle: 'bold',
            color: '#34495e'
          });
          yPosition += 3;
          
          const summary = paperWithSummary?.summary || 'Summary not available';
          yPosition = addText(summary, margin + 15, yPosition, { fontSize: 10 });
          yPosition += 10;
          
          // Add separator line between papers
          if (paperIndex < papersInTopic.length - 1) {
            doc.setDrawColor(220, 220, 220);
            doc.line(margin + 10, yPosition, pageWidth - margin - 10, yPosition);
            yPosition += 5;
          }
        });
        
        yPosition += 10;
      });
      
      // Conclusion
      checkNewPage(30);
      yPosition = addText('Conclusion', margin, yPosition, { 
        fontSize: 16, 
        fontStyle: 'bold',
        color: '#2c3e50'
      });
      yPosition += 5;
      
      const conclusionText = `This survey paper has examined ${totalPapers} research papers across ${Object.keys(groupedPapers).length} topic areas. The papers span from ${Math.min(...papersWithSummaries.map(p => p.year || 0))} to ${Math.max(...papersWithSummaries.map(p => p.year || 0))}, providing a comprehensive view of the research landscape in this domain.`;
      yPosition = addText(conclusionText, margin, yPosition, { fontSize: 11 });
      yPosition += 15;
      
      // Footer
      yPosition = addText('Generated by RefNet - Research Network Visualization Tool', margin, yPosition, {
        fontSize: 8,
        fontStyle: 'italic',
        color: '#95a5a6'
      });
      
      // Save the PDF
      const filename = `RefNet-Survey-Paper-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF: ' + error.message);
    }
  };
  */

  // Function to take screenshot (no selection required)
  const handleScreenshot = async () => {
    try {
      await captureSVGAsPNG();
    } catch (error) {
      alert('Failed to capture graph as PNG: ' + error.message);
    }
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (showExportModal && !event.target.closest('.export-container')) {
      setShowExportModal(false);
    }
  };

  // Function to capture SVG as PNG with high quality
  const captureSVGAsPNG = async () => {
    const svg = d3.select(svgRef.current);
    const svgNode = svg.node();
    
    if (!svgNode) {
      alert('No graph to capture');
      return;
    }

    // Get the actual SVG dimensions from the viewBox or computed style
    const svgRect = svgNode.getBoundingClientRect();
    const viewBox = svgNode.getAttribute('viewBox');
    
    let width, height;
    if (viewBox) {
      const viewBoxValues = viewBox.split(' ');
      width = parseInt(viewBoxValues[2]);
      height = parseInt(viewBoxValues[3]);
    } else {
      width = svgRect.width;
      height = svgRect.height;
    }
    
    // Use higher resolution for better quality
    const scale = 2; // 2x resolution for crisp output
    const canvasWidth = width * scale;
    const canvasHeight = height * scale;
    
    // Create a canvas with high resolution
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Set dark background to match the app
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgNode.cloneNode(true);
    
    // Set explicit width and height on the cloned SVG
    clonedSvg.setAttribute('width', width);
    clonedSvg.setAttribute('height', height);
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Draw the image scaled up for better quality
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        URL.revokeObjectURL(svgUrl);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `refnet-graph-${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            resolve();
          } else {
            reject(new Error('Failed to create PNG'));
          }
        }, 'image/png', 1.0); // Maximum quality
      };
      img.onerror = () => reject(new Error('Failed to load SVG'));
      img.src = svgUrl;
    });
  };


  // Function to handle export with selected format
  const handleExport = async (format) => {
    const selectedIds = Array.from(selectedPapersRef.current);
    const selectedPapers = graphData.nodes.filter(node => selectedIds.includes(node.id));
    
    if (format === 'png') {
      try {
        await captureSVGAsPNG();
        setShowExportModal(false);
        return;
      } catch (error) {
        alert('Failed to capture graph as PNG: ' + error.message);
        return;
      }
    }
    
    let content, mimeType, fileExtension;
    
    if (format === 'bib') {
      // Generate BibTeX content - only for selected papers
      if (selectedPapers.length === 0) {
        alert('Please select at least one paper to export as BibTeX.');
        return;
      }
      const bibEntries = selectedPapers.map(paper => paperToBibTeX(paper)).join('\n\n');
      content = bibEntries;
      mimeType = 'text/plain';
      fileExtension = 'bib';
    } else {
      // JSON format (default) - includes ALL nodes in the graph
    const exportData = {
      export_date: new Date().toISOString(),
      graph_parameters: {
        iterations,
        cited_limit: citedLimit,
        ref_limit: refLimit
        },
        // Include all graph data for complete import
        graph_data: {
          nodes: graphData.nodes,  // All nodes, not just selected ones
          links: graphData.links
      }
    };
      content = JSON.stringify(exportData, null, 2);
      mimeType = 'application/json';
      fileExtension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refnet-export-${new Date().toISOString().split('T')[0]}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Close modal after export
    setShowExportModal(false);
  };

  const handleBackToSearch = () => {
    navigate('/');
  };

  // Calculate position right next to selected nodes
  const calculateChatPosition = (selectedPapers) => {
    if (selectedPapers.length === 0) return { x: 50, y: 50 };
    
    // Get the first selected node's D3 position
    const firstNodeId = selectedPapers[0]?.id;
    if (!firstNodeId) return { x: 50, y: 50 };
    
    // Find the D3 node element to get current position
    const d3Node = d3.select(`circle[data-id="${firstNodeId}"]`);
    if (d3Node.empty()) return { x: 50, y: 50 };
    
    // Get the current position from D3
    const nodeData = d3Node.datum();
    const nodeX = nodeData?.x || 0;
    const nodeY = nodeData?.y || 0;
    
    // Get the graph container's position on screen
    const graphContainer = document.querySelector('.graph-container');
    const graphRect = graphContainer?.getBoundingClientRect();
    if (!graphRect) return { x: 50, y: 50 };
    
    // Convert D3 coordinates to screen coordinates
    const screenX = nodeX + graphRect.left;
    const screenY = nodeY + graphRect.top;
    
    // Position chat right next to the nodes (offset by chat width + some padding)
    const chatWidth = 280;
    const chatHeight = 350;
    const offset = 20; // Distance from nodes
    const margin = 20;
    
    // Try to position to the right of the nodes first
    let x = screenX + offset;
    let y = screenY - (chatHeight / 2); // Center vertically with nodes
    
    // If too far right, position to the left
    if (x + chatWidth > window.innerWidth - margin) {
      x = screenX - chatWidth - offset;
    }
    
    // If too far left, position below
    if (x < margin) {
      x = screenX - (chatWidth / 2); // Center horizontally
      y = screenY + offset;
    }
    
    // If too far down, position above
    if (y + chatHeight > window.innerHeight - margin) {
      y = screenY - chatHeight - offset;
    }
    
    // Final boundary checks
    x = Math.max(margin, Math.min(window.innerWidth - chatWidth - margin, x));
    y = Math.max(margin, Math.min(window.innerHeight - chatHeight - margin, y));
    
    return { x, y };
  };

  // Chat management functions
  const createChat = () => {
    const selectedIds = Array.from(selectedPapersRef.current);
    if (selectedIds.length < 1) return;
    
    const selectedPapers = graphData.nodes.filter(node => selectedIds.includes(node.id));
    const position = calculateChatPosition(selectedPapers);
    
    // Get the first node's D3 position for the connection line
    const firstNodeId = selectedPapers[0]?.id;
    let firstNodePosition = { x: 0, y: 0 };
    
    if (firstNodeId) {
      const d3Node = d3.select(`circle[data-id="${firstNodeId}"]`);
      if (!d3Node.empty()) {
        const nodeData = d3Node.datum();
        firstNodePosition = {
          x: nodeData?.x || 0,
          y: nodeData?.y || 0
        };
      }
    }
    
    const newChat = {
      id: nextChatId,
      name: `Chat ${nextChatId}`,
      selectedPapers: selectedPapers.map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        citations: paper.citations,
        topics: paper.topics || [],
        abstract: paper.abstract || ''
      })),
      position,
      isOpen: true,
      firstNodePosition,
      messages: []
    };
    
    setChats(prev => [...prev, newChat]);
    setActiveChatId(newChat.id);
    setNextChatId(prev => prev + 1);
    setLastInteractionTime(prev => ({ ...prev, [newChat.id]: Date.now() }));
  };

  const deleteChat = (chatId) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (activeChatId === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId);
      setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
    }
  };

  const closeChat = (chatId) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, isOpen: false } : chat
    ));
  };

  const renameChat = (chatId, newName) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, name: newName } : chat
    ));
  };

  const selectChat = (chatId) => {
    setActiveChatId(chatId);
    setLastInteractionTime(prev => ({ ...prev, [chatId]: Date.now() }));
  };

  const openChat = (chatId) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, isOpen: true } : chat
    ));
    setActiveChatId(chatId);
    setLastInteractionTime(prev => ({ ...prev, [chatId]: Date.now() }));
  };

  const updateChatPosition = (chatId, position) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, position } : chat
    ));
  };

  // Text box management functions
  const createTextBox = (x, y, width = 200, height = 100, text = '') => {
    const newTextBox = {
      id: nextTextBoxId,
      x,
      y,
      width,
      height,
      text,
      title: `Note #${nextTextBoxId}`,
      color: textBoxColors[0], // Default to gold
      createdAt: new Date().toISOString()
    };
    
    setTextBoxes(prev => [...prev, newTextBox]);
    setNextTextBoxId(prev => prev + 1);
    
    return newTextBox;
  };

  const updateTextBox = (id, updates) => {
    setTextBoxes(prev => prev.map(textBox => 
      textBox.id === id ? { ...textBox, ...updates } : textBox
    ));
  };

  const deleteTextBox = (id) => {
    setTextBoxes(prev => prev.filter(textBox => textBox.id !== id));
  };

  // Color picker functions
  const toggleColorPicker = (textBoxId) => {
    console.log('Toggle color picker for text box:', textBoxId, 'Current:', showColorPicker);
    setShowColorPicker(showColorPicker === textBoxId ? null : textBoxId);
  };

  const changeTextBoxColor = (textBoxId, color) => {
    console.log('Change color for text box:', textBoxId, 'to color:', color);
    updateTextBox(textBoxId, { color });
    setShowColorPicker(null);
  };

  const handleColorButtonClick = (event, textBoxId) => {
    event.preventDefault();
    event.stopPropagation();
    toggleColorPicker(textBoxId);
  };

  // Header editing functions
  const startEditingHeader = (textBoxId) => {
    setEditingHeader(textBoxId);
  };

  const finishEditingHeader = (textBoxId, newTitle) => {
    updateTextBox(textBoxId, { title: newTitle || `Note #${textBoxId}` });
    setEditingHeader(null);
  };

  const handleHeaderKeyDown = (event, textBoxId) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishEditingHeader(textBoxId, event.target.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditingHeader(null);
    }
  };

  // Resize handlers for text boxes
  const handleResizeStart = (event, textBoxId, direction) => {
    event.preventDefault();
    event.stopPropagation();
    
    const textBox = textBoxes.find(tb => tb.id === textBoxId);
    if (!textBox) return;
    
    setResizingTextBox({ id: textBoxId, direction });
    setResizeStart({
      x: event.clientX,
      y: event.clientY,
      width: textBox.width,
      height: textBox.height
    });
  };

  const handleResizeMove = (event) => {
    if (!resizingTextBox) return;
    
    event.preventDefault();
    
    const deltaX = event.clientX - resizeStart.x;
    const deltaY = event.clientY - resizeStart.y;
    
    const textBox = textBoxes.find(tb => tb.id === resizingTextBox.id);
    if (!textBox) return;
    
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = textBox.x;
    let newY = textBox.y;
    
    // Calculate new dimensions and position based on resize direction
    if (resizingTextBox.direction.includes('right')) {
      newWidth = Math.max(150, resizeStart.width + deltaX);
    }
    if (resizingTextBox.direction.includes('left')) {
      const widthChange = Math.max(150, resizeStart.width - deltaX) - resizeStart.width;
      newWidth = resizeStart.width + widthChange;
      newX = textBox.x - widthChange;
    }
    if (resizingTextBox.direction.includes('bottom')) {
      newHeight = Math.max(80, resizeStart.height + deltaY);
    }
    if (resizingTextBox.direction.includes('top')) {
      const heightChange = Math.max(80, resizeStart.height - deltaY) - resizeStart.height;
      newHeight = resizeStart.height + heightChange;
      newY = textBox.y - heightChange;
    }
    
    updateTextBox(resizingTextBox.id, { 
      width: newWidth, 
      height: newHeight, 
      x: newX, 
      y: newY 
    });
  };

  const handleResizeEnd = () => {
    setResizingTextBox(null);
    setResizeStart({ x: 0, y: 0, width: 0, height: 0 });
  };

  // Drag handlers for text boxes
  const handleTextBoxMouseDown = (event, textBoxId) => {
    // Don't drag if clicking on buttons, textarea, or color picker
    if (event.target.tagName === 'TEXTAREA' || 
        event.target.tagName === 'BUTTON' ||
        event.target.closest('button') ||
        event.target.closest('.color-picker') ||
        event.target.closest('.resize-handle')) {
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const textBox = textBoxes.find(tb => tb.id === textBoxId);
    if (!textBox) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    
    setDraggedTextBox(textBoxId);
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleTextBoxMouseMove = (event) => {
    if (!draggedTextBox) return;
    
    event.preventDefault();
    
    const newX = event.clientX - dragOffset.x;
    const newY = event.clientY - dragOffset.y;
    
    // Keep text box within screen bounds
    const maxX = window.innerWidth - 200; // text box width
    const maxY = window.innerHeight - 100; // text box height
    
    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));
    
    // Direct DOM manipulation for immediate response
    const textBoxElement = document.querySelector(`[data-textbox-id="${draggedTextBox}"]`);
    if (textBoxElement) {
      textBoxElement.style.left = `${constrainedX}px`;
      textBoxElement.style.top = `${constrainedY}px`;
    }
    
    // Update state for persistence (but don't block the visual update)
    requestAnimationFrame(() => {
      updateTextBox(draggedTextBox, { x: constrainedX, y: constrainedY });
    });
  };

  const handleTextBoxMouseUp = () => {
    setDraggedTextBox(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (draggedTextBox) {
      document.addEventListener('mousemove', handleTextBoxMouseMove, { passive: false });
      document.addEventListener('mouseup', handleTextBoxMouseUp, { passive: false });
      
      return () => {
        document.removeEventListener('mousemove', handleTextBoxMouseMove);
        document.removeEventListener('mouseup', handleTextBoxMouseUp);
      };
    }
  }, [draggedTextBox, dragOffset]);

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (resizingTextBox) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingTextBox, resizeStart]);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showColorPicker && 
          !event.target.closest('.color-picker') && 
          !event.target.closest('.textbox-color-btn') &&
          !event.target.closest('.color-option')) {
        setShowColorPicker(null);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);


  // Update chat connection lines when nodes move
  const updateChatConnections = () => {
    const newConnections = {};
    
    chats.forEach(chat => {
      if (chat.selectedPapers && chat.selectedPapers.length > 0) {
        const firstNodeId = chat.selectedPapers[0]?.id;
        if (firstNodeId) {
          const d3Node = d3.select(`circle[data-id="${firstNodeId}"]`);
          if (!d3Node.empty()) {
            const nodeData = d3Node.datum();
            newConnections[chat.id] = {
              x: nodeData?.x || 0,
              y: nodeData?.y || 0
            };
          }
        }
      }
    });
    
    setChatConnections(newConnections);
  };

  // Load initial data
  useEffect(() => {
    console.log('🔄 GraphViewerClean useEffect triggered');
    console.log('📊 Initial paper IDs:', initialPaperIds);
    console.log('🔍 Paper ID from params:', paperId);
    console.log('📦 Is import scenario:', isImportScenario);
    console.log('🔄 Has processed import:', hasProcessedImport);
    console.log('💾 Imported graph data from state:', !!importedGraphData);
    console.log('💾 Raw imported data:', importedGraphData);
    console.log('🔍 Location state:', location.state);
    console.log('🔍 Will load from API:', initialPaperIds.length > 0 && !importedGraphData);
    
    // Check if we have imported data from navigation state
    if (importedGraphData && !hasProcessedImport) {
      try {
        console.log('🔄 Processing imported data from navigation state...');
        setHasProcessedImport(true);
        
        console.log('📄 Graph data:', importedGraphData);
        console.log('📊 Number of nodes:', importedGraphData.nodes?.length);
        console.log('📊 Number of links:', importedGraphData.links?.length);
        
        setGraphData({
          nodes: importedGraphData.nodes || [],
          links: importedGraphData.links || []
        });
        
        // Apply imported parameters if available
        if (importedGraphData.parameters) {
          const { iterations: importedIterations, cited_limit, ref_limit } = importedGraphData.parameters;
          if (importedIterations !== undefined) setIterations(importedIterations);
          if (cited_limit !== undefined) setCitedLimit(cited_limit);
          if (ref_limit !== undefined) setRefLimit(ref_limit);
        }
        
        setLoading(false);
        console.log('✅ Imported data processed successfully - skipping API load');
        return;
      } catch (error) {
        console.error('❌ Failed to process imported data:', error);
        setHasProcessedImport(false);
        // Fall back to normal loading
      }
    }
    
    // Only load data if we have paper IDs AND no imported data was processed
    if (initialPaperIds.length > 0 && !importedGraphData) {
      console.log('🔄 Loading data from API for paper IDs:', initialPaperIds);
    loadGraphData();
    loadPaperDetails();
    } else if (isImportScenario && !importedGraphData) {
      // This is an import scenario but no imported data found
      setError('No imported data found. Please use the Import button on the landing page first.');
      setLoading(false);
    } else if (!importedGraphData && initialPaperIds.length === 0) {
      setError('No paper ID provided');
      setLoading(false);
    }
  }, [paperId, hasProcessedImport]);


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
    if (!dimensions.width || !dimensions.height || graphData.nodes.length === 0 || loading) return;
    
    // Ensure we have nodes data (links can be empty for single nodes)
    if (!graphData.nodes || graphData.nodes.length === 0) {
      console.log('Waiting for graph nodes...');
      return;
    }

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
    console.log('Original links before filtering:', graphData.links?.map(l => `${l.source} -> ${l.target}`) || 'No links');
    console.log('Graph ready state:', graphReady);
    console.log('Loading state:', loading);
    
    // Check if links reference valid nodes
    const invalidLinks = links.filter(l => !l.source || !l.target);
    if (invalidLinks.length > 0) {
      console.warn('Invalid links found (missing source or target):', invalidLinks);
    }

    // Create force simulation with proper link handling
    let simulation;
    try {
      simulation = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(-200)) // Reduced repulsion for more compact layout
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force('x', d3.forceX(dimensions.width / 2).strength(0.2)) // Stronger centering
        .force('y', d3.forceY(dimensions.height / 2).strength(0.2)); // Stronger centering
      
      // Only add link force if we have links
      if (links.length > 0) {
        simulation.force('link', d3.forceLink(links).distance(50).strength(0.8)); // Shorter links, stronger force
      }
    } catch (error) {
      console.error('Error creating D3 simulation:', error);
      return;
    }

    // Store simulation reference
    simulationRef.current = simulation;

    // Set graph as ready immediately after simulation starts
    setGraphReady(true);

    // Create links - simple lines without arrows (only if we have links)
    let link = null;
    if (links.length > 0) {
      link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
        .attr('stroke', d => {
          // AI discovery links get green color
          if (d.type === 'ai_discovered') {
            return '#10b981';
          }
          return '#666666';
        })
        .attr('stroke-opacity', d => {
          // AI discovery links are more prominent
          if (d.type === 'ai_discovered') {
            return 0.8;
          }
          return 0.6;
        })
        .attr('stroke-width', d => {
          // AI discovery links are thicker
          if (d.type === 'ai_discovered') {
            return 2;
          }
          return 1;
        })
        .attr('stroke-dasharray', d => {
          // AI discovery links have dashed pattern
          if (d.type === 'ai_discovered') {
            return '5,3';
          }
          return 'none';
        });
    }

    // Create nodes with size based on citations

    // Calculate normalized citations for radius scaling
    const citations = nodes.map(d => d.citations || 0);
    const minCitations = Math.min(...citations);
    const maxCitations = Math.max(...citations);
    const citationRange = maxCitations - minCitations;
    
    console.log(`Citation normalization: min=${minCitations}, max=${maxCitations}, range=${citationRange}`);
    
    // Create nodes with size based on normalized citations
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
      .attr('r', d => {
        if (citationRange === 0) return 10; // All nodes same size if no variation
        
        // Normalize citations to 0-1 range
        const normalizedCitations = (d.citations - minCitations) / citationRange;
        
        // Use square root for better visual distribution (reduces extreme differences)
        const sqrtNormalized = Math.sqrt(normalizedCitations);
        
        // Scale to radius range (6-18) for more compact visualization
        const radius = 6 + (sqrtNormalized * 12);
        return Math.max(6, Math.min(18, radius));
      })
      .attr('data-id', d => d.id)
      .attr('data-selected', d => selectedPapersRef.current.has(d.id) ? 'true' : 'false')
      .attr('fill', d => getTimelineColor(d.year, selectedPapersRef.current.has(d.id), d.source === 'ai_discovery'))
      .attr('stroke', d => d.source === 'ai_discovery' ? '#10b981' : 'none')
      .attr('stroke-width', d => d.source === 'ai_discovery' ? '2' : '0')
      .attr('stroke-dasharray', d => d.source === 'ai_discovery' ? '4,2' : 'none')
      .style('filter', d => {
        if (selectedPapersRef.current.has(d.id)) {
          return d.source === 'ai_discovery' 
            ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.8))' 
            : 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))';
        }
        return 'none';
      })
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add labels positioned in the center of nodes with better styling
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-30px') // Position above the node
      .attr('data-id', d => d.id)
      .style('font-size', '8px') // Smaller for more compact visualization
      .style('fill', '#ffffff') // White text for contrast against gold/purple nodes
      .style('font-weight', '700') // Bolder for better visibility
      .style('text-shadow', '2px 2px 4px rgba(0,0,0,0.8)') // Shadow for better contrast above nodes
      .style('pointer-events', 'none')
      .style('opacity', 1.0) // Full opacity for maximum visibility
      .text(d => {
        const firstAuthor = d.authors && d.authors.length > 0 ? d.authors[0].split(' ')[0] : 'No Author';
        const year = d.year || 'Unknown';
        return `${firstAuthor}, ${year}`;
      });


    // Update positions on tick
    simulation.on('tick', () => {
      // Only update links if they exist
      if (link && links.length > 0) {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      }

      // Update node positions (rotation is handled by animateRotation)
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y);
      
      // Update chat connection lines when nodes move
      updateChatConnections();
    });

    // Add debugging for links
    console.log('Links being rendered:', links.length);
    links.forEach((link, i) => {
      console.log(`Link ${i}: ${link.source?.id || link.source} -> ${link.target?.id || link.target}`);
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
      if (link) {
      link.style('opacity', linkData => {
        const linkId = `${linkData.source.id}-${linkData.target.id}`;
        if (connectedLinkIds.has(linkId)) {
          return 0.8; // Highlight connected links
        } else {
          return 0.1; // Dim unconnected links
        }
      });
      }
      
      // Create or update hover tooltip
      let tooltip = d3.select('body').select('.hover-tooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('class', 'hover-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', '#8b5cf6')
          .style('padding', '8px 12px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'auto') // Enable pointer events for clicking
          .style('z-index', '1000')
          .style('opacity', 0)
          .style('border', '1px solid #8b5cf6');
      }
      
      tooltip
        .html(`
          <div><strong>${d.title}</strong></div>
          <div>${d.authors.join(', ')}</div>
          <div>${d.year} • ${d.citations} citations</div>
          <div style="margin-top: 8px; display: flex; gap: 12px; align-items: center;">
            <a href="${d.openalex_url || d.id}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="color: #8b5cf6; text-decoration: underline; font-size: 11px;">
              View Paper →
            </a>
            ${d.oa_status && d.oa_status !== 'closed' && d.oa_url ? `
              <a href="${d.oa_url}" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 style="color: #00ff88; text-decoration: underline; font-size: 11px; font-weight: bold;">
                📄 Free PDF
              </a>
            ` : d.oa_status && d.oa_status !== 'closed' ? `
              <span style="color: #00ff88; font-size: 11px; font-weight: bold;">
                🔓 Open Access (${d.oa_status})
              </span>
            ` : ''}
          </div>
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1);
    });

    node.on('mouseout', function(event, d) {
      // Only hide tooltip if mouse is not moving to the tooltip
      const tooltip = d3.select('body').select('.hover-tooltip');
      if (!tooltip.empty()) {
        // Add a small delay to check if mouse moves to tooltip
        setTimeout(() => {
          const tooltipElement = tooltip.node();
          if (tooltipElement && !tooltipElement.matches(':hover')) {
      // Reset all nodes to full opacity
      node.style('opacity', 1);
      
      // Reset all text to normal opacity
      labels.style('opacity', 0.8);
      
      // Reset all links to normal opacity
            if (link) {
      link.style('opacity', 0.6);
            }
      
      // Remove tooltip
            tooltip
              .transition()
              .duration(200)
              .style('opacity', 0)
              .remove();
          }
        }, 100);
      }
    });

    // Add tooltip hover handlers to keep it visible when hovering over the tooltip
      d3.select('body').select('.hover-tooltip')
      .on('mouseenter', function() {
        // Keep tooltip visible when hovering over it
        d3.select(this).style('opacity', 1);
      })
      .on('mouseleave', function() {
        // Hide tooltip when leaving it
        d3.select(this)
        .transition()
        .duration(200)
        .style('opacity', 0)
        .remove();
        
        // Reset all nodes to full opacity
        node.style('opacity', 1);
        
        // Reset all text to normal opacity
        labels.style('opacity', 0.8);
        
        // Reset all links to normal opacity
        if (link) {
          link.style('opacity', 0.6);
        }
    });

    // Click handler - using ONLY direct DOM manipulation, NO React state updates
    node.on('click', async function(event, d) {
      // Get current selection from the node's data
      const isCurrentlySelected = d3.select(this).attr('data-selected') === 'true';
      
      // Toggle selection in the DOM
      d3.select(this)
        .attr('data-selected', !isCurrentlySelected)
        .attr('fill', getTimelineColor(d.year, !isCurrentlySelected, d.source === 'ai_discovery'))
        .style('filter', !isCurrentlySelected ? 
          (d.source === 'ai_discovery' 
            ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.8))' 
            : 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))') 
          : 'none');
      
      // Update text color to match selection state
      const textElement = d3.select(`text[data-id="${d.id}"]`);
      textElement.style('fill', '#ffffff'); // White text for contrast against gold/purple nodes
      
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
      
      // Note: AI discovery is now handled through chat commands
      
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
  }, [graphData.nodes, graphData.links, dimensions, loading]);

  if (loading) {
    return (
      <div className="graph-viewer-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Building citation network...</p>
          <p className="loading-subtitle">This may take a few moments</p>
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
          <button onClick={handleBackToSearch} className="logo-button">
            <img src="/logo.svg" alt="RefNet Logo" className="logo-image" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-viewer-container">
      {/* Header */}
      <div className="graph-header">
        <button onClick={handleBackToSearch} className="logo-button">
          <img src="/logo.svg" alt="RefNet Logo" className="logo-image" />
        </button>
        <h1>{getHeaderText()}</h1>
        <div className="header-controls">
          {/* Filters moved to header */}
          <div className="header-filters">
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
              <label>Cited:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={citedLimit}
            onChange={(e) => setCitedLimit(parseInt(e.target.value))}
          />
        </div>
        <div className="control-group">
              <label>Refs:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={refLimit}
            onChange={(e) => setRefLimit(parseInt(e.target.value))}
          />
        </div>
        <button onClick={rebuildGraph} className="rebuild-button">
              Rebuild
            </button>
          </div>
        <div className="header-chat-controls">
          {selectedPapers.length >= 1 && (
            <button 
              onClick={createChat} 
              className="chat-button"
              title="Create chat for selected papers"
            >
              Start Chat ({selectedPapers.length} paper{selectedPapers.length !== 1 ? 's' : ''})
            </button>
          )}
          
          {/* Inline Chat Tracker */}
          {chats.length > 0 && (
            <ChatTracker
              chats={chats}
              activeChatId={activeChatId}
              onChatSelect={selectChat}
              onChatRename={renameChat}
              onChatDelete={deleteChat}
              onChatClose={closeChat}
              displayMode="inline"
            />
          )}
        </div>
        </div>
      </div>



      {/* Main Content */}
      <div className="main-content">
        {/* References Panel */}
        <div className="references-panel">
          <h3 className="panel-title">References ({filteredPapers.length})</h3>
          
          {/* References Search Bar */}
          <div className="references-search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search references..."
              className="references-search-input"
            />
            <button 
              className="references-search-btn"
              style={{
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" fill="none"/>
                <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          
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
                  textElement.style('fill', '#ffffff'); // White text for contrast against gold/purple nodes
                  
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
                <div className="reference-actions">
                  <button
                    className="mla-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the reference selection
                      handleMLACopy(paper, e);
                    }}
                    title="Copy MLA citation"
                  >
MLA
                  </button>
                </div>
              </div>
            ))}
            
            {filteredPapers.length === 0 && (
              <div className="no-results">
                No papers found. Try a different search term.
              </div>
            )}
          </div>
          
          <div className="bottom-controls">
            <button 
              className="screenshot-button" 
              onClick={handleScreenshot}
              title="Take a screenshot of the graph"
            >
              <svg className="screenshot-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                <circle cx="12" cy="13" r="3"></circle>
              </svg>
            </button>
            <div className="export-container">
              <button className="export-btn" onClick={handleExportClick}>
                Export
              </button>
            {/* Export Dropdown */}
            {showExportModal && (
              <div className="export-dropdown-popup">
                <div className="export-dropdown-header">
                  <span>Choose format:</span>
                </div>
                <div className="export-dropdown-options">
                  <button 
                    className="export-dropdown-option" 
                    onClick={() => handleExport('json')}
                  >
                    JSON
                  </button>
                  <button 
                    className="export-dropdown-option" 
                    onClick={() => handleExport('bib')}
                  >
                    BibTeX
                  </button>
                  <button 
                    className="export-dropdown-option" 
                    onClick={generateSurveyPaper}
                    disabled={isGeneratingSurvey}
                  >
                    {isGeneratingSurvey ? 'Generating...' : 'Review Paper'}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Graph Visualization */}
        <div className="graph-container" onClick={handleGraphClick}>
          
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="graph-svg"
          />
          
          {/* Text Boxes */}
          {textBoxes.map(textBox => (
            <div
              key={textBox.id}
              data-textbox-id={textBox.id}
              className={`graph-textbox ${draggedTextBox === textBox.id ? 'dragging' : ''} ${resizingTextBox?.id === textBox.id ? 'resizing' : ''}`}
              style={{
                position: 'fixed',
                left: textBox.x,
                top: textBox.y,
                width: textBox.width,
                height: textBox.height,
                zIndex: 1000,
                borderColor: textBox.color.border,
                boxShadow: `0 4px 20px ${textBox.color.value}40`
              }}
            >
              <div 
                className="textbox-header"
                onMouseDown={(e) => handleTextBoxMouseDown(e, textBox.id)}
                style={{
                  background: textBox.color.header
                }}
              >
                {editingHeader === textBox.id ? (
                  <input
                    type="text"
                    className="textbox-title-input"
                    defaultValue={textBox.title || `Note #${textBox.id}`}
                    onBlur={(e) => finishEditingHeader(textBox.id, e.target.value)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, textBox.id)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    autoFocus
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'inherit',
                      font: 'inherit',
                      fontWeight: '700',
                      width: '100%',
                      padding: '2px 4px',
                      borderRadius: '2px'
                    }}
                  />
                ) : (
                  <span 
                    className="textbox-title"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditingHeader(textBox.id);
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Click to edit title"
                  >
                    {textBox.title || `Note #${textBox.id}`}
                  </span>
                )}
                <div className="textbox-controls">
                  <button 
                    className="textbox-color-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Color button clicked for text box:', textBox.id);
                      toggleColorPicker(textBox.id);
                    }}
                    title="Change color"
                    style={{
                      backgroundColor: textBox.color.value,
                      border: `2px solid ${textBox.color.value}`
                    }}
                  >
                    🎨
                  </button>
                  <span className="drag-handle" title="Drag to move">⋮⋮</span>
                  <button 
                    className="textbox-delete"
                    onClick={() => deleteTextBox(textBox.id)}
                    title="Delete text box"
                  >
                    ×
                  </button>
                </div>
        </div>

              {/* Color Picker */}
              {showColorPicker === textBox.id && (
                <div 
                  className="color-picker"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{ zIndex: 1003 }}
                >
                  <div className="color-picker-title">Choose Color</div>
                  <div className="color-palette">
                    {textBoxColors.map((color, index) => (
                      <button
                        key={index}
                        className={`color-option ${textBox.color.value === color.value ? 'selected' : ''}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Color option clicked:', color);
                          changeTextBoxColor(textBox.id, color);
                        }}
                        style={{
                          backgroundColor: color.value,
                          border: `2px solid ${color.value}`
                        }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <textarea
                className="textbox-content"
                value={textBox.text}
                onChange={(e) => updateTextBox(textBox.id, { text: e.target.value })}
                placeholder="Type your note here..."
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  height: 'calc(100% - 30px)',
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  padding: '8px',
                  cursor: 'text'
                }}
              />
              
              {/* Resize Handles */}
              <div className="resize-handles">
                <div 
                  className="resize-handle resize-nw"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'top-left')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-ne"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'top-right')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-sw"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'bottom-left')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-se"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'bottom-right')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-n"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'top')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-s"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'bottom')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-w"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'left')}
                  title="Resize"
                />
                <div 
                  className="resize-handle resize-e"
                  onMouseDown={(e) => handleResizeStart(e, textBox.id, 'right')}
                  title="Resize"
                />
              </div>
            </div>
          ))}
          
        </div>

      </div>

      {/* Floating Add Text Box Button - Top Right Corner */}
      <button 
        onClick={() => createTextBox(window.innerWidth - 250, 100 + (textBoxes.length * 120), 200, 100, 'New Note')}
        className="floating-textbox-button"
        title="Add Text Box"
        style={{
          position: 'fixed',
          top: '100px',
          right: '20px',
          zIndex: 1000,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
          color: '#ffffff',
          border: 'none',
          padding: '12px 16px',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
        }}
      >
        Add Text Box
      </button>

      {/* Timeline Keymap - Clean centered design */}
      {getTimelineYears().length > 0 && (
        <div className="timeline-keymap" style={{
          position: 'fixed',
          bottom: '20px',
          left: '88%',
          transform: 'translateX(-50%)',
          background: 'transparent',
          padding: '15px 20px',
          borderRadius: '0',
          boxShadow: 'none',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000
        }}>
          <div style={{ 
            width: '250px', 
            height: '12px', 
            background: 'linear-gradient(to right, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 1.0))',
            borderRadius: '6px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: '0',
              top: '15px',
              fontSize: '12px',
              color: '#8b5cf6',
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
              color: '#8b5cf6',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}>
              {getTimelineYears()[getTimelineYears().length - 1]}
            </div>
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#8b5cf6', 
            fontWeight: '500',
            opacity: 0.8,
            textAlign: 'center'
          }}>
            Older → Newer
          </div>
        </div>
      )}


      {/* Floating Chats */}
      {chats.map(chat => {
        // Determine if chat is unused (simply not the currently active chat)
        const isUnused = activeChatId !== chat.id;
        
        return (
          <FloatingChat
            key={chat.id}
            chat={chat}
            isActive={activeChatId === chat.id}
            isUnused={isUnused}
            onClose={() => closeChat(chat.id)}
            onDelete={() => deleteChat(chat.id)}
            onPositionChange={(position) => updateChatPosition(chat.id, position)}
            onInteraction={() => {
              setActiveChatId(chat.id);
              setLastInteractionTime(prev => ({ ...prev, [chat.id]: Date.now() }));
            }}
            graphData={graphData}
            // AI Discovery function
            discoverAndAddAIPapers={discoverAndAddAIPapers}
          />
        );
      })}

    </div>
  );
};

export default GraphViewerClean;
