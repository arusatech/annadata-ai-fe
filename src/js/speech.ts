import { SpeechRecognition } from '@capawesome-team/capacitor-speech-recognition';

export class SpeechRecognitionService {
  private isListening = false;
  private listeners: any[] = [];
  private customListeners: Map<string, Function[]> = new Map();
  private userStopped = false; // Track if user manually stopped
  private silenceTimer: any = null; // Timer for 3-minute silence threshold
  private lastSpeechTime: number = 0; // Track when user last spoke
  private autoRestart = true; // Auto-restart when session ends unexpectedly
  private sessionEndTimer: any = null; // Timer to delay session ending

  async initialize() {
    // Check availability
    const available = await SpeechRecognition.isAvailable();
    if (!available.isAvailable) {
      throw new Error('Speech recognition not available');
    }

    // Check permissions
    const permissions = await SpeechRecognition.checkPermissions();
    if (permissions.audioRecording !== 'granted') {
      await SpeechRecognition.requestPermissions({
        permissions: ['audioRecording', 'speechRecognition']
      });
    }

    // Setup event listeners
    await this.setupListeners();
  }

  private async setupListeners() {
    // Start event
    const startListener = await SpeechRecognition.addListener('start', () => {
      this.isListening = true;
      this.userStopped = false; // Reset user stopped flag
      this.lastSpeechTime = Date.now(); // Initialize speech time
      this.startSilenceTimer(); // Start the 3-minute timer
      console.log('🎤 Started listening...');
      this.emitCustomEvent('start');
    });

    // User speech start event
    const speechStartListener = await SpeechRecognition.addListener('speechStart', () => {
      console.log('🗣️ User started speaking...');
      this.lastSpeechTime = Date.now(); // Update last speech time
      this.resetSilenceTimer(); // Reset the 3-minute timer
      this.clearSessionEndTimer(); // Clear any pending session end
      this.emitCustomEvent('speechStart');
    });

    // Partial results
    const partialListener = await SpeechRecognition.addListener('partialResult', (event) => {
      console.log('🔄 Partial:', event.result);
      this.lastSpeechTime = Date.now(); // Update last speech time on partial results
      this.resetSilenceTimer(); // Reset the 3-minute timer
      this.clearSessionEndTimer(); // Clear any pending session end
      this.emitCustomEvent('partialResult', event);
    });

    // Final results
    const resultListener = await SpeechRecognition.addListener('result', (event) => {
      console.log('✅ Final result:', event.result);
      this.lastSpeechTime = Date.now(); // Update last speech time
      this.resetSilenceTimer(); // Reset the 3-minute timer
      this.clearSessionEndTimer(); // Clear any pending session end
      this.onResult(event.result);
      this.emitCustomEvent('result', event);
      
      // Keep the session alive - don't set isListening to false
      // The session should continue listening for more speech
    });

    // User speech end event
    const speechEndListener = await SpeechRecognition.addListener('speechEnd', () => {
      console.log('🔇 User stopped speaking');
      this.emitCustomEvent('speechEnd');
      
      // Start 3-minute timer before ending session
      this.startSessionEndTimer();
    });

    // Error handling
    const errorListener = await SpeechRecognition.addListener('error', (event) => {
      this.isListening = false;
      this.clearSilenceTimer(); // Clear silence timer on error
      this.clearSessionEndTimer(); // Clear session end timer
      console.error('❌ Error:', event.message);
      this.emitCustomEvent('error', event);
      
      // Auto-restart on error if user didn't manually stop
      if (this.autoRestart && !this.userStopped) {
        this.scheduleRestart(1000);
      }
    });

    // End event - this should only happen when user manually stops or 3-min threshold reached
    const endListener = await SpeechRecognition.addListener('end', () => {
      this.isListening = false;
      this.clearSilenceTimer(); // Clear silence timer
      this.clearSessionEndTimer(); // Clear session end timer
      console.log('🛑 Stopped listening');
      this.emitCustomEvent('end');
      
      // Auto-restart if user didn't manually stop and we haven't reached 3-min threshold
      if (this.autoRestart && !this.userStopped) {
        const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
        const threeMinutes = 3 * 60 * 1000;
        
        if (timeSinceLastSpeech < threeMinutes) {
          console.log('🔄 Auto-restarting - session ended unexpectedly');
          this.scheduleRestart(500); // Quick restart
        } else {
          console.log('⏰ 3-minute threshold reached - not restarting');
        }
      }
    });

    this.listeners = [
      startListener, 
      speechStartListener, 
      partialListener, 
      resultListener, 
      speechEndListener, 
      errorListener, 
      endListener
    ];
  }

  private startSessionEndTimer() {
    this.clearSessionEndTimer(); // Clear any existing timer
    this.sessionEndTimer = setTimeout(async () => {
      if (this.isListening && !this.userStopped) {
        console.log('⏰ 3-minute pause completed - stopping listening');
        this.userStopped = true; // Mark as user stopped to prevent auto-restart
        this.autoRestart = false; // Disable auto-restart
        await this.stopListening();
      }
    }, 3 * 60 * 1000); // 3 minutes in milliseconds
  }

  private clearSessionEndTimer() {
    if (this.sessionEndTimer) {
      clearTimeout(this.sessionEndTimer);
      this.sessionEndTimer = null;
    }
  }

  private scheduleRestart(delay = 500) {
    setTimeout(async () => {
      if (this.autoRestart && !this.isListening && !this.userStopped) {
        console.log('🔄 Auto-restarting speech recognition...');
        try {
          await this.startListening();
        } catch (error) {
          console.error('Failed to auto-restart:', error);
        }
      }
    }, delay);
  }

  private startSilenceTimer() {
    this.clearSilenceTimer(); // Clear any existing timer
    this.silenceTimer = setTimeout(async () => {
      if (this.isListening && !this.userStopped) {
        console.log('⏰ 3-minute silence threshold reached - stopping listening');
        this.userStopped = true; // Mark as user stopped to prevent auto-restart
        this.autoRestart = false; // Disable auto-restart
        await this.stopListening();
      }
    }, 3 * 60 * 1000); // 3 minutes in milliseconds
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();
    this.startSilenceTimer(); // Restart the timer
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  async startListening(language = 'en-US') {
    if (this.isListening) {
      console.log('Already listening');
      return;
    }

    try {
      await SpeechRecognition.startListening({
        language,
        silenceThreshold: 0, // Set to 0 to prevent automatic ending
        contextualStrings: ['hello', 'world', 'test'],
        enableFormatting: true
      });
    } catch (error) {
      console.error('Failed to start listening:', error);
      throw error;
    }
  }

  async stopListening() {
    if (!this.isListening) {
      console.log('Not currently listening');
      return;
    }

    // Mark that user manually stopped
    this.userStopped = true;
    this.autoRestart = false; // Disable auto-restart
    
    // Clear all timers
    this.clearSilenceTimer();
    this.clearSessionEndTimer();

    try {
      await SpeechRecognition.stopListening();
    } catch (error) {
      console.error('Failed to stop listening:', error);
      throw error;
    }
  }

  onResult(result: string) {
    // Handle the final speech recognition result
    console.log('Processed result:', result);
    // This can be overridden by the UI
  }

  // Custom event system for UI integration
  addCustomListener(event: string, callback: Function) {
    if (!this.customListeners.has(event)) {
      this.customListeners.set(event, []);
    }
    this.customListeners.get(event)!.push(callback);
  }

  private emitCustomEvent(event: string, data?: any) {
    const listeners = this.customListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  async cleanup() {
    // Clear all timers
    this.clearSilenceTimer();
    this.clearSessionEndTimer();
    
    await SpeechRecognition.removeAllListeners();
    this.listeners = [];
    this.customListeners.clear();
  }
}