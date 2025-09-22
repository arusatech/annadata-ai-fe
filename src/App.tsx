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
import SQLiteService from './services/SQLiteService';
import { getDeviceId } from './services/DeviceInfoService';

// Import global stylesheets
import './css/style.css';
import './css/layout.css';
import './css/icons.min.css';
import './css/icons.css'; // Add this
import './css/utilities.css'; // Add this
import './css/forms.css'; // Add this
import './css/popups.css'; // Add this

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
  const [selectedModel, setSelectedModel] = useState<string>('online'); // Default to online
  const [isLocalProcessing, setIsLocalProcessing] = useState<boolean>(false); // Add this state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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

  // Add handler for loading state changes
  const handleLoadingChange = (loading: boolean) => {
    setIsLocalProcessing(loading);
  };

  // Handle session selection from chat history
  const handleSessionSelect = async (sessionId: string) => {
    try {
      console.log('🔄 Loading session:', sessionId);
      
      const sqliteService = SQLiteService.getInstance();
      await sqliteService.initialize();
      
      const sessionMessages = await sqliteService.getSessionMessages(sessionId);
      
      // Convert SQLite messages to App message format
      const convertedMessages: Message[] = sessionMessages.map(msg => ({
        id: msg.message_id,
        text: msg.content,
        sender: msg.sender,
        time: new Date(msg.created_at).toLocaleTimeString(),
        timestamp: msg.created_at,
        isError: msg.is_error
      }));
      
      setMessages(convertedMessages);
      setCurrentSessionId(sessionId);
      
      console.log('✅ Session loaded successfully:', sessionId, 'Messages:', convertedMessages.length);
    } catch (error) {
      console.error('❌ Error loading session:', error);
      alert('Failed to load chat session');
    }
  };

  // Save message to SQLite when a new message is added
  const saveMessageToSQLite = async (message: Message, sessionId: string) => {
    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        console.warn('⚠️ No device ID available, skipping SQLite save');
        return;
      }

      const sqliteService = SQLiteService.getInstance();
      await sqliteService.initialize();

      // Check if session exists, if not create it
      if (!currentSessionId) {
        const newSessionId = await sqliteService.createSession(deviceId, 'New Chat');
        setCurrentSessionId(newSessionId);
        sessionId = newSessionId;
      }

      await sqliteService.saveMessage({
        message_id: message.id,
        session_id: sessionId,
        content: message.text,
        sender: message.sender,
        created_at: message.timestamp,
        is_error: message.isError || false
      });

      console.log('✅ Message saved to SQLite');
    } catch (error) {
      console.error('❌ Error saving message to SQLite:', error);
    }
  };

  useEffect(() => {
    // Show splash screen immediately
    const showSplash = async () => {
      try {
        console.log('🔍 [SPLASH] Showing splash screen immediately...');
        await SplashScreen.show({
          showDuration: 2000,
          autoHide: false
        });
      } catch (error) {
        console.warn('⚠️ [SPLASH] Failed to show splash screen:', error);
      }
    };

    const initialize = async () => {
      try {
        console.log('🚀 [INIT] Starting app initialization...');
        setIsLoading(true);
        
        // Initialize SQLite first
        try {
          const sqliteService = SQLiteService.getInstance();
          await sqliteService.initialize();
          console.log('✅ [INIT] SQLite initialized successfully');
        } catch (sqliteError) {
          console.error('❌ [INIT] SQLite initialization failed:', sqliteError);
          // Continue without SQLite functionality
        }

        // Initialize authentication
        const authResult = await AuthService.initializeJWT();
        console.log('🔐 [INIT] Auth result:', authResult);
        
        // Set auth state based on result
        setIsUserLoggedIn((authResult.userExists ?? false) && !!authResult.token);
        setIsOffline(authResult.offline ?? false);
        
        // Initialize chat service - commented out for now
        // const chatService = new ChatService();
        // await chatService.connect();
        // console.log('💬 [INIT] Chat service initialized');
        
        console.log('✅ [INIT] App initialization complete');
        
        // Hide splash screen
        try {
          await SplashScreen.hide();
          console.log('🔍 [SPLASH] Splash screen hidden');
        } catch (splashError) {
          console.warn('⚠️ [SPLASH] Failed to hide splash screen:', splashError);
        }
        
      } catch (error) {
        console.error('❌ [INIT] App initialization failed:', error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Run initialization
    showSplash();
    initialize();
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

  // Fix loading view - show nothing while splash screen is visible
  if (isLoading) {
    return null;
  }

  try {
    // Fix: Create a proper message handler function
    const handleSendMessage = async (messageText: string): Promise<void> => {
      const newMessage: Message = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: messageText,
        sender: 'user',
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString()
      };
      
      setMessages(prevMessages => [...prevMessages, newMessage]);
      
      // Save to SQLite
      if (currentSessionId) {
        await saveMessageToSQLite(newMessage, currentSessionId);
      }
    };

    // Update the ChatFooter props
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MenuContainer 
                isUserLoggedIn={isUserLoggedIn}
                isOffline={isOffline}
                onAuthStateChange={handleAuthStateChange}
                onSessionSelect={handleSessionSelect}
              />
        <ChatContainer 
          messages={messages} 
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isOffline={isOffline}
          isLoading={isLocalProcessing} // Pass the loading state
        />
        <ChatFooter 
          onSendMessage={handleSendMessage} 
          setMessages={setMessages}
          selectedModel={selectedModel}
          onLoadingChange={handleLoadingChange} // Pass the loading handler
        />
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
