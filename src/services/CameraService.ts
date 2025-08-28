// src/services/CameraService.ts
import { Camera, CameraResultType, CameraSource, PermissionStatus } from '@capacitor/camera';

export interface CameraPhoto {
  path: string;
  webPath: string;
  format: string;
  exif?: any;
}

export interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
  source?: CameraSource;
  saveToGallery?: boolean;
  width?: number;
  height?: number;
  correctOrientation?: boolean;
  direction?: 'REAR' | 'FRONT';
  presentationStyle?: 'fullscreen' | 'popover';
}

export class CameraService {
  /**
   * Take a single photo using camera or select from gallery
   * Based on https://capacitorjs.com/docs/apis/camera
   */
  static async takePhoto(options: CameraOptions = {}): Promise<CameraPhoto> {
    const defaultOptions = {
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      saveToGallery: false,
      correctOrientation: true,
      width: 1920,
      height: 1080
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    try {
      console.log('📸 Taking photo with options:', finalOptions);
      const image = await Camera.getPhoto(finalOptions);
      
      console.log('✅ Photo captured successfully:', {
        path: image.path,
        webPath: image.webPath,
        format: image.format
      });
      
      return {
        path: image.path,
        webPath: image.webPath,
        format: image.format || 'jpeg',
        exif: image.exif
      };
    } catch (error) {
      console.error('❌ Camera error:', error);
      throw error;
    }
  }

  /**
   * Select multiple photos from gallery
   */
  static async selectMultiplePhotos(limit: number = 5): Promise<CameraPhoto[]> {
    try {
      console.log(` Selecting up to ${limit} photos`);
      const result = await Camera.pickImages({
        quality: 90,
        limit,
        correctOrientation: true
      });
      
      console.log(`✅ Selected ${result.photos.length} photos`);
      
      return result.photos.map(photo => ({
        path: photo.path,
        webPath: photo.webPath,
        format: photo.format || 'jpeg',
        exif: photo.exif
      }));
    } catch (error) {
      console.error('❌ Photo picker error:', error);
      throw error;
    }
  }

  /**
   * Take photo using camera only
   */
  static async takePhotoWithCamera(options: CameraOptions = {}): Promise<CameraPhoto> {
    return this.takePhoto({
      ...options,
      source: CameraSource.Camera
    });
  }

  /**
   * Select photo from gallery only
   */
  static async selectPhotoFromGallery(options: CameraOptions = {}): Promise<CameraPhoto> {
    return this.takePhoto({
      ...options,
      source: CameraSource.Photos
    });
  }

  /**
   * Check camera and photo permissions
   */
  static async checkPermissions(): Promise<PermissionStatus> {
    try {
      const permissions = await Camera.checkPermissions();
      console.log(' Camera permissions:', permissions);
      return permissions;
    } catch (error) {
      console.error('❌ Error checking camera permissions:', error);
      throw error;
    }
  }

  /**
   * Request camera and photo permissions
   */
  static async requestPermissions(): Promise<PermissionStatus> {
    try {
      console.log('🔐 Requesting camera permissions...');
      const permissions = await Camera.requestPermissions({
        permissions: ['camera', 'photos']
      });
      console.log('✅ Camera permissions result:', permissions);
      return permissions;
    } catch (error) {
      console.error('❌ Error requesting camera permissions:', error);
      throw error;
    }
  }

  /**
   * Check if camera is available
   */
  static async isCameraAvailable(): Promise<boolean> {
    try {
      const permissions = await this.checkPermissions();
      return permissions.camera === 'granted' || permissions.camera === 'limited';
    } catch (error) {
      console.error('❌ Error checking camera availability:', error);
      return false;
    }
  }

  /**
   * Get photo as blob for upload
   */
  static async getPhotoAsBlob(photo: CameraPhoto): Promise<Blob> {
    try {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      console.log(' Photo converted to blob:', {
        size: blob.size,
        type: blob.type
      });
      return blob;
    } catch (error) {
      console.error('❌ Error converting photo to blob:', error);
      throw error;
    }
  }

  /**
   * Create FormData for photo upload
   */
  static async createPhotoFormData(photo: CameraPhoto, fieldName: string = 'photo'): Promise<FormData> {
    try {
      const blob = await this.getPhotoAsBlob(photo);
      const formData = new FormData();
      formData.append(fieldName, blob, `photo.${photo.format}`);
      
      console.log('📤 FormData created for photo upload');
      return formData;
    } catch (error) {
      console.error('❌ Error creating FormData:', error);
      throw error;
    }
  }
}