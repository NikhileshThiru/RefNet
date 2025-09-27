import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './FloatingChat.css';

const FloatingChat = ({ 
  chat, 
  isActive = false,
  isUnused = false,
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
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
  const handleSendMessage = async () => {
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
    
    // Set loading state
    setIsLoading(true);
    
    // Send message to AI backend for analysis
    try {
      console.log('🤖 Sending message to AI backend:', inputValue);
      console.log('📄 Selected papers:', chat.selectedPapers.length);
      
      const response = await fetch('http://localhost:4111/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: inputValue,
          additionalContext: {
            selectedPapers: chat.selectedPapers,
            graphData: graphData
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ AI response received:', data);
      
      // Add AI response
      const aiResponse = {
        id: Date.now() + 1,
        text: data.content,
        sender: 'ai',
        timestamp: new Date(),
        metadata: data.metadata
      };
      setMessages(prev => [...prev, aiResponse]);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${error.message}. Please make sure the AI backend is running on http://localhost:4111`,
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!chat.isOpen) return null;

  return (
    <>
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
                <div className="empty-icon">🤖</div>
                <div className="empty-text">
                  AI Research Assistant Ready
                </div>
                <div className="empty-subtext">
                  Ask me to analyze {chat.selectedPapers.length} selected paper{chat.selectedPapers.length !== 1 ? 's' : ''}
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
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="loading-message">
                <div className="loading-dots">
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                </div>
                <div className="loading-text">AI is analyzing the papers...</div>
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
              disabled={!inputValue.trim() || isLoading}
              className="send-button"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </>
      )}
      </div>
    </>
  );
};

export default FloatingChat;
