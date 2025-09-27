import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './FloatingChat.css';

const FloatingChat = ({ 
  chat, 
  isActive = false,
  isUnused = false,
  nodePosition,
  onClose, 
  onDelete, 
  onPositionChange, 
  onInteraction,
  graphData 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Force re-render when node position changes
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [nodePosition]);

  // Handle drag start
  const handleMouseDown = (e) => {
    if (e.target.closest('.chat-content') || e.target.closest('.chat-input')) {
      return; // Don't drag if clicking on content or input
    }
    
    setIsDragging(true);
    const rect = chatRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  // Handle drag
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    };
    
    // Keep chat within viewport bounds
    const chatWidth = 350;
    const chatHeight = isMinimized ? 60 : 500;
    const margin = 10;
    
    newPosition.x = Math.max(margin, Math.min(window.innerWidth - chatWidth - margin, newPosition.x));
    newPosition.y = Math.max(margin, Math.min(window.innerHeight - chatHeight - margin, newPosition.y));
    
    onPositionChange(newPosition);
  };

  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Handle send message
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    
    // Track interaction
    if (onInteraction) onInteraction();
    
    // Simulate AI response (placeholder for now)
    setTimeout(() => {
      const aiResponse = {
        id: Date.now() + 1,
        text: `I can see you're asking about ${chat.selectedPapers.length} selected papers. This is a placeholder response - Cedar OS integration will be added later.`,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!chat.isOpen) return null;

  // Calculate connection line coordinates
  const getConnectionLine = () => {
    if (!nodePosition) return null;
    
    const chatRect = chatRef.current?.getBoundingClientRect();
    if (!chatRect) return null;
    
    // Use the passed node position (already in D3 coordinates)
    const nodeX = nodePosition.x || 0;
    const nodeY = nodePosition.y || 0;
    
    // Get the graph container's position on screen
    const graphContainer = document.querySelector('.graph-container');
    const graphRect = graphContainer?.getBoundingClientRect();
    if (!graphRect) return null;
    
    // Convert D3 coordinates to screen coordinates
    const nodeScreenX = nodeX + graphRect.left;
    const nodeScreenY = nodeY + graphRect.top;
    
    // Calculate connection points
    const chatCenterX = chatRect.left + chatRect.width / 2;
    const chatCenterY = chatRect.top + chatRect.height / 2;
    
    // Find the closest edge of the chat to the node
    const dx = nodeScreenX - chatCenterX;
    const dy = nodeScreenY - chatCenterY;
    
    let startX, startY, endX, endY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Connect horizontally
      if (dx > 0) {
        // Node is to the right of chat
        startX = chatRect.right;
        startY = chatCenterY;
        endX = nodeScreenX;
        endY = nodeScreenY;
      } else {
        // Node is to the left of chat
        startX = chatRect.left;
        startY = chatCenterY;
        endX = nodeScreenX;
        endY = nodeScreenY;
      }
    } else {
      // Connect vertically
      if (dy > 0) {
        // Node is below chat
        startX = chatCenterX;
        startY = chatRect.bottom;
        endX = nodeScreenX;
        endY = nodeScreenY;
      } else {
        // Node is above chat
        startX = chatCenterX;
        startY = chatRect.top;
        endX = nodeScreenX;
        endY = nodeScreenY;
      }
    }
    
    return { startX, startY, endX, endY };
  };

  const connectionLine = getConnectionLine();

  return (
    <>
      {/* Connection Line */}
      {connectionLine && !isMinimized && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 999
          }}
        >
          <defs>
            <marker
              id={`arrowhead-${chat.id}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={isUnused ? "#fbbf24" : "#7c3aed"}
                opacity="0.6"
              />
            </marker>
          </defs>
          <line
            x1={connectionLine.startX}
            y1={connectionLine.startY}
            x2={connectionLine.endX}
            y2={connectionLine.endY}
            stroke={isUnused ? "#fbbf24" : "#7c3aed"}
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.6"
            markerEnd={`url(#arrowhead-${chat.id})`}
          />
        </svg>
      )}
      
      {/* Chat Window */}
      <div
        ref={chatRef}
        className={`floating-chat ${isDragging ? 'dragging' : ''} ${isMinimized ? 'minimized' : ''} ${isActive ? 'active' : ''} ${isUnused ? 'unused' : ''}`}
        style={{
          position: 'fixed',
          left: `${chat.position.x}px`,
          top: `${chat.position.y}px`,
          width: '280px',
          height: isMinimized ? '50px' : '350px',
          zIndex: isActive ? 1001 : 1000
        }}
        onMouseDown={(e) => {
          if (onInteraction) onInteraction();
          handleMouseDown(e);
        }}
        onClick={() => onInteraction && onInteraction()}
      >
        {/* Connection Indicator */}
        {connectionLine && !isMinimized && (
          <div 
            className="connection-indicator"
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: isUnused ? '#fbbf24' : '#7c3aed',
              borderRadius: '50%',
              border: '2px solid #ffffff',
              top: '-4px',
              right: '-4px',
              zIndex: 1002,
              boxShadow: isUnused ? '0 0 8px rgba(251, 191, 36, 0.6)' : '0 0 8px rgba(124, 58, 237, 0.6)'
            }}
          />
        )}
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <span>Chat #{chat.id}</span>
          <span className="paper-count">({chat.selectedPapers.length} papers)</span>
        </div>
        <div className="chat-controls">
          <button 
            className="minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? '□' : '−'}
          </button>
          <button 
            className="close-btn"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
          <button 
            className="delete-btn"
            onClick={onDelete}
            title="Delete Chat"
          >
            🗑️
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Selected Papers Info */}
          <div className="selected-papers-info">
            <div className="papers-line">
              {chat.selectedPapers.map((paper, index) => (
                <span key={paper.id} className="paper-item-inline">
                  {paper.title?.substring(0, 20)}
                  {paper.title?.length > 20 ? '...' : ''}
                  {index < chat.selectedPapers.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="chat-content">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💭</div>
                <div className="empty-text">
                  Start a conversation about the selected papers
                </div>
              </div>
            ) : (
              <div className="messages">
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`message ${message.sender}`}
                  >
                    <div className="message-content">
                      {message.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="chat-input">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the selected papers..."
              className="message-input"
            />
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="send-button"
            >
              Send
            </button>
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default FloatingChat;
