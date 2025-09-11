import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Storage path priority for Android LLM models:
 * 1. External Storage: /storage/emulated/0/Android/data/ai.annadata.app/files/ (RECOMMENDED for LLM models)
 * 2. Documents: /storage/emulated/0/Documents/ (Good for LLM models)
 * 3. App Data (Internal): /data/user/0/ai.annadata.app/files/
 * 4. Cache: /data/user/0/ai.annadata.app/cache/ (Temporary only)
 */

export interface StorageLocation {
  id: string;
  name: string;
  directory: Directory;
  path: string;
  priority: number;
  isRecommended: boolean;
  isTemporary: boolean;
  description: string;
}

export interface StorageInfo {
  location: StorageLocation;
  available: boolean;
  writable: boolean;
  freeSpace?: number;
  totalSpace?: number;
  error?: string;
}

export interface ModelStorageInfo {
  modelId: string;
  fileName: string;
  locations: {
    [locationId: string]: {
      exists: boolean;
      path: string;
      size?: number;
      lastModified?: string;
    };
  };
  primaryLocation?: string;
}

export class StoragePathService {
  private static instance: StoragePathService;
  private isAndroid = Capacitor.getPlatform() === 'android';
  private storageLocations: StorageLocation[] = [];

  private constructor() {
    this.initializeStorageLocations();
  }

  public static getInstance(): StoragePathService {
    if (!StoragePathService.instance) {
      StoragePathService.instance = new StoragePathService();
    }
    return StoragePathService.instance;
  }

  private initializeStorageLocations(): void {
    if (this.isAndroid) {
      this.storageLocations = [
        {
          id: 'external_storage',
          name: 'External Storage (Recommended)',
          directory: Directory.External,
          path: 'models',
          priority: 1,
          isRecommended: true,
          isTemporary: false,
          description: 'External storage - recommended for large LLM models'
        },
        {
          id: 'documents',
          name: 'Documents',
          directory: Directory.Documents,
          path: 'models',
          priority: 2,
          isRecommended: false,
          isTemporary: false,
          description: 'User documents folder - good for LLM models'
        },
        {
          id: 'app_data',
          name: 'App Data (Internal)',
          directory: Directory.Data,
          path: 'models',
          priority: 3,
          isRecommended: false,
          isTemporary: false,
          description: 'Internal app storage - persistent but limited space'
        },
        {
          id: 'cache',
          name: 'Cache (Temporary)',
          directory: Directory.Cache,
          path: 'models',
          priority: 4,
          isRecommended: false,
          isTemporary: true,
          description: 'Temporary storage - files may be cleared by system'
        }
      ];
    } else {
      // For non-Android platforms, use standard locations
      this.storageLocations = [
        {
          id: 'app_data',
          name: 'App Data',
          directory: Directory.Data,
          path: 'models',
          priority: 1,
          isRecommended: true,
          isTemporary: false,
          description: 'Application data directory'
        }
      ];
    }
  }

  /**
   * Get all storage locations sorted by priority
   */
  public getStorageLocations(): StorageLocation[] {
    return [...this.storageLocations].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get storage information for all locations
   */
  public async getStorageInfo(): Promise<StorageInfo[]> {
    const results: StorageInfo[] = [];

    for (const location of this.storageLocations) {
      try {
        const info = await this.checkStorageLocation(location);
        results.push(info);
      } catch (error) {
        results.push({
          location,
          available: false,
          writable: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results.sort((a, b) => a.location.priority - b.location.priority);
  }

  /**
   * Check if a specific storage location is available and writable
   */
  private async checkStorageLocation(location: StorageLocation): Promise<StorageInfo> {
    try {
      // Try to create a test directory to check write permissions
      const testPath = `${location.path}/test`;
      
      try {
        await Filesystem.mkdir({
          path: testPath,
          directory: location.directory,
          recursive: true
        });

        // Clean up test directory
        await Filesystem.rmdir({
          path: testPath,
          directory: location.directory,
          recursive: true
        });

        return {
          location,
          available: true,
          writable: true
        };
      } catch (writeError) {
        return {
          location,
          available: true,
          writable: false,
          error: `Write permission denied: ${writeError}`
        };
      }
    } catch (error) {
      return {
        location,
        available: false,
        writable: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the best available storage location for downloading models
   * Returns the highest priority available and writable location
   */
  public async getBestStorageLocation(): Promise<StorageLocation | null> {
    const storageInfo = await this.getStorageInfo();
    
    console.log('=== Storage Location Check ===');
    storageInfo.forEach(info => {
      console.log(`${info.location.name} (${info.location.id}): available=${info.available}, writable=${info.writable}, priority=${info.location.priority}`);
      if (info.error) {
        console.log(`  Error: ${info.error}`);
      }
    });
    
    // Find the first available and writable location (already sorted by priority)
    const bestLocation = storageInfo.find(info => info.available && info.writable);
    
    if (bestLocation) {
      console.log(`✅ Selected storage location: ${bestLocation.location.name} (priority ${bestLocation.location.priority})`);
      console.log(`📁 Full path: ${bestLocation.location.path}`);
    } else {
      console.log('❌ No available storage locations found');
      console.log('Available locations:', storageInfo.map(info => `${info.location.name} (available: ${info.available}, writable: ${info.writable})`));
    }
    
    return bestLocation?.location || null;
  }

  /**
   * Get the recommended storage location (External Storage for Android)
   */
  public getRecommendedStorageLocation(): StorageLocation | null {
    return this.storageLocations.find(loc => loc.isRecommended) || null;
  }

  /**
   * Get model file path for a specific storage location
   */
  public getModelPath(modelId: string, locationId?: string): string {
    const sanitizedId = modelId.replace(/[.-]/g, '_');
    const fileName = `${sanitizedId}.gguf`;
    
    if (locationId) {
      const location = this.storageLocations.find(loc => loc.id === locationId);
      if (location) {
        return `${location.path}/${fileName}`;
      }
    }
    
    // Default to first available location
    const defaultLocation = this.storageLocations[0];
    return `${defaultLocation.path}/${fileName}`;
  }

  /**
   * Search for a model across all storage locations
   * Searches in priority order: External Storage > Documents > App Data > Cache
   */
  public async searchModel(modelId: string): Promise<ModelStorageInfo> {
    const fileName = `${modelId.replace(/[.-]/g, '_')}.gguf`;
    const locations: ModelStorageInfo['locations'] = {};
    let primaryLocation: string | undefined;

    // Get storage locations sorted by priority (highest first)
    const sortedLocations = this.getStorageLocations();

    for (const location of sortedLocations) {
      try {
        const modelPath = this.getModelPath(modelId, location.id);
        
        const fileInfo = await Filesystem.stat({
          path: modelPath,
          directory: location.directory
        });

        locations[location.id] = {
          exists: true,
          path: modelPath,
          size: fileInfo.size,
          lastModified: fileInfo.mtime ? new Date(fileInfo.mtime).toISOString() : undefined
        };

        // Set primary location to the first found model (highest priority)
        if (!primaryLocation) {
          primaryLocation = location.id;
          console.log(`Model ${modelId} found in ${location.name} (priority ${location.priority})`);
        }
      } catch (error) {
        locations[location.id] = {
          exists: false,
          path: this.getModelPath(modelId, location.id)
        };
      }
    }

    return {
      modelId,
      fileName,
      locations,
      primaryLocation
    };
  }

  /**
   * Check if a model exists in any storage location
   */
  public async modelExists(modelId: string): Promise<boolean> {
    const modelInfo = await this.searchModel(modelId);
    return Object.values(modelInfo.locations).some(loc => loc.exists);
  }

  /**
   * Get the primary location where a model is stored
   */
  public async getModelPrimaryLocation(modelId: string): Promise<{ location: StorageLocation; path: string } | null> {
    const modelInfo = await this.searchModel(modelId);
    
    if (!modelInfo.primaryLocation) {
      return null;
    }

    const location = this.storageLocations.find(loc => loc.id === modelInfo.primaryLocation);
    if (!location) {
      return null;
    }

    return {
      location,
      path: modelInfo.locations[modelInfo.primaryLocation].path
    };
  }

  /**
   * Create the models directory in a specific storage location
   * Handles existing directories gracefully (like mkdir -p)
   */
  public async ensureModelsDirectory(locationId: string): Promise<string> {
    const location = this.storageLocations.find(loc => loc.id === locationId);
    if (!location) {
      throw new Error(`Storage location ${locationId} not found`);
    }

    try {
      // First check if directory already exists
      try {
        await Filesystem.readdir({
          path: location.path,
          directory: location.directory
        });
        // Directory exists, no need to create it
        console.log(`📁 Directory already exists: ${location.name}/${location.path}`);
        return location.path;
      } catch (readError) {
        // Directory doesn't exist, try to create it
        console.log(`📁 Creating directory: ${location.name}/${location.path}`);
        await Filesystem.mkdir({
          path: location.path,
          directory: location.directory,
          recursive: true
        });
        console.log(`✅ Directory created successfully: ${location.name}/${location.path}`);
        return location.path;
      }
    } catch (error) {
      // Check if error is about directory already existing
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`📁 Directory already exists (handled): ${location.name}/${location.path}`);
        return location.path;
      }
      throw new Error(`Failed to create models directory in ${location.name}: ${error}`);
    }
  }

  /**
   * Get storage space information for a location (if available)
   */
  public async getStorageSpace(locationId: string): Promise<{ free: number; total: number } | null> {
    // Note: Capacitor Filesystem doesn't provide direct storage space info
    // This would need to be implemented via a custom native plugin
    // For now, return null to indicate this feature is not available
    return null;
  }

  /**
   * Debug method to show all storage paths
   */
  public async debugStoragePaths(): Promise<void> {
    console.log('=== Storage Paths Debug ===');
    const locations = this.getStorageLocations();
    
    for (const location of locations) {
      console.log(`\n📍 ${location.name} (${location.id})`);
      console.log(`   Priority: ${location.priority}`);
      console.log(`   Directory: ${location.directory}`);
      console.log(`   Path: ${location.path}`);
      console.log(`   Recommended: ${location.isRecommended}`);
      console.log(`   Temporary: ${location.isTemporary}`);
      
      try {
        const info = await this.checkStorageLocation(location);
        console.log(`   Available: ${info.available}`);
        console.log(`   Writable: ${info.writable}`);
        if (info.error) {
          console.log(`   Error: ${info.error}`);
        }
      } catch (error) {
        console.log(`   Error checking: ${error}`);
      }
    }
  }

  /**
   * Clean up temporary files in cache location
   */
  public async cleanupCache(): Promise<void> {
    const cacheLocation = this.storageLocations.find(loc => loc.id === 'cache');
    if (!cacheLocation) {
      return;
    }

    try {
      // List all files in cache models directory
      const files = await Filesystem.readdir({
        path: cacheLocation.path,
        directory: cacheLocation.directory
      });

      // Delete all model files in cache
      for (const file of files.files) {
        if (file.name.endsWith('.gguf')) {
          await Filesystem.deleteFile({
            path: `${cacheLocation.path}/${file.name}`,
            directory: cacheLocation.directory
          });
        }
      }

      console.log('Cache cleanup completed');
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }

  /**
   * Migrate a model from one storage location to another
   */
  public async migrateModel(modelId: string, fromLocationId: string, toLocationId: string): Promise<void> {
    const fromLocation = this.storageLocations.find(loc => loc.id === fromLocationId);
    const toLocation = this.storageLocations.find(loc => loc.id === toLocationId);

    if (!fromLocation || !toLocation) {
      throw new Error('Invalid storage locations');
    }

    const fromPath = this.getModelPath(modelId, fromLocationId);
    const toPath = this.getModelPath(modelId, toLocationId);

    // Ensure destination directory exists
    await this.ensureModelsDirectory(toLocationId);

    try {
      // Read the source file
      const fileData = await Filesystem.readFile({
        path: fromPath,
        directory: fromLocation.directory
      });

      // Write to destination
      await Filesystem.writeFile({
        path: toPath,
        data: fileData.data,
        directory: toLocation.directory
      });

      // Delete source file
      await Filesystem.deleteFile({
        path: fromPath,
        directory: fromLocation.directory
      });

      console.log(`Model ${modelId} migrated from ${fromLocation.name} to ${toLocation.name}`);
    } catch (error) {
      throw new Error(`Failed to migrate model ${modelId}: ${error}`);
    }
  }
}
