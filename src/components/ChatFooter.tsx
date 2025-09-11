import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../css/style.css';
import '../css/icons.min.css';
import ChatService from '../services/ChatService';
import AuthService from '../services/AuthService';
import { SpeechRecognitionService } from '../services/SpeechService';
import { fileService, FileType } from '../services/FileService';
import { CameraService, CameraPhoto } from '../services/CameraService';
import LlamaService from '../services/LlamaService';

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
  selectedModel?: string; // Add this prop
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

// Add interface for photo attachment
interface PhotoAttachment {
  id: string;
  photo: CameraPhoto;
  name: string;
  size: number;
  type: string;
}

// Add interface for file attachment
interface FileAttachment {
  id: string;
  file: any; // File object from FileService
  name: string;
  size: number;
  type: string;
  path: string;
  webPath?: string;
}

const ChatFooter: React.FC<ChatFooterProps> = ({ onSendMessage, setMessages, selectedModel }) => {
  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingState, setRecordingState] = useState<'mic' | 'stop' | 'send'>('mic');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  
  // Photo attachments state
  const [photoAttachments, setPhotoAttachments] = useState<PhotoAttachment[]>([]);
  
  // NEW: Add state for file attachments
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  
  // Speech service reference
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Add LlamaService reference
  const [llamaService] = useState(() => LlamaService);

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

  // Keyboard detection for mobile devices
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const viewportHeight = window.innerHeight;
        const windowHeight = window.outerHeight;
        const keyboardHeight = windowHeight - viewportHeight;
        
        // If keyboard height is significant, consider it open
        setIsKeyboardOpen(keyboardHeight > 150);
      }
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        setIsKeyboardOpen(keyboardHeight > 150);
      }
    };

    // Listen for resize events (keyboard show/hide)
    window.addEventListener('resize', handleResize);
    
    // Listen for visual viewport changes (more reliable for keyboard detection)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
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

  // Initialize file service
  useEffect(() => {
    const initializeFileService = async () => {
      try {
        await fileService.initialize();
        
        // Set up file service event listeners
        fileService.addCustomListener('filesPicked', (result: any) => {
          console.log('📁 Files picked:', result.files);
          handleFilesSelected(result.files);
        });
        
        fileService.addCustomListener('error', (error: any) => {
          console.error('❌ File picker error:', error);
          addErrorMessage(`File selection error: ${error.error?.message || 'Unknown error'}`);
        });
        
        console.log('✅ File service initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize file service:', error);
        addErrorMessage('File picker initialization failed');
      }
    };

    initializeFileService();

    // Cleanup on unmount
    return () => {
      fileService.cleanup();
    };
  }, []);

  // Handle files selected from file picker
  const handleFilesSelected = (files: any[]) => {
    if (!files || files.length === 0) {
      return;
    }

    // Validate files
    const validFiles = files.filter(file => {
      const isValidSize = fileService.validateFileSize(file, 10); // 10MB limit
      const isValidType = fileService.validateFileType(file, [
        ...fileService.getMimeTypeMappings()[FileType.IMAGES],
        ...fileService.getMimeTypeMappings()[FileType.DOCUMENTS],
        ...fileService.getMimeTypeMappings()[FileType.AUDIO]
      ]);

      if (!isValidSize) {
        addErrorMessage(`File ${file.name} is too large (max 10MB)`);
        return false;
      }

      if (!isValidType) {
        addErrorMessage(`File type not supported: ${file.name}`);
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) {
      return;
    }

    // Create file attachment message
    const fileMessage = createFileAttachmentMessage(validFiles);
    setMessages(prevMessages => [...prevMessages, fileMessage]);

    // TODO: Upload files to server and get URLs
    // For now, just show the file names
    console.log('📎 Files to upload:', validFiles);
  };

  // Create file attachment message
  const createFileAttachmentMessage = (files: any[]) => {
    const fileList = files.map(file => ({
      name: file.name,
      size: fileService.formatFileSize(file.size),
      type: file.mimeType,
      extension: fileService.getFileExtension(file)
    }));

    const fileMessageObj = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: `📎 Attached ${files.length} file(s):\n${fileList.map(f => `• ${f.name} (${f.size})`).join('\n')}`,
      sender: 'user' as const,
      time: new Date().toLocaleTimeString(),
      timestamp: new Date().toISOString(),
      attachments: files
    };
    
    return fileMessageObj;
  };

  // Enhanced attach button click handler
  const handleAttachClick = async (): Promise<void> => {
    try {
      console.log('📎 Attach button clicked');
      
      // Check permissions first
      const permissions = await fileService.checkPermissions();
      if (permissions.readExternalStorage !== 'granted') {
        const permissionResult = await fileService.requestPermissions();
        if (permissionResult.readExternalStorage !== 'granted') {
          addErrorMessage('Storage permission is required. Please grant permission in device settings and try again.');
          return;
        }
      }

      // Show file picker for all supported types
      const result = await fileService.pickFiles({
        types: [
          ...fileService.getMimeTypeMappings()[FileType.IMAGES],
          ...fileService.getMimeTypeMappings()[FileType.DOCUMENTS],
          ...fileService.getMimeTypeMappings()[FileType.AUDIO]
        ],
        limit: 5, // Allow up to 5 files
        readData: false
      });

      console.log('✅ Files selected:', result);

      // Process selected files
      if (result.files && result.files.length > 0) {
        const newFileAttachments: FileAttachment[] = result.files.map((file: any) => ({
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name || `file_${Date.now()}`,
          size: file.size || 0,
          type: file.type || 'application/octet-stream',
          path: file.path,
          webPath: file.webPath
        }));

        // Add files to attachments
        setFileAttachments(prev => [...prev, ...newFileAttachments]);
        
        // Don't update message text - just show the attachment preview
        
        console.log('✅ Files attached to input:', newFileAttachments);
      }

    } catch (error) {
      console.error('❌ Error in attach click:', error);
      addErrorMessage('Failed to open file picker');
    }
  };

  /**
   * One-click camera button handler - directly captures and attaches JPEG
   * 
   * This function provides a streamlined camera experience:
   * - No prompts or source selection
   * - Direct camera capture
   * - No editing interface
   * - Automatically attaches JPEG to the message
   * - Optimized quality and size for chat
   */
  const handleCameraClick = async (): Promise<void> => {
    try {
      console.log('📸 One-click camera button clicked');
      
      // Check camera permissions first
      const permissions = await CameraService.checkPermissions();
      if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
        console.log('🔐 Requesting camera permissions...');
        const permissionResult = await CameraService.requestPermissions();
        
        if (permissionResult.camera !== 'granted' && permissionResult.camera !== 'limited') {
          addErrorMessage('Camera permission is required to take photos. Please grant permission in device settings.');
          return;
        }
      }

      // Direct camera capture - no prompts, no editing, just capture JPEG
      const photo = await CameraService.capturePhotoDirectly({
        quality: 85, // Good quality for chat
        width: 1200, // Optimized size for chat
        height: 1200
      });

      console.log('✅ Photo captured directly:', photo);

      // Get blob for size calculation
      let photoSize = 0;
      try {
        const blob = await CameraService.getPhotoAsBlob(photo);
        photoSize = blob.size;
      } catch (error) {
        console.warn('⚠️ Could not get photo blob for size calculation:', error);
      }

      // Create photo attachment object
      const photoAttachment: PhotoAttachment = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        photo: photo,
        name: `annadata_${Date.now()}.jpeg`,
        size: photoSize,
        type: 'image/jpeg'
      };

      // Add photo to attachments
      setPhotoAttachments(prev => [...prev, photoAttachment]);
      
      // Don't update message text - just show the attachment preview
      
      console.log('✅ Photo attached to input:', photoAttachment);

    } catch (error: any) {
      console.error('❌ Error in one-click camera:', error);
      
      // Handle specific error cases
      if (error.message?.includes('User cancelled')) {
        console.log('👤 User cancelled photo capture');
        return;
      }
      
      if (error.message?.includes('permission')) {
        addErrorMessage('Camera permission denied. Please enable camera access in device settings.');
      } else {
        addErrorMessage('Failed to capture photo. Please try again.');
      }
    }
  };

  // Enhanced camera-only click handler
  const handleCameraOnlyClick = async (): Promise<void> => {
    try {
      console.log('📸 Camera-only button clicked');
      
      // Check camera permissions first
      const permissions = await CameraService.checkPermissions();
      if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
        console.log('🔐 Requesting camera permissions...');
        const permissionResult = await CameraService.requestPermissions();
        
        if (permissionResult.camera !== 'granted' && permissionResult.camera !== 'limited') {
          addErrorMessage('Camera permission is required to take photos. Please grant permission in device settings.');
          return;
        }
      }

      // Take photo with camera only
      const photo = await CameraService.takePhotoWithCamera({
        quality: 80,
        allowEditing: true,
        saveToGallery: false
      });

      console.log('✅ Photo captured:', photo);

      // Get blob for size calculation
      let photoSize = 0;
      try {
        const blob = await CameraService.getPhotoAsBlob(photo);
        photoSize = blob.size;
      } catch (error) {
        console.warn('⚠️ Could not get photo blob for size calculation:', error);
      }

      // Create photo attachment object
      const photoAttachment: PhotoAttachment = {
        id: `annadata_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        photo: photo,
        name: `annadata_${Date.now()}.${photo.format}`,
        size: photoSize,
        type: `image/${photo.format}`
      };

      // Add photo to attachments
      setPhotoAttachments(prev => [...prev, photoAttachment]);
      
      // Don't update message text - just show the attachment preview
      
      console.log('✅ Photo attached to input:', photoAttachment);

    } catch (error: any) {
      console.error('❌ Error in camera-only click:', error);
      
      if (error.message?.includes('User cancelled')) {
        console.log('👤 User cancelled photo capture');
        return;
      }
      
      if (error.message?.includes('permission')) {
        addErrorMessage('Camera permission denied. Please enable camera access in device settings.');
      } else {
        addErrorMessage('Failed to capture photo. Please try again.');
      }
    }
  };

  // Remove photo attachment
  const removePhotoAttachment = (photoId: string): void => {
    setPhotoAttachments(prev => prev.filter(photo => photo.id !== photoId));
    
    console.log('🗑️ Photo attachment removed:', photoId);
  };

  // Remove file attachment
  const removeFileAttachment = (fileId: string): void => {
    setFileAttachments(prev => prev.filter(file => file.id !== fileId));
    
    console.log('🗑️ File attachment removed:', fileId);
  };

  // Enhanced photo upload function
  const uploadPhotoToServer = async (photo: CameraPhoto): Promise<void> => {
    try {
      console.log('📤 Starting photo upload...');
      
      const formData = await CameraService.createPhotoFormData(photo, 'image');
      
      // Add metadata
      formData.append('timestamp', new Date().toISOString());
      formData.append('format', photo.format);
      
      // Send to your backend
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Photo uploaded successfully:', result);
      
    } catch (error) {
      console.error('❌ Photo upload failed:', error);
      throw error; // Re-throw to be handled by caller
    }
  };

  // Enhanced file upload function
  const uploadFileToServer = async (attachment: FileAttachment): Promise<void> => {
    try {
      console.log('📤 Starting file upload...', attachment.name);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // If we have the file object, use it directly
      if (attachment.file && attachment.file.blob) {
        formData.append('file', attachment.file.blob, attachment.name);
      } else {
        // Otherwise, try to fetch the file from path
        try {
          const response = await fetch(attachment.path);
          const blob = await response.blob();
          formData.append('file', blob, attachment.name);
        } catch (fetchError) {
          console.error('❌ Could not fetch file from path:', fetchError);
          throw new Error('Could not read file data');
        }
      }
      
      // Add metadata
      formData.append('timestamp', new Date().toISOString());
      formData.append('type', attachment.type);
      formData.append('size', attachment.size.toString());
      
      // Send to your backend
      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ File uploaded successfully:', result);
      
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error; // Re-throw to be handled by caller
    }
  };

  // Select multiple photos
  const handleMultiplePhotosClick = async (): Promise<void> => {
    try {
      const photos = await CameraService.selectMultiplePhotos(3); // Max 3 photos
      
      // Handle multiple photos...
      console.log('📸 Multiple photos:', photos);
    } catch (error) {
      console.error('❌ Multiple photos error:', error);
      addErrorMessage('Failed to select photos');
    }
  };

  // Send message via WebSocket (Online mode)
  const sendMessageViaWebSocket = async (messageText: string, timestamp: string): Promise<boolean> => {
    try {
      const connected: boolean = await ChatService.connect();
      if (!connected) {
        return false;
      }

      // Pass the selected model to the ChatService
      const success: boolean = await ChatService.sendChatMessage(messageText, selectedModel);
      
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

  // Process message locally using downloaded model (Offline mode)
  const processMessageLocally = async (messageText: string, timestamp: string): Promise<boolean> => {
    try {
      // Early return if selectedModel is undefined
      if (!selectedModel) {
        console.error(`❌ [LOCAL DEBUG] No model selected`);
        return false;
      }

      console.log(`🤖 [LOCAL DEBUG] Processing message locally with model: ${selectedModel}`);
      
      // Check if the selected model is downloaded
      const model = llamaService.getModel(selectedModel);
      if (!model || model.status !== 'downloaded') {
        console.error(`❌ [LOCAL DEBUG] Model ${selectedModel} is not downloaded`);
        return false;
      }

      // Load the model if not already loaded
      try {
        await llamaService.loadModel(selectedModel);
        console.log(`✅ [LOCAL DEBUG] Model ${selectedModel} loaded successfully`);
      } catch (error: any) {
        console.error(`❌ [LOCAL DEBUG] Failed to load model ${selectedModel}:`, error);
        
        // Check if it's an Android platform error
        if (error.message && error.message.includes('not implemented on Android')) {
          const errorMessageObj: ErrorMessageObj = {
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: 'Local model processing is not available on Android. Please use online mode instead.',
            sender: 'bot',
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            isError: true
          };
          
          setMessages(prevMessages => [...prevMessages, errorMessageObj]);
          return false;
        }
        
        return false;
      }

      // Generate response using the local model
      const completionParams = {
        prompt: messageText,
        n_predict: 256,
        temperature: 0.7,
        top_p: 0.9,
        stop: ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>']
      };

      console.log(`🔄 [LOCAL DEBUG] Generating response for: "${messageText}"`);
      
      const result = await llamaService.completion(completionParams);
      
      // Check for response content in both text and content fields
      const responseText = result.text || result.content || '';
      
      if (responseText.trim()) {
        console.log(`✅ [LOCAL DEBUG] Local response generated:`, responseText);
        
        // Add bot response to messages
        const botMessageObj = {
          id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: responseText,
          sender: 'bot' as const,
          time: new Date().toLocaleTimeString(),
          timestamp: new Date().toISOString()
        };
        
        setMessages(prevMessages => [...prevMessages, botMessageObj]);
        return true;
      } else {
        console.error(`❌ [LOCAL DEBUG] No response generated from local model`);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [LOCAL DEBUG] Local processing error:`, error);
      
      // Check if it's an Android platform error
      if (error.message && error.message.includes('not implemented on Android')) {
        const errorMessageObj: ErrorMessageObj = {
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: 'Local model processing is not available on Android. Please use online mode instead.',
          sender: 'bot',
          time: new Date().toLocaleTimeString(),
          timestamp: new Date().toISOString(),
          isError: true
        };
        
        setMessages(prevMessages => [...prevMessages, errorMessageObj]);
        return false;
      }
      
      return false;
    }
  };

  // Enhanced function to handle form submission with dual-mode support
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement> | { preventDefault: () => void }): Promise<void> => {
    event.preventDefault();
    
    // Don't submit if no message and no attachments
    if ((!message.trim() && photoAttachments.length === 0 && fileAttachments.length === 0) || isSending) {
      return;
    }

    const userMessage: string = message.trim();
    const timestamp: string = new Date().toISOString();
    
    // Create user message object
    const userMessageObj: UserMessageObj = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: userMessage || (photoAttachments.length > 0 || fileAttachments.length > 0 ? 
        `📤 Sent ${photoAttachments.length + fileAttachments.length} attachment(s)` : ''),
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
      // Upload photos first if any
      if (photoAttachments.length > 0) {
        console.log('📤 Uploading photos to server...');
        
        for (const attachment of photoAttachments) {
          try {
            await uploadPhotoToServer(attachment.photo);
            console.log('✅ Photo uploaded:', attachment.name);
          } catch (error) {
            console.error('❌ Failed to upload photo:', attachment.name, error);
            addErrorMessage(`Failed to upload photo: ${attachment.name}`);
          }
        }
      }

      // Upload files if any
      if (fileAttachments.length > 0) {
        console.log('📤 Uploading files to server...');
        
        for (const attachment of fileAttachments) {
          try {
            await uploadFileToServer(attachment);
            console.log('✅ File uploaded:', attachment.name);
          } catch (error) {
            console.error('❌ Failed to upload file:', attachment.name, error);
            addErrorMessage(`Failed to upload file: ${attachment.name}`);
          }
        }
      }

      // Send text message based on selected mode
      if (userMessage.trim()) {
        let success: boolean = false;
        
        if (selectedModel === 'online') {
          // Online mode: Send to remote server
          console.log(' [MODE DEBUG] Using online mode - sending to remote server');
          success = await sendMessageViaWebSocket(userMessage, timestamp);
        } else {
          // Offline mode: Process locally
          console.log(` [MODE DEBUG] Using offline mode - processing with local model: ${selectedModel}`);
          success = await processMessageLocally(userMessage, timestamp);
        }
        
        if (!success) {
          console.error(`❌ [CHAT DEBUG] Message processing failed`);
          
          const errorMessageObj: ErrorMessageObj = {
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: selectedModel === 'online' 
              ? 'Unable to send message. Please check your connection and try again.'
              : `Unable to process message with local model ${selectedModel}. Please try again.`,
            sender: 'bot',
            time: new Date().toLocaleTimeString(),
            timestamp: new Date().toISOString(),
            isError: true
          };
          
          setMessages(prevMessages => [...prevMessages, errorMessageObj]);
        }
      }

      // Clear all attachments after successful send
      setPhotoAttachments([]);
      setFileAttachments([]);
      
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
    
    // On mobile, assume keyboard will open when input is focused
    if (window.innerWidth <= 768) {
      setTimeout(() => setIsKeyboardOpen(true), 300);
    }
  };

  const handleInputBlur = (): void => {
    setIsInputFocused(false);
    updateButtonState();
    
    // On mobile, assume keyboard will close when input loses focus
    if (window.innerWidth <= 768) {
      setTimeout(() => setIsKeyboardOpen(false), 300);
    }
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

  // Helper function to get file icon based on type
  const getFileIcon = (fileType: string): string => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    if (fileType.includes('text')) return '📄';
    return '📎';
  };

  const buttonConfig = getButtonIcon();

  return (
    <div className={`chat-footer ${isKeyboardOpen ? 'keyboard-open' : ''}`}>
      {/* Photo attachments preview */}
      {photoAttachments.length > 0 && (
        <div className="photo-attachments-preview">
          <div className="attachments-header">
            <span>📷 {photoAttachments.length} photo(s) attached</span>
            <button 
              className="clear-all-btn"
              onClick={() => setPhotoAttachments([])}
              type="button"
            >
              Clear All
            </button>
          </div>
          <div className="attachments-list">
            {photoAttachments.map((attachment) => (
              <div key={attachment.id} className="attachment-item">
                <img 
                  src={attachment.photo.webPath} 
                  alt={attachment.name}
                  className="attachment-thumbnail"
                />
                <div className="attachment-info">
                  <span className="attachment-name">{attachment.name}</span>
                  <span className="attachment-size">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button 
                  className="remove-attachment-btn"
                  onClick={() => removePhotoAttachment(attachment.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File attachments preview */}
      {fileAttachments.length > 0 && (
        <div className="file-attachments-preview">
          <div className="attachments-header">
            <span>📎 {fileAttachments.length} file(s) attached</span>
            <button 
              className="clear-all-btn"
              onClick={() => setFileAttachments([])}
              type="button"
            >
              Clear All
            </button>
          </div>
          <div className="attachments-list">
            {fileAttachments.map((attachment) => (
              <div key={attachment.id} className="attachment-item">
                <div className="file-icon">
                  {getFileIcon(attachment.type)}
                </div>
                <div className="attachment-info">
                  <span className="attachment-name">{attachment.name}</span>
                  <span className="attachment-size">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button 
                  className="remove-attachment-btn"
                  onClick={() => removeFileAttachment(attachment.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing form content */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="chat-input-container">
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
                title="Take photo (one-click camera)"
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
        </div>
      </form>
    </div>
  );
};

export default ChatFooter;
