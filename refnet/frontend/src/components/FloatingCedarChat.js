import React, { useState, useEffect } from 'react';
import { ChatBubbles, ChatInput } from 'cedar-os-components';
import { useCedarStore, useRegisterState, useSubscribeStateToAgentContext } from 'cedar-os';
import { chatAPI } from '../services/api';
import './FloatingCedarChat.css';

const FloatingCedarChat = ({ 
  isOpen, 
  onClose, 
  position, 
  selectedPapers = [],
  graphData = { nodes: [], links: [] }
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [chatPosition, setChatPosition] = useState(position || { x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
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
      icon: '📄',
      color: '#8B5CF6',
      labelField: 'title',
      showInChat: (entry) => entry.data && entry.data.title,
      collapse: {
        threshold: 3,
        label: '{count} Selected Papers',
        icon: '📚'
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

  // Custom message handler for sending messages to our backend
  const handleSendMessage = async (message) => {
    if (!message.trim() || selectedPapers.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await chatAPI.sendMessage(message, selectedPapers, graphData);
      
      // Add the AI response to the chat
      const store = useCedarStore.getState();
      if (store.addMessage) {
        store.addMessage({
          id: Date.now().toString(),
          content: response.response,
          role: 'assistant',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Chat API error:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ChatBubbles maxHeight="400px" />
      </div>

      {/* Input */}
      <div style={{ 
        padding: '16px', 
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        {error && (
          <div style={{
            color: '#dc2626',
            fontSize: '12px',
            marginBottom: '8px',
            padding: '4px 8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}
        <ChatInput
          handleFocus={() => setIsFocused(true)}
          handleBlur={() => setIsFocused(false)}
          isInputFocused={isFocused}
          stream={true}
          placeholder="Ask about the selected papers..."
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          style={{
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px'
          }}
        />
        {isLoading && (
          <div style={{
            color: '#6b7280',
            fontSize: '12px',
            marginTop: '4px',
            textAlign: 'center'
          }}>
            Analyzing papers...
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingCedarChat;
