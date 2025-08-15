import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import config, { ENV } from '../config/environment';
import SecurityService from './SecurityService';

interface AuthCallback {
  (isAuthenticated: boolean): void;
}

interface TokenInfo {
  issuedAt: Date | null;
  expiresAt: Date | null;
  userId: string | null;
  issuer: string | null;
  audience: string | null;
}

// Update the AuthResponse interface to allow null for token
interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  token?: string | null; // Allow null values
  sessionId?: string;
  userExists?: boolean;
  userId?: string;
  offline?: boolean;
  data?: any;
}

interface JWTPayload {
  exp?: number;
  iat?: number;
  user_id?: string;
  sub?: string;
  iss?: string;
  aud?: string;
  [key: string]: any;
}

interface DeviceDetails {
  [key: string]: any;
}

class AuthService {
  private apiBaseUrl: string;
  private authCallbacks: AuthCallback[];
  private tokenRefreshTimer: NodeJS.Timeout | null;
  private useSecureStorage: boolean = false; // Initialize with default value

  constructor() {
    // Use environment-based configuration
    this.apiBaseUrl = config.apiBaseUrl;
    console.log('🔧 [CONFIG] AuthService - apiBaseUrl:', this.apiBaseUrl);
    console.log('🔧 [CONFIG] AuthService - config:', config);
    console.log('🔧 [CONFIG] AuthService - Environment check:', {
      isDevelopment: config === ENV.development,
      isStaging: config === ENV.staging,
      isProduction: config === ENV.production
    });
    
    console.log('🔧 [CONFIG] AuthService - Final apiBaseUrl:', this.apiBaseUrl);
    this.authCallbacks = [];
    this.tokenRefreshTimer = null;
    this.initializeSecureStorage();
    
    // Test SecurityService
    this.testSecurityService();
  }

  // Initialize secure storage for mobile platforms
  async initializeSecureStorage(): Promise<void> {
    try {
      // Check if we're in a Capacitor environment
      if (typeof Capacitor !== 'undefined') {
        this.useSecureStorage = true;
      } else {
        this.useSecureStorage = false;
      }
    } catch (error) {
      console.log('Running in web environment, using localStorage');
      this.useSecureStorage = false;
    }
  }

  // Secure storage methods
  async setSecureItem(key: string, value: string): Promise<void> {
    if (this.useSecureStorage) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    if (this.useSecureStorage) {
      const result = await Preferences.get({ key });
      return result.value;
    } else {
      return localStorage.getItem(key);
    }
  }

  async removeSecureItem(key: string): Promise<void> {
    if (this.useSecureStorage) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getSecureItem('jwt_token');
      if (!token) return false;
      
      // Check if token is valid and not expired
      return await this.isTokenValid(token);
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  // Validate JWT token
  async isTokenValid(token: string): Promise<boolean> {
    try {
      if (!token) return false;

      // Decode JWT token to check expiration
      const payload = this.decodeJWT(token);
      if (!payload) return false;

      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        // Token is expired, try to refresh it
        const refreshResult = await this.refreshToken();
        return refreshResult.success;
      }

      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }

  // Decode JWT token (without verification - for client-side expiration check only)
  decodeJWT(token: string): JWTPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }

  // Get token expiration time
  getTokenExpiration(token: string): number | null {
    const payload = this.decodeJWT(token);
    return payload ? payload.exp || null : null;
  }

  // Refresh JWT token
  async refreshToken(): Promise<AuthResponse> {
    try {
      // Get current token to check if it's expired
      const currentToken = await this.getSecureItem('jwt_token');
      if (!currentToken) {
        throw new Error('No JWT token available');
      }

      // Get device ID for re-authentication
      const deviceId = await this.getSecureItem('device_id');
      const userId = await this.getSecureItem('user_id');
      
      if (!deviceId) {
        throw new Error('No device ID available for token refresh');
      }

      // Re-authenticate using the initialize endpoint
      const payload: { device_id: string; user_id?: string } = {
        device_id: deviceId,
      };
      
      if (userId) {
        payload.user_id = userId;
      }

      const response = await fetch(`${this.apiBaseUrl}/auth/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to refresh token');
      }

      if (!data.token) {
        throw new Error('No new token received from server');
      }

      // Store new token
      await this.setSecureItem('jwt_token', data.token);
      
      // Update user_id if provided
      if (data.user_id) {
        await this.setSecureItem('user_id', data.user_id);
      }

      // Set up automatic refresh for new token
      this.setupTokenRefresh(data.token);

      return {
        success: true,
        token: data.token,
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      // If refresh fails, logout the user
      await this.logout();
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Setup automatic token refresh
  setupTokenRefresh(token: string): void {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    const payload = this.decodeJWT(token);
    if (!payload || !payload.exp) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = (payload.exp - currentTime) * 1000; // Convert to milliseconds
    
    // Refresh token 5 minutes before expiry
    const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 60000); // At least 1 minute

    this.tokenRefreshTimer = setTimeout(async () => {
      await this.refreshToken();
    }, refreshTime);
  }

  // Get the current user ID
  async getUserId(): Promise<string | null> {
    try {
      return await this.getSecureItem('user_id');
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  // Send OTP to phone number or email
  async sendOtp(method: string, contact: string): Promise<AuthResponse> {
    try {
      // The server expects ContactInfo with user_id field
      const payload = {
        user_id: contact
      };

      console.log('Sending OTP payload:', payload);
      console.log('Method:', method);
      console.log('Contact:', contact);
      
      await this.setSecureItem('user_id', contact);

      const response = await fetch(`${this.apiBaseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      console.log('Session ID from response:', data.session_id);
      console.log('All response fields:', Object.keys(data));
      console.log('Response field values:', Object.entries(data));
      
      if (!response.ok) {
        console.error('Server error details:', data);
        throw new Error(data.detail || data.message || data.error || 'Failed to send OTP');
      }

      return {
        success: true,
        sessionId: data.session_id,
      };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Verify OTP
  async verifyOtp(username: string, user_id: string, session_id: string, otp: string): Promise<AuthResponse> {
    try {
      // Get device_details and parse it if it's a string
      let deviceDetails: string | null = await this.getSecureItem('device_details');
      let parsedDeviceDetails: DeviceDetails | null = null;

      if (deviceDetails && typeof deviceDetails === 'string') {
        try {
          parsedDeviceDetails = JSON.parse(deviceDetails) as DeviceDetails;
        } catch (parseError) {
          console.warn('Failed to parse device_details JSON:', parseError);
          parsedDeviceDetails = null;
        }
      }

      const payload = { 
        session_id: session_id,
        otp: otp,
        username: username,
        user_id: user_id,
        device_details: parsedDeviceDetails
      };
      
      console.log('Verifying OTP payload:', payload);
      

      const response = await fetch(`${this.apiBaseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Verify OTP response status:', response.status);
      const data = await response.json();
      console.log('Verify OTP response data:', data);
      
      if (!response.ok) {
        console.error('Verify OTP server error details:', data);
        throw new Error(data.detail || data.message || data.error || 'Failed to verify OTP');
      }

      // OTP verified successfully - no JWT expected here
      console.log('OTP verified successfully');
      
      return {
        success: true,
        message: data.message || 'OTP verified successfully'
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async registerUser(username: string, user_id: string, device_id: string): Promise<AuthResponse> {
    try {
      // Get device_details and parse it if it's a string
      let deviceDetails: string | null = await this.getSecureItem('device_details');
      let parsedDeviceDetails: DeviceDetails | null = null;

      if (deviceDetails && typeof deviceDetails === 'string') {
        try {
          parsedDeviceDetails = JSON.parse(deviceDetails) as DeviceDetails;
        } catch (parseError) {
          console.warn('Failed to parse device_details JSON:', parseError);
          parsedDeviceDetails = null;
        }
      }

      const payload = { 
        username: username,
        user_id: user_id,
        device_id: device_id,
        device_details: parsedDeviceDetails
      };
      
      console.log('Registering user payload:', payload);
      

      const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Register user server error details:', data);
        throw new Error(data.detail || data.message || data.error || 'Failed to verify OTP');
      }

      return {
        success: true,
        message: data.message || 'User registered successfully'
      };
    } catch (error) {
      console.error('Error registering user:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
  
  // Log out the current user
  async logout(): Promise<boolean> {
    try {
      console.log('Logging out user...');
      
      // Clear all authentication data
      await this.removeSecureItem('jwt_token');
      await this.removeSecureItem('user_id');
      await this.removeSecureItem('userVerified');
      // Note: refresh_token not used in single-token system
      
      // Clear token refresh timer
      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = null;
      }
      
      // Notify auth state change
      this.notifyAuthChange(false);
      
      return true;
    } catch (error) {
      console.error('Error during logout:', error);
      return false;
    }
  }

  // Get the authentication token
  async getToken(): Promise<string | null> {
    try {
      const token = await this.getSecureItem('jwt_token');
      if (!token) return null;

      // Check if token is valid
      if (await this.isTokenValid(token)) {
        return token;
      } else {
        // Token is invalid, try to refresh
        const refreshResult = await this.refreshToken();
        return refreshResult.success ? refreshResult.token || null : null;
      }
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Register an auth state change callback
  onAuthStateChanged(callback: AuthCallback): void {
    if (typeof callback === 'function') {
      this.authCallbacks.push(callback);
    }
  }

  // Manual trigger for JWT initialization (for testing)
  async manualInitializeJWT(): Promise<AuthResponse> {
    console.log('🔄 Manual JWT initialization triggered...');
    const result = await this.initializeJWT();
    console.log('🔄 Manual JWT initialization result:', result);
    return result;
  }

  // Retry server connection (for when server becomes available)
  async retryServerConnection(): Promise<AuthResponse> {
    console.log('🔄 Retrying server connection...');
    
    try {
      // Clear any cached offline state
      await this.removeSecureItem('offline_mode');
      
      // Attempt to initialize JWT again with retry logic
      const result = await this.initializeJWTWithRetry();
      
      if (result.success && !result.offline) {
        console.log('✅ Server connection successful!');
        return {
          success: true,
          message: 'Connected to server successfully',
          userExists: result.userExists,
          token: result.token
        };
      } else if (result.offline) {
        console.log('❌ Still in offline mode - server may not be reachable');
        return {
          success: false,
          message: 'Server not reachable - still in offline mode',
          offline: true
        };
      } else {
        console.log('❌ Server connection failed');
        return {
          success: false,
          message: 'Server connection failed',
          error: result.message
        };
      }
    } catch (error) {
      console.error('❌ Error retrying server connection:', error);
      return {
        success: false,
        message: 'Error retrying server connection',
        error: (error as Error).message
      };
    }
  }

  // Initialize JWT with retry logic and exponential backoff
  private async initializeJWTWithRetry(maxRetries: number = 3): Promise<AuthResponse> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to connect to server...`);
        
        const result = await this.initializeJWT();
        
        // If successful and not offline, return immediately
        if (result.success && !result.offline) {
          console.log(`✅ Connection successful on attempt ${attempt}`);
          return result;
        }
        
        // If offline mode, don't retry
        if (result.offline) {
          console.log(`🌐 Offline mode detected on attempt ${attempt}`);
          return result;
        }
        
        // If failed but not offline, retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Last attempt failed, switch to offline mode
          console.log('❌ All retry attempts failed, switching to offline mode');
          return await this.handleOfflineMode();
        }
      }
    }
    
    // Should not reach here, but just in case
    return await this.handleOfflineMode();
  }

  // Remove an auth state change callback
  removeAuthCallback(callback: AuthCallback): void {
    this.authCallbacks = this.authCallbacks.filter(cb => cb !== callback);
  }

  // Notify all auth callbacks
  notifyAuthChange(isAuthenticated: boolean): void {
    this.authCallbacks.forEach(callback => {
      if (typeof callback === 'function') {
        callback(isAuthenticated);
      }
    });
  }

  // Update user profile
  async updateProfile(userData: any): Promise<AuthResponse> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      // console.log('Updating profile:', userData);

      const response = await fetch(`${this.apiBaseUrl}/auth/save-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Get user profile
  async getProfile(user_id: string): Promise<AuthResponse> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.apiBaseUrl}/auth/get-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user_id,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get profile');
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Error getting profile:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // Get token information (for debugging)
  async getTokenInfo(): Promise<TokenInfo | null> {
    try {
      const token = await this.getSecureItem('jwt_token');
      if (!token) return null;

      const payload = this.decodeJWT(token);
      if (!payload) return null;

      return {
        issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
        userId: payload.user_id || payload.sub || null,
        issuer: payload.iss || null,
        audience: payload.aud || null,
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }

  // Comprehensive diagnostic method
  async runDiagnostics(): Promise<void> {
    console.log('🔍 Running comprehensive diagnostics...');
    console.log('='.repeat(50));
    
    // Environment check
    console.log('🌍 Environment Analysis:');
    console.log('  - NODE_ENV:', process.env.NODE_ENV);
    console.log('  - REACT_APP_ENV:', process.env.REACT_APP_ENV);
    console.log('  - Vite DEV:', import.meta.env?.DEV);
    console.log('  - API Base URL:', this.apiBaseUrl);
    console.log('  - Is Proxy:', this.apiBaseUrl.startsWith('/'));
    
    // Network connectivity test
    console.log('\n🌐 Network Connectivity Test:');
    try {
      const response = await fetch(this.apiBaseUrl, { method: 'HEAD' });
      console.log('  ✅ Base URL accessible:', response.status);
    } catch (error: any) {
      console.log('  ❌ Base URL not accessible:', error.message);
    }
    
    // CORS test
    console.log('\n🔒 CORS Test:');
    try {
      const testPayload = { device_id: 'diagnostic-test' };
      
      const response = await fetch(`${this.apiBaseUrl}/auth/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });
      
      console.log('  ✅ CORS test successful:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('  📄 Response data:', data);
      }
    } catch (error: any) {
      console.log('  ❌ CORS test failed:', error.message);
      
      if (error.message.includes('Failed to fetch')) {
        console.log('  💡 This is likely a CORS issue');
        console.log('  💡 Solutions:');
        console.log('     - Set REACT_APP_ENV=staging');
        console.log('     - Check Vite proxy configuration');
        console.log('     - Verify server CORS settings');
      }
    }
    
    // Device ID test
    console.log('\n📱 Device ID Test:');
    try {
      const { getDeviceId } = await import('./DeviceInfoService.js');
      const deviceId = await getDeviceId();
      console.log('  ✅ Device ID generated:', deviceId);
    } catch (error: any) {
      console.log('  ❌ Device ID generation failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🔍 Diagnostics complete');
  }

  // Manual test method for debugging (can be called from browser console)
  async manualTestConnection(): Promise<void> {
    console.log('🔧 Manual connection test started...');
    console.log('🔧 API Base URL:', this.apiBaseUrl);
    console.log('🔧 Environment:', import.meta.env?.DEV ? 'development' : 'production');
    console.log('🔧 Is Proxy:', this.apiBaseUrl.startsWith('/'));
    console.log('🔧 Target Server: staging.annadata.ai');
    
    try {
      // Test 1: Simple fetch to the base URL
      console.log('🔧 Test 1: Simple fetch to base URL...');
      const response1 = await fetch(this.apiBaseUrl, {
        method: 'HEAD'
      });
      console.log('🔧 Test 1 result:', response1.status, response1.statusText);
      
      // Test 2: Fetch to /auth/initialize with optimized configuration
      console.log('🔧 Test 2: Fetch to /auth/initialize...');
      const testPayload = { device_id: 'test-device-456' };
      
      const response2 = await fetch(`${this.apiBaseUrl}/auth/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });
      console.log('🔧 Test 2 result:', response2.status, response2.statusText);
      
      if (response2.ok) {
        const data = await response2.json();
        console.log('🔧 Test 2 data:', data);
      } else {
        const errorText = await response2.text();
        console.log('🔧 Test 2 error:', errorText);
      }
      
    } catch (error: any) {
      console.error('🔧 Manual test error:', error);
      console.log('🔧 Error name:', error.name);
      console.log('🔧 Error message:', error.message);
      console.log('🔧 Error stack:', error.stack);
      
      // Provide specific guidance based on error type
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.log('💡 CORS/Network Issue Detected!');
        console.log('💡 Solutions:');
        console.log('   1. Check if staging.annadata.ai is accessible');
        console.log('   2. Verify CORS is enabled on the server');
        console.log('   3. Check browser network tab for detailed errors');
        console.log('   4. Try using a CORS browser extension for testing');
      }
    }
  }

  // Simple test method to check network connectivity
  async testNetworkConnection(): Promise<void> {
    console.log('🧪 [TEST] Testing network connection...');
    console.log('🧪 [TEST] API Base URL:', this.apiBaseUrl);
    
    try {
      // Test 1: Simple HEAD request
      console.log('🧪 [TEST] Making HEAD request...');
      const headResponse = await fetch(this.apiBaseUrl, { method: 'HEAD' });
      console.log('🧪 [TEST] HEAD response status:', headResponse.status);
      
      // Test 2: Simple POST request with minimal payload
      console.log('🧪 [TEST] Making POST request...');
      const postResponse = await fetch(`${this.apiBaseUrl}/auth/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: 'test-123' }),
      });
      console.log('🧪 [TEST] POST response status:', postResponse.status);
      
      if (postResponse.ok) {
        const data = await postResponse.json();
        console.log('🧪 [TEST] POST response data:', data);
      } else {
        const errorText = await postResponse.text();
        console.log('🧪 [TEST] POST error response:', errorText);
      }
      
    } catch (error: any) {
      console.error('🧪 [TEST] Network test failed:', error);
      console.error('🧪 [TEST] Error name:', error.name);
      console.error('🧪 [TEST] Error message:', error.message);
    }
  }

  // Initialize JWT on app startup
  async initializeJWT(): Promise<AuthResponse> {
    try {
      console.log('🚀 [1] Initializing JWT authentication...');
      
      // Get device ID
      const { getDeviceId } = await import('./DeviceInfoService.js');
      const deviceId = await getDeviceId();
      console.log('📱 [2] Device ID:', deviceId);

      if (deviceId) {
        await this.setSecureItem('device_id', deviceId);
        console.log('💾 [3] Device ID stored');
      }

      const { getFullDeviceInfo } = await import('./DeviceInfoService.js');
      const deviceDetails = await getFullDeviceInfo();
      await this.setSecureItem('device_details', JSON.stringify(deviceDetails));
      console.log('💾 [4] Device details stored');
      
      // Get cached user_id if available
      const cachedUserId = await this.getSecureItem('user_id');
      console.log('👤 [5] Cached user_id:', cachedUserId);
      
      // Check if device_id is null (should work offline)
      if (!deviceId) {
        console.log('❌ [6] Device ID is null, working offline mode');
        return await this.handleOfflineMode();
      }
      
      // Prepare payload for /auth/initialize endpoint
      const currentTime = Math.floor(Date.now() / 1000);

      const payload: { device_id: string; user_id?: string } = {
        device_id: deviceId,
      };
      
      // Add user_id to payload if available
      if (cachedUserId) {
        payload.user_id = cachedUserId;
      }
      
      console.log('📤 [7] Attempting to connect to:', `${this.apiBaseUrl}/auth/initialize`);
      console.log('📦 [8] Request payload:', payload);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        // Send device_id and user_id to server to check if user exists
        const response = await fetch(`${this.apiBaseUrl}/auth/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('📥 [9] Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.log('❌ [11] Server error during initialization:', errorData);
          // Server error - work offline
          return await this.handleOfflineMode();
        }
        
        const data = await response.json();
        console.log('📄 [10] Response data:', data);

        await this.setSecureItem('jwt_token', data.token);
        await this.setSecureItem('user_id', data.user_id);
        if (data.device_id) {
          await this.setSecureItem('device_id', data.device_id);
        }
        await this.setSecureItem('expires_in', (currentTime + 3600).toString());
        console.log('💾 [12] All data stored successfully');

        if (!data.token) {
          console.log('❌ [13] No token received, switching to offline mode');
          return await this.handleOfflineMode();
        }
        
        if (!SecurityService.validateJWTFormat(data.token)) {
          console.error('❌ [14] Invalid JWT token format:', data.token);
          return {
            success: false,
            userExists: false,
            message: 'Invalid JWT token format received from server'
          };
        }

        if (data.user_id) {
          console.log('✅ [15] User authenticated successfully');
          return {
            success: true,
            userExists: true,
            token: data.token,
            userId: data.user_id,
            message: 'User authenticated successfully'
          };
        } else {
          console.log('📝 [16] User does not exist, needs registration');
          return {
            success: true,
            userExists: false,
            token: data.token,
            message: 'User needs to register'
          };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      console.error('❌ [ERROR] Error during JWT initialization:', error);
      console.error('❌ [ERROR] Error name:', (error as Error).name);
      console.error('❌ [ERROR] Error message:', (error as Error).message);
      
      // Improved error handling with more specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('⏰ [ERROR] Request timeout - server not responding');
          return {
            success: false,
            userExists: false,
            offline: true,
            message: 'Server connection timeout. Please check your internet connection and try again.'
          };
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.log('🌐 [ERROR] Network connection unavailable - switching to offline mode');
          return await this.handleOfflineMode();
        } else if (error.message.includes('CORS')) {
          console.log('🔒 [ERROR] CORS error - server not accessible');
          return {
            success: false,
            userExists: false,
            offline: true,
            message: 'Server access blocked. Please check your network settings.'
          };
        } else {
          console.error('❌ [ERROR] Unexpected error during JWT initialization:', error);
          return await this.handleOfflineMode();
        }
      } else {
        console.error('❌ [ERROR] Unknown error type during JWT initialization:', error);
        return await this.handleOfflineMode();
      }
    }
  }

  // Handle offline mode with cached credentials
  async handleOfflineMode(): Promise<AuthResponse> {
    try {
      // Get device ID for comparison
      const { getDeviceId } = await import('./DeviceInfoService.js');
      const deviceId = await getDeviceId();
      
      // Check if we have cached JWT for offline mode
      const cachedToken = await this.getSecureItem('jwt_token');
      const cachedUserId = await this.getSecureItem('user_id');
      const cachedDeviceId = await this.getSecureItem('device_id');
      
      if (cachedToken && cachedUserId && cachedDeviceId === deviceId) {
        console.log('Using cached JWT for offline mode');
        
        // Validate cached token
        if (await this.isTokenValid(cachedToken)) {
          // Setup automatic token refresh for cached token
          this.setupTokenRefresh(cachedToken);
          
          // Notify all auth callbacks
          this.notifyAuthChange(true);
          
          return {
            success: true,
            userExists: true,
            token: cachedToken,
            userId: cachedUserId,
            offline: true,
            message: 'Working offline with cached credentials'
          };
        } else {
          console.log('Cached token is invalid, clearing credentials');
          await this.logout();
        }
      }
      
      console.log('No valid cached credentials, working offline without authentication');
      return {
        success: true,
        userExists: false,
        token: null,
        offline: true,
        message: 'Working offline without authentication'
      };
    } catch (error) {
      console.error('Error handling offline mode:', error);
      return {
        success: true,
        userExists: false,
        token: null,
        offline: true,
        message: 'Working offline without authentication'
      };
    }
  }

  // Test SecurityService
  testSecurityService(): void {
    console.log('🔒 [SECURITY] Testing SecurityService...');
    try {
      const headers = SecurityService.addSecurityHeaders({
        'Content-Type': 'application/json',
      });
      console.log('🔒 [SECURITY] Security headers:', headers);
      
      const isValid = SecurityService.validateJWTFormat('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
      console.log('🔒 [SECURITY] JWT validation test:', isValid);
      
    } catch (error: any) {
      console.error('🔒 [SECURITY] SecurityService test failed:', error);
    }
  }

  // Check network connectivity
  async checkNetworkConnectivity(): Promise<{
    isOnline: boolean;
    serverReachable: boolean;
    error?: string;
  }> {
    try {
      console.log('🌐 Checking network connectivity...');
      
      // First check if we're online
      if (!navigator.onLine) {
        console.log('❌ Device is offline');
        return {
          isOnline: false,
          serverReachable: false,
          error: 'Device is offline'
        };
      }
      
      // Test basic internet connectivity
      try {
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        console.log('✅ Basic internet connectivity: OK');
      } catch (error) {
        console.log('❌ Basic internet connectivity: Failed');
        return {
          isOnline: true,
          serverReachable: false,
          error: 'No internet connection'
        };
      }
      
      // Test server connectivity
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${this.apiBaseUrl}/health`, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log('✅ Server connectivity: OK');
          return {
            isOnline: true,
            serverReachable: true
          };
        } else {
          console.log('❌ Server connectivity: HTTP error', response.status);
          return {
            isOnline: true,
            serverReachable: false,
            error: `Server returned HTTP ${response.status}`
          };
        }
      } catch (error) {
        console.log('❌ Server connectivity: Failed', error);
        return {
          isOnline: true,
          serverReachable: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
    } catch (error) {
      console.error('❌ Error checking network connectivity:', error);
      return {
        isOnline: false,
        serverReachable: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

}

// Export a singleton instance
export default new AuthService();
