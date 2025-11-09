// src/services/PDFAnnotationService.ts
import EnhancedPDFParser, { PDFParseResult, OCRConfig } from './EnhancedPDFParser';
import RedactionDatabaseService, {
  ImageAnnotation,
  TextSectionAnnotation,
  RedactionDocument,
  RedactionSection
} from './RedactionDatabaseService';

/**
 * PDF Annotation Service - Integration layer between parser and database
 * 
 * This service orchestrates the complete workflow:
 * 1. Parse PDF with EnhancedPDFParser
 * 2. Store all annotations in database
 * 3. Provide query and retrieval methods
 * 4. Generate reports and summaries
 */

export interface AnnotationReport {
  documentId: string;
  fileName: string;
  pageCount: number;
  totalImages: number;
  totalTextSections: number;
  imagesWithCaptions: number;
  imagesByPage: { [pageNumber: number]: number };
  textSectionsByPage: { [pageNumber: number]: number };
  averageImageSize: {
    widthCm: number;
    heightCm: number;
    widthInches: number;
    heightInches: number;
  };
  metadata: any;
}

class PDFAnnotationService {
  private static instance: PDFAnnotationService;
  private parser: EnhancedPDFParser;
  private db: RedactionDatabaseService;

  private constructor() {
    this.parser = EnhancedPDFParser.getInstance();
    this.db = RedactionDatabaseService.getInstance();
  }

  public static getInstance(): PDFAnnotationService {
    if (!PDFAnnotationService.instance) {
      PDFAnnotationService.instance = new PDFAnnotationService();
    }
    return PDFAnnotationService.instance;
  }

  /**
   * Parse and annotate a PDF document with OCR support, storing all results in database
   */
  async parseAndAnnotatePDF(
    fileBuffer: ArrayBuffer,
    fileName: string,
    sessionId?: string,
    messageId?: string,
    options?: {
      extractImages?: boolean;
      extractText?: boolean;
      detectCaptions?: boolean;
      analyzeHierarchy?: boolean;
      ocr?: OCRConfig; // NEW: OCR configuration
    }
  ): Promise<{
    documentId: string;
    parseResult: PDFParseResult;
    report: AnnotationReport;
  }> {
    try {
      console.log(`🚀 [PDFAnnotationService] Starting PDF annotation workflow for: ${fileName}`);
      
      // Ensure database is initialized
      await this.db.initialize();
      
      // Generate document ID
      const documentId = this.generateDocumentId();
      
      // Parse PDF
      console.log(`📄 [PDFAnnotationService] Parsing PDF...`);
      const parseResult = await this.parser.parsePDF(fileBuffer, documentId, options);
      
      // Create document record
      console.log(`💾 [PDFAnnotationService] Creating document record...`);
      await this.createDocumentRecord(
        documentId,
        fileName,
        fileBuffer.byteLength,
        parseResult,
        sessionId,
        messageId
      );
      
      // Store image annotations
      console.log(`💾 [PDFAnnotationService] Storing ${parseResult.images.length} image annotations...`);
      await this.storeImageAnnotations(documentId, parseResult);
      
      // Store text annotations
      console.log(`💾 [PDFAnnotationService] Storing ${parseResult.textSections.length} text annotations...`);
      await this.storeTextAnnotations(documentId, parseResult);
      
      // Generate report
      const report = this.generateReport(documentId, fileName, parseResult);
      
      console.log(`✅ [PDFAnnotationService] PDF annotation completed successfully`);
      console.log(`📊 [PDFAnnotationService] Summary: ${report.totalImages} images, ${report.totalTextSections} text sections`);
      
      return {
        documentId,
        parseResult,
        report
      };
      
    } catch (error) {
      console.error('❌ [PDFAnnotationService] PDF annotation failed:', error);
      throw error;
    }
  }

  /**
   * Create document record in database
   */
  private async createDocumentRecord(
    documentId: string,
    fileName: string,
    fileSize: number,
    parseResult: PDFParseResult,
    sessionId?: string,
    messageId?: string
  ): Promise<void> {
    const document: Omit<RedactionDocument, 'id'> = {
      document_id: documentId,
      file_name: fileName,
      file_type: 'application/pdf',
      file_size: fileSize,
      session_id: sessionId,
      message_id: messageId,
      analysis_status: 'analyzing',
      total_sections: parseResult.images.length + parseResult.textSections.length,
      created_at: new Date().toISOString(),
      metadata: {
        ...parseResult.metadata,
        pageCount: parseResult.pageCount,
        totalImages: parseResult.images.length,
        totalTextSections: parseResult.textSections.length
      }
    };
    
    await this.db.createDocument(document);
    
    // Create sections for images
    for (const image of parseResult.images) {
      const section: Omit<RedactionSection, 'id'> = {
        document_id: documentId,
        section_id: image.sectionId,
        section_type: 'image',
        section_index: image.index,
        page_number: image.pageNumber,
        content_preview: image.caption?.text || `Image ${image.index + 1} (${image.widthCm}cm x ${image.heightCm}cm)`,
        content_length: 0,
        has_sensitive_content: false,
        sensitive_patterns_found: '[]',
        confidence_score: 1.0,
        is_user_selected: true,
        created_at: new Date().toISOString(),
        metadata: {
          dimensions: {
            widthCm: image.widthCm,
            heightCm: image.heightCm,
            widthInches: image.widthInches,
            heightInches: image.heightInches
          },
          hasCaption: !!image.caption
        }
      };
      
      await this.db.createSection(section);
    }
    
    // Create sections for text
    for (const textSection of parseResult.textSections) {
      const section: Omit<RedactionSection, 'id'> = {
        document_id: documentId,
        section_id: textSection.sectionId,
        section_type: 'text',
        section_index: textSection.index,
        page_number: textSection.pageNumber,
        content_preview: textSection.text.substring(0, 200),
        content_length: textSection.charCount,
        has_sensitive_content: false,
        sensitive_patterns_found: '[]',
        confidence_score: 1.0,
        is_user_selected: true,
        created_at: new Date().toISOString(),
        metadata: {
          type: textSection.type,
          level: textSection.level,
          wordCount: textSection.wordCount
        }
      };
      
      await this.db.createSection(section);
    }
    
    // Update document status
    await this.db.updateDocumentStatus(documentId, 'completed', document.total_sections);
  }

  /**
   * Store image annotations in database
   */
  private async storeImageAnnotations(
    documentId: string,
    parseResult: PDFParseResult
  ): Promise<void> {
    for (const image of parseResult.images) {
      const annotation: Omit<ImageAnnotation, 'id'> = {
        document_id: documentId,
        section_id: image.sectionId,
        page_number: image.pageNumber,
        image_index: image.index,
        width_px: image.widthPx,
        height_px: image.heightPx,
        width_cm: image.widthCm,
        height_cm: image.heightCm,
        width_inches: image.widthInches,
        height_inches: image.heightInches,
        bbox_x1: image.bbox[0],
        bbox_y1: image.bbox[1],
        bbox_x2: image.bbox[2],
        bbox_y2: image.bbox[3],
        caption_text: image.caption?.text,
        caption_position: image.caption?.position,
        caption_bbox: image.caption ? JSON.stringify(image.caption.bbox) : undefined,
        format: image.format,
        color_space: image.colorSpace,
        dpi: image.dpi,
        is_inline: image.isInline,
        has_transparency: image.hasTransparency,
        created_at: new Date().toISOString(),
        metadata: image.metadata
      };
      
      await this.db.createImageAnnotation(annotation);
    }
  }

  /**
   * Store text annotations in database
   */
  private async storeTextAnnotations(
    documentId: string,
    parseResult: PDFParseResult
  ): Promise<void> {
    for (const textSection of parseResult.textSections) {
      const annotation: Omit<TextSectionAnnotation, 'id'> = {
        document_id: documentId,
        section_id: textSection.sectionId,
        page_number: textSection.pageNumber,
        section_index: textSection.index,
        parent_section_id: textSection.parentSectionId,
        section_level: textSection.level,
        section_title: textSection.title,
        content_text: textSection.text,
        content_type: textSection.type,
        word_count: textSection.wordCount,
        char_count: textSection.charCount,
        bbox_x1: textSection.bbox?.[0],
        bbox_y1: textSection.bbox?.[1],
        bbox_x2: textSection.bbox?.[2],
        bbox_y2: textSection.bbox?.[3],
        font_name: textSection.fontName,
        font_size: textSection.fontSize,
        is_bold: textSection.isBold,
        is_italic: textSection.isItalic,
        text_color: textSection.textColor,
        contains_numbers: textSection.containsNumbers,
        contains_urls: textSection.containsUrls,
        language: textSection.language,
        created_at: new Date().toISOString(),
        metadata: textSection.metadata
      };
      
      await this.db.createTextAnnotation(annotation);
    }
  }

  /**
   * Generate annotation report
   */
  private generateReport(
    documentId: string,
    fileName: string,
    parseResult: PDFParseResult
  ): AnnotationReport {
    // Count images with captions
    const imagesWithCaptions = parseResult.images.filter(img => img.caption).length;
    
    // Group by page
    const imagesByPage: { [pageNumber: number]: number } = {};
    const textSectionsByPage: { [pageNumber: number]: number } = {};
    
    for (const image of parseResult.images) {
      imagesByPage[image.pageNumber] = (imagesByPage[image.pageNumber] || 0) + 1;
    }
    
    for (const textSection of parseResult.textSections) {
      textSectionsByPage[textSection.pageNumber] = (textSectionsByPage[textSection.pageNumber] || 0) + 1;
    }
    
    // Calculate average image size
    const avgSize = {
      widthCm: 0,
      heightCm: 0,
      widthInches: 0,
      heightInches: 0
    };
    
    if (parseResult.images.length > 0) {
      const totalWidthCm = parseResult.images.reduce((sum, img) => sum + img.widthCm, 0);
      const totalHeightCm = parseResult.images.reduce((sum, img) => sum + img.heightCm, 0);
      const totalWidthInches = parseResult.images.reduce((sum, img) => sum + img.widthInches, 0);
      const totalHeightInches = parseResult.images.reduce((sum, img) => sum + img.heightInches, 0);
      
      avgSize.widthCm = parseFloat((totalWidthCm / parseResult.images.length).toFixed(2));
      avgSize.heightCm = parseFloat((totalHeightCm / parseResult.images.length).toFixed(2));
      avgSize.widthInches = parseFloat((totalWidthInches / parseResult.images.length).toFixed(2));
      avgSize.heightInches = parseFloat((totalHeightInches / parseResult.images.length).toFixed(2));
    }
    
    return {
      documentId,
      fileName,
      pageCount: parseResult.pageCount,
      totalImages: parseResult.images.length,
      totalTextSections: parseResult.textSections.length,
      imagesWithCaptions,
      imagesByPage,
      textSectionsByPage,
      averageImageSize: avgSize,
      metadata: parseResult.metadata
    };
  }

  /**
   * Get annotation report for a document
   */
  async getAnnotationReport(documentId: string): Promise<AnnotationReport> {
    try {
      const document = await this.db.getDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      const images = await this.db.getImageAnnotations(documentId);
      const textSections = await this.db.getTextAnnotations(documentId);
      
      const imagesWithCaptions = images.filter(img => img.caption_text).length;
      
      const imagesByPage: { [pageNumber: number]: number } = {};
      const textSectionsByPage: { [pageNumber: number]: number } = {};
      
      for (const image of images) {
        imagesByPage[image.page_number] = (imagesByPage[image.page_number] || 0) + 1;
      }
      
      for (const textSection of textSections) {
        textSectionsByPage[textSection.page_number] = (textSectionsByPage[textSection.page_number] || 0) + 1;
      }
      
      const avgSize = {
        widthCm: 0,
        heightCm: 0,
        widthInches: 0,
        heightInches: 0
      };
      
      if (images.length > 0) {
        avgSize.widthCm = parseFloat((images.reduce((sum, img) => sum + (img.width_cm || 0), 0) / images.length).toFixed(2));
        avgSize.heightCm = parseFloat((images.reduce((sum, img) => sum + (img.height_cm || 0), 0) / images.length).toFixed(2));
        avgSize.widthInches = parseFloat((images.reduce((sum, img) => sum + (img.width_inches || 0), 0) / images.length).toFixed(2));
        avgSize.heightInches = parseFloat((images.reduce((sum, img) => sum + (img.height_inches || 0), 0) / images.length).toFixed(2));
      }
      
      return {
        documentId: document.document_id,
        fileName: document.file_name,
        pageCount: document.metadata?.pageCount || 0,
        totalImages: images.length,
        totalTextSections: textSections.length,
        imagesWithCaptions,
        imagesByPage,
        textSectionsByPage,
        averageImageSize: avgSize,
        metadata: document.metadata
      };
      
    } catch (error) {
      console.error('❌ [PDFAnnotationService] Failed to get annotation report:', error);
      throw error;
    }
  }

  /**
   * Get all annotations for a document
   */
  async getDocumentAnnotations(documentId: string, pageNumber?: number): Promise<{
    images: ImageAnnotation[];
    textSections: TextSectionAnnotation[];
  }> {
    const images = await this.db.getImageAnnotations(documentId, pageNumber);
    const textSections = await this.db.getTextAnnotations(documentId, pageNumber);
    
    return {
      images,
      textSections
    };
  }

  /**
   * Get hierarchical text structure for a page
   */
  async getPageTextHierarchy(documentId: string, pageNumber: number): Promise<TextSectionAnnotation[]> {
    return await this.db.getTextHierarchy(documentId, pageNumber);
  }

  /**
   * Export annotations as JSON
   */
  async exportAnnotationsAsJSON(documentId: string): Promise<string> {
    const annotations = await this.getDocumentAnnotations(documentId);
    const report = await this.getAnnotationReport(documentId);
    
    const exportData = {
      documentId,
      report,
      annotations: {
        images: annotations.images.map(img => ({
          pageNumber: img.page_number,
          index: img.image_index,
          dimensions: {
            widthCm: img.width_cm,
            heightCm: img.height_cm,
            widthInches: img.width_inches,
            heightInches: img.height_inches,
            widthPx: img.width_px,
            heightPx: img.height_px
          },
          position: {
            x1: img.bbox_x1,
            y1: img.bbox_y1,
            x2: img.bbox_x2,
            y2: img.bbox_y2
          },
          caption: img.caption_text ? {
            text: img.caption_text,
            position: img.caption_position
          } : null,
          properties: {
            format: img.format,
            colorSpace: img.color_space,
            dpi: img.dpi,
            hasTransparency: img.has_transparency
          }
        })),
        textSections: annotations.textSections.map(txt => ({
          pageNumber: txt.page_number,
          index: txt.section_index,
          level: txt.section_level,
          type: txt.content_type,
          title: txt.section_title,
          content: txt.content_text.substring(0, 100) + '...',
          wordCount: txt.word_count,
          charCount: txt.char_count,
          formatting: {
            fontName: txt.font_name,
            fontSize: txt.font_size,
            isBold: txt.is_bold,
            isItalic: txt.is_italic
          }
        }))
      },
      exportedAt: new Date().toISOString()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default PDFAnnotationService;
