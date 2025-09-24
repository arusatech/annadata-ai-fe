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
      console.log('🔍 [CHAT HISTORY] Starting to load chat history...');
      setLoading(true);
      setError(null);
      
      const deviceId = await getDeviceId();
      console.log('📱 [CHAT HISTORY] Device ID:', deviceId);
      if (!deviceId) {
        console.error('❌ [CHAT HISTORY] No device ID available');
        setError('Unable to get device ID');
        return;
      }

      const sqliteService = SQLiteService.getInstance();
      console.log('🔧 [CHAT HISTORY] SQLiteService instance obtained');
      
      // Check if SQLite is initialized
      console.log('🔍 [CHAT HISTORY] Checking SQLite initialization...');
      
      const history = await sqliteService.getChatHistory(deviceId, 50);
      console.log('📊 [CHAT HISTORY] Retrieved history:', history);
      console.log('📊 [CHAT HISTORY] History length:', history?.length || 0);
      
      if (history && history.length > 0) {
        console.log('✅ [CHAT HISTORY] Found', history.length, 'chat sessions');
        history.forEach((item, index) => {
          console.log(`📝 [CHAT HISTORY] Session ${index + 1}:`, {
            session_id: item.session_id,
            title: item.title,
            display_title: item.display_title,
            created_at: item.created_at,
            formatted_date: item.formatted_date,
            // message_count: item.message_count // Not available in ChatHistoryItem interface
          });
        });
      } else {
        console.log('⚠️ [CHAT HISTORY] No chat sessions found');
      }
      
      setChatHistory(history);
    } catch (err) {
      console.error('❌ [CHAT HISTORY] Error loading chat history:', err);
      console.error('❌ [CHAT HISTORY] Error details:', {
        name: (err as any)?.name,
        message: (err as any)?.message,
        stack: (err as any)?.stack
      });
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
      console.log('🏁 [CHAT HISTORY] Loading completed');
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
