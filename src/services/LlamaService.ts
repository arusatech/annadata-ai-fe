import { Capacitor } from '@capacitor/core';
import { StoragePathService } from './StoragePathService';

// Type definitions based on the actual llama-cpp-capacitor API
export interface LlamaModel {
  id: string;
  name: string;
  sizeMB: number;
  status: 'available' | 'downloading' | 'downloaded' | 'error';
  path?: string;
  description?: string;
  url?: string;  // Add this
  size?: number; // Add this
}

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface CompletionParams {
  prompt?: string;
  messages?: CompletionMessage[];
  n_predict?: number;
  stop?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  seed?: number;
  tfs_z?: number;
  typical_p?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  penalize_nl?: boolean;
  n_ctx?: number;
  n_batch?: number;
  n_keep?: number;
  n_discard?: number;
  n_threads?: number;
  n_gpu_layers?: number;
  main_gpu?: number;
  tensor_split?: number[];
  rope_freq_base?: number;
  rope_freq_scale?: number;
  mul_mat_q?: boolean;
  f16_kv?: boolean;
  logits_all?: boolean;
  vocab_only?: boolean;
  use_mmap?: boolean;
  use_mlock?: boolean;
  embedding_only?: boolean;
  rope_scaling_type?: number;
  rope_freq_scale_linear?: number;
  numa?: boolean;
  numa_strategy?: number[];
  dump_kv_cache?: boolean;
  no_kv_offload?: boolean;
  offload_kqv?: boolean;
  flash_attn?: boolean;
  cache_type_k?: string;
  cache_type_v?: string;
  cache_type_f16?: boolean;
  cache_type_q8_0?: boolean;
  cache_type_q4_0?: boolean;
  cache_type_q4_1?: boolean;
  cache_type_iq4_nl?: boolean;
  cache_type_q5_0?: boolean;
  cache_type_q5_1?: boolean;
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: {
      schema: object;
      strict?: boolean;
    };
  };
  guide_tokens?: number[];
  grammar?: string;
  media_paths?: string[];
}

export interface CompletionResult {
  text: string;
  content: string;
  timings: {
    predicted_ms: number;
    predicted_n: number;
    predicted_per_token_ms: number;
    predicted_per_second: number;
    prompt_ms: number;
    prompt_n: number;
    prompt_per_token_ms: number;
    prompt_per_second: number;
  };
  stopped_eos: boolean;
  stopped_word: boolean;
  stopped_limit: boolean;
  stopping_word: string;
  tokens_predicted: number;
  tokens_evaluated: number;
  generation_settings: CompletionParams;
  audio_tokens?: number[];
}

export interface TokenData {
  token: string;
  completion: string;
  stop: boolean;
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{
    type: 'function';
    id?: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  accumulated_text?: string;
}

// Update the ContextParams interface to match the exact types from llama-cpp-capacitor
export interface ContextParams {
  model: string;
  n_ctx?: number;
  n_batch?: number;
  n_threads?: number;
  n_gpu_layers?: number;
  main_gpu?: number;
  tensor_split?: number[];
  rope_freq_base?: number;
  rope_freq_scale?: number;
  mul_mat_q?: boolean;
  f16_kv?: boolean;
  logits_all?: boolean;
  vocab_only?: boolean;
  use_mmap?: boolean;
  use_mlock?: boolean;
  embedding?: boolean;
  numa?: boolean;
  cache_type_k?: 'f16' | 'f32' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1';
  cache_type_v?: 'f16' | 'f32' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1';
  pooling_type?: 'none' | 'mean' | 'cls' | 'last' | 'rank';
  flash_attn?: boolean;
  ctx_shift?: boolean;
  kv_unified?: boolean;
  swa_full?: boolean;
  n_cpu_moe?: number;
  embd_normalize?: number;
}

export interface EmbeddingParams {
  n_batch?: number;
  n_threads?: number;
  embd_normalize?: number;
}

export interface NativeEmbeddingResult {
  embedding: number[];
  n_embd: number;
}

export interface RerankParams {
  n_batch?: number;
  n_threads?: number;
  normalize?: number;
}

export interface RerankResult {
  index: number;
  score: number;
  document?: string;
}

export interface BenchResult {
  modelDesc: string;
  modelNParams: number;
  modelSize: number;
  ppAvg: number;
  ppStd: number;
  tgAvg: number;
  tgStd: number;
}

export interface NativeSessionLoadResult {
  tokens: number[];
  n_tokens: number;
  tokens_loaded?: number;
  prompt?: string;
}

export class LlamaService {
  private static instance: LlamaService;
  private llamaContext: any = null;
  private isInitialized = false;
  private isAndroidPlatform = Capacitor.getPlatform() === 'android';
  private storagePathService = StoragePathService.getInstance();
  private availableModels: LlamaModel[] = [
    {
      id: 'tiny_test',
      name: 'Tiny Test Model',
      sizeMB: 461,
      status: 'available',
      description: 'Very small test model for debugging',
      url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q2_K.gguf'
    },
    {
      id: 'smol_0_1',
      name: 'Smol-015',
      sizeMB: 164,
      status: 'available',
      description: 'Biggie SmoLlm 0.15B Base model',
      url: 'https://huggingface.co/QuantFactory/Biggie-SmoLlm-0.15B-Base-GGUF/resolve/main/Biggie-SmoLlm-0.15B-Base.Q8_0.gguf'
    },
    {
        id: 'llama_2',
        name: 'llama-2',
        sizeMB: 4370,
        status: 'available',
        description: 'Small 7B model for basic testing',
        url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf',
    },
    // New models added
    {
      id: 'lai_img2txt',
      name: 'LAI-Img2Txt',
      sizeMB: 670,
      status: 'available',
      description: 'LiquidAI LFM2 Vision Language model for image-to-text',
      url: 'https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/resolve/main/LFM2-VL-1.6B-Q4_0.gguf'
    },
    {
      id: 'tao_phy',
      name: 'Tao-Physics',
      sizeMB: 4475,
      status: 'available',
      description: 'TaoGPT vision language model',
      url: 'https://huggingface.co/agency888/TaoGPT-v1-GGUF-GGUF/resolve/main/taogpt-v1-gguf.Q4_K_M.gguf'
    },
    {
      id: 'hermes_vl',
      name: 'Hermes-Vision',
      sizeMB: 3154,
      status: 'available',
      description: 'NousResearch Hermes 2 Vision model',
      url: 'https://huggingface.co/PsiPi/NousResearch_Nous-Hermes-2-Vision-GGUF/resolve/main/NousResearch_Nous-Hermes-2-Vision-GGUF_Q2_K.gguf'
    },
    {
      id: 'hermes_mistral',
      name: 'Hermes-Mistral',
      sizeMB: 3154,
      status: 'available',
      description: 'NousResearch Hermes 2 Mistral model',
      url: 'https://huggingface.co/PsiPi/NousResearch_Nous-Hermes-2-Mistral-GGUF/resolve/main/NousResearch_Nous-Hermes-2-Mistral-GGUF_Q2_K.gguf'
    },
    {
      id: 'open_hermes2',
      name: 'Open-Hermes2',
      sizeMB: 3604,
      status: 'available',
      description: 'OpenHermes V2 Portuguese Brazil model',
      url: 'https://huggingface.co/BornSaint/OpenHermesV2-PTBR-portuguese-brazil-gguf/resolve/main/ggml-OpenHermesV2-PTBR-Q3_K_M.gguf'
    },
    {
      id: 'mistral_ai',
      name: 'Mistral-AI',
      sizeMB: 3236,
      status: 'available',
      description: 'Mistral 7B v0.1 model',
      url: 'https://huggingface.co/TheBloke/Mistral-7B-v0.1-GGUF/resolve/main/mistral-7b-v0.1.Q3_K_S.gguf'
    },
    
    {
      id: 'smol_1_7',
      name: 'Smol-17b',
      sizeMB: 1434,
      status: 'available',
      description: 'SmolLM 1.7B model',
      url: 'https://huggingface.co/mradermacher/SmolLM-1.7B-GGUF/resolve/main/SmolLM-1.7B.Q6_K.gguf'
    },
    {
      id: 'moondream2_f16',
      name: 'Moondream2',
      sizeMB: 2908,
      status: 'available',
      description: 'Moondream2 text model with Vicuna architecture',
      url: 'https://huggingface.co/ggml-org/moondream2-20250414-GGUF/resolve/main/moondream2-text-model-f16_ct-vicuna.gguf'
    },
    {
      id: 'glm_edge',
      name: 'GLM Edge',
      sizeMB: 1167,
      status: 'available',
      description: 'GLM Edge 1.5B chat model',
      url: 'https://huggingface.co/mradermacher/glm-edge-1.5b-chat-i1-GGUF/resolve/main/glm-edge-1.5b-chat.i1-Q5_K_M.gguf'
    },
    {
      id: 'liq2',
      name: 'Liq2',
      sizeMB: 1280,
      status: 'available',
      description: 'Luth LFM2 1.2B model',
      url: 'https://huggingface.co/kurakurai/Luth-LFM2-1.2B-GGUF/resolve/main/Luth-LFM2-1.2B-Q8_0.gguf'
    },
    {
      id: 'minicpm',
      name: 'MiniCPM',
      sizeMB: 5151,
      status: 'available',
      description: 'MiniCPM V 4.5 vision language model',
      url: 'https://huggingface.co/openbmb/MiniCPM-V-4_5-gguf/resolve/main/ggml-model-Q4_K_M.gguf'
    },
    {
      id: 'qwen2_vl',
      name: 'Qwen2-VL',
      sizeMB: 1157,
      status: 'available',
      description: 'Qwen2 VL 2B Instruct model',
      url: 'https://huggingface.co/bartowski/Qwen2-VL-2B-Instruct-GGUF/resolve/main/Qwen2-VL-2B-Instruct-Q5_K_M.gguf'
    },
    {
      id: 'liq2_vl',
      name: 'Liq2-VL',
      sizeMB: 1280,
      status: 'available',
      description: 'LiquidAI LFM2 VL 1.6B model',
      url: 'https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/resolve/main/LFM2-VL-1.6B-Q8_0.gguf'
    },
    {
      id: 'bunny_v1',
      name: 'Bunny v1.0',
      sizeMB: 2458,
      status: 'available',
      description: 'BAAI Bunny v1.0 4B model',
      url: 'https://huggingface.co/BAAI/Bunny-v1_0-4B-gguf/resolve/main/ggml-model-Q4_K_M.gguf'
    },
    {
      id: 'llava_v1_6',
      name: 'Llava v1.6',
      sizeMB: 2591,
      status: 'available',
      description: 'Llava v1.6 Vicuna 7B model',
      url: 'https://huggingface.co/second-state/Llava-v1.6-Vicuna-7B-GGUF/resolve/main/llava-v1.6-vicuna-7b-Q2_K.gguf'
    }
  ];
  private downloadedModels: LlamaModel[] = [];
  private currentModel: string | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LlamaService {
    if (!LlamaService.instance) {
      LlamaService.instance = new LlamaService();
    }
    return LlamaService.instance;
  }

  /**
   * Initialize the Llama service
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Remove this Android check - the plugin supports Android
      // if (this.isAndroidPlatform) {
      //   console.warn('⚠️ LlamaCpp plugin is not fully implemented on Android. Local model processing will be disabled.');
      //   this.isInitialized = true;
      //   return;
      // }

      // Load any previously downloaded models
      await this.loadDownloadedModels();
      
      this.isInitialized = true;
      console.log('LlamaService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LlamaService:', error);
      // Don't throw error, just mark as initialized to prevent further attempts
      this.isInitialized = true;
    }
  }

  /**
   * Load information about downloaded models
   */
  private async loadDownloadedModels(): Promise<void> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'downloaded_models' });
      
      if (value) {
        this.downloadedModels = JSON.parse(value);
      }
    } catch (error) {
      console.error('Failed to load downloaded models:', error);
    }
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): LlamaModel[] {
    return [...this.availableModels];
  }

  /**
   * Get list of downloaded models
   */
  getDownloadedModels(): LlamaModel[] {
    return [...this.downloadedModels];
  }

  /**
   * Get storage information for all locations
   */
  async getStorageInfo() {
    return await this.storagePathService.getStorageInfo();
  }

  /**
   * Debug method to show storage paths and availability
   */
  async debugStoragePaths(): Promise<void> {
    console.log('=== LlamaService Storage Debug ===');
    await this.storagePathService.debugStoragePaths();
    
    const bestLocation = await this.storagePathService.getBestStorageLocation();
    if (bestLocation) {
      console.log(`\n✅ Best location for downloads: ${bestLocation.name}`);
    } else {
      console.log('\n❌ No suitable storage location found');
    }
  }

  /**
   * Test method to check which storage location would be selected for download
   */
  async testStorageSelection(modelId: string = 'test_model'): Promise<void> {
    console.log(`🧪 Testing storage selection for model: ${modelId}`);
    try {
      const downloadInfo = await this.getModelDownloadPath(modelId);
      console.log(`✅ Test successful! Selected location: ${downloadInfo.location}`);
      console.log(`📁 Test path: ${downloadInfo.path}`);
    } catch (error) {
      console.error(`❌ Test failed:`, error);
    }
  }

  /**
   * Get the Capacitor Directory enum value for a storage location
   */
  private getDirectoryForLocation(locationId?: string): any {
    if (!locationId) {
      return this.storagePathService.getStorageLocations()[0]?.directory;
    }
    
    const location = this.storagePathService.getStorageLocations().find(loc => loc.id === locationId);
    return location?.directory || this.storagePathService.getStorageLocations()[0].directory;
  }

  /**
   * Get model storage information
   */
  async getModelStorageInfo(modelId: string) {
    return await this.storagePathService.searchModel(modelId);
  }

  /**
   * Migrate a model to a different storage location
   */
  async migrateModel(modelId: string, fromLocationId: string, toLocationId: string): Promise<void> {
    await this.storagePathService.migrateModel(modelId, fromLocationId, toLocationId);
    
    // Update the model's path in our records
    const model = this.getModel(modelId);
    if (model) {
      const newPath = this.storagePathService.getModelPath(modelId, toLocationId);
      model.path = newPath;
      await this.saveDownloadedModels();
    }
  }

  /**
   * Clean up cache storage
   */
  async cleanupCache(): Promise<void> {
    await this.storagePathService.cleanupCache();
  }

  /**
   * Delete a specific model from all storage locations
   */
  async deleteModel(modelId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting model: ${modelId}`);
      
      // Get model info
      const model = this.getModel(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Delete model files from all storage locations
      await this.deleteModelFile(modelId);

      // Remove from downloaded models list
      this.downloadedModels = this.downloadedModels.filter(m => m.id !== modelId);
      
      // Update model status
      model.status = 'available';
      model.path = undefined;

      // Save updated list
      await this.saveDownloadedModels();

      console.log(`✅ Model ${modelId} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all downloaded models
   */
  async deleteAllModels(): Promise<void> {
    try {
      console.log('🗑️ Deleting all downloaded models...');
      
      const modelsToDelete = [...this.downloadedModels];
      
      for (const model of modelsToDelete) {
        try {
          await this.deleteModel(model.id);
        } catch (error) {
          console.error(`Failed to delete model ${model.id}:`, error);
          // Continue with other models even if one fails
        }
      }

      // Clear the downloaded models list
      this.downloadedModels = [];
      await this.saveDownloadedModels();

      console.log('✅ All models deleted successfully');
    } catch (error) {
      console.error('Failed to delete all models:', error);
      throw error;
    }
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): LlamaModel | null {
    return this.availableModels.find(model => model.id === modelId) || null;
  }

  /**
   * Check if a model file exists on the filesystem across all storage locations
   * Checks in priority order: External Storage > Documents > App Data > Cache
   */
  private async checkModelFileExists(modelId: string): Promise<boolean> {
    try {
      return await this.storagePathService.modelExists(modelId);
    } catch (error) {
      console.log(`Error checking model file existence: ${error}`);
      return false;
    }
  }

  /**
   * Verify downloaded model integrity
   */
  private async verifyModelIntegrity(modelId: string): Promise<boolean> {
    try {
      const model = this.getModel(modelId);
      if (!model) {
        return false;
      }

      // Get model storage information
      const modelInfo = await this.storagePathService.searchModel(modelId);
      
      // Find the primary location where the model exists
      const primaryLocation = modelInfo.primaryLocation;
      if (!primaryLocation) {
        console.log(`Model ${modelId} not found in any storage location`);
        return false;
      }

      const locationInfo = modelInfo.locations[primaryLocation];
      if (!locationInfo.exists || !locationInfo.size) {
        console.log(`Model ${modelId} exists but size information unavailable`);
        return false;
      }

      // Check if file size is reasonable
      const fileSizeBytes = locationInfo.size;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);
      
      console.log(`Model file size: ${fileSizeMB.toFixed(2)}MB (expected: ~${model.sizeMB}MB)`);
      
      // Allow more tolerance in file size (models can vary significantly in size)
      const minExpectedSize = model.sizeMB * 0.5; // 50% of expected size (more lenient)
      const maxExpectedSize = model.sizeMB * 2.0; // 200% of expected size (more lenient)
      
      console.log(`Size check: ${fileSizeMB.toFixed(2)}MB (min: ${minExpectedSize.toFixed(2)}MB, max: ${maxExpectedSize.toFixed(2)}MB)`);
      
      return fileSizeBytes > 1024 * 1024 && // At least 1MB
             fileSizeMB >= minExpectedSize && 
             fileSizeMB <= maxExpectedSize;
    } catch (error) {
      console.error(`Failed to verify model integrity for ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Download a model with proper file handling and existence checks
   */
  async downloadModel(
    modelId: string, 
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
  ): Promise<void> {
    try {
      const model = this.getModel(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      if (!model.url) {
        throw new Error(`Download URL not available for model ${modelId}`);
      }

      // Check if model is already downloading
      if (model.status === 'downloading') {
        throw new Error(`Model ${modelId} is already being downloaded`);
      }

      // Check if model file already exists on filesystem
      const fileExists = await this.checkModelFileExists(modelId);
      console.log(`🔍 Model ${modelId} file exists check: ${fileExists}`);
      if (fileExists) {
        // Verify the existing file integrity
        const isValid = await this.verifyModelIntegrity(modelId);
        console.log(`🔍 Model ${modelId} integrity check: ${isValid}`);
        if (isValid) {
          console.log(`✅ Model ${modelId} already exists and is valid, skipping download`);
          
          // Update model status and add to downloaded models if not already there
          model.status = 'downloaded';
          const downloadInfo = await this.getModelDownloadPath(modelId);
          model.path = downloadInfo.path;
          
          if (!this.downloadedModels.find(m => m.id === modelId)) {
            this.downloadedModels.push({ ...model });
            await this.saveDownloadedModels();
          }
          
          return; // Skip download
        } else {
          console.log(`Model ${modelId} exists but appears corrupted, will re-download`);
          // Remove the corrupted file
          await this.deleteModelFile(modelId);
        }
      }

      // Check if model is already in downloaded models list
      const existingDownloaded = this.downloadedModels.find(m => m.id === modelId);
      if (existingDownloaded && existingDownloaded.status === 'downloaded') {
        console.log(`Model ${modelId} already marked as downloaded, checking filesystem...`);
        const fileExists = await this.checkModelFileExists(modelId);
        if (fileExists) {
          const isValid = await this.verifyModelIntegrity(modelId);
          if (isValid) {
            console.log(`Model ${modelId} is already downloaded and valid`);
            return; // Skip download
          }
        }
        // If we get here, the model was marked as downloaded but file is missing/corrupted
        console.log(`Model ${modelId} was marked as downloaded but file is missing/corrupted, re-downloading`);
      }

      model.status = 'downloading';

      // Get the best available download path for the platform
      const downloadInfo = await this.getModelDownloadPath(modelId);
      const downloadPath = downloadInfo.path;
      const storageLocation = downloadInfo.location;
      
      console.log(`Downloading model ${modelId} from ${model.url} to ${downloadPath} (location: ${storageLocation})`);

      // For web platform, use fetch with progress tracking
      if (Capacitor.getPlatform() === 'web') {
        await this.downloadModelWeb(model, downloadPath, onProgress, storageLocation);
      } else {
        // For native platforms, use Capacitor HTTP with progress
        await this.downloadModelNative(model, downloadPath, onProgress, storageLocation);
      }

      // Verify the downloaded file
      const isValid = await this.verifyModelIntegrity(modelId);
      if (!isValid) {
        throw new Error(`Downloaded model ${modelId} failed integrity check`);
      }

      // Update model status and path
      model.status = 'downloaded';
      model.path = downloadPath;
      
      if (!this.downloadedModels.find(m => m.id === modelId)) {
        this.downloadedModels.push({ ...model });
      }

      await this.saveDownloadedModels();
      console.log(`Model ${modelId} downloaded successfully to ${downloadPath}`);
    } catch (error) {
      const model = this.getModel(modelId);
      if (model) {
        model.status = 'error';
      }
      console.error(`Failed to download model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get the download path for a model using the best available storage location
   * Prioritizes: External Storage > Documents > App Data > Cache
   */
  private async getModelDownloadPath(modelId: string): Promise<{ path: string; location: string }> {
    try {
      // Get all storage locations sorted by priority
      const storageLocations = this.storagePathService.getStorageLocations();
      
      console.log(`🔍 Checking storage locations for model ${modelId} download:`);
      storageLocations.forEach(loc => {
        console.log(`  ${loc.priority}. ${loc.name} (${loc.id}) - ${loc.isRecommended ? 'RECOMMENDED' : 'normal'}`);
      });
      
      // Get storage info once for all locations
      const storageInfo = await this.storagePathService.getStorageInfo();
      console.log(`📊 Storage location status:`);
      storageInfo.forEach(info => {
        console.log(`  ${info.location.name}: available=${info.available}, writable=${info.writable}`);
        if (info.error) {
          console.log(`    ❌ Error: ${info.error}`);
        }
      });
      
      // Find the first available and writable location in priority order
      for (const location of storageLocations) {
        try {
          console.log(`🔍 Checking location: ${location.name} (${location.id})`);
          
          // Check if this location is available and writable
          const locationInfo = storageInfo.find(info => info.location.id === location.id);
          
          if (locationInfo && locationInfo.available && locationInfo.writable) {
            try {
              // Ensure the models directory exists in the chosen location
              await this.storagePathService.ensureModelsDirectory(location.id);

              // Get the model path
              const modelPath = this.storagePathService.getModelPath(modelId, location.id);

              console.log(`🎯 SELECTED storage location: ${location.name} (${location.id}) for model ${modelId}`);
              console.log(`📁 Full download path: ${modelPath}`);
              
              return {
                path: modelPath,
                location: location.id
              };
            } catch (dirError) {
              console.log(`❌ Failed to ensure directory in ${location.name}:`, dirError);
              console.log(`   Trying next location...`);
              continue; // Try next location
            }
          } else {
            console.log(`❌ Location ${location.name} not suitable: available=${locationInfo?.available}, writable=${locationInfo?.writable}`);
            if (locationInfo?.error) {
              console.log(`   Error: ${locationInfo.error}`);
            }
            console.log(`   Trying next location...`);
          }
        } catch (error) {
          console.log(`❌ Error checking storage location ${location.name}:`, error);
          continue; // Try next location
        }
      }
      
      throw new Error('No available storage location found');
    } catch (error) {
      console.error('❌ Error getting model download path:', error);
      throw error; // Don't fallback to app_data, let the caller handle the error
    }
  }

  /**
   * Helper method to concatenate Uint8Array chunks
   */
  private concatenateChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  /**
   * Helper method to convert Uint8Array to base64 efficiently
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    
    // Process in smaller chunks to avoid call stack issues
    const chunkSize = 8192; // 8KB chunks
    
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  /**
   * Helper method to append data to a file
   */
  private async appendToFile(filePath: string, data: Uint8Array, directory?: any): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Use the efficient base64 conversion
    const base64Data = this.uint8ArrayToBase64(data);
    
    await Filesystem.appendFile({
      path: filePath,
      data: base64Data,
      directory: directory || Directory.Data
    });
  }

  /**
   * Download model for web platform with streaming to reduce memory usage
   */
  private async downloadModelWeb(
    model: LlamaModel, 
    downloadPath: string, 
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void,
    storageLocation?: string
  ): Promise<void> {
    const response = await fetch(model.url!);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Create a temporary file for streaming
    const tempPath = `${downloadPath}.tmp`;
    
    // Get the correct directory based on storage location
    const targetDirectory = this.getDirectoryForLocation(storageLocation);
    
    try {
      
      // Initialize empty file
      await Filesystem.writeFile({
        path: tempPath,
        data: '',
        directory: targetDirectory,
        recursive: true
      });

      const chunkSize = 256 * 1024; // 256KB chunks (reduced to prevent stack overflow)
      let currentChunk: Uint8Array[] = [];
      let currentChunkSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Write any remaining data
          if (currentChunk.length > 0) {
            const finalChunk = this.concatenateChunks(currentChunk);
            await this.appendToFile(tempPath, finalChunk, targetDirectory);
          }
          break;
        }
        
        currentChunk.push(value);
        currentChunkSize += value.length;
        loaded += value.length;
        
        // Write chunk when it reaches the target size
        if (currentChunkSize >= chunkSize) {
          const chunkData = this.concatenateChunks(currentChunk);
          await this.appendToFile(tempPath, chunkData, targetDirectory);
          
          // Clear chunk buffer
          currentChunk = [];
          currentChunkSize = 0;
          
          // Force garbage collection if available
          if (window.gc) {
            window.gc();
          }
        }
        
        if (onProgress && total > 0) {
          const percentage = Math.round((loaded / total) * 100);
          onProgress({ loaded, total, percentage });
        }
      }

      // Rename temp file to final file
      await Filesystem.rename({
        from: tempPath,
        to: downloadPath,
        directory: targetDirectory,
        toDirectory: targetDirectory
      });

    } catch (error) {
      // Clean up temp file on error
      try {
        await Filesystem.deleteFile({
          path: tempPath,
          directory: targetDirectory
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Download model for native platforms with streaming
   */
  private async downloadModelNative(
    model: LlamaModel, 
    downloadPath: string, 
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void,
    storageLocation?: string
  ): Promise<void> {
    const response = await fetch(model.url!);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Create a temporary file for streaming
    const tempPath = `${downloadPath}.tmp`;
    
    // Get the correct directory based on storage location
    const targetDirectory = this.getDirectoryForLocation(storageLocation);
    
    try {
      
      // Initialize empty file
      await Filesystem.writeFile({
        path: tempPath,
        data: '',
        directory: targetDirectory,
        recursive: true
      });

      const chunkSize = 128 * 1024; // 128KB chunks for native (even smaller to be safe)
      let currentChunk: Uint8Array[] = [];
      let currentChunkSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Write any remaining data
          if (currentChunk.length > 0) {
            const finalChunk = this.concatenateChunks(currentChunk);
            await this.appendToFile(tempPath, finalChunk, targetDirectory);
          }
          break;
        }
        
        currentChunk.push(value);
        currentChunkSize += value.length;
        loaded += value.length;
        
        // Write chunk when it reaches the target size
        if (currentChunkSize >= chunkSize) {
          const chunkData = this.concatenateChunks(currentChunk);
          await this.appendToFile(tempPath, chunkData, targetDirectory);
          
          // Clear chunk buffer
          currentChunk = [];
          currentChunkSize = 0;
          
          // Add small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        if (onProgress && total > 0) {
          const percentage = Math.round((loaded / total) * 100);
          onProgress({ loaded, total, percentage });
        }
      }

      // Rename temp file to final file
      await Filesystem.rename({
        from: tempPath,
        to: downloadPath,
        directory: targetDirectory,
        toDirectory: targetDirectory
      });

    } catch (error) {
      // Clean up temp file on error
      try {
        await Filesystem.deleteFile({
          path: tempPath,
          directory: targetDirectory
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Delete a model file from the filesystem across all storage locations
   */
  private async deleteModelFile(modelId: string): Promise<void> {
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      
      // Get model storage information
      const modelInfo = await this.storagePathService.searchModel(modelId);
      
      // Delete the model from all locations where it exists
      for (const [locationId, locationInfo] of Object.entries(modelInfo.locations)) {
        if (locationInfo.exists) {
          const location = this.storagePathService.getStorageLocations().find(loc => loc.id === locationId);
          if (location) {
            try {
              await Filesystem.deleteFile({
                path: locationInfo.path,
                directory: location.directory
              });
              console.log(`Deleted model file from ${location.name}: ${locationInfo.path}`);
            } catch (error) {
              console.warn(`Failed to delete model from ${location.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to delete model file ${modelId}:`, error);
    }
  }

  /**
   * Load a model for inference using the correct API
   */
  async loadModel(modelId: string, contextParams?: Partial<ContextParams>): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('LlamaService not initialized');
      }

      // Remove this Android check - the plugin supports Android
      // if (this.isAndroidPlatform) {
      //   throw new Error('LlamaCpp plugin is not implemented on Android. Please use online mode instead.');
      // }

      const model = this.getModel(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      if (model.status !== 'downloaded') {
        throw new Error(`Model ${modelId} is not downloaded`);
      }

      // Import the correct API
      const { initLlama } = await import('llama-cpp-capacitor');

      if (this.llamaContext) {
        await this.releaseModel();
      }

      // Get the model path from the storage system
      let modelPath = model.path;
      if (modelPath && !modelPath.startsWith('/') && !modelPath.startsWith('file://')) {
        // Get the primary location where the model is stored
        const primaryLocation = await this.storagePathService.getModelPrimaryLocation(modelId);
        if (primaryLocation) {
          const { Filesystem } = await import('@capacitor/filesystem');
          try {
            // Get the full URI for the model file
            const uri = await Filesystem.getUri({
              path: primaryLocation.path,
              directory: primaryLocation.location.directory
            });
            modelPath = uri.uri;
            console.log(`Full model path: ${modelPath}`);
          } catch (error) {
            console.error('Failed to get model URI:', error);
            // Fallback to the stored path
            modelPath = model.path;
          }
        }
      }

      // Convert pooling_type from string to number
      const poolTypeMap = {
        none: 0,
        mean: 1,
        cls: 2,
        last: 3,
        rank: 4,
      };

             // Use extremely conservative parameters for mobile devices to avoid crashes
       const isMobile = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';
       
       const params: ContextParams = {
         model: modelPath || modelId,
         n_ctx: isMobile ? 1024 : 2048, // Smaller context for mobile
         n_batch: isMobile ? 128 : 512, // Much smaller batch size for mobile
         n_threads: isMobile ? 1 : 4, // Single thread for mobile to avoid race conditions
         n_gpu_layers: 0, // Always disable GPU layers to avoid crashes
         use_mmap: isMobile ? false : true, // Disable mmap on mobile
         use_mlock: false, // Always disable mlock to avoid permission issues
         pooling_type: 'none',
         ...contextParams
       };

      // Convert pooling_type to number
      if (params.pooling_type && typeof params.pooling_type === 'string') {
        (params as any).pooling_type = poolTypeMap[params.pooling_type as keyof typeof poolTypeMap] || 0;
      }

      this.llamaContext = await initLlama(params);
      this.currentModel = modelId;

      console.log(`Model ${modelId} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Generate text completion using the correct API
   */
  async completion(
    params: CompletionParams,
    onToken?: (token: TokenData) => void
  ): Promise<CompletionResult> {
    try {
      // Remove this Android check - the plugin supports Android
      // if (this.isAndroidPlatform) {
      //   throw new Error('LlamaCpp plugin is not implemented on Android. Please use online mode instead.');
      // }

      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      const completionParams = {
        n_predict: 128,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        stop: ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>'],
        ...params
      };

      const result = await this.llamaContext.completion(completionParams, onToken);

      // Transform the result to match our interface
      return {
        ...result,
        generation_settings: completionParams
      };
    } catch (error) {
      console.error('Failed to generate completion:', error);
      throw error;
    }
  }

  /**
   * Tokenize text using the correct API
   */
  async tokenize(text: string, options?: { media_paths?: string[] }): Promise<number[]> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      const result = await this.llamaContext.tokenize(text, options);
      return result.tokens || [];
    } catch (error) {
      console.error('Failed to tokenize text:', error);
      throw error;
    }
  }

  /**
   * Detokenize tokens using the correct API
   */
  async detokenize(tokens: number[]): Promise<string> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      return await this.llamaContext.detokenize(tokens);
    } catch (error) {
      console.error('Failed to detokenize tokens:', error);
      throw error;
    }
  }

  /**
   * Get text embeddings using the correct API
   */
  async embedding(text: string, params?: EmbeddingParams): Promise<NativeEmbeddingResult> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      const result = await this.llamaContext.embedding(text, params);
      return {
        embedding: result.embedding || [],
        n_embd: result.n_embd || 0
      };
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Rank documents by relevance using the correct API
   */
  async rerank(query: string, documents: string[], params?: RerankParams): Promise<RerankResult[]> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      return await this.llamaContext.rerank(query, documents, params);
    } catch (error) {
      console.error('Failed to rerank documents:', error);
      throw error;
    }
  }

  /**
   * Benchmark model performance using the correct API
   */
  async bench(pp: number, tg: number, pl: number, nr: number): Promise<BenchResult> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      return await this.llamaContext.bench(pp, tg, pl, nr);
    } catch (error) {
      console.error('Failed to run benchmark:', error);
      throw error;
    }
  }

  /**
   * Stop current completion using the correct API
   */
  async stopCompletion(): Promise<void> {
    try {
      if (!this.llamaContext) {
        return;
      }

      await this.llamaContext.stopCompletion();
    } catch (error) {
      console.error('Failed to stop completion:', error);
      throw error;
    }
  }

  /**
   * Initialize multimodal support using the correct API
   */
  async initMultimodal(params: { path: string; use_gpu?: boolean }): Promise<boolean> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      return await this.llamaContext.initMultimodal(params);
    } catch (error) {
      console.error('Failed to initialize multimodal support:', error);
      throw error;
    }
  }

  /**
   * Check if multimodal is enabled using the correct API
   */
  async isMultimodalEnabled(): Promise<boolean> {
    try {
      if (!this.llamaContext) {
        return false;
      }

      return await this.llamaContext.isMultimodalEnabled();
    } catch (error) {
      console.error('Failed to check multimodal status:', error);
      return false;
    }
  }

  /**
   * Get multimodal capabilities using the correct API
   */
  async getMultimodalSupport(): Promise<{ vision: boolean; audio: boolean }> {
    try {
      if (!this.llamaContext) {
        return { vision: false, audio: false };
      }

      return await this.llamaContext.getMultimodalSupport();
    } catch (error) {
      console.error('Failed to get multimodal support:', error);
      return { vision: false, audio: false };
    }
  }

  /**
   * Initialize TTS vocoder using the correct API
   */
  async initVocoder(params: { path: string; n_batch?: number }): Promise<boolean> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      return await this.llamaContext.initVocoder(params);
    } catch (error) {
      console.error('Failed to initialize vocoder:', error);
      throw error;
    }
  }

  /**
   * Check if TTS is enabled using the correct API
   */
  async isVocoderEnabled(): Promise<boolean> {
    try {
      if (!this.llamaContext) {
        return false;
      }

      return await this.llamaContext.isVocoderEnabled();
    } catch (error) {
      console.error('Failed to check vocoder status:', error);
      return false;
    }
  }

  /**
   * Apply LoRA adapters using the correct API
   */
  async applyLoraAdapters(loraList: Array<{ path: string; scaled?: number }>): Promise<void> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      await this.llamaContext.applyLoraAdapters(loraList);
    } catch (error) {
      console.error('Failed to apply LoRA adapters:', error);
      throw error;
    }
  }

  /**
   * Remove LoRA adapters using the correct API
   */
  async removeLoraAdapters(): Promise<void> {
    try {
      if (!this.llamaContext) {
        return;
      }

      await this.llamaContext.removeLoraAdapters();
    } catch (error) {
      console.error('Failed to remove LoRA adapters:', error);
      throw error;
    }
  }

  /**
   * Save session using the correct API
   */
  async saveSession(filepath: string, options?: { tokenSize: number }): Promise<number> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      return await this.llamaContext.saveSession(filepath, options);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Load session using the correct API
   */
  async loadSession(filepath: string): Promise<NativeSessionLoadResult> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      const result = await this.llamaContext.loadSession(filepath);
      return {
        tokens: result.tokens || [],
        n_tokens: result.n_tokens || 0,
        tokens_loaded: result.tokens_loaded,
        prompt: result.prompt
      };
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    }
  }

  /**
   * Release the current model using the correct API
   */
  async releaseModel(): Promise<void> {
    try {
      if (this.llamaContext) {
        await this.llamaContext.release();
        this.llamaContext = null;
        this.currentModel = null;
      }
    } catch (error) {
      console.error('Failed to release model:', error);
      throw error;
    }
  }

  /**
   * Get current model information
   */
  getCurrentModel(): string | null {
    return this.currentModel;
  }

  /**
   * Check if a model is loaded
   */
  isModelLoaded(): boolean {
    return this.llamaContext !== null;
  }

  /**
   * Get model information
   */
  async getModelInfo(modelPath: string): Promise<any> {
    try {
      const { loadLlamaModelInfo } = await import('llama-cpp-capacitor');
      return await loadLlamaModelInfo(modelPath);
    } catch (error) {
      console.error('Failed to get model info:', error);
      throw error;
    }
  }

  /**
   * Save downloaded models to preferences
   */
  private async saveDownloadedModels(): Promise<void> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ 
        key: 'downloaded_models', 
        value: JSON.stringify(this.downloadedModels) 
      });
    } catch (error) {
      console.error('Failed to save downloaded models:', error);
    }
  }

  /**
   * Release all resources using the correct API
   */
  async release(): Promise<void> {
    try {
      const { releaseAllLlama } = await import('llama-cpp-capacitor');
      await releaseAllLlama();
      this.llamaContext = null;
      this.currentModel = null;
      this.isInitialized = false;
      console.log('LlamaService released successfully');
    } catch (error) {
      console.error('Failed to release LlamaService:', error);
      throw error;
    }
  }

  /**
   * Check if the model supports chat templates based on the loaded context
   */
  async checkChatTemplateSupport(): Promise<boolean> {
    try {
      if (!this.llamaContext) {
        return false;
      }

      console.log(`🔍 [LOCAL DEBUG] Checking chat template support...`);
      console.log(`🔍 [LOCAL DEBUG] llamaContext type:`, typeof this.llamaContext);
      console.log(`🔍 [LOCAL DEBUG] llamaContext keys:`, Object.keys(this.llamaContext));
      
      // Check if model property exists and its structure
      if (this.llamaContext.model) {
        console.log(`🔍 [LOCAL DEBUG] model type:`, typeof this.llamaContext.model);
        console.log(`🔍 [LOCAL DEBUG] model is array:`, Array.isArray(this.llamaContext.model));
        
        // If model is an object, check for chat template properties
        if (typeof this.llamaContext.model === 'object' && !Array.isArray(this.llamaContext.model)) {
          console.log(`🔍 [LOCAL DEBUG] model object keys:`, Object.keys(this.llamaContext.model));
          
          // Check if the model has chat templates
          if (this.llamaContext.model.chatTemplates) {
            console.log(`✅ [LOCAL DEBUG] Model has chat templates:`, Object.keys(this.llamaContext.model.chatTemplates));
            return true;
          }
          
          // Check if isChatTemplateSupported property exists
          if (this.llamaContext.model.isChatTemplateSupported) {
            console.log(`✅ [LOCAL DEBUG] Model supports chat templates: ${this.llamaContext.model.isChatTemplateSupported}`);
            return this.llamaContext.model.isChatTemplateSupported;
          }
        }
      }
      
      // Check if getFormattedChat method exists on the context itself
      if (typeof this.llamaContext.getFormattedChat === 'function') {
        console.log(`✅ [LOCAL DEBUG] getFormattedChat method available on context`);
        return true;
      }
      
      // Check for other possible properties that might indicate chat support
      const contextKeys = Object.keys(this.llamaContext);
      console.log(`🔍 [LOCAL DEBUG] Context properties:`, contextKeys);
      
      // Look for any chat-related properties
      const chatRelatedProps = contextKeys.filter(key => 
        key.toLowerCase().includes('chat') || 
        key.toLowerCase().includes('template') ||
        key.toLowerCase().includes('format')
      );
      
      if (chatRelatedProps.length > 0) {
        console.log(`🔍 [LOCAL DEBUG] Found chat-related properties:`, chatRelatedProps);
      }
      
      return false;
    } catch (error: any) {
      console.log(`⚠️ [LOCAL DEBUG] Error checking chat template support:`, error.message);
      return false;
    }
  }

  /**
   * ARCHITECTURAL FIX: Safe wrapper for getFormattedChat that handles the plugin bug
   * This fixes the destructuring error in the plugin's isJinjaSupported() method
   */
  async getFormattedChatSafe(messages: CompletionMessage[]): Promise<string> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      console.log(`🔄 [LOCAL DEBUG] Formatting chat messages with safe wrapper:`, messages);
      
      // ARCHITECTURAL FIX: Patch the model object to prevent destructuring errors
      const originalModel = this.llamaContext.model;
      
      // Check if model is a string (which it is in this case)
      if (typeof originalModel === 'string') {
        console.log(`🔧 [PLUGIN FIX] Model is a string, creating object wrapper to prevent destructuring error`);
        
        // Create a proper model object with chatTemplates
        this.llamaContext.model = {
          path: originalModel,
          size: 0,
          nEmbd: 0,
          nParams: 0,
          desc: 'Loaded model',
          chatTemplates: {
            llamaChat: false,
            minja: {
              default: false,
              defaultCaps: {
                tools: false,
                toolCalls: false,
                toolResponses: false,
                systemRole: false,
                parallelToolCalls: false,
                toolCallId: false
              },
              toolUse: false,
              toolUseCaps: {
                tools: false,
                toolCalls: false,
                toolResponses: false,
                systemRole: false,
                parallelToolCalls: false,
                toolCallId: false
              }
            }
          }
        };
      } else if (!originalModel.chatTemplates) {
        console.log(`🔧 [PLUGIN FIX] Patching model.chatTemplates to prevent destructuring error`);
        originalModel.chatTemplates = {
          llamaChat: false,
          minja: {
            default: false,
            defaultCaps: {
              tools: false,
              toolCalls: false,
              toolResponses: false,
              systemRole: false,
              parallelToolCalls: false,
              toolCallId: false
            },
            toolUse: false,
            toolUseCaps: {
              tools: false,
              toolCalls: false,
              toolResponses: false,
              systemRole: false,
              parallelToolCalls: false,
              toolCallId: false
            }
          }
        };
      }
      
      // Now call getFormattedChat with jinja disabled to use fallback formatting
      const result = await this.llamaContext.getFormattedChat(
        messages,
        null, // Use default template
        {
          jinja: false, // Disable jinja to prevent the isJinjaSupported() call
          add_generation_prompt: true
        }
      );
      
      // Handle both string and object responses
      const formattedPrompt = typeof result === 'string' ? result : (result?.prompt || result || '');
      
      console.log(`✅ [LOCAL DEBUG] Chat formatted successfully with safe wrapper:`, formattedPrompt);
      return formattedPrompt;
      
    } catch (error: any) {
      console.error(`❌ [LOCAL DEBUG] Error in safe wrapper:`, error);
      
      // Fallback to manual formatting
      console.log(`🔄 [LOCAL DEBUG] Falling back to manual chat formatting`);
      return this.formatChatMessagesFallback(messages);
    }
  }

  /**
   * Format chat messages using the correct API with architectural fixes
   */
  async getFormattedChat(messages: CompletionMessage[]): Promise<string> {
    try {
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      console.log(`🔄 [LOCAL DEBUG] Formatting chat messages:`, messages);
      
      // Use the safe wrapper that fixes the plugin bug
      return await this.getFormattedChatSafe(messages);
      
    } catch (error: any) {
      console.error(`❌ [LOCAL DEBUG] Error formatting chat messages:`, error);
      
      // Fallback to manual formatting on error
      console.log(`🔄 [LOCAL DEBUG] Falling back to manual chat formatting due to error`);
      return this.formatChatMessagesFallback(messages);
    }
  }

  /**
   * Fallback method to manually format chat messages with improved formatting
   */
  private formatChatMessagesFallback(messages: CompletionMessage[]): string {
    try {
      let formattedPrompt = '';
      
      // Add a simple system message if not present
      const hasSystemMessage = messages.some(msg => msg.role === 'system');
      if (!hasSystemMessage) {
        formattedPrompt += 'You are a helpful AI assistant. Please provide clear and helpful responses.\n\n';
      }
      
      for (const message of messages) {
        const role = message.role;
        const content = typeof message.content === 'string' 
          ? message.content 
          : message.content.map(item => item.text || '').join('');
        
        switch (role) {
          case 'system':
            formattedPrompt += `System: ${content}\n\n`;
            break;
          case 'user':
            formattedPrompt += `Human: ${content}\n\n`;
            break;
          case 'assistant':
            formattedPrompt += `Assistant: ${content}\n\n`;
            break;
        }
      }
      
      // Add the assistant prompt
      formattedPrompt += 'Assistant: ';
      
      console.log(`✅ [LOCAL DEBUG] Fallback chat formatting completed:`, formattedPrompt);
      return formattedPrompt;
    } catch (error: any) {
      console.error(`❌ [LOCAL DEBUG] Error in fallback chat formatting:`, error);
      
      // Ultimate fallback - just use the user message
      const userMessage = messages.find(msg => msg.role === 'user');
      if (userMessage) {
        const content = typeof userMessage.content === 'string' 
          ? userMessage.content 
          : userMessage.content.map(item => item.text || '').join('');
        console.log(` [LOCAL DEBUG] Using ultimate fallback with user message only`);
        return content;
      }
      
      throw new Error(`Failed to format chat messages: ${error.message}`);
    }
  }

  /**
   * Generate text completion using formatted chat messages with improved error handling
   * Based on the llama-cpp-capacitor documentation
   */
  async completionWithFormattedChat(
    messages: CompletionMessage[],
    params: Omit<CompletionParams, 'prompt' | 'messages'> = {},
    onToken?: (token: TokenData) => void
  ): Promise<CompletionResult> {
    try {
      console.log(`🔄 [LOCAL DEBUG] Starting completion with formatted chat`);
      
      if (!this.llamaContext) {
        throw new Error('No model loaded. Please load a model first.');
      }

      // Format the chat messages
      const formattedPrompt = await this.getFormattedChat(messages);
      
      // Prepare completion parameters with better defaults
      const completionParams: CompletionParams = {
        prompt: formattedPrompt,
        n_predict: 256,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        stop: ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>', '<|im_end|>', 'Human:', 'User:', 'System:'],
        ...params
      };

      console.log(`🔄 [LOCAL DEBUG] Generating completion with formatted prompt length:`, formattedPrompt.length);
      console.log(`🔄 [LOCAL DEBUG] Completion params:`, {
        n_predict: completionParams.n_predict,
        temperature: completionParams.temperature,
        top_p: completionParams.top_p,
        stop: completionParams.stop
      });
      
      const result = await this.llamaContext.completion(completionParams, onToken);

      console.log(`✅ [LOCAL DEBUG] Completion generated successfully`);
      console.log(`✅ [LOCAL DEBUG] Result keys:`, Object.keys(result));
      console.log(`✅ [LOCAL DEBUG] Response length:`, (result.text || result.content || '').length);

      // Transform the result to match our interface
      return {
        ...result,
        generation_settings: completionParams
      };
    } catch (error: any) {
      console.error(`❌ [LOCAL DEBUG] Error in completion with formatted chat:`, error);
      console.error(`❌ [LOCAL DEBUG] Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }
}

export default LlamaService;