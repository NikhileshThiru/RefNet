import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { graphAPI, paperAPI } from '../services/api';
import FloatingChat from './FloatingChat';
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
  const [paperDetails, setPaperDetails] = useState(null);
  const [iterations, setIterations] = useState(2);
  const [citedLimit, setCitedLimit] = useState(2);
  const [refLimit, setRefLimit] = useState(1);
  const [chats, setChats] = useState([]);
  const [nextChatId, setNextChatId] = useState(1);
  const [activeChatId, setActiveChatId] = useState(null);
  const [lastInteractionTime, setLastInteractionTime] = useState({});
  const [chatConnections, setChatConnections] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [hasProcessedImport, setHasProcessedImport] = useState(false);
  const [isGeneratingSurvey, setIsGeneratingSurvey] = useState(false);

  // Get initial paper IDs from location state or params
  const initialPaperIds = location.state?.paperIds || (paperId ? [paperId] : []);
  
  // Check if this is an import scenario
  const isImportScenario = location.state?.isImport || (initialPaperIds.length === 0 && !paperId);
  const importedGraphData = location.state?.importedGraphData;

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

  // Simplified timeline color function - solid colors with opacity
  const getTimelineColor = (year, isSelected) => {
    if (graphData.nodes.length === 0) return isSelected ? 'rgba(124, 58, 237, 0.8)' : 'rgba(255, 215, 0, 0.8)';
    
    const years = graphData.nodes.map(n => n.year).filter(y => y);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const normalizedYear = (year - minYear) / (maxYear - minYear);
    
    // Calculate transparency based on age (newer = more opaque) - more dramatic gradient
    const opacity = 0.1 + (normalizedYear * 0.9); // 0.1 to 1.0 opacity for much more obvious difference
    
    if (isSelected) {
      // Selected nodes: solid purple (no opacity based on age)
      return 'rgba(124, 58, 237, 1.0)';
    } else {
      // Unselected nodes: solid gold with opacity based on age
      return `rgba(255, 215, 0, ${opacity})`;
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
      button.style.backgroundColor = '#ffd700';
      button.style.color = '#1a1a2e';
      
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
      const response = await fetch('http://localhost:4111/chat', {
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
          <title>RefNet Review Paper</title>
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
    
    let content = `REFNET REVIEW PAPER\n`;
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
      const response = await fetch('http://localhost:4111/chat', {
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
        <h1 style="font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #2c3e50;">A Comprehensive Review of Selected Research Papers</h1>
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
    
    let content = `# Survey Paper: Research Overview
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
      yPosition = addText('Survey Paper: Research Overview', margin, yPosition, { 
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
    
    // Check if a chat already exists for the same set of papers
    const selectedIdsSet = new Set(selectedIds);
    const existingChat = chats.find(chat => {
      const chatIds = new Set(chat.selectedPapers.map(p => p.id));
      return chatIds.size === selectedIdsSet.size && 
             [...chatIds].every(id => selectedIdsSet.has(id));
    });
    
    if (existingChat) {
      // Open existing chat instead of creating a new one
      openChat(existingChat.id);
      return;
    }
    
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
      selectedPapers,
      position,
      isOpen: true,
      firstNodePosition
    };
    
    setChats(prev => [...prev, newChat]);
    setActiveChatId(nextChatId);
    setLastInteractionTime(prev => ({ ...prev, [nextChatId]: Date.now() }));
    setNextChatId(prev => prev + 1);
  };

  const deleteChat = (chatId) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
  };

  const closeChat = (chatId) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, isOpen: false } : chat
    ));
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
      .attr('stroke', '#ffd700')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2);

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

    // Add labels positioned in the center of nodes with better styling
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-30px') // Position above the node
      .attr('data-id', d => d.id)
      .style('font-size', '10px') // Slightly smaller to fit inside nodes
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
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

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
        <div className="header-controls">
          <button 
            className="screenshot-button" 
            onClick={handleScreenshot}
            title="Take a screenshot of the graph"
          >
            📸 Screenshot
          </button>
        <div className="header-chat-controls">
          {chats.length > 0 && (
            <div className="existing-chats">
              <span className="chats-label">Active Chats:</span>
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat.id)}
                  className={`chat-tab ${chat.isOpen ? 'active' : ''}`}
                  title={`Chat #${chat.id} - ${chat.selectedPapers.length} papers`}
                >
                  #{chat.id}
                </button>
              ))}
            </div>
          )}
          {selectedPapers.length >= 1 && (
            <button 
              onClick={createChat} 
              className="chat-button"
              title="Create chat for selected papers"
            >
              💬 Start Chat ({selectedPapers.length} paper{selectedPapers.length !== 1 ? 's' : ''})
            </button>
          )}
          </div>
        </div>
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
            <button className="references-search-btn">🔍</button>
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
                    📋 MLA
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
          
          <div className="export-container">
            <button className="export-btn" onClick={handleExportClick}>
              📤 Export
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
                    <span className="export-dropdown-icon">📄</span>
                    <span>JSON</span>
                  </button>
                  <button 
                    className="export-dropdown-option" 
                    onClick={() => handleExport('bib')}
                  >
                    <span className="export-dropdown-icon">📚</span>
                    <span>BibTeX</span>
                  </button>
                  <button 
                    className="export-dropdown-option" 
                    onClick={generateSurveyPaper}
                    disabled={isGeneratingSurvey}
                  >
                    <span className="export-dropdown-icon">📋</span>
                    <span>{isGeneratingSurvey ? 'Generating...' : 'Review Paper'}</span>
                  </button>
                </div>
              </div>
            )}
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
          
        </div>

        {/* AI Panel - Removed */}
      </div>

      {/* Timeline Keymap - Clean centered design */}
      {getTimelineYears().length > 0 && (
        <div className="timeline-keymap" style={{
          position: 'fixed',
          bottom: '20px',
          left: '88%',
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
            background: 'linear-gradient(to right, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 1.0))',
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
          />
        );
      })}

    </div>
  );
};

export default GraphViewerClean;
