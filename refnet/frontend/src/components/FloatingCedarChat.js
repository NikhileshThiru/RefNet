import React, { useState, useEffect } from 'react';
import { useCedarStore, useRegisterState, useSubscribeStateToAgentContext } from 'cedar-os';
import { messageRenderers, responseHandlers } from '../cedar';
import './FloatingCedarChat.css';

const FloatingCedarChat = ({ 
  isOpen, 
  onClose, 
  position, 
  selectedPapers = [],
  graphData = { nodes: [], links: [] },
  discoverAndAddAIPapers = null
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [chatPosition, setChatPosition] = useState(position || { x: 0, y: 0 });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Register selected papers state with Cedar
  useRegisterState({
    key: 'selectedPapers',
    value: selectedPapers,
    description: 'Currently selected research papers in the graph'
  });

  // Subscribe selected papers to agent context for AI understanding
  useSubscribeStateToAgentContext(
    'selectedPapers',
    (papers) => ({
      selectedPapers: papers.map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        citations: paper.citations,
        topics: paper.topics || [],
        abstract: paper.abstract || ''
      }))
    }),
    {
      color: '#8B5CF6',
      labelField: 'title',
      showInChat: (entry) => entry.data && entry.data.title,
      collapse: {
        threshold: 3,
        label: '{count} Selected Papers'
      }
    }
  );

  // Register graph data for context
  useRegisterState({
    key: 'graphData',
    value: graphData,
    description: 'Complete graph data including nodes and links for research paper network'
  });

  // Subscribe graph data to agent context
  useSubscribeStateToAgentContext(
    'graphData',
    (data) => ({
      graphStats: {
        totalNodes: data.nodes?.length || 0,
        totalLinks: data.links?.length || 0,
        nodeTypes: data.nodes?.map(n => n.year).filter(Boolean) || []
      }
    }),
    {
      icon: '🕸️',
      color: '#10B981',
      labelField: 'totalNodes',
      showInChat: false // Don't show in chat, just provide context
    }
  );

  // Update position when prop changes
  useEffect(() => {
    if (position) {
      setChatPosition(position);
    }
  }, [position]);

  // Send message to AI backend
  const sendMessage = async (message) => {
    if (!message.trim() || selectedPapers.length === 0) return;
    
    setIsLoading(true);
    
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: message,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      console.log('🤖 Sending message to AI backend:', message);
      console.log('📄 Selected papers:', selectedPapers.length);
      
      const response = await fetch('https://api.refnet.wiki/mastra/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: message,
          additionalContext: {
            selectedPapers: selectedPapers,
            graphData: graphData
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ AI response received:', data);
      
      // Check if this is a paper generation request
      if (data.metadata?.action === 'generate_papers' && discoverAndAddAIPapers) {
        const count = data.metadata.count || 5;
        const discoveryType = data.metadata.discoveryType || 'similar';
        
        // Add the AI response first
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          content: data.content,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          metadata: data.metadata
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Generate papers
        try {
          const result = await discoverAndAddAIPapers(selectedPapers, count, discoveryType);
          
          // Add result message
          const resultMessage = {
            id: (Date.now() + 2).toString(),
            content: result.success 
              ? `✅ ${result.message}` 
              : `❌ ${result.message}`,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            isResult: true
          };
          setMessages(prev => [...prev, resultMessage]);
        } catch (error) {
          const errorMessage = {
            id: (Date.now() + 2).toString(),
            content: `❌ Error generating papers: ${error.message}`,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            isError: true
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // Add AI response
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          content: data.content,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          metadata: data.metadata
        };
        setMessages(prev => [...prev, aiMessage]);
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error.message}. Please make sure the AI backend is running on http://localhost:4111`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  // Calculate optimal position to avoid screen edges
  const getOptimalPosition = () => {
    const chatWidth = 400;
    const chatHeight = 500;
    const margin = 20;
    
    let x = chatPosition.x;
    let y = chatPosition.y;
    
    // Adjust if too close to right edge
    if (x + chatWidth > window.innerWidth - margin) {
      x = window.innerWidth - chatWidth - margin;
    }
    
    // Adjust if too close to left edge
    if (x < margin) {
      x = margin;
    }
    
    // Adjust if too close to bottom edge
    if (y + chatHeight > window.innerHeight - margin) {
      y = window.innerHeight - chatHeight - margin;
    }
    
    // Adjust if too close to top edge
    if (y < margin) {
      y = margin;
    }
    
    return { x, y };
  };

  const optimalPosition = getOptimalPosition();

  if (!isOpen) return null;

  return (
    <div 
      className="floating-cedar-chat"
      style={{
        position: 'fixed',
        left: `${optimalPosition.x}px`,
        top: `${optimalPosition.y}px`,
        width: '400px',
        height: '500px',
        zIndex: 1000,
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div className="chat-header" style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#111827' 
          }}>
            Research Chat
          </h3>
          <p style={{ 
            margin: '4px 0 0 0', 
            fontSize: '12px', 
            color: '#6b7280' 
          }}>
            {selectedPapers.length} paper{selectedPapers.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{ 
        flex: 1, 
        minHeight: 0, 
        overflow: 'auto',
        padding: '16px',
        backgroundColor: 'white'
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>AI Research Assistant</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Ask me about the {selectedPapers.length} selected paper{selectedPapers.length !== 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: '16px',
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: '18px',
                  backgroundColor: message.role === 'user' ? '#3b82f6' : '#f3f4f6',
                  color: message.role === 'user' ? 'white' : '#374151',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: message.isError ? '1px solid #ef4444' : 'none'
                }}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '16px'
          }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '18px',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              AI is analyzing the papers...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ 
        padding: '16px', 
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '24px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: 'white'
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            style={{
              padding: '12px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FloatingCedarChat;
