import React, { useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import MenuContainer from './components/MenuContainer';
import ChatContainer from './components/ChatContainer';
import ChatFooter from './components/ChatFooter';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { langData, langOptions } from './data/langData'; // Import both exports
import { capacitorPreferencesDetector } from './js/i18n-detector';
import AuthService from './services/AuthService';
import ChatService from './services/ChatService';

// Import global stylesheets
import './css/style.css';
import './css/layout.css';
import './css/icons.min.css';

// Type definitions
// Fix: Update the Message interface to match the components' expectations
interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user'; // Remove 'system' to match component interfaces
  time: string;
  timestamp: string;
  isError?: boolean;
}

interface MessagePayload {
  type: string;
  topic?: string;
  content?: string;
  data?: any;
  confidence?: number;
  model_used?: string;
  sender?: string;
  status?: string;
  user_id?: string;
  ai_status?: string;
  kafka_topics?: string[];
  message_id?: string;
  timestamp?: string;
  error?: string;
  code?: string;
}

interface JWTResult {
  userExists?: boolean; // Make optional to match AuthResponse
  token?: string;
  offline?: boolean;
}

interface TokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

interface LangData {
  [key: string]: {
    [key: string]: string;
  };
}

interface LangOptions {
  [key: string]: {
    initial?: string;
    name?: string;
    reply?: string;
  };
}

// --- Start of New Merging Logic ---
// Create a unified resource object for i18next
const resources: { [key: string]: { translation: any } } = {};
Object.keys(langData).forEach(key => {
  resources[key] = {
    translation: {
      ...langData[key], // Get all the main translations
      // Merge the 'initial' property from langOptions
      initial: langOptions[key] ? langOptions[key].initial : '',
    }
  };
});
// --- End of New Merging Logic ---

// Fix: Use type assertion to bypass type checking for custom configuration
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['customCapacitor'],
      caches: [],
      lookupCustom: capacitorPreferencesDetector.detect,
      cacheUserLanguage: capacitorPreferencesDetector.cacheUserLanguage,
    },
  } as any); // Add type assertion

const App: React.FC = () => {
  const { i18n: i18nextInstance } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Error boundary for the app
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (hasError) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>App Error</h1>
        <p>Something went wrong: {errorMessage}</p>
        <button onClick={() => window.location.reload()}>Reload App</button>
      </div>
    );
  }

  // Handle auth state changes from MenuContainer
  const handleAuthStateChange = (isLoggedIn: boolean, isOfflineMode: boolean): void => {
    setIsUserLoggedIn(isLoggedIn);
    setIsOffline(isOfflineMode);
  };

  useEffect(() => {
    // Initialize and hide the splash screen when component mounts
    const initApp = async (): Promise<(() => void) | void> => {
      try {
        console.log('🚀 App Startup: Initializing application...');
        
        // Step 1: Initialize JWT and check if user exists
        console.log('📡 Step 1: Calling AuthService.initializeJWT()');
        const jwtResult = await AuthService.initializeJWT() as JWTResult;
        const userExists: boolean = jwtResult.userExists || false;
        setIsUserLoggedIn(userExists);
        console.log('✅ JWT initialization result:', jwtResult);
        
        // Step 2: Set user login state based on JWT initialization
        // User is logged in ONLY if we have a valid JWT token
        console.log('👤 User login state:', userExists ? 'Logged In' : 'Not Logged In');
        console.log('🔑 JWT Token present:', jwtResult.token);
        
        // Step 3: Set offline state
        const isOfflineMode: boolean = jwtResult.offline || false;
        setIsOffline(isOfflineMode);
        console.log('🌐 Offline mode:', isOfflineMode ? 'Enabled' : 'Disabled');
        
        // Step 4: Set up WebSocket message handling for bot responses
        let messageCallback: ((topic: string, payload: MessagePayload) => void) | null = null;
        if (userExists && !isOfflineMode) {
          console.log('🔌 [APP DEBUG] Setting up WebSocket message handling');
          
          // First, ensure we have a valid token before setting up WebSocket
          ChatService.checkAndRefreshToken().then((tokenResult: TokenResult) => {
            if (tokenResult.success) {
              console.log('✅ [APP DEBUG] Token validated, proceeding with WebSocket setup');
            } else {
              console.error('❌ [APP DEBUG] Token validation failed:', tokenResult.error);
              // If token validation fails, we might need to re-authenticate
              setIsUserLoggedIn(false);
              return;
            }
          }).catch((error: any) => {
            console.error('❌ [APP DEBUG] Error checking token:', error);
            setIsUserLoggedIn(false);
            return;
          });
          
          messageCallback = (topic: string, payload: MessagePayload): void => {
            console.log('📨 [APP DEBUG] Received WebSocket message:', {
              topic: topic,
              payloadType: payload.type,
              hasContent: !!payload.content,
              contentLength: payload.content ? payload.content.length : 0,
              timestamp: payload.timestamp
            });
            
            // Handle connection established
            if (payload.type === 'connection_established') {
              console.log('🔗 [APP DEBUG] WebSocket connection established:', {
                user_id: payload.user_id,
                ai_status: payload.ai_status,
                kafka_topics: payload.kafka_topics
              });
              
              // Test: Add a test message when connection is established
              console.log('🧪 [TEST DEBUG] Adding test message on connection');
              const testMessage: Message = {
                id: `connection_test_${Date.now()}`,
                text: '🔗 Connection established! WebSocket is working.',
                sender: 'bot',
                time: new Date().toLocaleTimeString(),
                timestamp: new Date().toISOString()
              };
              setMessages(prevMessages => [...prevMessages, testMessage]);
            }
            
            // Handle user message confirmation
            else if (payload.type === 'user_message') {
              console.log('✅ [APP DEBUG] User message confirmed:', {
                content: payload.content,
                status: payload.status,
                message_id: payload.message_id
              });
            }
            
            // Handle processing status messages
            else if (payload.type === 'processing_status') {
              console.log('⚙️ [APP DEBUG] Processing status message:', {
                status: payload.status,
                user_id: payload.user_id,
                timestamp: payload.timestamp
              });
              
              // Hide loading animation when processing is completed
              if (payload.status === 'completed') {
                console.log('✅ [APP DEBUG] Processing completed, hiding loading animation');
                // The loading animation will be hidden by the ChatService when bot response arrives
              }
              
              // You can add UI feedback here if needed
              // For example, show a "Processing..." message or status indicator
            }
            
            // Handle AI responses (the main bot responses)
            else if (payload.type === 'ai_response') {
              console.log('🤖 [APP DEBUG] AI response received:', {
                content: payload.content,
                data: payload.data,
                confidence: payload.confidence,
                model_used: payload.model_used,
                sender: payload.sender
              });
              
              // Handle both possible content locations based on server structure
              let responseContent: string | undefined = payload.content;
              if (!responseContent && payload.data && payload.data.content) {
                responseContent = payload.data.content;
              }
              
              if (responseContent) {
                const botMessageObj: Message = {
                  id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  text: responseContent,
                  sender: 'bot',
                  time: new Date().toLocaleTimeString(),
                  timestamp: payload.timestamp || new Date().toISOString()
                };
                
                console.log('💬 [APP DEBUG] Created bot message object:', {
                  id: botMessageObj.id,
                  textLength: botMessageObj.text.length,
                  timestamp: botMessageObj.timestamp,
                  content: responseContent.substring(0, 100) + (responseContent.length > 100 ? '...' : ''),
                  fullMessageObj: botMessageObj
                });
                
                setMessages(prevMessages => {
                  const newMessages: Message[] = [...prevMessages, botMessageObj];
                  console.log('💬 [APP DEBUG] Updated messages array, new count:', newMessages.length);
                  console.log('💬 [APP DEBUG] All messages in array:', newMessages);
                  
                  // Test: Add a simple test message to see if state updates work
                  setTimeout(() => {
                    console.log('🧪 [TEST DEBUG] Testing state update with simple message');
                    setMessages((currentMessages: Message[]) => {
                      const testMessage: Message = {
                        id: `test_${Date.now()}`,
                        text: '🧪 TEST MESSAGE - If you see this, state updates work!',
                        sender: 'bot',
                        time: new Date().toLocaleTimeString(),
                        timestamp: new Date().toISOString()
                      };
                      return [...currentMessages, testMessage];
                    });
                  }, 1000);
                  
                  return newMessages;
                });
              } else {
                console.error('❌ [APP DEBUG] AI response received but no content found:', payload);
              }
            }
            
            // Handle notifications
            else if (payload.type === 'notification') {
              console.log('🔔 [APP DEBUG] Notification received:', {
                content: payload.data?.content,
                type: payload.data?.type,
                user_id: payload.user_id
              });
              // Handle notification messages here if needed
            }
            
            // Handle system messages
            else if (payload.type === 'system_message') {
              console.log('⚙️ [APP DEBUG] System message received:', {
                content: payload.content,
                user_id: payload.user_id
              });
            }
            
            // Handle broadcast messages
            else if (payload.type === 'broadcast') {
              console.log('📢 [APP DEBUG] Broadcast message received:', {
                content: payload.content,
                sender: payload.sender
              });
            }
            
            // Handle error messages
            else if (payload.type === 'error') {
              console.error('❌ [APP DEBUG] Error message received:', {
                error: payload.error,
                code: payload.code,
                user_id: payload.user_id
              });
              
              // Add error message to chat
              const errorMessageObj: Message = {
                id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: `Error: ${payload.error}`,
                sender: 'bot', // Change from 'system' to 'bot'
                time: new Date().toLocaleTimeString(),
                timestamp: payload.timestamp || new Date().toISOString(),
                isError: true
              };
              
              setMessages(prevMessages => {
                const newMessages: Message[] = [...prevMessages, errorMessageObj];
                return newMessages;
              });
            }
            
            // Handle legacy bot responses (fallback for old format)
            else if (topic.includes('-bot') && payload.type === 'text') {
              console.log('💬 [APP DEBUG] Processing legacy bot response message:', {
                topic: topic,
                contentPreview: payload.content ? payload.content.substring(0, 100) + (payload.content.length > 100 ? '...' : '') : 'no content',
                contentLength: payload.content ? payload.content.length : 0
              });
              
              const botMessageObj: Message = {
                id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                text: payload.content || '',
                sender: 'bot',
                time: new Date().toLocaleTimeString(),
                timestamp: payload.timestamp || new Date().toISOString()
              };
              
              setMessages(prevMessages => {
                const newMessages: Message[] = [...prevMessages, botMessageObj];
                console.log('💬 [APP DEBUG] Updated messages array, new count:', newMessages.length);
                return newMessages;
              });
            }
            
            // Handle any other message types
            else {
              console.log('📡 [APP DEBUG] Received unhandled message:', {
                topic: topic,
                payload: payload,
                messageType: payload.type,
                hasTopic: !!topic
              });
              
              // Log all message types for debugging
              console.log('🔍 [APP DEBUG] Full message details:', {
                topic: topic,
                type: payload.type,
                status: payload.status,
                content: payload.content,
                user_id: payload.user_id,
                timestamp: payload.timestamp
              });
            }
          };
          
          console.log('🔌 [APP DEBUG] Registering message callback with ChatService');
          ChatService.onMessage(messageCallback);
          console.log('✅ [APP DEBUG] Message callback registered successfully');
          
          // Test: Verify callback registration by checking ChatService
          console.log('🔍 [APP DEBUG] ChatService message callbacks count:', (ChatService as any).messageCallbacks?.length || 0);
        } else {
          console.log('🔌 [APP DEBUG] Skipping WebSocket setup:', {
            userExists: userExists,
            isOfflineMode: isOfflineMode,
            reason: !userExists ? 'User not authenticated' : 'Offline mode enabled'
          });
        }
        
        // Step 5: Log the final app state
        if (userExists) {
          console.log('✅ App Startup Complete: User authenticated, showing settings icon');
        } else if (isOfflineMode) {
          console.log('✅ App Startup Complete: Working offline mode');
        } else {
          console.log('✅ App Startup Complete: User needs registration, showing join icon');
        }
        
        // Hide the splash screen when the app is ready
        setTimeout(async () => {
            await SplashScreen.hide();
          setIsLoading(false);
        }, 2000);

        // Return cleanup function
        return () => {
          if (messageCallback) {
            console.log('🔌 [APP DEBUG] Cleaning up message callback');
            ChatService.removeMessageCallback(messageCallback);
            console.log('✅ [APP DEBUG] Message callback removed successfully');
          } else {
            console.log('🔌 [APP DEBUG] No message callback to clean up');
          }
        };
      } catch (error: any) {
        console.error('❌ Error initializing app:', error);
        setIsUserLoggedIn(false);
        setIsOffline(true);
        
        setTimeout(async () => {
          await SplashScreen.hide();
        setIsLoading(false);
        }, 2000);
      }
    };

    const cleanup = initApp();
    
    // Cleanup function for component unmount
    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((cleanupFn: (() => void) | void) => {
          if (cleanupFn && typeof cleanupFn === 'function') {
            cleanupFn();
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    // This effect now only manages the body class based on i18next's state
    const handleLanguageChange = (lng: string): void => {
      const bodyClasses: string[] = document.body.className.split(' ').filter(c => !c.startsWith('lang-'));
      document.body.className = bodyClasses.join(' ');
      document.body.classList.add(`lang-${lng}`);
    };

    // Listen to the 'languageChanged' event from i18next
    i18nextInstance.on('languageChanged', handleLanguageChange);

    // Set initial class
    handleLanguageChange(i18nextInstance.language);

    // Cleanup listener on component unmount
    return () => {
      i18nextInstance.off('languageChanged', handleLanguageChange);
    };
  }, [i18nextInstance]);

  // Fix loading view
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <p style={{ fontSize: 18, color: '#888' }}>Loading...</p>
            </div>
    );
  }

  try {
    // Fix: Create a proper message handler function
    const handleSendMessage = (messageText: string): void => {
      const newMessage: Message = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: messageText,
        sender: 'user',
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString()
      };
      setMessages(prevMessages => [...prevMessages, newMessage]);
    };

    // Update the ChatFooter props
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MenuContainer 
                isUserLoggedIn={isUserLoggedIn}
                isOffline={isOffline}
                onAuthStateChange={handleAuthStateChange}
              />
        <ChatContainer messages={messages} />
        <ChatFooter onSendMessage={handleSendMessage} setMessages={setMessages} />
      </div>
    );
  } catch (error: any) {
    console.error('❌ [APP] Rendering error:', error);
    setHasError(true);
    setErrorMessage(error.message);
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>Rendering Error</h1>
        <p>Error: {error.message}</p>
        <button onClick={() => window.location.reload()}>Reload App</button>
      </div>
    );
  }
};

export default App;
