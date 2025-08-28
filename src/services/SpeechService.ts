import { Capacitor } from '@capacitor/core';
import { SpeechRecognition, AudioSessionCategory } from '@capawesome-team/capacitor-speech-recognition';

// Type definitions based on Capawesome plugin
interface StartListeningOptions {
  language?: string;
  silenceThreshold?: number;
  contextualStrings?: string[];
  enableFormatting?: boolean;
  audioSessionCategory?: AudioSessionCategory;
  deactivateAudioSessionOnStop?: boolean;
}

interface GetLanguagesResult {
  languages: string[];
}

interface IsAvailableResult {
  isAvailable: boolean;
}

interface IsListeningResult {
  isListening: boolean;
}

interface ErrorEvent {
  message: string;
}

interface PartialResultEvent {
  result: string;
}

interface ResultEvent {
  result: string;
}

interface PluginListenerHandle {
  remove: () => Promise<void>;
}

// Language mapping for speech recognition
const LANGUAGE_MAPPING: { [key: string]: string } = {
  'en': 'en-US',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'tr': 'tr-TR',
  'uk': 'uk-UA',
  'ja': 'ja-JP',
  'hi': 'hi-IN',
  'bn': 'bn-IN',
  'ml': 'ml-IN',
  'ta': 'ta-IN',
  'kn': 'kn-IN',
  'pa': 'pa-IN',
  'as': 'as-IN',
  'ne': 'ne-NP',
  'sa': 'sa-IN',
  'mai': 'mai-IN',
  'ur': 'ur-PK',
  'th': 'th-TH',
  'ru': 'ru-RU',
  'ko': 'ko-KR',
  'te': 'te-IN',
  'or': 'or-IN',
  'mr': 'mr-IN',
  'gu': 'gu-IN',
  'brx': 'brx-IN',
  'ks': 'ks-IN',
  'mni': 'mni-IN',
  'gom': 'gom-IN',
  'si': 'si-LK',
  'sd': 'sd-PK',
  'pt': 'pt-BR',
  'he': 'he-IL',
  'el': 'el-GR',
  'pl': 'pl-PL',
  'zh': 'zh-CN'
};

export class SpeechRecognitionService {
  private isListening = false;
  private customListeners: Map<string, Function[]> = new Map();
  private userStopped = false;
  private lastSpeechTime = 0;
  private autoRestart = true;
  private sessionEndTimer: number | null = null;
  private keepAliveTimer: number | null = null;
  private keepAliveInterval: number | null = null;
  private keepAliveMode = false;
  private silenceTimer: number | null = null;
  
  // Platform detection
  private isNative = Capacitor.isNativePlatform();
  private isWeb = Capacitor.getPlatform() === 'web';
  
  // Web Speech API fallback
  private webSpeechRecognition: any = null;
  private currentLanguage = 'en-US';
  
  // Capawesome plugin listeners
  private pluginListeners: PluginListenerHandle[] = [];
  
  // Performance optimization: Reuse objects to reduce GC pressure
  private readonly eventData = { result: '' };
  private readonly partialEventData = { result: '' };
  private readonly errorEventData = { message: '' };
  
  // Performance monitoring
  private performanceMetrics = {
    startTime: 0,
    resultCount: 0,
    partialResultCount: 0,
    errorCount: 0,
    platform: 'unknown'
  };

  // Get language from localStorage
  private getLanguageFromStorage(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedLanguage = localStorage.getItem('language') || localStorage.getItem('lang') || 'en';
        return this.mapLanguageCode(storedLanguage);
      }
    } catch (error) {
      console.warn('Failed to read language from localStorage:', error);
    }
    return 'en-US'; // Default fallback
  }

  // Map language code to speech recognition format
  private mapLanguageCode(langCode: string): string {
    const normalizedCode = langCode.toLowerCase().trim();
    return LANGUAGE_MAPPING[normalizedCode] || 'en-US';
  }

  // Get current language for speech recognition
  private getCurrentLanguage(): string {
    return this.getLanguageFromStorage();
  }

  async initialize(): Promise<void> {
    // console.log('🎤 Initializing speech recognition service...');
    
    try {
      // Set current language from localStorage
      this.currentLanguage = this.getCurrentLanguage();
      // console.log('🌍 Detected language from localStorage:', this.currentLanguage);
      
      if (this.isNative) {
        try {
          await this.initializeCapawesomePlugin();
        } catch (nativeError) {
          console.warn('⚠️ Native speech recognition failed, falling back to Web Speech API:', nativeError);
          
          // Fallback to Web Speech API if native fails
          if (this.isWeb) {
            // console.log('🔄 Attempting Web Speech API fallback...');
            await this.initializeWebSpeechAPI();
          } else {
            throw nativeError;
          }
        }
      } else if (this.isWeb) {
        await this.initializeWebSpeechAPI();
      } else {
        throw new Error('Unsupported platform for speech recognition');
      }
      
      this.performanceMetrics.platform = this.isNative ? 'native' : 'web';
      // console.log('🎤 Speech recognition service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize speech recognition:', error);
      throw error;
    }
  }

  private async initializeCapawesomePlugin(): Promise<void> {
    // console.log('🎤 Initializing Capawesome Speech Recognition plugin...');
    
    // Check if speech recognition is available
    const availability = await SpeechRecognition.isAvailable();
    if (!availability.isAvailable) {
      throw new Error('Speech recognition not available on this device');
    }
    
    // Check permissions with better error handling
    try {
      const permissions = await SpeechRecognition.checkPermissions();
      // console.log('🔐 Current permissions:', permissions);
      
      // Check if we need to request permissions
      const needsAudioRecording = permissions.audioRecording !== 'granted';
      const needsSpeechRecognition = permissions.speechRecognition !== 'granted';
      
      if (needsAudioRecording || needsSpeechRecognition) {
        // console.log('🔐 Requesting speech recognition permissions...');
        
        try {
          const permissionResult = await SpeechRecognition.requestPermissions({
            permissions: ['audioRecording', 'speechRecognition']
          });
          
          // console.log('🔐 Permission result:', permissionResult);
          
          // Check if permissions were granted
          const audioGranted = permissionResult.audioRecording === 'granted';
          const speechGranted = permissionResult.speechRecognition === 'granted';
          
          if (!audioGranted || !speechGranted) {
            console.warn('⚠️ Some permissions were not granted:', {
              audioRecording: permissionResult.audioRecording,
              speechRecognition: permissionResult.speechRecognition
            });
            
            // Try to continue with partial permissions
            if (audioGranted) {
              // console.log('✅ Audio recording permission granted, proceeding...');
            } else {
              throw new Error(`Audio recording permission denied: ${permissionResult.audioRecording}`);
            }
          } else {
            // console.log('✅ All permissions granted successfully');
          }
        } catch (permissionError) {
          console.error('❌ Permission request failed:', permissionError);
          
          // Try to check if we can proceed with existing permissions
          const currentPermissions = await SpeechRecognition.checkPermissions();
          if (currentPermissions.audioRecording === 'granted') {
            // console.log('✅ Audio recording permission available, proceeding...');
          } else {
            const errorMessage = permissionError instanceof Error ? permissionError.message : 'Unknown permission error';
            throw new Error(`Permission request failed: ${errorMessage}`);
          }
        }
      } else {
        // console.log('✅ All required permissions already granted');
      }
    } catch (permissionError) {
      console.error('❌ Permission check failed:', permissionError);
      
      // Try to proceed anyway - some devices might work without explicit permission checks
      // console.log('🔄 Attempting to proceed without explicit permission verification...');
    }
    
    // Set up event listeners for Capawesome plugin
    await this.setupCapawesomeListeners();
    
    // console.log('✅ Capawesome Speech Recognition plugin initialized');
  }

  private async setupCapawesomeListeners(): Promise<void> {
    // Start event
    const startListener = await SpeechRecognition.addListener('start', () => {
      // console.log('🎤 Capawesome: Started listening...');
      this.isListening = true;
      this.userStopped = false;
      this.lastSpeechTime = Date.now();
      this.performanceMetrics.startTime = Date.now();
      this.startSilenceTimer();
      this.emitCustomEvent('start');
    });
    this.pluginListeners.push(startListener);

    // End event
    const endListener = await SpeechRecognition.addListener('end', () => {
      // console.log('🛑 Capawesome: Session ended');
      this.isListening = false;
      this.keepAliveMode = false;
      this.clearAllTimers();
      this.emitCustomEvent('end');
      this.logPerformanceMetrics();
    });
    this.pluginListeners.push(endListener);

    // Speech start event
    const speechStartListener = await SpeechRecognition.addListener('speechStart', () => {
      // console.log('🗣️ Capawesome: User started speaking');
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();
      this.emitCustomEvent('speechStart');
    });
    this.pluginListeners.push(speechStartListener);

    // Speech end event
    const speechEndListener = await SpeechRecognition.addListener('speechEnd', () => {
      // console.log('🔇 Capawesome: User stopped speaking');
      this.emitCustomEvent('speechEnd');
      
      if (!this.userStopped) {
        this.startKeepAliveMode();
      }
    });
    this.pluginListeners.push(speechEndListener);

    // Partial result event
    const partialResultListener = await SpeechRecognition.addListener('partialResult', (event: PartialResultEvent) => {
      this.performanceMetrics.partialResultCount++;
      // console.log('🔄 Capawesome: Partial result:', event.result);
      
      this.partialEventData.result = event.result;
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();
      this.emitCustomEvent('partialResult', this.partialEventData);
    });
    this.pluginListeners.push(partialResultListener);

    // Final result event
    const resultListener = await SpeechRecognition.addListener('result', (event: ResultEvent) => {
      this.performanceMetrics.resultCount++;
      // console.log('✅ Capawesome: Final result:', event.result);
      
      this.eventData.result = event.result;
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();
      this.onResult(event.result);
      this.emitCustomEvent('result', this.eventData);
    });
    this.pluginListeners.push(resultListener);

    // Error event
    const errorListener = await SpeechRecognition.addListener('error', (event: ErrorEvent) => {
      this.performanceMetrics.errorCount++;
      console.error('❌ Capawesome: Error:', event.message);
      
      this.errorEventData.message = event.message;
      this.isListening = false;
      this.clearAllTimers();
      this.emitCustomEvent('error', this.errorEventData);
      
      if (this.autoRestart && !this.userStopped) {
        this.scheduleRestart(1000);
      }
    });
    this.pluginListeners.push(errorListener);
  }

  private async initializeWebSpeechAPI(): Promise<void> {
    // console.log('🎤 Initializing Web Speech API fallback...');
    
    // Check if we're on HTTPS (required for speech recognition in some browsers)
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.warn('⚠️ Speech recognition may not work on HTTP. HTTPS is recommended.');
    }
    
    // Check if Web Speech API is available
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // console.log('✅ Web Speech API available');
      this.setupWebSpeechAPI();
    } else if (typeof window !== 'undefined' && 'SpeechRecognition' in window) {
      // console.log('✅ Standard Speech API available');
      this.setupWebSpeechAPI();
    } else {
      throw new Error('Speech recognition not available in this browser');
    }
  }

  private setupWebSpeechAPI(): void {
    // Use webkitSpeechRecognition for better browser support
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported');
    }

    this.webSpeechRecognition = new SpeechRecognition();
    
    // Configure the recognition with optimized settings
    this.webSpeechRecognition.continuous = true;
    this.webSpeechRecognition.interimResults = true;
    this.webSpeechRecognition.maxAlternatives = 1;
    this.webSpeechRecognition.lang = this.currentLanguage;
    
    // Performance optimization: Use more efficient language detection
    this.webSpeechRecognition.grammars = null; // Disable grammars for better performance
    
    // console.log('🎤 Web Speech API Configuration:', {
    //   continuous: this.webSpeechRecognition.continuous,
    //   interimResults: this.webSpeechRecognition.interimResults,
    //   maxAlternatives: this.webSpeechRecognition.maxAlternatives,
    //   lang: this.webSpeechRecognition.lang
    // });

    // Optimized event listeners with reduced function allocations
    this.setupOptimizedEventListeners();
  }

  private setupOptimizedEventListeners(): void {
    // Use arrow functions to maintain context and reduce memory allocations
    this.webSpeechRecognition.onstart = () => {
      // console.log('🎤 Web Speech API: Started listening...');
      this.isListening = true;
      this.userStopped = false;
      this.lastSpeechTime = Date.now();
      this.performanceMetrics.startTime = Date.now();
      this.startSilenceTimer();
      this.emitCustomEvent('start');
    };

    // Optimized result handler with reduced object allocations
    this.webSpeechRecognition.onresult = (event: any) => {
      this.performanceMetrics.resultCount++;
      
      let finalTranscript = '';
      let interimTranscript = '';

      // Optimized loop with early exit
      const resultsLength = event.results.length;
      for (let i = event.resultIndex; i < resultsLength; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Handle partial results with reused object
      if (interimTranscript.trim()) {
        this.performanceMetrics.partialResultCount++;
        this.partialEventData.result = interimTranscript;
        this.lastSpeechTime = Date.now();
        this.resetSilenceTimer();
        this.emitCustomEvent('partialResult', this.partialEventData);
      }

      // Handle final results with reused object
      if (finalTranscript.trim()) {
        this.eventData.result = finalTranscript;
        this.lastSpeechTime = Date.now();
        this.resetSilenceTimer();
        this.onResult(finalTranscript);
        this.emitCustomEvent('result', this.eventData);
      }
    };

    this.webSpeechRecognition.onspeechstart = () => {
      this.lastSpeechTime = Date.now();
      this.resetSilenceTimer();
      this.emitCustomEvent('speechStart');
    };

    this.webSpeechRecognition.onspeechend = () => {
      this.emitCustomEvent('speechEnd');
      
      if (!this.userStopped) {
        this.startKeepAliveMode();
      }
    };

    // Optimized error handler
    this.webSpeechRecognition.onerror = (event: any) => {
      this.performanceMetrics.errorCount++;
      console.error('❌ Web Speech API Error:', event.error);
      
      this.errorEventData.message = event.error;
      this.isListening = false;
      this.clearAllTimers();
      this.emitCustomEvent('error', this.errorEventData);
      
      if (this.autoRestart && !this.userStopped) {
        this.scheduleRestart(1000);
      }
    };

    this.webSpeechRecognition.onend = () => {
      // console.log('🛑 Web Speech API: Session ended');
      this.isListening = false;
      this.keepAliveMode = false;
      this.clearAllTimers();
      this.emitCustomEvent('end');
      
      // Log performance metrics
      this.logPerformanceMetrics();
    };
  }

  // Capawesome plugin methods
  async getLanguages(): Promise<GetLanguagesResult> {
    if (this.isNative) {
      const availableLanguages = await SpeechRecognition.getLanguages();
      
      // Get current language from localStorage
      const currentLanguage = this.getCurrentLanguage();
      
      // Return only the current language if it's available, otherwise return all available
      if (availableLanguages.languages.includes(currentLanguage)) {
        return { languages: [currentLanguage] };
      } else {
        // If current language not available, return all available languages
        return availableLanguages;
      }
    } else {
      // Web Speech API - return current language from localStorage
      const currentLanguage = this.getCurrentLanguage();
      return { languages: [currentLanguage] };
    }
  }

  async isAvailable(): Promise<IsAvailableResult> {
    if (this.isNative) {
      return await SpeechRecognition.isAvailable();
    } else {
      return {
        isAvailable: !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition
      };
    }
  }

  async getListeningStatus(): Promise<IsListeningResult> {
    if (this.isNative) {
      return await SpeechRecognition.isListening();
    } else {
      return { isListening: this.isListening };
    }
  }

  async checkPermissions(): Promise<any> {
    if (this.isNative) {
      return await SpeechRecognition.checkPermissions();
    } else {
      // Web Speech API permissions are handled differently
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return {
          audioRecording: 'granted',
          recordAudio: 'granted',
          speechRecognition: 'granted'
        };
      } catch (error) {
        return {
          audioRecording: 'denied',
          recordAudio: 'denied',
          speechRecognition: 'denied'
        };
      }
    }
  }

  async requestPermissions(): Promise<any> {
    if (this.isNative) {
      return await SpeechRecognition.requestPermissions({
        permissions: ['audioRecording', 'speechRecognition']
      });
    } else {
      // For web, we can only request microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return {
          audioRecording: 'granted',
          recordAudio: 'granted',
          speechRecognition: 'granted'
        };
      } catch (error) {
        return {
          audioRecording: 'denied',
          recordAudio: 'denied',
          speechRecognition: 'denied'
        };
      }
    }
  }

  private startKeepAliveMode(): void {
    this.keepAliveMode = true;
    this.clearSessionEndTimer();
    this.clearKeepAliveTimers();
    
    // Use window.setTimeout for better performance
    this.sessionEndTimer = window.setTimeout(async () => {
      if (this.isListening && !this.userStopped && this.keepAliveMode) {
        this.keepAliveMode = false;
        await this.stopListening();
      }
    }, 3 * 60 * 1000);
    
    this.keepAliveInterval = window.setInterval(() => {
      if (this.isListening && !this.userStopped && this.keepAliveMode) {
        this.emitCustomEvent('keepAlive');
      } else {
        this.clearKeepAliveTimers();
      }
    }, 10000);
  }

  private clearKeepAliveTimers(): void {
    if (this.keepAliveInterval !== null) {
      window.clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.keepAliveTimer !== null) {
      window.clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    this.keepAliveMode = false;
  }

  private clearSessionEndTimer(): void {
    if (this.sessionEndTimer !== null) {
      window.clearTimeout(this.sessionEndTimer);
      this.sessionEndTimer = null;
    }
  }

  private scheduleRestart(delay = 500): void {
    window.setTimeout(async () => {
      if (this.autoRestart && !this.isListening && !this.userStopped) {
        try {
          await this.startListening(this.currentLanguage);
        } catch (error) {
          console.error('Failed to auto-restart:', error);
        }
      }
    }, delay);
  }

  private startSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = window.setTimeout(async () => {
      if (this.isListening && !this.userStopped) {
        this.userStopped = true;
        this.autoRestart = false;
        await this.stopListening();
      }
    }, 3 * 60 * 1000);
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.startSilenceTimer();
    
    if (this.keepAliveMode) {
      this.keepAliveMode = false;
      this.clearKeepAliveTimers();
    }
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  // Optimized timer clearing method
  private clearAllTimers(): void {
    this.clearSilenceTimer();
    this.clearSessionEndTimer();
    this.clearKeepAliveTimers();
  }

  async startListening(language?: string, options: StartListeningOptions = {}): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      // Use provided language or get from localStorage
      const targetLanguage = language || this.getCurrentLanguage();
      this.currentLanguage = targetLanguage;
      
      // console.log('🌍 Starting speech recognition with language:', targetLanguage);
      
      if (this.isNative) {
        // Use Capawesome plugin with full options support
        const startOptions = {
          language: targetLanguage,
          silenceThreshold: options.silenceThreshold || 2000,
          contextualStrings: options.contextualStrings || [],
          enableFormatting: options.enableFormatting || false,
          audioSessionCategory: options.audioSessionCategory || AudioSessionCategory.Record,
          deactivateAudioSessionOnStop: options.deactivateAudioSessionOnStop !== false
        };
        
        // console.log('🎤 Starting Capawesome speech recognition with options:', startOptions);
        await SpeechRecognition.startListening(startOptions);
        
      } else if (this.webSpeechRecognition) {
        // Web Speech API fallback
        this.webSpeechRecognition.lang = targetLanguage;
        
        // Use requestAnimationFrame for better performance timing
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            this.webSpeechRecognition.start();
            resolve();
          });
        });
        
        // console.log('✅ Web Speech API started successfully');
        
        // Performance monitoring
        setTimeout(() => {
          if (this.isListening) {
            // console.log('🎤 Still listening after 2 seconds - speech recognition is active');
          } else {
            console.warn('⚠️ Speech recognition stopped unexpectedly within 2 seconds');
          }
        }, 2000);
        
      } else {
        throw new Error('Speech recognition not initialized');
      }
    } catch (error) {
      console.error('Failed to start listening:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    this.userStopped = true;
    this.autoRestart = false;
    this.keepAliveMode = false;
    
    this.clearAllTimers();
    this.emitCustomEvent('userStop');

    try {
      if (this.isNative) {
        await SpeechRecognition.stopListening();
      } else if (this.webSpeechRecognition) {
        this.webSpeechRecognition.stop();
      }
    } catch (error) {
      console.error('Failed to stop listening:', error);
      throw error;
    }
  }

  onResult(result: string): void {
    // console.log('Processed result:', result);
  }

  addCustomListener(event: string, callback: Function): void {
    if (!this.customListeners.has(event)) {
      this.customListeners.set(event, []);
    }
    this.customListeners.get(event)!.push(callback);
  }

  // Optimized event emission with reduced allocations
  private emitCustomEvent(event: string, data?: any): void {
    const listeners = this.customListeners.get(event);
    if (listeners && listeners.length > 0) {
      // Use for...of for better performance with large listener arrays
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  // Performance monitoring
  private logPerformanceMetrics(): void {
    const sessionDuration = Date.now() - this.performanceMetrics.startTime;
    // console.log('📊 Performance Metrics:', {
    //   platform: this.performanceMetrics.platform,
    //   sessionDuration: `${sessionDuration}ms`,
    //   resultsProcessed: this.performanceMetrics.resultCount,
    //   partialResults: this.performanceMetrics.partialResultCount,
    //   errors: this.performanceMetrics.errorCount,
    //   avgResultTime: this.performanceMetrics.resultCount > 0 
    //     ? `${sessionDuration / this.performanceMetrics.resultCount}ms` 
    //     : 'N/A'
    // });
  }

  // Get performance metrics for external monitoring
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  // Get current language code
  getCurrentLanguageCode(): string {
    return this.currentLanguage;
  }

  // Check if service is initialized
  isInitialized(): boolean {
    return this.isNative ? this.pluginListeners.length > 0 : this.webSpeechRecognition !== null;
  }

  // Get initialization status with details
  getInitializationStatus(): { initialized: boolean; platform: string; error?: string } {
    return {
      initialized: this.isInitialized(),
      platform: this.performanceMetrics.platform,
      error: this.performanceMetrics.errorCount > 0 ? 'Service encountered errors' : undefined
    };
  }

  // Update language from localStorage (useful when user changes language)
  updateLanguageFromStorage(): void {
    const newLanguage = this.getCurrentLanguage();
    if (newLanguage !== this.currentLanguage) {
      // console.log('🌍 Language changed from', this.currentLanguage, 'to', newLanguage);
      this.currentLanguage = newLanguage;
      
      // Update Web Speech API language if active
      if (this.webSpeechRecognition) {
        this.webSpeechRecognition.lang = newLanguage;
      }
    }
  }

  async cleanup(): Promise<void> {
    this.clearAllTimers();
    
    // Remove all Capawesome plugin listeners
    for (const listener of this.pluginListeners) {
      try {
        await listener.remove();
      } catch (error) {
        console.error('Error removing plugin listener:', error);
      }
    }
    this.pluginListeners = [];
    
    if (this.webSpeechRecognition) {
      try {
        this.webSpeechRecognition.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
    
    // Clear all listeners to prevent memory leaks
    this.customListeners.clear();
    
    // Reset performance metrics
    this.performanceMetrics = {
      startTime: 0,
      resultCount: 0,
      partialResultCount: 0,
      errorCount: 0,
      platform: 'unknown'
    };
  }
}