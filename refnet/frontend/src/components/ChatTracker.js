import React, { useState } from 'react';
import './ChatTracker.css';

const ChatTracker = ({ 
  chats = [], 
  activeChatId, 
  onChatSelect, 
  onChatRename, 
  onChatDelete,
  onChatClose,
  isOpen,
  onToggle,
  displayMode = 'popup' // 'popup' or 'inline'
}) => {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleRenameStart = (chatId, currentName) => {
    setEditingChatId(chatId);
    setEditingName(currentName);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (editingName.trim() && editingChatId) {
      onChatRename(editingChatId, editingName.trim());
      setEditingChatId(null);
      setEditingName('');
    }
  };

  const handleRenameCancel = () => {
    setEditingChatId(null);
    setEditingName('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(e);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  // Inline display mode for top bar
  if (displayMode === 'inline') {
    return (
      <div className="chat-tracker-inline">
        <span className="chat-tracker-label">Chats:</span>
        <div className="chat-tracker-numbers">
          {chats.map((chat, index) => (
            <button
              key={chat.id}
              className={`chat-number ${activeChatId === chat.id ? 'active' : 'inactive'}`}
              onClick={() => onChatSelect(chat.id)}
              title={`${chat.name} (${chat.selectedPapers.length} papers)`}
            >
              #{index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button 
        className="chat-tracker-toggle"
        onClick={onToggle}
        title="Show Chat Tracker"
      >
        💬 {chats.length}
      </button>
    );
  }

  return (
    <div className="chat-tracker">
      <div className="chat-tracker-header">
        <h3>Chats ({chats.length})</h3>
        <button 
          className="chat-tracker-close"
          onClick={onToggle}
          title="Close Tracker"
        >
          ✕
        </button>
      </div>
      
      <div className="chat-tracker-list">
        {chats.length === 0 ? (
          <div className="chat-tracker-empty">
            No active chats
          </div>
        ) : (
          chats.map((chat, index) => (
            <div 
              key={chat.id}
              className={`chat-tracker-item ${activeChatId === chat.id ? 'active' : 'inactive'}`}
              onClick={() => onChatSelect(chat.id)}
            >
              <div className="chat-tracker-item-header">
                <span className="chat-tracker-number">{index + 1}</span>
                {editingChatId === chat.id ? (
                  <form onSubmit={handleRenameSubmit} className="chat-rename-form">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleKeyPress}
                      onBlur={handleRenameSubmit}
                      autoFocus
                      className="chat-rename-input"
                    />
                  </form>
                ) : (
                  <span 
                    className="chat-tracker-name"
                    onDoubleClick={() => handleRenameStart(chat.id, chat.name)}
                    title="Double-click to rename"
                  >
                    {chat.name}
                  </span>
                )}
              </div>
              
              <div className="chat-tracker-item-actions">
                <button
                  className="chat-tracker-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameStart(chat.id, chat.name);
                  }}
                  title="Rename chat"
                >
                  ✏️
                </button>
                <button
                  className="chat-tracker-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatClose(chat.id);
                  }}
                  title="Close chat"
                >
                  ✕
                </button>
                <button
                  className="chat-tracker-action delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatDelete(chat.id);
                  }}
                  title="Delete chat"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatTracker;
