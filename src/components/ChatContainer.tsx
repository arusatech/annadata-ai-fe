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

// Model type definition
type ModelType = 'model' | 'live-model' | 'hybrid';

const ChatContainer: React.FC<ChatContainerProps> = ({ 
  messages = [], 
  isLoading = false 
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('model');
  const [isServiceUnavailable, setIsServiceUnavailable] = useState<boolean>(false);

  // Model options
  const modelOptions = [
    { value: 'model', label: 'Model' },
    { value: 'live-model', label: 'Live Model' },
    { value: 'hybrid', label: 'Hybrid' }
  ];

  // Handle model selection change
  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const newModel = event.target.value as ModelType;
    setSelectedModel(newModel);
    console.log('Selected model:', newModel);
    // Here you can add logic to switch models or notify parent component
  };

  // Helper function to determine if model dropdown should be shown
  const shouldShowModelDropdown = (message: Message): boolean => {
    return message.sender === 'bot' && isServiceUnavailable;
  };

  // Monitor for service unavailability (credentials failing, server not responding)
  useEffect(() => {
    let serviceUnavailable = false;

    // Monitor console for service unavailability indicators
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      
      // Check for various service unavailability indicators
      if (message.includes('No valid cached credentials') || 
          message.includes('working offline without authentication') ||
          message.includes('WebSocket send failed') ||
          message.includes('Failed to ensure valid token') ||
          message.includes('No user authentication available') ||
          message.includes('server not responding') ||
          message.includes('authentication failed')) {
        
        if (!serviceUnavailable) {
          serviceUnavailable = true;
          setIsServiceUnavailable(true);
          console.log('🔄 Service unavailable detected - showing model dropdown');
        }
      }
      
      // Check if service is back online
      if (serviceUnavailable && 
          (message.includes('connected successfully') || 
           message.includes('authentication successful') ||
           message.includes('token valid'))) {
        serviceUnavailable = false;
        setIsServiceUnavailable(false);
        console.log('🔄 Service back online - hiding model dropdown');
      }
      
      originalConsoleLog.apply(console, args);
    };

    // Also monitor for network errors that indicate service unavailability
    const handleNetworkError = (event: ErrorEvent) => {
      if (event.error && (
          event.error.message?.includes('fetch') ||
          event.error.message?.includes('network') ||
          event.error.message?.includes('timeout') ||
          event.error.message?.includes('connection')
        )) {
        if (!serviceUnavailable) {
          serviceUnavailable = true;
          setIsServiceUnavailable(true);
          console.log('🔄 Network error detected - showing model dropdown');
        }
      }
    };

    // Monitor for fetch/API failures
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok && (response.status === 401 || response.status === 403 || response.status >= 500)) {
          if (!serviceUnavailable) {
            serviceUnavailable = true;
            setIsServiceUnavailable(true);
            console.log('🔄 API error detected - showing model dropdown');
          }
        }
        return response;
      } catch (error) {
        if (!serviceUnavailable) {
          serviceUnavailable = true;
          setIsServiceUnavailable(true);
          console.log('🔄 Fetch error detected - showing model dropdown');
        }
        throw error;
      }
    };

    // Add error event listener
    window.addEventListener('error', handleNetworkError);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleNetworkError);
      console.log = originalConsoleLog;
      window.fetch = originalFetch;
    };
  }, []);

  // Copy message text to clipboard
  const copyMessageToClipboard = async (text: string, event: CopyButtonEvent): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      
      // Show success by adding green background overlay
      const copyButton: HTMLSpanElement = event.target as HTMLSpanElement;
      const originalBackground = copyButton.style.backgroundColor || '';
      copyButton.style.backgroundColor = 'rgba(76, 175, 80, 0.3)'; // Semi-transparent green
      copyButton.style.borderRadius = '4px';
      copyButton.style.padding = '2px';
      
      setTimeout(() => {
        copyButton.style.backgroundColor = originalBackground;
        copyButton.style.borderRadius = '';
        copyButton.style.padding = '';
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
      const copyButton: HTMLSpanElement = event.target as HTMLSpanElement;
      const originalBackground = copyButton.style.backgroundColor || '';
      copyButton.style.backgroundColor = 'rgba(76, 175, 80, 0.3)'; // Semi-transparent green
      copyButton.style.borderRadius = '4px';
      copyButton.style.padding = '2px';
      
      setTimeout(() => {
        copyButton.style.backgroundColor = originalBackground;
        copyButton.style.borderRadius = '';
        copyButton.style.padding = '';
      }, 2000);
    }
  };

  // Download message functionality
  const downloadMessage = async (text: string, event: React.MouseEvent<HTMLSpanElement>): Promise<void> => {
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `message-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show success by adding green background overlay
      const downloadButton: HTMLSpanElement = event.target as HTMLSpanElement;
      const originalBackground = downloadButton.style.backgroundColor || '';
      downloadButton.style.backgroundColor = 'rgba(76, 175, 80, 0.3)'; // Semi-transparent green
      downloadButton.style.borderRadius = '4px';
      downloadButton.style.padding = '2px';
      
      setTimeout(() => {
        downloadButton.style.backgroundColor = originalBackground;
        downloadButton.style.borderRadius = '';
        downloadButton.style.padding = '';
      }, 2000);
      
    } catch (err) {
      console.error('Failed to download message:', err);
    }
  };

  // Speaker functionality (text-to-speech)
  const speakMessage = async (text: string, event: React.MouseEvent<HTMLSpanElement>): Promise<void> => {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
        
        // Show success by adding green background overlay
        const speakerButton: HTMLSpanElement = event.target as HTMLSpanElement;
        const originalBackground = speakerButton.style.backgroundColor || '';
        speakerButton.style.backgroundColor = 'rgba(76, 175, 80, 0.3)'; // Semi-transparent green
        speakerButton.style.borderRadius = '4px';
        speakerButton.style.padding = '2px';
        
        setTimeout(() => {
          speakerButton.style.backgroundColor = originalBackground;
          speakerButton.style.borderRadius = '';
          speakerButton.style.padding = '';
        }, 2000);
      } else {
        console.error('Speech synthesis not supported');
      }
    } catch (err) {
      console.error('Failed to speak message:', err);
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
    <table 
      key={message.id} 
      className={`message ${message.sender === 'bot' ? 'bot-message' : 'user-message'} ${message.isError ? 'error-message' : ''}`}
    >
      <tbody>
        <tr>
          <td className="message-content">
            {renderMessageContent(message)}
          </td>
        </tr>
        <tr>
          <td className="message-footer">
            {message.time && (
              <span className="message-time">
                {message.time}
              </span>
            )}
            {/* Debug info - remove after fixing */}
            {message.sender === 'bot' && (
              <span style={{ fontSize: '10px', color: 'red', marginRight: '5px' }}>
                Local
                {/* serviceUnavailable={isServiceUnavailable.toString()} */}
              </span>
            )}
            {/* Only show model dropdown for bot messages when service is unavailable */}
            {shouldShowModelDropdown(message) && (
              <select 
                className="model-dropdown"
                value={selectedModel}
                onChange={handleModelChange}
                title="Select model"
                aria-label="Select model type"
                style={{
                  width: '15ch',
                  fontSize: '12px',
                  padding: '2px 4px',
                  border: '1px solid #ccc',
                  borderRadius: '12px',
                  backgroundColor: '#fff',
                  cursor: 'pointer'
                }}
              >
                {modelOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <span className="icon-copy" 
              onClick={(event: React.MouseEvent<HTMLSpanElement>) => 
                copyMessageToClipboard(message.text, event as CopyButtonEvent)
              }
              title="Copy message"
              aria-label="Copy message to clipboard"
            />
            {/* Only show download icon for bot messages */}
            {message.sender === 'bot' && (
              <span className="icon-download" 
                onClick={(event: React.MouseEvent<HTMLSpanElement>) => 
                  downloadMessage(message.text, event)
                }
                title="Download message"
                aria-label="Download message"
              />
            )}
            <span className="icon-speaker" 
              onClick={(event: React.MouseEvent<HTMLSpanElement>) => 
                speakMessage(message.text, event)
              }
              title="Speak message"
              aria-label="Speak message"
            />
          </td>
        </tr>
      </tbody>
    </table>
  );

  // Error boundary for message rendering
  const renderMessageSafely = (message: Message): React.ReactElement => {
    try {
      return renderMessage(message);
    } catch (error) {
      console.error('Error rendering message:', error);
      setHasError(true);
      return (
        <div key={message.id} className="message bot-message error-message">
          <div className="message-content">
            Error rendering message. Please try again.
          </div>
        </div>
      );
    }
  };

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
          {messages.length === 0 ? renderWelcomeMessage() : messages.map(renderMessageSafely)}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Loading animation - shows when waiting for bot response */}
      {renderLoadingAnimation()}
    </div>
  );
};

export default ChatContainer;
