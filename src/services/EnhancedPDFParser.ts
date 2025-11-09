// src/services/EnhancedPDFParser.ts
// @ts-ignore - MuPDF types may not be fully compatible
import * as mupdf from "mupdf";
import { createWorker, Worker } from 'tesseract.js';
import RedactionDatabaseService, {
  ImageAnnotation,
  TextSectionAnnotation
} from './RedactionDatabaseService';

/**
 * Enhanced PDF Parser - Advanced PDF analysis with detailed annotations
 * 
 * Features:
 * - Image extraction with multi-unit dimensions (px, cm, inches)
 * - Caption detection for images (Fig 1.1, etc.)
 * - Hierarchical text section parsing
 * - Font and style analysis
 * - Bounding box extraction
 * - DPI calculation
 */

export interface ParsedImage {
  index: number;
  pageNumber: number;
  sectionId: string;
  
  // Dimensions in multiple units
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  widthInches: number;
  heightInches: number;
  
  // Position
  bbox: [number, number, number, number];
  
  // Caption information
  caption?: {
    text: string;
    position: 'top' | 'bottom' | 'left' | 'right';
    bbox: [number, number, number, number];
    distance: number; // Distance from image in points
  };
  
  // Image properties
  format?: string;
  colorSpace?: string;
  dpi?: number;
  isInline: boolean;
  hasTransparency: boolean;
  
  // OCR results (NEW)
  ocrText?: string;
  ocrConfidence?: number;
  ocrLanguage?: string;
  ocrDetectedLanguages?: Array<{ lang: string; confidence: number }>;
  
  metadata?: any;
}

export interface ParsedTextSection {
  index: number;
  pageNumber: number;
  sectionId: string;
  
  // Hierarchical structure
  parentSectionId?: string;
  level: number;
  title?: string;
  
  // Content
  text: string;
  type: 'paragraph' | 'heading' | 'list' | 'table' | 'caption' | 'other';
  wordCount: number;
  charCount: number;
  
  // Position
  bbox?: [number, number, number, number];
  
  // Typography
  fontName?: string;
  fontSize?: number;
  isBold: boolean;
  isItalic: boolean;
  textColor?: string;
  
  // Semantic information
  containsNumbers: boolean;
  containsUrls: boolean;
  language?: string;
  
  metadata?: any;
}

export interface PDFParseResult {
  documentId: string;
  pageCount: number;
  images: ParsedImage[];
  textSections: ParsedTextSection[];
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modDate?: string;
    // OCR metadata (NEW)
    ocrEnabled?: boolean;
    ocrLanguages?: string;
    totalOcrImages?: number;
    ocrProcessingTime?: number;
  };
}

// NEW: OCR Configuration interface
export interface OCRConfig {
  enabled: boolean;
  primaryLanguage?: string;
  fallbackLanguages?: string[];
  minImageSize?: number; // Skip images smaller than this (in pixels)
  maxImageSize?: number; // Resize images larger than this
  progressCallback?: (current: number, total: number, imageIndex: number) => void;
}

class EnhancedPDFParser {
  private static instance: EnhancedPDFParser;
  private readonly POINTS_PER_INCH = 72; // PDF standard
  private readonly POINTS_PER_CM = 28.3465;
  private readonly DEFAULT_DPI = 72;
  
  // Caption detection patterns
  private readonly CAPTION_PATTERNS = [
    /^(Fig(?:ure)?\.?\s*\d+(?:\.\d+)*)/i,
    /^(Table\s*\d+(?:\.\d+)*)/i,
    /^(Image\s*\d+(?:\.\d+)*)/i,
    /^(Diagram\s*\d+(?:\.\d+)*)/i,
    /^(Chart\s*\d+(?:\.\d+)*)/i,
    /^(Photo\s*\d+(?:\.\d+)*)/i,
    /^(Illustration\s*\d+(?:\.\d+)*)/i,
  ];
  
  // Heading detection (font size based)
  private readonly HEADING_MIN_SIZE = 14;

  // NEW: Language mappings (similar to Python version)
  private readonly TESSERACT_LANGUAGES: Record<string, string> = {
    hindi: 'hin',
    english: 'eng',
    arabic: 'ara',
    chinese: 'chi_sim+chi_tra',
    japanese: 'jpn',
    korean: 'kor',
    spanish: 'spa',
    french: 'fra',
    german: 'deu',
    russian: 'rus',
    portuguese: 'por',
    italian: 'ita',
    bengali: 'ben',
    gujarati: 'guj',
    punjabi: 'pan',
    tamil: 'tam',
    telugu: 'tel',
    kannada: 'kan',
    malayalam: 'mal',
    marathi: 'mar',
    nepali: 'nep',
    urdu: 'urd',
    assamese: 'asm',
    oriya: 'ori',
    sinhala: 'sin',
    thai: 'tha',
    vietnamese: 'vie',
    dutch: 'nld',
    swedish: 'swe',
    norwegian: 'nor',
    danish: 'dan',
    finnish: 'fin',
    turkish: 'tur',
    greek: 'ell',
    hebrew: 'heb'
  };

  // NEW: OCR worker instance
  private ocrWorker: Worker | null = null;
  private ocrEnabled = false;

  private constructor() {}

  public static getInstance(): EnhancedPDFParser {
    if (!EnhancedPDFParser.instance) {
      EnhancedPDFParser.instance = new EnhancedPDFParser();
    }
    return EnhancedPDFParser.instance;
  }

  // NEW: Initialize OCR worker
  private async initializeOCR(config: OCRConfig): Promise<void> {
    if (!config.enabled || this.ocrWorker) {
      return;
    }

    try {
      console.log('🔍 [EnhancedPDFParser] Initializing Tesseract OCR...');
      
      const languages = this.getLanguageCodes(
        config.primaryLanguage || 'english',
        config.fallbackLanguages || ['english', 'hindi']
      );
      
      console.log(`🔍 [EnhancedPDFParser] Loading OCR languages: ${languages}`);
      
      // Get base URL for local files
      const baseUrl = window.location.origin;
      
      // Debug logging
      console.log(`🔍 [EnhancedPDFParser] Current URL: ${window.location.href}`);
      console.log(`🔍 [EnhancedPDFParser] Origin: ${baseUrl}`);
      console.log(`🔍 [EnhancedPDFParser] Worker path: ${baseUrl}/tesseract/worker.min.js`);
      console.log(`🔍 [EnhancedPDFParser] Lang path: ${baseUrl}/tessdata`);
      console.log(`🔍 [EnhancedPDFParser] Core path: ${baseUrl}/tesseract/tesseract-core-lstm.wasm.js`);
      
      this.ocrWorker = await createWorker(languages, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`🔍 [OCR Progress] ${Math.round(m.progress * 100)}%`);
          }
          if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
            console.log(`🔍 [OCR] ${m.status}...`);
          }
        },
        // Use LOCAL paths for offline OCR (files in public directory)
        workerPath: `${baseUrl}/tesseract/worker.min.js`,
        langPath: `${baseUrl}/tessdata`,
        corePath: `${baseUrl}/tesseract/tesseract-core-lstm.wasm.js`,
        // Additional config for better compatibility
        cacheMethod: 'none', // Disable caching for local files
        gzip: true // Language files are gzipped
      });
      
      this.ocrEnabled = true;
      console.log('✅ [EnhancedPDFParser] OCR initialized successfully');
      
    } catch (error) {
      console.warn('⚠️ [EnhancedPDFParser] OCR initialization failed (network/CORS issue):', error);
      console.warn('⚠️ [EnhancedPDFParser] Continuing without OCR - images will be processed without text extraction');
      console.warn('ℹ️  [EnhancedPDFParser] OCR requires internet access to CDN. To enable OCR:');
      console.warn('   1. Check your internet connection');
      console.warn('   2. Ensure CDN access is not blocked (unpkg.com, tessdata.projectnaptha.com)');
      console.warn('   3. Or disable OCR in configuration');
      this.ocrEnabled = false;
      // Don't throw - allow parsing to continue without OCR
    }
  }

  // NEW: Get language codes for Tesseract
  private getLanguageCodes(primaryLanguage: string, fallbackLanguages: string[]): string {
    const languages: string[] = [];
    
    // Add primary language
    if (primaryLanguage !== 'auto' && primaryLanguage in this.TESSERACT_LANGUAGES) {
      languages.push(this.TESSERACT_LANGUAGES[primaryLanguage]);
    }

    // Add fallback languages
    fallbackLanguages.forEach(lang => {
      if (lang in this.TESSERACT_LANGUAGES) {
        const code = this.TESSERACT_LANGUAGES[lang];
        if (!languages.includes(code)) {
          languages.push(code);
        }
      }
    });

    // Default to English + Hindi if none specified
    return languages.length > 0 ? languages.join('+') : 'eng+hin';
  }

  // NEW: Perform OCR on image
  private async performOCR(
    imageElement: HTMLImageElement | HTMLCanvasElement,
    imageIndex: number
  ): Promise<{
    text: string;
    confidence: number;
    language?: string;
  }> {
    if (!this.ocrWorker || !this.ocrEnabled) {
      return { text: '', confidence: 0 };
    }

    try {
      const result = await this.ocrWorker.recognize(imageElement);
      
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        language: result.data.text ? 'detected' : 'none'
      };
    } catch (error) {
      console.error(`❌ [EnhancedPDFParser] OCR failed for image ${imageIndex}:`, error);
      return { text: '', confidence: 0 };
    }
  }

  // NEW: Detect language from image
  private async detectLanguage(
    imageElement: HTMLImageElement | HTMLCanvasElement
  ): Promise<Array<{ lang: string; confidence: number }>> {
    if (!this.ocrWorker || !this.ocrEnabled) {
      return [];
    }

    try {
      const result = await this.ocrWorker.detect(imageElement);
      // Tesseract.js returns a different structure, we'll parse it
      const detectData = result.data as any;
      if (detectData && Array.isArray(detectData)) {
        return detectData.map((lang: any) => ({
          lang: lang.lang || lang.language || 'unknown',
          confidence: lang.confidence || 0
        }));
      }
      return [];
    } catch (error) {
      console.error('❌ [EnhancedPDFParser] Language detection failed:', error);
      return [];
    }
  }

  // NEW: Convert MuPDF image to canvas for OCR
  private async imageToCanvas(
    page: mupdf.PDFPage,
    bbox: mupdf.Rect,
    scale: number = 2
  ): Promise<HTMLCanvasElement | null> {
    try {
      // Extract the image region as a pixmap
      const matrix = mupdf.Matrix.scale(scale, scale);
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
      
      // Create canvas from pixmap
      const canvas = document.createElement('canvas');
      const imageData = pixmap.asImageData();
      
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      
      ctx.putImageData(imageData, 0, 0);
      return canvas;
      
    } catch (error) {
      console.error('❌ [EnhancedPDFParser] Failed to convert image to canvas:', error);
      return null;
    }
  }

  // NEW: Terminate OCR worker
  async terminateOCR(): Promise<void> {
    if (this.ocrWorker) {
      try {
        await this.ocrWorker.terminate();
        this.ocrWorker = null;
        this.ocrEnabled = false;
        console.log('✅ [EnhancedPDFParser] OCR worker terminated');
      } catch (error) {
        console.error('❌ [EnhancedPDFParser] Failed to terminate OCR worker:', error);
      }
    }
  }

  /**
   * Parse PDF with comprehensive annotation and OCR
   */
  async parsePDF(
    fileBuffer: ArrayBuffer,
    documentId: string,
    options: {
      extractImages?: boolean;
      extractText?: boolean;
      detectCaptions?: boolean;
      analyzeHierarchy?: boolean;
      maxImageDistance?: number; // Max distance in points to consider text as caption
      ocr?: OCRConfig; // NEW
    } = {}
  ): Promise<PDFParseResult> {
    const defaultOptions = {
      extractImages: true,
      extractText: true,
      detectCaptions: true,
      analyzeHierarchy: true,
      maxImageDistance: 50, // ~0.7 inches
      ocr: { enabled: false } as OCRConfig,
      ...options
    };

    // Initialize OCR if enabled
    if (defaultOptions.ocr?.enabled) {
      await this.initializeOCR(defaultOptions.ocr);
    }

    const ocrStartTime = Date.now();
    let totalOcrImages = 0;

    try {
      console.log(`📄 [EnhancedPDFParser] Starting enhanced PDF parsing for document: ${documentId}`);
      
      const document = mupdf.Document.openDocument(fileBuffer, "application/pdf") as mupdf.PDFDocument;
      
      if (document.needsPassword()) {
        throw new Error("Password-protected PDFs are not supported");
      }
      
      const pageCount = document.countPages();
      console.log(`📄 [EnhancedPDFParser] Document has ${pageCount} pages`);
      
      const images: ParsedImage[] = [];
      const textSections: ParsedTextSection[] = [];
      let globalImageIndex = 0;
      let globalTextIndex = 0;
      
      // Extract metadata
      const metadata = this.extractMetadata(document);
      
      // Process each page
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        console.log(`📄 [EnhancedPDFParser] Processing page ${pageIndex + 1}/${pageCount}`);
        const page = document.loadPage(pageIndex);
        
        // Get page dimensions for DPI calculation
        const pageBounds = page.getBounds();
        const pageDPI = this.calculatePageDPI(pageBounds);
        
        // Extract images with OCR
        if (defaultOptions.extractImages) {
          const pageImages = await this.extractImagesFromPage(
            page,
            pageIndex,
            documentId,
            globalImageIndex,
            pageDPI,
            defaultOptions.ocr // Pass OCR config
          );
          
          images.push(...pageImages);
          globalImageIndex += pageImages.length;
          
          // Count OCR-processed images
          totalOcrImages += pageImages.filter(img => img.ocrText).length;
          
          // Progress callback
          if (defaultOptions.ocr?.progressCallback) {
            defaultOptions.ocr.progressCallback(pageIndex + 1, pageCount, globalImageIndex);
          }
        }
        
        // Extract text sections
        if (defaultOptions.extractText) {
          const pageTextSections = await this.extractTextSectionsFromPage(
            page,
            pageIndex,
            documentId,
            globalTextIndex,
            defaultOptions.analyzeHierarchy
          );
          textSections.push(...pageTextSections);
          globalTextIndex += pageTextSections.length;
        }
        
        // Detect captions for images
        if (defaultOptions.detectCaptions && images.length > 0 && textSections.length > 0) {
          this.associateCaptionsWithImages(
            images.filter(img => img.pageNumber === pageIndex),
            textSections.filter(ts => ts.pageNumber === pageIndex),
            defaultOptions.maxImageDistance
          );
        }
      }
      
      const ocrProcessingTime = Date.now() - ocrStartTime;
      
      console.log(`✅ [EnhancedPDFParser] Parsing complete: ${images.length} images, ${textSections.length} text sections`);
      if (defaultOptions.ocr?.enabled) {
        console.log(`✅ [EnhancedPDFParser] OCR processed ${totalOcrImages} images in ${(ocrProcessingTime / 1000).toFixed(2)}s`);
      }
      
      return {
        documentId,
        pageCount,
        images,
        textSections,
        metadata: {
          ...metadata,
          ocrEnabled: defaultOptions.ocr?.enabled,
          ocrLanguages: defaultOptions.ocr?.enabled 
            ? this.getLanguageCodes(
                defaultOptions.ocr.primaryLanguage || 'english',
                defaultOptions.ocr.fallbackLanguages || ['english', 'hindi']
              )
            : undefined,
          totalOcrImages,
          ocrProcessingTime
        }
      };
      
    } catch (error) {
      console.error('❌ [EnhancedPDFParser] Failed to parse PDF:', error);
      throw error;
    } finally {
      // Cleanup OCR worker if enabled
      if (defaultOptions.ocr?.enabled) {
        await this.terminateOCR();
      }
    }
  }

  /**
   * Extract images from a page with OCR support
   */
  private async extractImagesFromPage(
    page: mupdf.PDFPage,
    pageNumber: number,
    documentId: string,
    startIndex: number,
    pageDPI: number,
    ocrConfig?: OCRConfig // NEW parameter
  ): Promise<ParsedImage[]> {
    const images: ParsedImage[] = [];
    
    try {
      const extractedImages: Array<{
        bbox: mupdf.Rect;
        matrix: mupdf.Matrix;
        image: mupdf.Image;
      }> = [];
      
      // Extract images using structured text
      page.toStructuredText("preserve-images").walk({
        onImageBlock: (bbox: any, matrix: any, image: any) => {
          extractedImages.push({ bbox, matrix, image });
        }
      });
      
      console.log(`📄 [EnhancedPDFParser] Found ${extractedImages.length} images on page ${pageNumber + 1}`);
      
      for (let i = 0; i < extractedImages.length; i++) {
        const img = extractedImages[i];
        const sectionId = `${documentId}_img_p${pageNumber}_i${i}`;
        
        // Calculate dimensions in pixels (from bounding box)
        const widthPx = Math.round(img.bbox[2] - img.bbox[0]);
        const heightPx = Math.round(img.bbox[3] - img.bbox[1]);
        
        // Convert to cm and inches
        const widthInches = widthPx / this.POINTS_PER_INCH;
        const heightInches = heightPx / this.POINTS_PER_INCH;
        const widthCm = widthPx / this.POINTS_PER_CM;
        const heightCm = heightPx / this.POINTS_PER_CM;
        
        // Get image properties
        let format: string | undefined;
        let colorSpace: string | undefined;
        let hasTransparency = false;
        
        try {
          // Try to get image metadata
          const imageObj = img.image;
          if (imageObj) {
            // MuPDF image properties
            colorSpace = imageObj.getColorSpace ? imageObj.getColorSpace() : undefined;
            hasTransparency = colorSpace === 'DeviceRGBA' || colorSpace === 'DeviceGray+Alpha';
          }
        } catch (error) {
          console.warn('⚠️ [EnhancedPDFParser] Could not extract image properties:', error);
        }
        
        const parsedImage: ParsedImage = {
          index: startIndex + i,
          pageNumber,
          sectionId,
          widthPx,
          heightPx,
          widthCm: parseFloat(widthCm.toFixed(2)),
          heightCm: parseFloat(heightCm.toFixed(2)),
          widthInches: parseFloat(widthInches.toFixed(2)),
          heightInches: parseFloat(heightInches.toFixed(2)),
          bbox: [img.bbox[0], img.bbox[1], img.bbox[2], img.bbox[3]],
          format,
          colorSpace,
          dpi: pageDPI,
          isInline: false,
          hasTransparency,
          metadata: {
            extractedAt: new Date().toISOString(),
            pageNumber: pageNumber + 1,
            imageIndex: i
          }
        };
        
        // NEW: Perform OCR if enabled
        if (ocrConfig?.enabled && this.ocrEnabled) {
          const minSize = ocrConfig.minImageSize || 50;
          
          // Only OCR images above minimum size
          if (widthPx >= minSize && heightPx >= minSize) {
            try {
              console.log(`🔍 [EnhancedPDFParser] Running OCR on image ${i + 1}...`);
              
              const canvas = await this.imageToCanvas(page, img.bbox);
              if (canvas) {
                const ocrResult = await this.performOCR(canvas, startIndex + i);
                const detectedLanguages = await this.detectLanguage(canvas);
                
                if (ocrResult.text.trim()) {
                  parsedImage.ocrText = ocrResult.text;
                  parsedImage.ocrConfidence = ocrResult.confidence;
                  parsedImage.ocrLanguage = ocrResult.language;
                  parsedImage.ocrDetectedLanguages = detectedLanguages;
                  
                  console.log(`✅ [EnhancedPDFParser] OCR extracted ${ocrResult.text.length} characters (confidence: ${ocrResult.confidence.toFixed(1)}%)`);
                }
              }
            } catch (error) {
              console.error(`❌ [EnhancedPDFParser] OCR failed for image ${i}:`, error);
            }
          } else {
            console.log(`⏭️ [EnhancedPDFParser] Skipping OCR for small image ${i + 1} (${widthPx}x${heightPx}px)`);
          }
        }
        
        images.push(parsedImage);
        
        console.log(`📷 [EnhancedPDFParser] Image ${i + 1}: ${widthCm.toFixed(1)}cm x ${heightCm.toFixed(1)}cm (${widthInches.toFixed(2)}" x ${heightInches.toFixed(2)}")`);
      }
      
    } catch (error) {
      console.error('❌ [EnhancedPDFParser] Failed to extract images from page:', error);
    }
    
    return images;
  }

  /**
   * Extract text sections from a page with font and style analysis
   */
  private async extractTextSectionsFromPage(
    page: mupdf.PDFPage,
    pageNumber: number,
    documentId: string,
    startIndex: number,
    analyzeHierarchy: boolean
  ): Promise<ParsedTextSection[]> {
    const sections: ParsedTextSection[] = [];
    
    try {
      // Extract structured text with detailed information
      const structuredText = page.toStructuredText("preserve-whitespace,preserve-spans");
      
      // Collect text blocks with font information
      interface TextBlock {
        text: string;
        bbox: mupdf.Rect;
        fontSize: number;
        fontName: string;
        isBold: boolean;
        isItalic: boolean;
        color?: string;
      }
      
      const textBlocks: TextBlock[] = [];
      let currentBlock: TextBlock | null = null;
      
      structuredText.walk({
        beginLine: () => {
          if (currentBlock !== null && currentBlock.text.trim()) {
            textBlocks.push(currentBlock);
          }
          currentBlock = null;
        },
        onChar: (char: string, origin: any, font: any, size: number, quad: any) => {
          if (!currentBlock) {
            currentBlock = {
              text: '',
              bbox: [quad[0], quad[1], quad[6], quad[7]],
              fontSize: size,
              fontName: font?.getName ? font.getName() : 'Unknown',
              isBold: font?.isBold ? font.isBold() : false,
              isItalic: font?.isItalic ? font.isItalic() : false
            };
          }
          
          currentBlock.text += char;
          // Update bounding box
          currentBlock.bbox[0] = Math.min(currentBlock.bbox[0], quad[0]);
          currentBlock.bbox[1] = Math.min(currentBlock.bbox[1], quad[1]);
          currentBlock.bbox[2] = Math.max(currentBlock.bbox[2], quad[6]);
          currentBlock.bbox[3] = Math.max(currentBlock.bbox[3], quad[7]);
        },
        endLine: () => {
          if (currentBlock !== null && currentBlock.text.trim()) {
            textBlocks.push(currentBlock);
            currentBlock = null;
          }
        }
      });
      
      // Add last block if exists
      if (currentBlock !== null) {
        const lastBlock: TextBlock = currentBlock;
        if (lastBlock.text.trim()) {
          textBlocks.push(lastBlock);
        }
      }
      
      console.log(`📄 [EnhancedPDFParser] Extracted ${textBlocks.length} text blocks from page ${pageNumber + 1}`);
      
      // Group blocks into sections
      const groupedSections = this.groupTextBlocks(textBlocks, analyzeHierarchy);
      
      // Create ParsedTextSection objects
      for (let i = 0; i < groupedSections.length; i++) {
        const group = groupedSections[i];
        const sectionId = `${documentId}_txt_p${pageNumber}_s${i}`;
        
        const text = group.blocks.map(b => b.text).join(' ').trim();
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const charCount = text.length;
        
        // Determine content type
        const contentType = this.determineContentType(group);
        
        // Calculate merged bounding box
        const bbox = this.mergeBoundingBoxes(group.blocks.map(b => b.bbox));
        
        // Semantic analysis
        const containsNumbers = /\d/.test(text);
        const containsUrls = /https?:\/\/|www\./i.test(text);
        
        const section: ParsedTextSection = {
          index: startIndex + i,
          pageNumber,
          sectionId,
          level: group.level,
          title: contentType === 'heading' ? text : undefined,
          text,
          type: contentType,
          wordCount,
          charCount,
          bbox,
          fontName: group.blocks[0]?.fontName,
          fontSize: group.blocks[0]?.fontSize,
          isBold: group.blocks[0]?.isBold || false,
          isItalic: group.blocks[0]?.isItalic || false,
          containsNumbers,
          containsUrls,
          metadata: {
            extractedAt: new Date().toISOString(),
            pageNumber: pageNumber + 1,
            blockCount: group.blocks.length
          }
        };
        
        sections.push(section);
      }
      
    } catch (error) {
      console.error('❌ [EnhancedPDFParser] Failed to extract text sections from page:', error);
    }
    
    return sections;
  }

  /**
   * Group text blocks into logical sections
   */
  private groupTextBlocks(
    blocks: Array<{ text: string; bbox: mupdf.Rect; fontSize: number; fontName: string; isBold: boolean; isItalic: boolean }>,
    analyzeHierarchy: boolean
  ): Array<{
    blocks: Array<{ text: string; bbox: mupdf.Rect; fontSize: number; fontName: string; isBold: boolean; isItalic: boolean }>;
    level: number;
  }> {
    const groups: Array<{
      blocks: Array<{ text: string; bbox: mupdf.Rect; fontSize: number; fontName: string; isBold: boolean; isItalic: boolean }>;
      level: number;
    }> = [];
    
    if (!analyzeHierarchy) {
      // Simple grouping: each block is its own section
      return blocks.map(block => ({
        blocks: [block],
        level: 1
      }));
    }
    
    // Group by font size and style (headings vs paragraphs)
    let currentGroup: Array<{ text: string; bbox: mupdf.Rect; fontSize: number; fontName: string; isBold: boolean; isItalic: boolean }> = [];
    let currentLevel = 1;
    
    for (const block of blocks) {
      const isHeading = block.fontSize >= this.HEADING_MIN_SIZE || block.isBold;
      const level = isHeading ? (block.fontSize >= 18 ? 1 : 2) : 3;
      
      // Start new group if level changes or it's a heading
      if (currentGroup.length > 0 && (level !== currentLevel || isHeading)) {
        groups.push({
          blocks: currentGroup,
          level: currentLevel
        });
        currentGroup = [];
      }
      
      currentGroup.push(block);
      currentLevel = level;
    }
    
    // Add final group
    if (currentGroup.length > 0) {
      groups.push({
        blocks: currentGroup,
        level: currentLevel
      });
    }
    
    return groups;
  }

  /**
   * Determine content type from text block group
   */
  private determineContentType(group: {
    blocks: Array<{ text: string; fontSize: number; isBold: boolean }>;
    level: number;
  }): 'paragraph' | 'heading' | 'list' | 'table' | 'caption' | 'other' {
    const text = group.blocks.map(b => b.text).join(' ').trim();
    
    // Check for captions
    if (this.CAPTION_PATTERNS.some(pattern => pattern.test(text))) {
      return 'caption';
    }
    
    // Check for headings
    if (group.level <= 2 || group.blocks[0]?.fontSize >= this.HEADING_MIN_SIZE || group.blocks[0]?.isBold) {
      return 'heading';
    }
    
    // Check for lists
    if (/^[\d•\-\*]\s/.test(text)) {
      return 'list';
    }
    
    // Default to paragraph
    return 'paragraph';
  }

  /**
   * Associate captions with nearby images
   */
  private associateCaptionsWithImages(
    images: ParsedImage[],
    textSections: ParsedTextSection[],
    maxDistance: number
  ): void {
    // Find caption sections
    const captions = textSections.filter(ts => ts.type === 'caption');
    
    console.log(`📄 [EnhancedPDFParser] Found ${captions.length} potential captions for ${images.length} images`);
    
    for (const image of images) {
      let closestCaption: ParsedTextSection | null = null;
      let closestDistance = Infinity;
      let captionPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
      
      for (const caption of captions) {
        if (!caption.bbox) continue;
        
        // Calculate distance and position
        const { distance, position } = this.calculateImageCaptionRelation(image.bbox, caption.bbox);
        
        if (distance < closestDistance && distance <= maxDistance) {
          closestDistance = distance;
          closestCaption = caption;
          captionPosition = position;
        }
      }
      
      if (closestCaption && closestCaption.bbox) {
        image.caption = {
          text: closestCaption.text,
          position: captionPosition,
          bbox: closestCaption.bbox,
          distance: closestDistance
        };
        
        console.log(`📷 [EnhancedPDFParser] Associated caption "${closestCaption.text.substring(0, 30)}..." with image ${image.index} (distance: ${closestDistance.toFixed(1)}pt)`);
      }
    }
  }

  /**
   * Calculate spatial relationship between image and caption
   */
  private calculateImageCaptionRelation(
    imageBbox: mupdf.Rect,
    captionBbox: mupdf.Rect
  ): { distance: number; position: 'top' | 'bottom' | 'left' | 'right' } {
    const imageCenter = {
      x: (imageBbox[0] + imageBbox[2]) / 2,
      y: (imageBbox[1] + imageBbox[3]) / 2
    };
    
    const captionCenter = {
      x: (captionBbox[0] + captionBbox[2]) / 2,
      y: (captionBbox[1] + captionBbox[3]) / 2
    };
    
    const dx = captionCenter.x - imageCenter.x;
    const dy = captionCenter.y - imageCenter.y;
    
    // Determine position (PDF coordinates: y increases upward)
    let position: 'top' | 'bottom' | 'left' | 'right';
    if (Math.abs(dx) > Math.abs(dy)) {
      position = dx > 0 ? 'right' : 'left';
    } else {
      position = dy > 0 ? 'top' : 'bottom';
    }
    
    // Calculate minimum distance between boxes
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return { distance, position };
  }

  /**
   * Merge multiple bounding boxes into one
   */
  private mergeBoundingBoxes(bboxes: mupdf.Rect[]): mupdf.Rect {
    if (bboxes.length === 0) {
      return [0, 0, 0, 0];
    }
    
    return [
      Math.min(...bboxes.map(b => b[0])),
      Math.min(...bboxes.map(b => b[1])),
      Math.max(...bboxes.map(b => b[2])),
      Math.max(...bboxes.map(b => b[3]))
    ];
  }

  /**
   * Extract PDF metadata
   */
  private extractMetadata(document: mupdf.PDFDocument): any {
    const metadata: any = {};
    
    const fields = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
    for (const field of fields) {
      try {
        const value = document.getMetaData(`info:${field}`);
        if (value && value.trim()) {
          metadata[field.toLowerCase()] = value;
        }
      } catch (error) {
        // Ignore missing fields
      }
    }
    
    return metadata;
  }

  /**
   * Calculate page DPI based on dimensions
   */
  private calculatePageDPI(pageBounds: mupdf.Rect): number {
    // Most PDFs use 72 DPI by default
    // This is a simplified calculation
    const width = pageBounds[2] - pageBounds[0];
    const height = pageBounds[3] - pageBounds[1];
    
    // Standard page sizes (A4, Letter) in points at 72 DPI
    // A4: 595 x 842 points
    // Letter: 612 x 792 points
    
    return this.DEFAULT_DPI;
  }
}

export default EnhancedPDFParser;
