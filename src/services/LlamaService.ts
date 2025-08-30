import { Capacitor } from '@capacitor/core';

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
  private availableModels: LlamaModel[] = [
    {
      id: 'smol_0_1',
      name: 'SmoL-015',
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
      sizeMB: 2048,
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
      name: 'HermesVision',
      sizeMB: 3154,
      status: 'available',
      description: 'NousResearch Hermes 2 Vision model',
      url: 'https://huggingface.co/PsiPi/NousResearch_Nous-Hermes-2-Vision-GGUF/resolve/main/NousResearch_Nous-Hermes-2-Vision-GGUF_Q2_K.gguf'
    },
    {
      id: 'hermes_mistral',
      name: 'Hermes-Mistral',
      sizeMB: 2785,
      status: 'available',
      description: 'Hermes 2 Pro Mistral 7B model',
      url: 'https://huggingface.co/NousResearch/Hermes-2-Pro-Mistral-7B-GGUF/resolve/main/Hermes-2-Pro-Mistral-7B.Q2_K.gguf'
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

  public static getInstance(): LlamaService {
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

      // Load any previously downloaded models
      await this.loadDownloadedModels();
      
      this.isInitialized = true;
      console.log('LlamaService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LlamaService:', error);
      throw error;
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
   * Get a specific model by ID
   */
  getModel(modelId: string): LlamaModel | null {
    return this.availableModels.find(model => model.id === modelId) || null;
  }

  /**
   * Check if a model file exists on the filesystem
   */
  private async checkModelFileExists(modelId: string): Promise<boolean> {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const downloadPath = await this.getModelDownloadPath(modelId);
      
      await Filesystem.stat({
        path: downloadPath,
        directory: Directory.Documents
      });
      
      console.log(`Model file exists: ${downloadPath}`);
      return true;
    } catch (error) {
      console.log(`Model file does not exist: ${modelId}`);
      return false;
    }
  }

  /**
   * Verify downloaded model integrity
   */
  private async verifyModelIntegrity(modelId: string): Promise<boolean> {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const downloadPath = await this.getModelDownloadPath(modelId);
      const model = this.getModel(modelId);
      
      if (!model) {
        return false;
      }

      const fileInfo = await Filesystem.stat({
        path: downloadPath,
        directory: Directory.Documents
      });

      // Check if file size is reasonable (at least 1MB and not empty)
      const fileSizeBytes = fileInfo.size || 0;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);
      
      console.log(`Model file size: ${fileSizeMB.toFixed(2)}MB (expected: ~${model.sizeMB}MB)`);
      
      // Allow some tolerance in file size (models can be slightly different sizes)
      const minExpectedSize = model.sizeMB * 0.8; // 80% of expected size
      const maxExpectedSize = model.sizeMB * 1.2; // 120% of expected size
      
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
      if (fileExists) {
        // Verify the existing file integrity
        const isValid = await this.verifyModelIntegrity(modelId);
        if (isValid) {
          console.log(`Model ${modelId} already exists and is valid, skipping download`);
          
          // Update model status and add to downloaded models if not already there
          model.status = 'downloaded';
          model.path = await this.getModelDownloadPath(modelId);
          
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

      // Get the standard download path for the platform
      const downloadPath = await this.getModelDownloadPath(modelId);
      
      console.log(`Downloading model ${modelId} from ${model.url} to ${downloadPath}`);

      // For web platform, use fetch with progress tracking
      if (Capacitor.getPlatform() === 'web') {
        await this.downloadModelWeb(model, downloadPath, onProgress);
      } else {
        // For native platforms, use Capacitor HTTP with progress
        await this.downloadModelNative(model, downloadPath, onProgress);
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
   * Get the download path for a model
   */
  private async getModelDownloadPath(modelId: string): Promise<string> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    try {
      // Check if models directory already exists
      try {
        await Filesystem.stat({
          path: 'models',
          directory: Directory.Documents
        });
        // Directory exists, no need to create it
      } catch (statError) {
        // Directory doesn't exist, create it
        await Filesystem.mkdir({
          path: 'models',
          directory: Directory.Documents,
          recursive: true
        });
      }

      // Sanitize the model ID to create a valid filename
      // Replace dots and other problematic characters with underscores
      const sanitizedId = modelId.replace(/[.-]/g, '_');
      
      // Return the full path for the model file
      return `models/${sanitizedId}.gguf`;
    } catch (error) {
      console.error('Error handling models directory:', error);
      // Fallback to a default path with sanitized ID
      const sanitizedId = modelId.replace(/[.-]/g, '_');
      return `models/${sanitizedId}.gguf`;
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
  private async appendToFile(filePath: string, data: Uint8Array): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Use the efficient base64 conversion
    const base64Data = this.uint8ArrayToBase64(data);
    
    await Filesystem.appendFile({
      path: filePath,
      data: base64Data,
      directory: Directory.Documents
    });
  }

  /**
   * Download model for web platform with streaming to reduce memory usage
   */
  private async downloadModelWeb(
    model: LlamaModel, 
    downloadPath: string, 
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
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
    
    try {
      // Initialize empty file
      await Filesystem.writeFile({
        path: tempPath,
        data: '',
        directory: Directory.Documents,
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
            await this.appendToFile(tempPath, finalChunk);
          }
          break;
        }
        
        currentChunk.push(value);
        currentChunkSize += value.length;
        loaded += value.length;
        
        // Write chunk when it reaches the target size
        if (currentChunkSize >= chunkSize) {
          const chunkData = this.concatenateChunks(currentChunk);
          await this.appendToFile(tempPath, chunkData);
          
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
        directory: Directory.Documents,
        toDirectory: Directory.Documents
      });

    } catch (error) {
      // Clean up temp file on error
      try {
        await Filesystem.deleteFile({
          path: tempPath,
          directory: Directory.Documents
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
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
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
    
    try {
      // Initialize empty file
      await Filesystem.writeFile({
        path: tempPath,
        data: '',
        directory: Directory.Documents,
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
            await this.appendToFile(tempPath, finalChunk);
          }
          break;
        }
        
        currentChunk.push(value);
        currentChunkSize += value.length;
        loaded += value.length;
        
        // Write chunk when it reaches the target size
        if (currentChunkSize >= chunkSize) {
          const chunkData = this.concatenateChunks(currentChunk);
          await this.appendToFile(tempPath, chunkData);
          
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
        directory: Directory.Documents,
        toDirectory: Directory.Documents
      });

    } catch (error) {
      // Clean up temp file on error
      try {
        await Filesystem.deleteFile({
          path: tempPath,
          directory: Directory.Documents
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Delete a model file from the filesystem
   */
  private async deleteModelFile(modelId: string): Promise<void> {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const downloadPath = await this.getModelDownloadPath(modelId);
      
      await Filesystem.deleteFile({
        path: downloadPath,
        directory: Directory.Documents
      });
      
      console.log(`Deleted model file: ${downloadPath}`);
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

      // Convert pooling_type from string to number
      const poolTypeMap = {
        none: 0,
        mean: 1,
        cls: 2,
        last: 3,
        rank: 4,
      };

      const params: ContextParams = {
        model: model.path || modelId,
        n_ctx: 2048,
        n_batch: 512,
        n_threads: 4,
        n_gpu_layers: 99,
        use_mmap: true,
        use_mlock: true,
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
}

// Export singleton instance
export default LlamaService.getInstance();
