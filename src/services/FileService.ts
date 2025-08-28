import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';

// Type definitions based on Capawesome plugin
interface PickedFile {
  blob?: Blob;
  data?: string;
  duration?: number;
  height?: number;
  mimeType: string;
  modifiedAt?: number;
  name: string;
  path?: string;
  size: number;
  width?: number;
}

interface PickFilesResult {
  files: PickedFile[];
}

interface PickDirectoryResult {
  path: string;
}

interface PermissionStatus {
  accessMediaLocation: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
  readExternalStorage: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}

interface PickFilesOptions {
  types?: string[];
  limit?: number;
  readData?: boolean;
}

interface PickMediaOptions {
  readData?: boolean;
  skipTranscoding?: boolean;
  limit?: number;
  ordered?: boolean;
}

interface CopyFileOptions {
  from: string;
  to: string;
  overwrite?: boolean;
}

interface ConvertHeicToJpegOptions {
  path: string;
}

interface ConvertHeicToJpegResult {
  path: string;
}

interface RequestPermissionsOptions {
  permissions?: ('accessMediaLocation' | 'readExternalStorage')[];
}

interface PluginListenerHandle {
  remove: () => Promise<void>;
}

// File type categories for easy filtering
export enum FileType {
  IMAGES = 'images',
  VIDEOS = 'videos',
  DOCUMENTS = 'documents',
  AUDIO = 'audio',
  ALL = 'all'
}

// MIME type mappings
const MIME_TYPE_MAPPINGS = {
  [FileType.IMAGES]: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif'
  ],
  [FileType.VIDEOS]: [
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv',
    'video/webm', 'video/mkv', 'video/3gp', 'video/quicktime'
  ],
  [FileType.DOCUMENTS]: [
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/rtf', 'application/xml', 'text/html'
  ],
  [FileType.AUDIO]: [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
    'audio/flac', 'audio/wma', 'audio/m4a'
  ]
};

export class FileService {
  private isInitialized = false;
  private listeners: PluginListenerHandle[] = [];
  private customListeners: Map<string, Function[]> = new Map();
  
  // Platform detection
  private isNative = Capacitor.isNativePlatform();
  private isWeb = Capacitor.getPlatform() === 'web';
  private isIOS = Capacitor.getPlatform() === 'ios';
  private isAndroid = Capacitor.getPlatform() === 'android';

  // Performance monitoring
  private performanceMetrics = {
    filesPicked: 0,
    totalSize: 0,
    errors: 0,
    lastOperation: ''
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if FilePicker is available
      if (typeof FilePicker === 'undefined') {
        throw new Error('FilePicker plugin not available');
      }

      // Set up event listeners
      await this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ FileService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FileService:', error);
      throw error;
    }
  }

  private async setupEventListeners(): Promise<void> {
    try {
      // Set up picker dismissed listener (iOS only)
      if (this.isIOS) {
        const dismissedListener = await FilePicker.addListener('pickerDismissed', () => {
          this.emitCustomEvent('pickerDismissed');
        });
        this.listeners.push(dismissedListener);
      }
    } catch (error) {
      console.warn('⚠️ Could not set up file picker event listeners:', error);
    }
  }

  // Permission management
  async checkPermissions(): Promise<PermissionStatus> {
    try {
      if (this.isAndroid) {
        return await FilePicker.checkPermissions();
      } else {
        // For non-Android platforms, return granted status
        return {
          accessMediaLocation: 'granted',
          readExternalStorage: 'granted'
        };
      }
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
      return {
        accessMediaLocation: 'denied',
        readExternalStorage: 'denied'
      };
    }
  }

  async requestPermissions(options?: RequestPermissionsOptions): Promise<PermissionStatus> {
    try {
      if (this.isAndroid) {
        const result = await FilePicker.requestPermissions(options);
        
        // If readExternalStorage is denied, try to provide helpful guidance
        if (result.readExternalStorage === 'denied') {
          console.warn('⚠️ Storage permission denied. User may need to grant permission manually in device settings.');
        }
        
        return result;
      } else {
        // For non-Android platforms, return granted status
        return {
          accessMediaLocation: 'granted',
          readExternalStorage: 'granted'
        };
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      throw error;
    }
  }

  // File selection methods
  async pickFiles(options?: PickFilesOptions): Promise<PickFilesResult> {
    try {
      this.performanceMetrics.lastOperation = 'pickFiles';
      const result = await FilePicker.pickFiles(options);
      
      this.performanceMetrics.filesPicked += result.files.length;
      this.performanceMetrics.totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
      
      this.emitCustomEvent('filesPicked', result);
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error picking files:', error);
      this.emitCustomEvent('error', { operation: 'pickFiles', error });
      throw error;
    }
  }

  async pickImages(options?: PickMediaOptions): Promise<PickFilesResult> {
    try {
      this.performanceMetrics.lastOperation = 'pickImages';
      const result = await FilePicker.pickImages(options);
      
      this.performanceMetrics.filesPicked += result.files.length;
      this.performanceMetrics.totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
      
      this.emitCustomEvent('imagesPicked', result);
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error picking images:', error);
      this.emitCustomEvent('error', { operation: 'pickImages', error });
      throw error;
    }
  }

  async pickVideos(options?: PickMediaOptions): Promise<PickFilesResult> {
    try {
      this.performanceMetrics.lastOperation = 'pickVideos';
      const result = await FilePicker.pickVideos(options);
      
      this.performanceMetrics.filesPicked += result.files.length;
      this.performanceMetrics.totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
      
      this.emitCustomEvent('videosPicked', result);
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error picking videos:', error);
      this.emitCustomEvent('error', { operation: 'pickVideos', error });
      throw error;
    }
  }

  async pickMedia(options?: PickMediaOptions): Promise<PickFilesResult> {
    try {
      this.performanceMetrics.lastOperation = 'pickMedia';
      const result = await FilePicker.pickMedia(options);
      
      this.performanceMetrics.filesPicked += result.files.length;
      this.performanceMetrics.totalSize += result.files.reduce((sum, file) => sum + file.size, 0);
      
      this.emitCustomEvent('mediaPicked', result);
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error picking media:', error);
      this.emitCustomEvent('error', { operation: 'pickMedia', error });
      throw error;
    }
  }

  async pickDirectory(): Promise<PickDirectoryResult> {
    try {
      this.performanceMetrics.lastOperation = 'pickDirectory';
      const result = await FilePicker.pickDirectory();
      
      this.emitCustomEvent('directoryPicked', result);
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error picking directory:', error);
      this.emitCustomEvent('error', { operation: 'pickDirectory', error });
      throw error;
    }
  }

  // File operations
  async copyFile(options: CopyFileOptions): Promise<void> {
    try {
      this.performanceMetrics.lastOperation = 'copyFile';
      await FilePicker.copyFile(options);
      
      this.emitCustomEvent('fileCopied', options);
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error copying file:', error);
      this.emitCustomEvent('error', { operation: 'copyFile', error });
      throw error;
    }
  }

  async convertHeicToJpeg(options: ConvertHeicToJpegOptions): Promise<ConvertHeicToJpegResult> {
    try {
      this.performanceMetrics.lastOperation = 'convertHeicToJpeg';
      const result = await FilePicker.convertHeicToJpeg(options);
      
      this.emitCustomEvent('heicConverted', result);
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      console.error('❌ Error converting HEIC to JPEG:', error);
      this.emitCustomEvent('error', { operation: 'convertHeicToJpeg', error });
      throw error;
    }
  }

  // Convenience methods for specific file types
  async pickImagesOnly(limit: number = 1): Promise<PickFilesResult> {
    return this.pickImages({
      limit,
      skipTranscoding: true,
      readData: false
    });
  }

  async pickVideosOnly(limit: number = 1): Promise<PickFilesResult> {
    return this.pickVideos({
      limit,
      readData: false
    });
  }

  async pickDocuments(limit: number = 1): Promise<PickFilesResult> {
    return this.pickFiles({
      types: MIME_TYPE_MAPPINGS[FileType.DOCUMENTS],
      limit,
      readData: false
    });
  }

  async pickAudioFiles(limit: number = 1): Promise<PickFilesResult> {
    return this.pickFiles({
      types: MIME_TYPE_MAPPINGS[FileType.AUDIO],
      limit,
      readData: false
    });
  }

  async pickFilesByType(fileType: FileType, limit: number = 1): Promise<PickFilesResult> {
    if (fileType === FileType.ALL) {
      return this.pickFiles({ limit, readData: false });
    }
    
    return this.pickFiles({
      types: MIME_TYPE_MAPPINGS[fileType],
      limit,
      readData: false
    });
  }

  // FormData utilities
  createFormDataFromFiles(files: PickedFile[], fieldName: string = 'files'): FormData {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      if (file.blob) {
        const rawFile = new File([file.blob], file.name, {
          type: file.mimeType,
        });
        formData.append(`${fieldName}[${index}]`, rawFile, file.name);
      } else if (file.data) {
        // For files with base64 data
        const byteCharacters = atob(file.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: file.mimeType });
        const rawFile = new File([blob], file.name, { type: file.mimeType });
        formData.append(`${fieldName}[${index}]`, rawFile, file.name);
      }
    });
    
    return formData;
  }

  // File validation utilities
  validateFileSize(file: PickedFile, maxSizeMB: number = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  validateFileType(file: PickedFile, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.mimeType);
  }

  getFileExtension(file: PickedFile): string {
    return file.name.split('.').pop()?.toLowerCase() || '';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get MIME type mappings
  getMimeTypeMappings() {
    return MIME_TYPE_MAPPINGS;
  }

  // Event handling
  addCustomListener(event: string, callback: Function): void {
    if (!this.customListeners.has(event)) {
      this.customListeners.set(event, []);
    }
    this.customListeners.get(event)!.push(callback);
  }

  removeCustomListener(event: string, callback: Function): void {
    const listeners = this.customListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitCustomEvent(event: string, data?: any): void {
    const listeners = this.customListeners.get(event);
    if (listeners && listeners.length > 0) {
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
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      filesPicked: 0,
      totalSize: 0,
      errors: 0,
      lastOperation: ''
    };
  }

  // Platform information
  getPlatformInfo() {
    return {
      isNative: this.isNative,
      isWeb: this.isWeb,
      isIOS: this.isIOS,
      isAndroid: this.isAndroid,
      platform: Capacitor.getPlatform()
    };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      // Remove all plugin listeners
      for (const listener of this.listeners) {
        try {
          await listener.remove();
        } catch (error) {
          console.error('Error removing listener:', error);
        }
      }
      this.listeners = [];

      // Clear custom listeners
      this.customListeners.clear();

      // Reset performance metrics
      this.resetPerformanceMetrics();

      this.isInitialized = false;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const fileService = new FileService();