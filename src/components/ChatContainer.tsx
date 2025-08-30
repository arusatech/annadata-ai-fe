import React, { useState, useEffect, useRef } from 'react';
import MarkdownService from '../services/MarkdownService';
import { useTranslation } from 'react-i18next';
import LlamaService, { LlamaModel } from '../services/LlamaService';
import '../css/chat.css';
import '../css/markdown.css';
import '../css/welcome.css';
import '../css/icons.css';

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
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

interface CopyButtonEvent extends React.MouseEvent<HTMLButtonElement> {
  target: HTMLButtonElement;
}

// Update ModelType to include 'online'
type ModelType = 'online' | 'smol-lm-3-3b-q4' | 'gemma-3n-e2b-q3' | 'qwen-3-4b-q3' | 'gemma-3n-e4b-q3' | 'ultravox-v0.5-llama-3.2-1b-q4' | 'llama-2-7b-chat.Q4_K_M.gguf';

const ChatContainer: React.FC<ChatContainerProps> = ({ 
  messages = [], 
  isLoading = false,
  selectedModel,
  onModelChange
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [localSelectedModel, setLocalSelectedModel] = useState<ModelType>('online');
  const [isServiceUnavailable, setIsServiceUnavailable] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<LlamaModel[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<LlamaModel[]>([]);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [llamaService] = useState(() => LlamaService);
  
  // Add new state variables for download status tracking
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Initialize llama service
  useEffect(() => {
    const initializeLlama = async () => {
      try {
        await llamaService.initialize();
        setAvailableModels(llamaService.getAvailableModels());
        setDownloadedModels(llamaService.getDownloadedModels());
      } catch (error) {
        console.error('Failed to initialize llama service:', error);
      }
    };

    initializeLlama();
  }, [llamaService]);

  // Use the prop if provided, otherwise use local state
  const currentSelectedModel = selectedModel || localSelectedModel;

  // Handle model selection change
  const handleModelChange = async (event: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const newModelId = event.target.value as ModelType;
    
    if (onModelChange) {
      onModelChange(newModelId);
    } else {
      setLocalSelectedModel(newModelId);
    }
    
    console.log('Selected model:', newModelId);

    // Only load/download if it's not the online option
    if (newModelId !== 'online') {
      try {
        setIsModelLoading(true);
        
        // Check if model is downloaded
        const model = llamaService.getModel(newModelId);
        if (model && model.status === 'downloaded') {
          await llamaService.loadModel(newModelId);
          console.log(`Model ${newModelId} loaded successfully`);
        } else {
          // Model not downloaded, download it automatically
          console.log(`Model ${newModelId} needs to be downloaded, starting download...`);
          await handleModelDownload(newModelId);
        }
      } catch (error) {
        console.error(`Failed to load/download model ${newModelId}:`, error);
        // Show error message in chat (you can customize this)
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          text: `Failed to load model ${newModelId}. Please try again.`,
          sender: 'bot',
          time: new Date().toLocaleTimeString(),
          isError: true
        };
        // You can add this to your messages state if needed
        console.error('Model error:', errorMessage.text);
      } finally {
        setIsModelLoading(false);
      }
    }
  };

  // Handle model download - simplified
  const handleModelDownload = async (modelId: string): Promise<void> => {
    try {
      setDownloadingModel(modelId);
      setDownloadProgress(0);
      setIsDownloading(true);
      setDownloadError(null);
      setDownloadSuccess(false);

      await llamaService.downloadModel(modelId, (progress: { loaded: number; total: number; percentage: number }) => {
        setDownloadProgress(progress.percentage);
      });

      // Update downloaded models list
      setDownloadedModels(llamaService.getDownloadedModels());
      
      // Auto-load the downloaded model
      await llamaService.loadModel(modelId);
      setLocalSelectedModel(modelId as ModelType);
      
      console.log(`Model ${modelId} downloaded and loaded successfully`);
      setDownloadSuccess(true);
      
      // Reset success state after a delay
      setTimeout(() => {
        setDownloadSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error(`Failed to download model ${modelId}:`, error);
      const errorMessage = `Failed to download model ${modelId}. Please check your internet connection and try again.`;
      setDownloadError(errorMessage);
      
      // Show error message in chat (you can customize this)
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        text: errorMessage,
        sender: 'bot',
        time: new Date().toLocaleTimeString(),
        isError: true
      };
      // You can add this to your messages state if needed
      console.error('Download error:', errorMsg.text);
    } finally {
      setDownloadingModel(null);
      setDownloadProgress(0);
      setIsDownloading(false);
    }
  };

  // Helper function to determine if model dropdown should be shown
  const shouldShowModelDropdown = (message: Message): boolean => {
    return message.sender === 'bot' && isServiceUnavailable;
  };

  // Get model options for dropdown
  const getModelOptions = (): Array<{ value: string; label: string; disabled: boolean }> => {
    const options = [
      {
        value: 'online',
        label: '🌐 Online Server',
        disabled: false
      }
    ];

    // Add downloaded models
    downloadedModels.forEach(model => {
      options.push({
        value: model.id,
        label: `🤖 ${model.name}`,
        disabled: false
      });
    });

    // Add available models that are not downloaded
    availableModels.forEach(model => {
      if (!downloadedModels.find(dm => dm.id === model.id)) {
        options.push({
          value: model.id,
          label: `⬇️ ${model.name} (${model.sizeMB}MB)`,
          disabled: false
        });
      }
    });

    return options;
  };

  // Helper function to get the status text and tooltip
  const getStatusInfo = () => {
    if (downloadError) {
      return { text: 'Download Error', tooltip: downloadError };
    } else if (isDownloading || downloadingModel) {
      return { text: 'Downloading', tooltip: `Downloading model: ${downloadingModel} (${downloadProgress.toFixed(1)}%)` };
    } else if (downloadSuccess) {
      return { text: 'Local', tooltip: 'Model downloaded successfully' };
    } else {
      return { text: 'Local', tooltip: 'Using local model' };
    }
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

  const renderMessage = (message: Message): React.ReactElement => {
    const statusInfo = getStatusInfo();
    
    return (
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
                <span 
                  style={{ 
                    fontSize: '10px', 
                    color: downloadError ? 'red' : isDownloading ? 'orange' : 'green', 
                    marginRight: '5px',
                    cursor: downloadError || isDownloading ? 'help' : 'default'
                  }}
                  title={statusInfo.tooltip}
                >
                  {statusInfo.text}
                  {/* serviceUnavailable={isServiceUnavailable.toString()} */}
                </span>
              )}
              {/* Only show model dropdown for bot messages when service is unavailable */}
              {shouldShowModelDropdown(message) && (
                <select 
                  className="model-dropdown"
                  value={currentSelectedModel}
                  onChange={handleModelChange}
                  title="Select local model"
                  aria-label="Select local model type"
                  disabled={isModelLoading}
                  style={{
                    width: '15ch',
                    fontSize: '12px',
                    padding: '2px 4px',
                    border: '1px solid #ccc',
                    borderRadius: '12px',
                    backgroundColor: isModelLoading ? '#f5f5f5' : '#fff',
                    cursor: isModelLoading ? 'not-allowed' : 'pointer',
                    opacity: isModelLoading ? 0.6 : 1
                  }}
                >
                  {getModelOptions().map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      disabled={option.disabled}
                    >
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
  };

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
