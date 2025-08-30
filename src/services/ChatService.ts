import { Preferences } from '@capacitor/preferences';
import config from '../config/environment';
import AuthService from './AuthService';

// Type definitions
interface LoadingAnimation {
  element: HTMLDivElement | null;
  timeoutId: NodeJS.Timeout | null;
  timeoutDuration: number;
  init(): void;
  show(): void;
  hide(): void;
  clearTimeout(): void;
}

interface TokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

interface MessagePayload {
  type: string;
  topic?: string;
  message?: string;
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
}

interface AuthMessage {
  type: string;
  token: string;
  clientId: string;
}

interface SubscribeMessage {
  type: string;
  topic: string;
}

interface PublishMessage {
  type: string;
  topic: string;
  message: string;
}

interface ChatMessage {
  type: string;
  content: string;
  timestamp: string;
  language: string;
  model?: string; // Add this field
}

interface LangOptions {
  [key: string]: {
    reply?: string;
    name?: string;
  };
}

type MessageCallback = (topic: string, payload: MessagePayload) => void;
type ConnectionCallback = (connected: boolean, error?: any) => void;

// Chat loading animation controller
const loadingAnimation: LoadingAnimation = {
  element: null,
  timeoutId: null,
  timeoutDuration: 30000, // Increased to 30 seconds for longer server responses
  
  init(): void {
    // Create loading animation element if not already created
    if (!this.element) {
      const chatContainer = document.querySelector('.chat-container');
      if (!chatContainer) return;
      
      this.element = document.createElement('div');
      this.element.className = 'chat-loading-animation';
      this.element.innerHTML = '<div class="loading-icon"></div>';
      this.element.style.display = 'none';
      chatContainer.appendChild(this.element);
    }
  },
  
  show(): void {
    if (!this.element) this.init();
    if (this.element) {
      this.element.style.display = 'flex';
      
      // Set a longer timeout as a fallback (in case server never responds)
      this.clearTimeout();
      this.timeoutId = setTimeout(() => {
        this.hide();
        // You can optionally show a timeout message here if needed
      }, this.timeoutDuration);
    }
  },
  
  hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
      this.clearTimeout();
    }
  },
  
  clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
};

class ChatService {
  private socket: WebSocket | null;
  private messageCallbacks: MessageCallback[];
  private connectionCallbacks: ConnectionCallback[];
  private isConnected: boolean;
  private clientId: string;
  private reconnectTimeout: number;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private lastErrorCode: number | null;
  private lastErrorReason: string | null;
  private isReconnecting: boolean;
  private isAuthenticated: boolean;

  constructor() {
    this.socket = null;
    this.messageCallbacks = [];
    this.connectionCallbacks = [];
    this.isConnected = false;
    this.clientId = `annadata_mobile_${Math.random().toString(16).substr(2, 8)}`;
    this.reconnectTimeout = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.lastErrorCode = null;
    this.lastErrorReason = null;
    this.isReconnecting = false;
    this.isAuthenticated = false;
    
    // Initialize loading animation
    loadingAnimation.init();
  }

  // Initialize WebSocket connection
  // Ensure we have a valid token, refreshing if necessary
  private async ensureValidToken(): Promise<TokenResult> {
    try {
      // Get current token
      let token: string | null = await AuthService.getSecureItem('jwt_token');
      
      if (!token) {
        // Try to initialize JWT (this will attempt to re-authenticate)
        const initResult = await AuthService.initializeJWT();
        if (!initResult.userExists) {
          return {
            success: false,
            error: 'No user authentication available'
          };
        }
        // Get the token after initialization
        token = await AuthService.getSecureItem('jwt_token');
        if (!token) {
          return {
            success: false,
            error: 'Failed to obtain token after initialization'
          };
        }
      }
      
      // Validate token format
      if (!this.isValidTokenFormat(token)) {
        console.error('Invalid JWT token format');
        return {
          success: false,
          error: 'Invalid token format'
        };
      }
      
      // Check if token is expired and refresh if needed
      try {
        const tokenParts: string[] = token.split('.');
        const payload: any = JSON.parse(atob(tokenParts[1]));
        const currentTime: number = Math.floor(Date.now() / 1000);
        
        if (payload.exp && payload.exp < currentTime) {
          const refreshResult = await AuthService.refreshToken();
          if (!refreshResult.success) {
            console.error('Failed to refresh expired token:', refreshResult.error);
            return {
              success: false,
              error: 'Token refresh failed: ' + (refreshResult.error || 'Unknown error')
            };
          }
          // Get the refreshed token
          const refreshedToken: string | null = await AuthService.getSecureItem('jwt_token');
          if (!refreshedToken) {
            return {
              success: false,
              error: 'No refreshed token available'
            };
          }
          token = refreshedToken;
        }
      } catch (e) {
        console.warn('Could not validate JWT token expiration:', e);
        // If we can't validate the token, try to refresh it anyway
        const refreshResult = await AuthService.refreshToken();
        if (refreshResult.success) {
          const refreshedToken: string | null = await AuthService.getSecureItem('jwt_token');
          if (refreshedToken) {
            token = refreshedToken;
          }
        }
      }
      
      return {
        success: true,
        token: token
      };
    } catch (error: any) {
      console.error('Error ensuring valid token:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Initialize WebSocket connection
  private async init(): Promise<boolean> {
    try {
      const protocol: string = config.useSSL ? 'wss' : 'ws';
      const host: string = config.apiBaseUrl.replace(/^https?:\/\//, '');
      
      // Get device_id for WebSocket connection
      const deviceId: string | null = await AuthService.getSecureItem('device_id');
      
      if (!deviceId) {
        console.error('No device ID available for WebSocket connection');
        return false;
      }
      
      // Ensure we have a valid token
      const tokenResult: TokenResult = await this.ensureValidToken();
      if (!tokenResult.success) {
        console.error('Failed to ensure valid token:', tokenResult.error);
        return false;
      }
      
      const token: string = tokenResult.token!;
      
      // Note: HTTP health check removed due to CORS issues in staging
      // WebSocket connection will be attempted directly
      
      // Use device_id in WebSocket URL path: /ws/{device_id}
      let wsUrl: string = `${protocol}://${host}/ws/${deviceId}`;
      
      // Add token as URL parameter if available
      if (token) {
        wsUrl += `?token=${encodeURIComponent(token)}`;
      }
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = this.onConnect.bind(this);
      this.socket.onclose = this.onConnectionLost.bind(this);
      this.socket.onerror = this.onConnectFailure.bind(this);
      this.socket.onmessage = this.onMessageArrived.bind(this);

      return true;
    } catch (error) {
      console.error('WebSocket initialization error:', error);
      return false;
    }
  }

  // Connect to WebSocket server
  public async connect(): Promise<boolean> {
    // Check if device_id is available
    const deviceId: string | null = await AuthService.getSecureItem('device_id');
    if (!deviceId) {
      console.log('No device ID available, cannot connect to WebSocket');
      return false;
    }

    if (!this.socket) {
      const initialized: boolean = await this.init();
      if (!initialized) return false;
    }

    // If already connected, return true
    if (this.isConnected && this.socket!.readyState === WebSocket.OPEN) {
      return true;
    }

    // If socket is connecting, wait for it
    if (this.socket!.readyState === WebSocket.CONNECTING) {
      return new Promise<boolean>((resolve) => {
        const checkConnection = (): void => {
          if (this.isConnected && this.socket!.readyState === WebSocket.OPEN) {
            resolve(true);
          } else if (this.socket!.readyState === WebSocket.CLOSED) {
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    // If socket is closed, try to reconnect
    if (this.socket!.readyState === WebSocket.CLOSED) {
      const reinitialized: boolean = await this.init();
      if (!reinitialized) return false;
    }

    // Wait for connection to be established
    return new Promise<boolean>((resolve) => {
      const timeout: NodeJS.Timeout = setTimeout(() => {
        console.error('WebSocket connection timeout');
        resolve(false);
      }, 10000); // 10 second timeout

      const onConnectSuccess = (): void => {
        clearTimeout(timeout);
        this.connectionCallbacks.forEach(callback => {
          if (typeof callback === 'function') {
            callback(true);
          }
        });
        resolve(true);
      };

      const onConnectFail = (error: any): void => {
        clearTimeout(timeout);
        console.error('WebSocket connection failed:', error);
        this.connectionCallbacks.forEach(callback => {
          if (typeof callback === 'function') {
            callback(false, error);
          }
        });
        resolve(false);
      };

      // Set up one-time event handlers for this connection attempt
      const originalOnOpen: ((event: Event) => void) | null = this.socket!.onopen;
      const originalOnError: ((event: Event) => void) | null = this.socket!.onerror;
      const originalOnClose: ((event: CloseEvent) => void) | null = this.socket!.onclose;

      this.socket!.onopen = async (event: Event) => {
        // Authentication is now handled in onConnect() method
        // No need to send authentication here
        
        onConnectSuccess();
        if (originalOnOpen) originalOnOpen(event);
      };

      this.socket!.onerror = (error: Event) => {
        console.error('WebSocket connection error:', error);
        onConnectFail(error);
        if (originalOnError) originalOnError(error);
      };

      this.socket!.onclose = (event: CloseEvent) => {
        if (event.code !== 1000) { // Not a normal closure
          onConnectFail(new Error(`Connection closed: ${event.code} - ${event.reason}`));
        }
        if (originalOnClose) originalOnClose(event);
      };
    });
  }

  // Disconnect from WebSocket server
  public disconnect(): void {
    if (this.socket && this.isConnected) {
      this.socket.close();
      this.isConnected = false;
    }
  }

  // Subscribe to a topic (now handled via WebSocket messages)
  public subscribe(topic: string): void {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      const subscribeMessage: SubscribeMessage = {
        type: 'subscribe',
        topic: topic
      };
      
      this.socket.send(JSON.stringify(subscribeMessage));
    } else {
      console.warn(`⚠️ [SUBSCRIPTION DEBUG] Cannot subscribe to ${topic}: WebSocket not connected`, {
        hasSocket: !!this.socket,
        isConnected: this.isConnected,
        readyState: this.socket ? this.socket.readyState : 'no socket',
        readyStateText: this.socket ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState] : 'no socket'
      });
    }
  }

  // Unsubscribe from a topic
  public unsubscribe(topic: string): void {
    if (this.socket && this.isConnected) {
      const unsubscribeMessage: SubscribeMessage = {
        type: 'unsubscribe',
        topic: topic
      };
      
      this.socket.send(JSON.stringify(unsubscribeMessage));
    } else {
      console.warn(`⚠️ [SUBSCRIPTION DEBUG] Cannot unsubscribe from ${topic}: WebSocket not connected`);
    }
  }

  // Publish a message to a topic
  public publish(topic: string, message: string): boolean {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      const publishMessage: PublishMessage = {
        type: 'publish',
        topic: topic,
        message: message
      };
      
      this.socket.send(JSON.stringify(publishMessage));
      
      return true;
    } else {
      console.warn(`⚠️ [PUBLISH DEBUG] Cannot publish to ${topic}: WebSocket not connected`, {
        hasSocket: !!this.socket,
        isConnected: this.isConnected,
        readyState: this.socket ? this.socket.readyState : 'no socket',
        readyStateText: this.socket ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState] : 'no socket'
      });
      return false;
    }
  }

  // Send a chat message
  public async sendChatMessage(message: string, model?: string): Promise<boolean> {
    try {
      // Show loading animation
      loadingAnimation.show();
      
      let deviceId: string | null = await AuthService.getSecureItem('device_id');
      
      if (!deviceId) {
        console.error(`❌ [CHAT DEBUG] Device ID not found, cannot send message`);
        loadingAnimation.hide();
        return false;
      }
      
      const topic: string = `chat-${deviceId}-user`;
      let languageCode: string | null = await AuthService.getSecureItem('language');
      if (!languageCode) {
        languageCode = 'en';
      }

      // Import langOptions to get the full language name
      const { langOptions }: { langOptions: LangOptions } = await import('../data/langData');
      const languageName: string = langOptions[languageCode]?.reply || 'english';
      
      const messageObj: ChatMessage = {
        type: 'text',
        content: message,
        timestamp: new Date().toISOString(),
        language: languageName,
        model: model, // Include the selected model
      };

      const result: boolean = this.publish(topic, JSON.stringify(messageObj));
      
      if (result) {
        // Note: We don't hide the animation here because we need to wait for the bot response
        // The animation will be hidden when we receive a message from the bot topic
        return true;
      } else {
        console.error(`❌ [CHAT DEBUG] Failed to publish message to topic: ${topic}`);
        loadingAnimation.hide();
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [CHAT DEBUG] Error sending chat message:`, error);
      loadingAnimation.hide();
      return false;
    }
  }

  // Connection successful callback
  private async onConnect(): Promise<void> {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Check if we need to send authentication message (only if not in URL)
    const wsUrl: string = this.socket!.url;
    const hasTokenInUrl: boolean = wsUrl.includes('token=');
    
    if (!hasTokenInUrl) {
      // Send authentication message as fallback
      try {
        const token: string | null = await AuthService.getSecureItem('jwt_token');
        
        if (token && this.socket!.readyState === WebSocket.OPEN) {
          // Validate token format first
          if (!this.isValidTokenFormat(token)) {
            console.error(`❌ [AUTH DEBUG] Invalid token format, attempting refresh...`);
            await this.handleAuthenticationError();
            return;
          }
          
          const authMessage: AuthMessage = {
            type: 'auth',
            token: token,
            clientId: this.clientId
          };
          
          this.socket!.send(JSON.stringify(authMessage));
        } else {
          console.error(`❌ [AUTH DEBUG] Cannot send authentication: token missing or socket not open`, {
            hasToken: !!token,
            socketReadyState: this.socket!.readyState,
            isOpen: this.socket!.readyState === WebSocket.OPEN
          });
        }
      } catch (error: any) {
        console.error(`❌ [AUTH DEBUG] Error sending authentication message:`, error);
      }
    }
    
    // Wait a moment for authentication to be processed
    setTimeout(() => {
      // Only setup subscriptions if still connected
      if (this.socket!.readyState === WebSocket.OPEN) {
        this.setupUserSubscriptions();
      } else {
        console.warn(`⚠️ [SUBSCRIPTION DEBUG] WebSocket no longer open, skipping subscription setup. Ready state: ${this.socket!.readyState}`);
      }
    }, 1000);
    
    // Notify all connection callbacks
    this.connectionCallbacks.forEach((callback: ConnectionCallback) => {
      if (typeof callback === 'function') {
        callback(true);
      }
    });
  }

  // Connection failure callback
  private onConnectFailure(error: Event): void {
    console.error('WebSocket Connection failed:', error);
    
    // Provide more specific error information
    if (error && (error as any).target && (error as any).target.readyState === WebSocket.CLOSED) {
      console.error('WebSocket connection failed during handshake');
      console.log(' This usually means:');
      console.log('   - WebSocket server is not running');
      console.log('   - WebSocket endpoint is incorrect');
      console.log('   - Server is returning 502/503/504 errors');
      console.log('   - Firewall/proxy is blocking WebSocket connections');
    }
    
    this.isConnected = false;
    
    // Notify all connection callbacks
    this.connectionCallbacks.forEach((callback: ConnectionCallback) => {
      if (typeof callback === 'function') {
        callback(false, error);
      }
    });

    // Try to reconnect after a delay (but with reduced attempts for server issues)
    if (this.reconnectAttempts < 2) { // Reduced from 5 to 2 for server issues
      this.attemptReconnect();
    } else {
      console.log('💡 WebSocket server appears to be unavailable. Using HTTP fallback for messaging.');
    }
  }

  // Connection lost callback
  private onConnectionLost(event: CloseEvent): void {
    console.error('WebSocket Connection lost:', event);
    this.isConnected = false;
    
    // Store error information for better handling
    this.lastErrorCode = event.code;
    this.lastErrorReason = event.reason;
    
    // Handle specific error codes
    if (event.code === 1011) {
      console.error('Internal server error (1011) - likely authentication issue');
      
      // For authentication errors, try to refresh token before reconnecting
      this.handleAuthenticationError().then(() => {
        // Only attempt reconnection if authentication was successful
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      }).catch(error => {
        console.error('Authentication error handling failed:', error);
        // Still try to reconnect but with exponential backoff
        this.attemptReconnect();
      });
    } else if (event.code === 1006) {
      console.error('Abnormal closure (1006) - network or server issue');
      this.attemptReconnect();
    } else if (event.code === 1000) {
      // Normal closure - don't reconnect
      this.reconnectAttempts = 0;
    } else {
      console.error(`Unknown error code: ${event.code}`);
      this.attemptReconnect();
    }
    
    // Notify all connection callbacks
    this.connectionCallbacks.forEach((callback: ConnectionCallback) => {
      if (typeof callback === 'function') {
        callback(false, event.reason || 'Connection lost');
      }
    });
  }

  // Attempt to reconnect with improved logic
  private attemptReconnect(): void {
    if (this.isReconnecting) {
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      
      // Notify connection callbacks about max attempts reached
      this.connectionCallbacks.forEach((callback: ConnectionCallback) => {
        if (typeof callback === 'function') {
          callback(false, new Error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`));
        }
      });
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s
    const backoffDelay: number = Math.min(this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1), 80000);
    
    setTimeout(async () => {
      try {
        // For authentication errors, try to refresh token before reconnecting
        if (this.lastErrorCode === 1011) {
          const tokenResult: TokenResult = await this.ensureValidToken();
          if (!tokenResult.success) {
            console.error('Token refresh failed, skipping reconnection');
            this.isReconnecting = false;
            return;
          }
        }
        
        await this.connect();
      } catch (error: any) {
        console.error('Reconnection attempt failed:', error);
      } finally {
        this.isReconnecting = false;
      }
    }, backoffDelay);
  }

  // Message arrived callback
  private onMessageArrived(event: MessageEvent): void {
    try {
      const payload: MessagePayload = JSON.parse(event.data);
      
      // Enhanced topic-based logging
      if (payload.topic) {
        if (payload.topic.includes('-bot')) {
          loadingAnimation.hide();
        }
      }
      
      // Hide loading animation when we receive a bot message
      if (payload.topic && payload.topic.includes('-bot')) {
        loadingAnimation.hide();
      }
      
      // Check if this is an authentication error
      if (payload.type === 'error' && payload.message) {
        console.error(`❌ [MESSAGE DEBUG] Server error message:`, payload.message);
        loadingAnimation.hide(); // Hide animation on error
        
        if (payload.message.includes('Authentication') || payload.message.includes('token')) {
          console.error(`❌ [AUTH DEBUG] Authentication error detected. Token might be invalid or expired.`);
          
          // Try to refresh token if it's an authentication error
          if (payload.message.includes('Authentication token required')) {
            this.handleAuthenticationError();
          }
        }
      }
      
      // Check if this is an authentication success
      if (payload.type === 'auth_success' || payload.type === 'connected') {
        this.isAuthenticated = true;
      }
      
      // Check for subscription-related messages
      if (payload.type === 'subscription_error') {
        console.error(`❌ [SUBSCRIPTION DEBUG] Subscription error for topic: ${payload.topic}`, payload.message);
      }
      
      // Handle processing status messages
      if (payload.type === 'processing_status') {
        console.log('⚙️ [CHAT DEBUG] Processing status message received:', {
          status: payload.status,
          user_id: payload.user_id,
          timestamp: payload.timestamp
        });
        
        // Hide loading animation when processing is completed
        if (payload.status === 'completed') {
          console.log('✅ [CHAT DEBUG] Processing completed, hiding loading animation');
          loadingAnimation.hide();
        }
      }
      
      // Handle AI responses (main bot responses)
      if (payload.type === 'ai_response') {
        console.log('🤖 [CHAT DEBUG] AI response received:', {
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
          console.log('✅ [CHAT DEBUG] AI response content found, hiding loading animation');
          // Hide loading animation when AI response is received
          loadingAnimation.hide();
        } else {
          console.error('❌ [CHAT DEBUG] AI response received but no content found:', payload);
        }
      }
      
      // Handle user message confirmations
      if (payload.type === 'user_message') {
        console.log('✅ [CHAT DEBUG] User message confirmed:', {
          content: payload.content,
          status: payload.status,
          message_id: payload.message_id
        });
      }
      
      // Handle connection established
      if (payload.type === 'connection_established') {
        console.log('🔗 [CHAT DEBUG] WebSocket connection established:', {
          user_id: payload.user_id,
          ai_status: payload.ai_status,
          kafka_topics: payload.kafka_topics
        });
      }
      
      // Notify all message callbacks with correct parameters
      this.messageCallbacks.forEach((callback: MessageCallback, index: number) => {
        if (typeof callback === 'function') {
          try {
            // Fix: Pass both topic and payload parameters to match App.js callback signature
            const topic: string = payload.topic || 'default';
            callback(topic, payload);
          } catch (error: any) {
            console.error(`Message callback ${index + 1} failed:`, error);
          }
        }
      });
      
    } catch (error: any) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  // Setup user-specific subscriptions
  private async setupUserSubscriptions(): Promise<void> {
    try {
      let deviceId: string | null = await AuthService.getSecureItem('device_id');
      
      if (deviceId) {
        // Subscribe to user-specific topics
        const chatUserTopic: string = `chat-${deviceId}-user`;
        const chatBotTopic: string = `chat-${deviceId}-bot`;
        const notificationTopic: string = `notifications-${deviceId}`;
        
        // Subscribe to chat topics
        this.subscribe(chatUserTopic);
        this.subscribe(chatBotTopic);
        
        // Subscribe to notification topic
        this.subscribe(notificationTopic);
        
      } else {
        console.warn(`⚠️ [SUBSCRIPTION DEBUG] No user ID available, skipping subscription setup`);
      }
    } catch (error: any) {
      console.error(`❌ [SUBSCRIPTION DEBUG] Error setting up user subscriptions:`, error);
    }
  }

  // Add message callback
  public onMessage(callback: MessageCallback): void {
    if (typeof callback === 'function') {
      this.messageCallbacks.push(callback);
    }
  }

  // Add connection status callback
  public onConnectionStatus(callback: ConnectionCallback): void {
    if (typeof callback === 'function') {
      this.connectionCallbacks.push(callback);
    }
  }

  // Remove message callback
  public removeMessageCallback(callback: MessageCallback): void {
    const index: number = this.messageCallbacks.indexOf(callback);
    if (index > -1) {
      this.messageCallbacks.splice(index, 1);
    }
  }

  // Remove connection callback
  public removeConnectionCallback(callback: ConnectionCallback): void {
    const index: number = this.connectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.connectionCallbacks.splice(index, 1);
    }
  }

  // Handle authentication errors
  private async handleAuthenticationError(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to ensure we have a valid token (this will attempt refresh if needed)
      const tokenResult: TokenResult = await this.ensureValidToken();
      if (tokenResult.success) {
        // Reset reconnection attempts since we have a fresh token
        this.reconnectAttempts = 0;
        this.lastErrorCode = null;
        this.lastErrorReason = null;
        
        // Disconnect and reconnect with new token
        this.disconnect();
        setTimeout(() => {
          this.connect();
        }, 1000);
        
        return { success: true };
      } else {
        console.error('❌ [AUTH DEBUG] Failed to ensure valid token:', tokenResult.error);
        
        // If we can't get a valid token, stop reconnection attempts
        this.reconnectAttempts = this.maxReconnectAttempts;
        
        // Notify connection callbacks about authentication failure
        this.connectionCallbacks.forEach((callback: ConnectionCallback) => {
          if (typeof callback === 'function') {
            callback(false, new Error('Authentication failed: ' + tokenResult.error));
          }
        });
        
        return { success: false, error: tokenResult.error };
      }
    } catch (error: any) {
      console.error('❌ [AUTH DEBUG] Error handling authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  // Reset reconnection state (useful for manual reconnection)
  public resetReconnectionState(): void {
    this.reconnectAttempts = 0;
    this.lastErrorCode = null;
    this.lastErrorReason = null;
    this.isReconnecting = false;
  }

  // Helper to validate token format
  private isValidTokenFormat(token: string): boolean {
    if (!token) return false;
    const parts: string[] = token.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload: any = JSON.parse(atob(parts[1]));
      // Basic check for payload structure
      if (typeof payload === 'object' && payload !== null && 'exp' in payload) {
        return true;
      }
    } catch (e) {
      console.warn('Could not parse token payload for format check:', e);
    }
    return false;
  }

  // Add method to manually hide loading animation (useful for error handling)
  public hideLoadingAnimation(): void {
    loadingAnimation.hide();
  }

  // Public method to check and refresh token if needed
  public async checkAndRefreshToken(): Promise<TokenResult> {
    try {
      const tokenResult: TokenResult = await this.ensureValidToken();
      if (tokenResult.success) {
        return {
          success: true,
          token: tokenResult.token
        };
      } else {
        console.error('❌ [TOKEN DEBUG] Token validation failed:', tokenResult.error);
        return {
          success: false,
          error: tokenResult.error
        };
      }
    } catch (error: any) {
      console.error('❌ [TOKEN DEBUG] Error checking token:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Public method to force reconnection with fresh token
  public async forceReconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      // Reset reconnection state
      this.resetReconnectionState();
      
      // Ensure we have a valid token
      const tokenResult: TokenResult = await this.ensureValidToken();
      if (!tokenResult.success) {
        console.error('❌ [FORCE RECONNECT] Failed to get valid token:', tokenResult.error);
        return {
          success: false,
          error: tokenResult.error
        };
      }
      
      // Disconnect current connection
      this.disconnect();
      
      // Wait a moment then reconnect
      setTimeout(async () => {
        try {
          const connected: boolean = await this.connect();
          if (connected) {
            // Reconnection successful
          } else {
            console.error('❌ [FORCE RECONNECT] Reconnection failed');
          }
        } catch (error: any) {
          console.error('❌ [FORCE RECONNECT] Error during reconnection:', error);
        }
      }, 1000);
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ [FORCE RECONNECT] Error in force reconnect:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new ChatService();
