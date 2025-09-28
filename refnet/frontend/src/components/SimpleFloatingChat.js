import React, { useState, useEffect, useRef } from 'react';
import { useCedarStore, useRegisterState, useSubscribeStateToAgentContext } from 'cedar-os';
import { chatAPI } from '../services/api';
import './FloatingCedarChat.css';

const SimpleFloatingChat = ({ 
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
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Custom message handler for sending messages to our backend
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || selectedPapers.length === 0) return;
    
    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    // Add user message to chat
    const newUserMessage = {
      id: Date.now().toString(),
      content: userMessage,
      role: 'user',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      const response = await chatAPI.sendMessage(userMessage, selectedPapers, graphData);
      
      // Add the AI response to the chat
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        role: 'assistant',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat API error:', err);
      setError('Failed to send message. Please try again.');
      
      // Add error message to chat
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
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
      <div style={{ 
        flex: 1, 
        minHeight: 0, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.length === 0 && (
            <div style={{
              color: '#6b7280',
              fontSize: '14px',
              textAlign: 'center',
              padding: '20px',
              fontStyle: 'italic'
            }}>
              Ask me about the selected research papers!
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '8px'
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  backgroundColor: message.role === 'user' ? '#3b82f6' : '#f3f4f6',
                  color: message.role === 'user' ? 'white' : '#111827',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  wordWrap: 'break-word',
                  border: message.isError ? '1px solid #fecaca' : 'none',
                  backgroundColor: message.isError ? '#fef2f2' : (message.role === 'user' ? '#3b82f6' : '#f3f4f6'),
                  color: message.isError ? '#dc2626' : (message.role === 'user' ? 'white' : '#111827')
                }}
              >
                {message.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '8px'
            }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontStyle: 'italic'
                }}
              >
                Analyzing papers...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
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
        
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
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
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default SimpleFloatingChat;
