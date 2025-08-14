import React, { useState, useEffect, useRef } from 'react';
import MarkdownService from '../services/MarkdownService';
import { useTranslation } from 'react-i18next';
import '../css/chat.css';
import '../css/markdown.css';
import '../css/welcome.css';
import '../css/icons.css'; // Add this

// Type definitions
interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  time?: string;
  isError?: boolean;
}

interface ChatContainerProps {
  messages?: Message[];
  isLoading?: boolean;
}

interface CopyButtonEvent extends React.MouseEvent<HTMLButtonElement> {
  target: HTMLButtonElement;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ 
  messages = [], 
  isLoading = false 
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Copy message text to clipboard
  const copyMessageToClipboard = async (text: string, event: CopyButtonEvent): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      
      // Show a brief success indicator (you can enhance this with a toast notification)
      const copyButton: HTMLButtonElement = event.target;
      const originalText: string = copyButton.textContent || '';
      copyButton.textContent = 'Copied!';
      copyButton.style.backgroundColor = '#4CAF50';
      
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.backgroundColor = '';
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy message:', err);
      
      // Fallback for older browsers
      const textArea: HTMLTextAreaElement = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Show success indicator for fallback method
      const copyButton: HTMLButtonElement = event.target;
      const originalText: string = copyButton.textContent || '';
      copyButton.textContent = 'Copied!';
      copyButton.style.backgroundColor = '#4CAF50';
      
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.backgroundColor = '';
      }, 2000);
    }
  };

  // Render message content based on sender and content type
  const renderMessageContent = (message: Message): React.ReactElement | null => {
    try {
      if (!message.text) return null;

      // Check if content contains markdown
      if (MarkdownService.containsMarkdown(message.text)) {
        // Render markdown to HTML
        const renderedHtml: string = MarkdownService.renderSync(message.text);
        
        return (
          <div 
            className="message-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            ref={(el: HTMLDivElement | null) => {
              if (el) {
                // Render math after DOM is ready
                const renderMath = (): void => {
                  if (MarkdownService.getStatus().katexAvailable) {
                    MarkdownService.renderMathInElement(el);
                  } else {
                    // Retry after a delay if KaTeX is not available
                    setTimeout(() => {
                      if (MarkdownService.getStatus().katexAvailable) {
                        MarkdownService.renderMathInElement(el);
                      } else {
                        console.warn('KaTeX not available for math rendering');
                      }
                    }, 2000);
                  }
                };
                
                // Initial render attempt
                setTimeout(renderMath, 100);
              }
            }}
          />
        );
      }

      // Plain text
      return (
        <div className="message-content">
          {message.text}
        </div>
      );
    } catch (error) {
      console.error('Error rendering message:', error);
      // Fallback to plain text
      return (
        <div className="message-content">
          {message.text}
        </div>
      );
    }
  };

  const renderWelcomeMessage = (): React.ReactElement => (
    <div className="welcome-message">
      <div
        className="greeting-message"
        id="greeting-message"
      >
        {t('welcome', 'Welcome to AnnaData (ai)℠! How can I help you today?')}
      </div>
    </div>
  );

  const renderMessage = (message: Message): React.ReactElement => (
    <div 
      key={message.id} 
      className={`message ${message.sender === 'bot' ? 'bot-message' : 'user-message'} ${message.isError ? 'error-message' : ''}`}
    >
      <div className="message-content">
        {renderMessageContent(message)}
      </div>
      <div className="message-footer">
        {message.time && (
          <div className="message-time">
            {message.time}
          </div>
        )}
        <button
          className="copy-button"
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => 
            copyMessageToClipboard(message.text, event as CopyButtonEvent)
          }
          title="Copy message"
          aria-label="Copy message to clipboard"
        >
          📋
        </button>
      </div>
    </div>
  );

  const renderLoadingAnimation = (): React.ReactElement | null => {
    if (!isLoading) return null;
    
    return (
      <div className="chat-loading-animation">
        <div className="loading-icon"></div>
      </div>
    );
  };

  return (
    <div className="chat-container" id="chatContainer">
      <div className="chat-messages-wrapper">
        <div 
          id="chat-messages" 
          className={`chat-messages ${messages.length === 0 ? 'welcome-only' : ''}`}
        >
          {/* Add a conditional welcome message */}
          {messages.length === 0 ? renderWelcomeMessage() : messages.map(renderMessage)}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Loading animation - shows when waiting for bot response */}
      {renderLoadingAnimation()}
    </div>
  );
};

export default ChatContainer;
