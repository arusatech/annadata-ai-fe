import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../css/style.css';
import '../css/icons.min.css';
import ChatService from '../services/ChatService';
import AuthService from '../services/AuthService';

// Type definitions
interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  time: string;
  timestamp: string;
  isError?: boolean;
}

interface ChatFooterProps {
  onSendMessage?: (message: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

interface UserMessageObj {
  id: string;
  text: string;
  sender: 'user';
  time: string;
  timestamp: string;
}

interface ErrorMessageObj {
  id: string;
  text: string;
  sender: 'bot';
  time: string;
  timestamp: string;
  isError: boolean;
}

const ChatFooter: React.FC<ChatFooterProps> = ({ onSendMessage, setMessages }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check authentication status on component mount (for UI display purposes only)
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const authStatus: boolean = await AuthService.isAuthenticated();
        setIsAuthenticated(authStatus);
      } catch (error) {
        console.error('Error checking authentication status:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Determine which icon to show based on input state
  const shouldShowSendIcon: boolean = isInputFocused || message.trim().length > 0;

  // Placeholder functions for icon clicks
  const handleAttachClick = (): void => {
    console.log('Attach icon clicked');
    // In a real app, this would open a file picker
  };

  const handleCameraClick = (): void => {
    console.log('Camera icon clicked');
    // In a real app, this would open the camera
  };

  const handleMicClick = (): void => {
    console.log('Mic icon clicked');
    // This would trigger voice-to-text functionality
  };

  // Fix: Remove the isConnected check and just try to connect directly
  const sendMessageViaWebSocket = async (messageText: string, timestamp: string): Promise<boolean> => {
    try {
      // Try to connect (ChatService will handle if already connected)
      const connected: boolean = await ChatService.connect();
      if (!connected) {
        return false;
      }

      // Send message via WebSocket
      const success: boolean = await ChatService.sendChatMessage(messageText);
      
      if (success) {
        return true;
      } else {
        console.warn(`⚠️ [CHAT DEBUG] WebSocket send returned false`);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [CHAT DEBUG] WebSocket send error:`, error);
      return false;
    }
  };

  // Enhanced function to handle form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement> | { preventDefault: () => void }): Promise<void> => {
    event.preventDefault();
    
    if (!message.trim() || isSending) {
      return;
    }

    const userMessage: string = message.trim();
    const timestamp: string = new Date().toISOString();
    
    // Create user message object
    const userMessageObj: UserMessageObj = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: userMessage,
      sender: 'user',
      time: new Date().toLocaleTimeString(),
      timestamp: timestamp
    };

    // Add user message to chat immediately
    setMessages(prevMessages => [...prevMessages, userMessageObj]);
    
    // Clear input and set sending state
    setMessage('');
    setIsSending(true);

    try {
      // Send message via WebSocket only
      const success: boolean = await sendMessageViaWebSocket(userMessage, timestamp);
      
      if (!success) {
        console.error(`❌ [CHAT DEBUG] WebSocket send failed`);
        
        // Add error message to chat
        const errorMessageObj: ErrorMessageObj = {
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: 'Unable to send message. Please check your connection and try again.',
          sender: 'bot',
          time: new Date().toLocaleTimeString(),
          timestamp: new Date().toISOString(),
          isError: true
        };
        
        setMessages(prevMessages => [...prevMessages, errorMessageObj]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessageObj: ErrorMessageObj = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: 'Sorry, there was an error sending your message. Please try again.',
        sender: 'bot',
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessageObj]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle input focus events
  const handleInputFocus = (): void => {
    setIsInputFocused(true);
  };

  const handleInputBlur = (): void => {
    setIsInputFocused(false);
  };

  // Handle right action click (either mic or send)
  const handleRightActionClick = (): void => {
    if (shouldShowSendIcon) {
      handleSubmit({ preventDefault: () => {} });
    } else {
      handleMicClick();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setMessage(e.target.value);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    handleSubmit(e);
  };

  return (
    <div className="chat-footer">
      <div className="chat-input-container">
        <form onSubmit={handleFormSubmit}>
          <div className="input-group">
            {/* Left side icons */}
            <div className="left-icons">
              <i 
                className="icon-attach" 
                onClick={handleAttachClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAttachClick();
                  }
                }}
              ></i>
              <i 
                className="icon-camera" 
                onClick={handleCameraClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCameraClick();
                  }
                }}
              ></i>
            </div>
            
            {/* Input field */}
            <input
              type="text"
              name="message"
              className="chat-input"
              placeholder={
                isSending 
                  ? t('sending', 'Sending...') 
                  : t('hint', 'Type a message...')
              }
              aria-label="Chat input"
              value={message}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={isSending}
            />
            
            {/* Right side actions - toggle between mic and send icons */}
            <div className="right-actions">
              {shouldShowSendIcon ? (
                <i
                  className={`icon-arrow-up send-icon ${shouldShowSendIcon ? 'active' : ''} ${isSending ? 'sending' : ''}`}
                  onClick={handleRightActionClick}
                  style={{ cursor: isSending ? 'not-allowed' : 'pointer' }}
                  title={
                    isSending 
                      ? t('sending', 'Sending...') 
                      : t('send', 'Send message')
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRightActionClick();
                    }
                  }}
                ></i>
              ) : (
                <i
                  className="icon-mic mic-icon"
                  onClick={handleRightActionClick}
                  style={{ cursor: 'pointer' }}
                  title={t('voice_message', 'Voice message')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRightActionClick();
                    }
                  }}
                ></i>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatFooter;
