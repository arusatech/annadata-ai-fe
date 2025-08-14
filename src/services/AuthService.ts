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
    console.log('AuthService - apiBaseUrl:', this.apiBaseUrl);
    console.log('AuthService - config:', config);
    console.log('AuthService - Environment check:', {
      isDevelopment: config === ENV.development,
      isStaging: config === ENV.staging,
      isProduction: config === ENV.production
    });
    this.authCallbacks = [];
    this.tokenRefreshTimer = null;
    this.initializeSecureStorage();
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
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
        }),
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
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
        }),
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
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
        }),
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
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
        }),
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
      
      // Attempt to initialize JWT again
      const result = await this.initializeJWT();
      
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
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }),
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
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }),
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

  // Initialize JWT on app startup
  async initializeJWT(): Promise<AuthResponse> {
    try {
      console.log('Initializing JWT authentication...');
      console.log('Using API Base URL:', this.apiBaseUrl);
      
      // Get device ID
      const { getDeviceId } = await import('./DeviceInfoService.js');
      const deviceId = await getDeviceId();

      await this.setSecureItem('device_id', deviceId);

      const { getFullDeviceInfo } = await import('./DeviceInfoService.js');
      const deviceDetails = await getFullDeviceInfo();
      await this.setSecureItem('device_details', JSON.stringify(deviceDetails));
      
      // Get cached user_id if available
      const cachedUserId = await this.getSecureItem('user_id');
      
      // Check if device_id is null (should work offline)
      if (!deviceId) {
        console.log('Device ID is null, working offline mode');
        return await this.handleOfflineMode();
      }
      
      // Check if API base URL is accessible
      if (!this.apiBaseUrl || this.apiBaseUrl === '') {
        console.log('No API base URL configured, working offline mode');
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
      
      console.log('Attempting to connect to:', `${this.apiBaseUrl}/auth/initialize`);
      
      // Send device_id and user_id to server to check if user exists
      const response = await fetch(`${this.apiBaseUrl}/auth/initialize`, {
        method: 'POST',
        headers: SecurityService.addSecurityHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.log('Server error during initialization:', data);
        // Server error - work offline
        return await this.handleOfflineMode();
      }

      await this.setSecureItem('jwt_token', data.token);
      await this.setSecureItem('user_id', data.user_id);
      await this.setSecureItem('device_id', data.device_id);
      await this.setSecureItem('expires_in', (currentTime + 3600).toString());

      if (!data.token) {
        return await this.handleOfflineMode();
      }
      
      if (!SecurityService.validateJWTFormat(data.token)) {
        console.error('Invalid JWT token format:', data.token);
        return {
          success: false,
          userExists: false,
          message: 'Invalid JWT token format received from server'
        };
      }

      if (data.user_id) {
        return {
          success: true,
          userExists: true,
          token: data.token,
          userId: data.user_id,
          message: 'User authenticated successfully'
        };
      } else {
        console.log('User does not exist');
        return {
          success: true,
          userExists: false,
          token: data.token,
          message: 'User needs to register'
        };
      }
    } catch (error) {
      // Improved error handling with more specific messages
      if ((error as Error).name === 'TypeError' && (error as Error).message.includes('Failed to fetch')) {
        console.log('Network connection unavailable - switching to offline mode');
        console.log('Error details:', (error as Error).message);
        return await this.handleOfflineMode();
      } else if ((error as Error).name === 'TypeError' && (error as Error).message.includes('ERR_NAME_NOT_RESOLVED')) {
        console.log('Domain resolution failed - switching to offline mode');
        console.log('Domain not accessible:', this.apiBaseUrl);
        return await this.handleOfflineMode();
      } else {
        console.error('Unexpected error during JWT initialization:', error);
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

}

// Export a singleton instance
export default new AuthService();
