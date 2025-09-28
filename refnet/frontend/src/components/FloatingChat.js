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
  graphData,
  // AI Discovery function
  discoverAndAddAIPapers
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [chatSize, setChatSize] = useState({ width: 280, height: 350 });
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
    
    const userMessage = inputValue.toLowerCase().trim();
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
    
    // Check if this is an AI paper discovery request
    const isPaperDiscoveryRequest = checkForPaperDiscoveryRequest(userMessage);
    
    if (isPaperDiscoveryRequest && chat.selectedPapers.length > 0) {
      try {
        console.log('🔍 Detected AI paper discovery request:', inputValue);
        
        const result = await discoverAndAddAIPapers(
          chat.selectedPapers,
          isPaperDiscoveryRequest.count,
          isPaperDiscoveryRequest.type
        );
        
        // Add AI response
        const aiResponse = {
          id: Date.now() + 1,
          text: result.success 
            ? `✅ ${result.message}\n\nI've added ${result.addedPapers.length} papers to your graph:\n${result.addedPapers.map(p => `• ${p.title} (${p.year})`).join('\n')}`
            : `❌ ${result.message}`,
          sender: 'ai',
          timestamp: new Date(),
          metadata: { type: 'paper_discovery', result }
        };
        setMessages(prev => [...prev, aiResponse]);
        
      } catch (error) {
        console.error('❌ Error in paper discovery:', error);
        const errorMessage = {
          id: Date.now() + 1,
          text: `❌ Failed to discover papers: ${error.message}`,
          sender: 'ai',
          timestamp: new Date(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Regular chat message - send to AI backend
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
    }
  };

  // Check if the message is a paper discovery request
  const checkForPaperDiscoveryRequest = (message) => {
    // Patterns for paper discovery requests
    const patterns = [
      // "give me X more papers" patterns
      { regex: /give me (\d+) more (similar|related|papers?)/i, count: 1, type: 'similar' },
      { regex: /find (\d+) more (similar|related|papers?)/i, count: 1, type: 'similar' },
      { regex: /show me (\d+) more (similar|related|papers?)/i, count: 1, type: 'similar' },
      { regex: /discover (\d+) more (similar|related|papers?)/i, count: 1, type: 'similar' },
      
      // "give me X papers" patterns
      { regex: /give me (\d+) (similar|related|papers?)/i, count: 1, type: 'similar' },
      { regex: /find (\d+) (similar|related|papers?)/i, count: 1, type: 'similar' },
      { regex: /show me (\d+) (similar|related|papers?)/i, count: 1, type: 'similar' },
      
      // Citation patterns
      { regex: /find (\d+) papers that cite this/i, count: 1, type: 'citing' },
      { regex: /show (\d+) citations?/i, count: 1, type: 'citing' },
      { regex: /give me (\d+) citing papers?/i, count: 1, type: 'citing' },
      
      // Methodology patterns
      { regex: /find (\d+) papers with similar methods?/i, count: 1, type: 'methodology' },
      { regex: /show (\d+) papers using similar approaches?/i, count: 1, type: 'methodology' },
      
      // Generic patterns
      { regex: /more papers?/i, count: 2, type: 'similar' },
      { regex: /related papers?/i, count: 2, type: 'similar' },
      { regex: /similar papers?/i, count: 2, type: 'similar' }
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern.regex);
      if (match) {
        return {
          count: parseInt(match[1]) || pattern.count,
          type: pattern.type
        };
      }
    }

    return null;
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Resize handlers
  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: chatSize.width,
      height: chatSize.height
    });
  };

  const handleResizeMove = (e) => {
    if (!isResizing) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    
    // Calculate new dimensions based on resize direction
    if (resizeDirection.includes('right')) {
      newWidth = Math.max(250, resizeStart.width + deltaX);
    }
    if (resizeDirection.includes('left')) {
      const widthChange = Math.max(250, resizeStart.width - deltaX) - resizeStart.width;
      newWidth = resizeStart.width + widthChange;
    }
    if (resizeDirection.includes('bottom')) {
      newHeight = Math.max(200, resizeStart.height + deltaY);
    }
    if (resizeDirection.includes('top')) {
      const heightChange = Math.max(200, resizeStart.height - deltaY) - resizeStart.height;
      newHeight = resizeStart.height + heightChange;
    }
    
    setChatSize({ width: newWidth, height: newHeight });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeDirection('');
    setResizeStart({ x: 0, y: 0, width: 0, height: 0 });
  };

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, resizeStart, resizeDirection]);

  if (!chat.isOpen) return null;

  return (
    <>
      {/* Chat Window */}
      <div
        ref={chatRef}
        className={`floating-chat ${isDragging ? 'dragging' : ''} ${isMinimized ? 'minimized' : ''} ${isActive ? 'active' : ''} ${isUnused ? 'unused' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{
          position: 'fixed',
          left: `${chat.position.x}px`,
          top: `${chat.position.y}px`,
          width: `${chatSize.width}px`,
          height: isMinimized ? '50px' : `${chatSize.height}px`,
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
                  {chat.selectedPapers.length > 0 
                    ? `Ask me to analyze ${chat.selectedPapers.length} selected paper${chat.selectedPapers.length !== 1 ? 's' : ''}, or try: "give me 2 more similar papers"`
                    : 'Select papers in the graph to start chatting'
                  }
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
              placeholder={chat.selectedPapers.length > 0 
                ? "Ask about papers or try: 'give me 2 more similar papers'" 
                : "Select papers to start chatting..."
              }
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

      {/* Resize Handles */}
      {!isMinimized && (
        <div className="resize-handles">
          <div 
            className="resize-handle resize-se"
            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
            title="Resize"
          />
          <div 
            className="resize-handle resize-e"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            title="Resize"
          />
          <div 
            className="resize-handle resize-s"
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            title="Resize"
          />
        </div>
      )}
      </div>
    </>
  );
};

export default FloatingChat;
