import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SQLiteService, { ChatHistoryItem } from '../services/SQLiteService';
import { getDeviceId } from '../services/DeviceInfoService';
import '../css/common.css';
import '../css/chat-history.css';

interface ChatHistoryPopupProps {
  onClose: () => void;
  onSelectSession?: (sessionId: string) => void;
}

const ChatHistoryPopup: React.FC<ChatHistoryPopupProps> = ({ onClose, onSelectSession }) => {
  const { t } = useTranslation();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const deviceId = await getDeviceId();
      if (!deviceId) {
        setError('Unable to get device ID');
        return;
      }

      const sqliteService = SQLiteService.getInstance();
      // Don't reinitialize - it should already be initialized from App.tsx
      // await sqliteService.initialize(); // Remove this line
      
      const history = await sqliteService.getChatHistory(deviceId, 50);
      setChatHistory(history);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    if (onSelectSession) {
      onSelectSession(sessionId);
    }
    onClose();
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent session selection
    
    if (!confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      return;
    }

    try {
      const sqliteService = SQLiteService.getInstance();
      await sqliteService.deleteSession(sessionId);
      
      // Refresh the list
      await loadChatHistory();
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('Failed to delete chat session');
    }
  };

  return (
    <div className="popup-backdrop show">
      <div className="popup-content">
        <div className="popup-header">
          <h3 style={{ textAlign: 'center' }}>{t('chatHistory', 'Chat History')}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="chat-history-content">
          {loading ? (
            <div className="loading-message">
              <i className="icon-loading"></i>
              <span>{t('loading', 'Loading...')}</span>
            </div>
          ) : error ? (
            <div className="error-message">
              <i className="icon-alert"></i>
              <span>{error}</span>
              <button onClick={loadChatHistory} className="retry-btn">
                {t('retry', 'Retry')}
              </button>
            </div>
          ) : chatHistory.length === 0 ? (
            <div className="empty-message">
              <i className="icon-empty"></i>
              <span>{t('noChatHistory', 'No chat history found')}</span>
            </div>
          ) : (
            <div className="chat-history-list">
              {chatHistory.map((item) => (
                <div
                  key={item.session_id}
                  className="chat-history-item"
                  onClick={() => handleSessionSelect(item.session_id)}
                >
                  <div className="chat-item-content">
                    <div className="chat-item-title">
                      {item.display_title}
                    </div>
                    <div className="chat-item-date">
                      {item.formatted_date}
                    </div>
                  </div>
                  <div className="chat-item-actions">
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteSession(item.session_id, e)}
                      title={t('deleteSession', 'Delete session')}
                    >
                      <i className="icon-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistoryPopup;
