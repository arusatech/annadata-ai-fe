import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../css/style.css';
import '../css/icons.min.css';
import ChatService from '../services/ChatService';
import AuthService from '../services/AuthService';
import { SpeechRecognitionService } from '../services/SpeechService';

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
  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingState, setRecordingState] = useState<'mic' | 'stop' | 'send'>('mic');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  
  // Speech service reference
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Check authentication status on component mount
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

  // Debug effect to monitor message state changes
  useEffect(() => {
    console.log('📝 Message state changed:', { 
      message, 
      partialTranscript, 
      isRecording, 
      recordingState,
      messageLength: message.length 
    });
  }, [message, partialTranscript, isRecording, recordingState]);

  // Initialize speech service
  useEffect(() => {
    const initializeSpeechService = async () => {
      try {
        speechServiceRef.current = new SpeechRecognitionService();
        await speechServiceRef.current.initialize();
        isInitializedRef.current = true;
        
        // Set up custom event listeners
        setupSpeechCallbacks();
        
        console.log('✅ Speech service initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize speech service:', error);
        addErrorMessage('Speech recognition initialization failed');
      }
    };

    initializeSpeechService();

    // Cleanup on unmount
    return () => {
      if (speechServiceRef.current) {
        speechServiceRef.current.cleanup();
      }
    };
  }, []);

  // Set up speech recognition callbacks
  const setupSpeechCallbacks = () => {
    if (!speechServiceRef.current) return;

    // Handle final results
    speechServiceRef.current.onResult = (result: string) => {
      console.log('🎤 Final transcript received via onResult:', result);
      if (result.trim()) {
        setMessage(result);
        setPartialTranscript('');
        updateButtonState();
      }
    };

    // Add custom listeners for UI feedback
    speechServiceRef.current.addCustomListener('start', () => {
      console.log('🎤 Recording started');
      setIsRecording(true);
      setRecordingState('stop');
      setPartialTranscript('');
      updateButtonIcon();
    });

    speechServiceRef.current.addCustomListener('speechStart', () => {
      console.log('🗣️ User started speaking');
      setPartialTranscript('');
    });

    speechServiceRef.current.addCustomListener('speechEnd', () => {
      console.log('🔇 User stopped speaking');
      // Clear the "Listening..." indicator when user stops speaking
      if (partialTranscript === 'Listening...') {
        setPartialTranscript('');
      }
    });

    speechServiceRef.current.addCustomListener('partialResult', (event: any) => {
      console.log('🔄 Partial result event received:', event);
      
      // Try multiple ways to get the partial result
      let partialText = '';
      
      if (event.result && typeof event.result === 'string') {
        partialText = event.result;
      } else if (event.transcript && typeof event.transcript === 'string') {
        partialText = event.transcript;
      } else if (event.text && typeof event.text === 'string') {
        partialText = event.text;
      } else if (typeof event === 'string') {
        partialText = event;
      } else if (event && typeof event === 'object') {
        // Try to find any string property
        for (const key in event) {
          if (typeof event[key] === 'string' && event[key].trim()) {
            partialText = event[key];
            break;
          }
        }
      }
      
      if (partialText.trim()) {
        console.log('🔄 Setting partial transcript:', partialText);
        setPartialTranscript(partialText);
        setMessage(partialText);
      } else {
        console.log('🔄 No valid partial result found');
      }
    });

    // Add a visual indicator when user is speaking (since partial results may not work)
    speechServiceRef.current.addCustomListener('speechStart', () => {
      console.log('🗣️ User started speaking');
      setPartialTranscript('Listening...');
    });

    speechServiceRef.current.addCustomListener('result', (event: any) => {
      console.log('✅ Final result event received:', event);
      
      // Try multiple ways to get the final result
      let finalText = '';
      
      if (event.result && typeof event.result === 'string') {
        finalText = event.result;
      } else if (event.transcript && typeof event.transcript === 'string') {
        finalText = event.transcript;
      } else if (event.text && typeof event.text === 'string') {
        finalText = event.text;
      } else if (typeof event === 'string') {
        finalText = event;
      } else if (event && typeof event === 'object') {
        // Try to find any string property
        for (const key in event) {
          if (typeof event[key] === 'string' && event[key].trim()) {
            finalText = event[key];
            break;
          }
        }
      }
      
      if (finalText.trim()) {
        console.log('✅ Setting final transcript:', finalText);
        setMessage(finalText);
        setPartialTranscript('');
        updateButtonState();
      } else {
        console.log('✅ No valid final result found');
      }
    });

    speechServiceRef.current.addCustomListener('error', (event: any) => {
      console.error('❌ Speech recognition error:', event);
      setIsRecording(false);
      setRecordingState('mic');
      updateButtonIcon();
      addErrorMessage(`Speech recognition error: ${event.message || 'Unknown error'}`);
    });

    speechServiceRef.current.addCustomListener('end', () => {
      console.log('🛑 Recording session ended');
      setIsRecording(false);
      // Always show send icon when recording ends, regardless of message content
      setRecordingState('send');
      setPartialTranscript('');
      updateButtonIcon();
    });

    speechServiceRef.current.addCustomListener('userStop', () => {
      console.log('🛑 User manually stopped recording');
      setIsRecording(false);
      // Always show send icon when user stops recording
      setRecordingState('send');
      setPartialTranscript('');
      updateButtonIcon();
    });
  };

  // Language to speech recognition locale mapping
  const getSpeechRecognitionLanguage = (languageCode: string): string => {
    const speechLanguageMap: Record<string, string> = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'bn': 'bn-IN',
      'ml': 'ml-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'gu': 'gu-IN',
      'mr': 'mr-IN',
      'pa': 'pa-IN',
      'or': 'or-IN',
      'as': 'as-IN',
      'ne': 'ne-NP',
      'si': 'si-LK',
      'gom': 'gom-IN',
      'mni': 'mni-IN',
      'brx': 'brx-IN',
      'ks': 'ks-IN',
      'sd': 'sd-PK',
      'ur': 'ur-PK',
      'mai': 'mai-IN',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'es': 'es-ES',
      'pt': 'pt-BR',
      'it': 'it-IT',
      'ru': 'ru-RU',
      'pl': 'pl-PL',
      'tr': 'tr-TR',
      'uk': 'uk-UA',
      'he': 'he-IL',
      'el': 'el-GR',
      'th': 'th-TH',
      'ko': 'ko-KR',
      'ja': 'ja-JP',
      'zh': 'zh-CN',
      'ar': 'ar-SA'
    };
    
    const mappedLanguage = speechLanguageMap[languageCode] || 'en-US';
    console.log(`🎤 Language mapping: ${languageCode} -> ${mappedLanguage}`);
    return mappedLanguage;
  };

  // Handle microphone button click
  const handleMicClick = useCallback(async (): Promise<void> => {
    console.log('🎤 MIC CLICKED!');
    
    if (!isInitializedRef.current || !speechServiceRef.current) {
      console.error('❌ Speech service not initialized');
      addErrorMessage('Speech recognition not available');
      return;
    }

    try {
      if (isRecording) {
        // Stop recording
        console.log(' Stopping recording...');
        await speechServiceRef.current.stopListening();
      } else {
        // Check microphone permissions first (only on web platform)
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Microphone permission granted');
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream
          } catch (permissionError) {
            console.error('❌ Microphone permission denied:', permissionError);
            addErrorMessage('Microphone permission is required for voice messages');
            return;
          }
        } else {
          console.log('🎤 Running on native platform - skipping web permission check');
        }
        
        // Start recording
        const currentLanguage = getSpeechRecognitionLanguage(i18n.language);
        console.log(`🎙️ Starting recording with language: ${currentLanguage}`);
        
        await speechServiceRef.current.startListening(currentLanguage);
      }
    } catch (error) {
      console.error('❌ Error in mic click:', error);
      setIsRecording(false);
      setRecordingState('mic');
      updateButtonIcon();
      addErrorMessage(`Failed to ${isRecording ? 'stop' : 'start'} recording`);
    }
  }, [isRecording, i18n.language]);

  // Handle send button click
  const handleSendClick = (): void => {
    if (message.trim()) {
      handleSubmit({ preventDefault: () => {} });
    }
  };

  // Update button state based on current conditions
  const updateButtonState = (): void => {
    if (isRecording) {
      setRecordingState('stop');
    } else {
      // When not recording, always show send icon if there's any content (including partial transcript)
      setRecordingState((message.trim() || partialTranscript.trim()) ? 'send' : 'mic');
    }
    updateButtonIcon();
  };

  // Update button icon based on state
  const updateButtonIcon = (): void => {
    // This will be handled in the render method
  };

  // Add error message to chat
  const addErrorMessage = (text: string): void => {
    const errorMessageObj: ErrorMessageObj = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      sender: 'bot',
      time: new Date().toLocaleTimeString(),
      timestamp: new Date().toISOString(),
      isError: true
    };
    
    setMessages(prevMessages => [...prevMessages, errorMessageObj]);
  };

  // Determine which icon to show based on input state
  const shouldShowSendIcon: boolean = isInputFocused || message.trim().length > 0;

  // Placeholder functions for icon clicks
  const handleAttachClick = (): void => {
    console.log('Attach icon clicked');
  };

  const handleCameraClick = (): void => {
    console.log('Camera icon clicked');
  };

  // Send message via WebSocket
  const sendMessageViaWebSocket = async (messageText: string, timestamp: string): Promise<boolean> => {
    try {
      const connected: boolean = await ChatService.connect();
      if (!connected) {
        return false;
      }

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
    setPartialTranscript('');
    setIsSending(true);
    setRecordingState('mic');
    updateButtonIcon();

    try {
      const success: boolean = await sendMessageViaWebSocket(userMessage, timestamp);
      
      if (!success) {
        console.error(`❌ [CHAT DEBUG] WebSocket send failed`);
        
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
    updateButtonState();
  };

  const handleInputBlur = (): void => {
    setIsInputFocused(false);
    updateButtonState();
  };

  // Handle right action click (mic, stop, or send)
  const handleRightActionClick = (): void => {
    switch (recordingState) {
      case 'mic':
        handleMicClick();
        break;
      case 'stop':
        // When stop is clicked, stop recording and show send icon if there's text
        handleMicClick();
        break;
      case 'send':
        handleSendClick();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setMessage(e.target.value);
    updateButtonState();
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    handleSubmit(e);
  };

  // Get button icon and class based on current state
  const getButtonIcon = (): { icon: string; className: string; title: string } => {
    switch (recordingState) {
      case 'mic':
        return {
          icon: 'icon-mic',
          className: 'mic-icon',
          title: t('voice_message', 'Voice message')
        };
      case 'stop':
        return {
          icon: 'icon-stop',
          className: 'stop-icon recording',
          title: t('stop_recording', 'Stop recording')
        };
      case 'send':
        return {
          icon: 'icon-arrow-up',
          className: `send-icon active ${isSending ? 'sending' : ''}`,
          title: isSending ? t('sending', 'Sending...') : t('send', 'Send message')
        };
      default:
        return {
          icon: 'icon-mic',
          className: 'mic-icon',
          title: t('voice_message', 'Voice message')
        };
    }
  };

  const buttonConfig = getButtonIcon();

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
                  : partialTranscript 
                    ? partialTranscript 
                    : t('hint', 'Type a message...')
              }
              aria-label="Chat input"
              value={message}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={isSending}
            />
            
            {/* Right side actions - dynamic icon based on state */}
            <div className="right-actions">
              <i
                className={buttonConfig.icon + ' ' + buttonConfig.className}
                onClick={handleRightActionClick}
                style={{ 
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  animation: recordingState === 'stop' ? 'pulse 1s infinite' : 'none'
                }}
                title={buttonConfig.title}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRightActionClick();
                  }
                }}
              ></i>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatFooter;
