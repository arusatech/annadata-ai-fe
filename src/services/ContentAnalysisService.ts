// src/services/ContentAnalysisService.ts
// @ts-ignore - MuPDF types may not be fully compatible
import * as mupdf from "mupdf";
import RedactionDatabaseService, { 
  RedactionDocument, 
  RedactionSection, 
  RedactionResult, 
  RedactionPattern 
} from './RedactionDatabaseService';

/**
 * Content Analysis Service - Analyzes documents and extracts sections for redaction
 * 
 * Features:
 * - PDF and image content analysis
 * - Section extraction (text, images, metadata)
 * - Sensitive content detection
 * - Database integration for user selections
 * - Granular content control
 */

export interface ContentSection {
  id: string;
  type: 'text' | 'image' | 'metadata' | 'form' | 'link' | 'annotation';
  index: number;
  pageNumber?: number;
  content: string;
  preview: string;
  length: number;
  hasSensitiveContent: boolean;
  sensitivePatterns: string[];
  confidence: number;
  boundingBox?: [number, number, number, number];
  metadata?: any;
}

export interface DocumentAnalysis {
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  sections: ContentSection[];
  totalSections: number;
  sensitiveSections: number;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
  metadata?: any;
}

class ContentAnalysisService {
  private static instance: ContentAnalysisService;
  private redactionDb: RedactionDatabaseService;
  private isInitialized: boolean = false;

  private constructor() {
    this.redactionDb = RedactionDatabaseService.getInstance();
  }

  public static getInstance(): ContentAnalysisService {
    if (!ContentAnalysisService.instance) {
      ContentAnalysisService.instance = new ContentAnalysisService();
    }
    return ContentAnalysisService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.redactionDb.initialize();
    this.isInitialized = true;
    console.log('✅ [ContentAnalysis] Service initialized');
  }

  /**
   * Analyze a document and extract all sections for user review
   */
  async analyzeDocument(
    fileBuffer: ArrayBuffer,
    fileName: string,
    fileType: string,
    sessionId?: string,
    messageId?: string
  ): Promise<DocumentAnalysis> {
    try {
      const documentId = this.generateDocumentId();
      
      console.log(`🔍 [ContentAnalysis] Starting analysis for ${fileName}`);
      
      // Create document record
      const document: Omit<RedactionDocument, 'id'> = {
        document_id: documentId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileBuffer.byteLength,
        session_id: sessionId,
        message_id: messageId,
        analysis_status: 'analyzing',
        total_sections: 0,
        created_at: new Date().toISOString()
      };
      
      await this.redactionDb.createDocument(document);
      
      let sections: ContentSection[] = [];
      
      if (fileType === 'application/pdf') {
        sections = await this.analyzePDF(fileBuffer, documentId);
      } else if (fileType.startsWith('image/')) {
        sections = await this.analyzeImage(fileBuffer, fileType, documentId);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      // Store sections in database
      for (const section of sections) {
        await this.redactionDb.createSection({
          document_id: documentId,
          section_id: section.id,
          section_type: section.type,
          section_index: section.index,
          page_number: section.pageNumber,
          content_preview: section.preview,
          content_length: section.length,
          has_sensitive_content: section.hasSensitiveContent,
          sensitive_patterns_found: JSON.stringify(section.sensitivePatterns),
          confidence_score: section.confidence,
          is_user_selected: true, // Default to selected
          created_at: new Date().toISOString(),
          metadata: section.metadata ? JSON.stringify(section.metadata) : null
        });
      }
      
      // Update document status
      await this.redactionDb.updateDocumentStatus(
        documentId, 
        'completed', 
        sections.length
      );
      
      const sensitiveSections = sections.filter(s => s.hasSensitiveContent).length;
      
      console.log(`✅ [ContentAnalysis] Analysis completed: ${sections.length} sections, ${sensitiveSections} sensitive`);
      
      return {
        documentId,
        fileName,
        fileType,
        fileSize: fileBuffer.byteLength,
        sections,
        totalSections: sections.length,
        sensitiveSections,
        analysisStatus: 'completed',
        metadata: {
          analyzedAt: new Date().toISOString(),
          sectionsByType: this.groupSectionsByType(sections)
        }
      };
      
    } catch (error) {
      console.error('❌ [ContentAnalysis] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze PDF document and extract sections
   */
  private async analyzePDF(fileBuffer: ArrayBuffer, documentId: string): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    let sectionIndex = 0;
    
    try {
      console.log(`📄 [ContentAnalysis] Loading PDF document`);
      const document = mupdf.Document.openDocument(fileBuffer, "application/pdf") as mupdf.PDFDocument;
      
      if (document.needsPassword()) {
        throw new Error("Password-protected PDFs are not supported");
      }
      
      const pageCount = document.countPages();
      console.log(`📄 [ContentAnalysis] Processing ${pageCount} pages`);
      
      // Extract metadata section
      const metadataSection = await this.extractPDFMetadata(document, sectionIndex++);
      if (metadataSection) {
        sections.push(metadataSection);
      }
      
      // Process each page
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = document.loadPage(pageIndex);
        console.log(`📄 [ContentAnalysis] Processing page ${pageIndex + 1}/${pageCount}`);
        
        // Extract text sections
        const textSections = await this.extractTextSections(page, pageIndex, documentId, sectionIndex);
        sections.push(...textSections);
        sectionIndex += textSections.length;
        
        // Extract image sections
        const imageSections = await this.extractImageSections(page, pageIndex, documentId, sectionIndex);
        sections.push(...imageSections);
        sectionIndex += imageSections.length;
        
        // Extract form sections
        const formSections = await this.extractFormSections(page, pageIndex, documentId, sectionIndex);
        sections.push(...formSections);
        sectionIndex += formSections.length;
        
        // Extract link sections
        const linkSections = await this.extractLinkSections(page, pageIndex, documentId, sectionIndex);
        sections.push(...linkSections);
        sectionIndex += linkSections.length;
        
        // Extract annotation sections
        const annotationSections = await this.extractAnnotationSections(page, pageIndex, documentId, sectionIndex);
        sections.push(...annotationSections);
        sectionIndex += annotationSections.length;
      }
      
    } catch (error) {
      console.error('❌ [ContentAnalysis] PDF analysis failed:', error);
      throw error;
    }
    
    return sections;
  }

  /**
   * Analyze image document and extract sections
   */
  private async analyzeImage(fileBuffer: ArrayBuffer, mimeType: string, documentId: string): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      console.log(`🖼️ [ContentAnalysis] Loading image document`);
      const document = mupdf.Document.openDocument(fileBuffer, mimeType);
      const page = document.loadPage(0);
      
      // Extract text from image (OCR-like functionality)
      const textSections = await this.extractTextFromImage(page, documentId, 0);
      sections.push(...textSections);
      
      // Create image section
      const imageSection: ContentSection = {
        id: `${documentId}_image_0`,
        type: 'image',
        index: 1,
        pageNumber: 0,
        content: `[Image Content - ${mimeType}]`,
        preview: `Image (${mimeType})`,
        length: fileBuffer.byteLength,
        hasSensitiveContent: false,
        sensitivePatterns: [],
        confidence: 1.0,
        metadata: {
          mimeType,
          size: fileBuffer.byteLength
        }
      };
      
      sections.push(imageSection);
      
    } catch (error) {
      console.error('❌ [ContentAnalysis] Image analysis failed:', error);
      throw error;
    }
    
    return sections;
  }

  /**
   * Extract PDF metadata
   */
  private async extractPDFMetadata(document: mupdf.PDFDocument, index: number): Promise<ContentSection | null> {
    try {
      const metadata: any = {};
      
      // Extract common metadata fields
      const fields = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
      for (const field of fields) {
        try {
          const value = document.getMetaData(`info:${field}`);
          if (value && value.trim()) {
            metadata[field] = value;
          }
        } catch (error) {
          // Ignore missing metadata fields
        }
      }
      
      if (Object.keys(metadata).length === 0) {
        return null;
      }
      
      const metadataText = JSON.stringify(metadata, null, 2);
      const hasSensitiveContent = await this.detectSensitiveContent(metadataText);
      
      return {
        id: `metadata_${index}`,
        type: 'metadata',
        index,
        content: metadataText,
        preview: `Document Metadata (${Object.keys(metadata).length} fields)`,
        length: metadataText.length,
        hasSensitiveContent: hasSensitiveContent.hasSensitive,
        sensitivePatterns: hasSensitiveContent.patterns,
        confidence: hasSensitiveContent.confidence,
        metadata: {
          extractedAt: new Date().toISOString(),
          fieldCount: Object.keys(metadata).length
        }
      };
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract metadata:', error);
      return null;
    }
  }

  /**
   * Extract text sections from a page
   */
  private async extractTextSections(
    page: mupdf.PDFPage, 
    pageNumber: number, 
    documentId: string, 
    startIndex: number
  ): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      // Extract full page text
      const structuredText = page.toStructuredText("preserve-whitespace");
      const fullText = structuredText.asText();
      
      if (!fullText.trim()) {
        return sections;
      }
      
      // Split text into logical sections (paragraphs, blocks, etc.)
      const textBlocks = this.splitTextIntoBlocks(fullText);
      
      for (let i = 0; i < textBlocks.length; i++) {
        const block = textBlocks[i];
        if (!block.trim()) continue;
        
        const hasSensitiveContent = await this.detectSensitiveContent(block);
        
        sections.push({
          id: `${documentId}_text_${pageNumber}_${i}`,
          type: 'text',
          index: startIndex + i,
          pageNumber,
          content: block,
          preview: this.createPreview(block, 100),
          length: block.length,
          hasSensitiveContent: hasSensitiveContent.hasSensitive,
          sensitivePatterns: hasSensitiveContent.patterns,
          confidence: hasSensitiveContent.confidence,
          metadata: {
            pageNumber,
            blockIndex: i,
            extractedAt: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract text sections:', error);
    }
    
    return sections;
  }

  /**
   * Extract text from image (OCR-like)
   */
  private async extractTextFromImage(page: mupdf.PDFPage, documentId: string, pageNumber: number): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      const structuredText = page.toStructuredText("preserve-whitespace");
      const text = structuredText.asText();
      
      if (!text.trim()) {
        return sections;
      }
      
      const hasSensitiveContent = await this.detectSensitiveContent(text);
      
      sections.push({
        id: `${documentId}_ocr_${pageNumber}`,
        type: 'text',
        index: 0,
        pageNumber,
        content: text,
        preview: this.createPreview(text, 100),
        length: text.length,
        hasSensitiveContent: hasSensitiveContent.hasSensitive,
        sensitivePatterns: hasSensitiveContent.patterns,
        confidence: hasSensitiveContent.confidence,
        metadata: {
          pageNumber,
          extractedAt: new Date().toISOString(),
          source: 'ocr'
        }
      });
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract text from image:', error);
    }
    
    return sections;
  }

  /**
   * Extract image sections from a page
   */
  private async extractImageSections(
    page: mupdf.PDFPage, 
    pageNumber: number, 
    documentId: string, 
    startIndex: number
  ): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      // Get images from the page
      const images: Array<{ bbox: mupdf.Rect; matrix: mupdf.Matrix; image: mupdf.Image }> = [];
      
      page.toStructuredText("preserve-images").walk({
        onImageBlock: (bbox: any, matrix: any, image: any) => {
          images.push({ bbox, matrix, image });
        }
      });
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        sections.push({
          id: `${documentId}_image_${pageNumber}_${i}`,
          type: 'image',
          index: startIndex + i,
          pageNumber,
          content: `[Image ${i + 1} on page ${pageNumber + 1}]`,
          preview: `Image ${i + 1} (${Math.round(img.bbox[2] - img.bbox[0])}x${Math.round(img.bbox[3] - img.bbox[1])}px)`,
          length: 0,
          hasSensitiveContent: false, // Images are considered safe by default
          sensitivePatterns: [],
          confidence: 1.0,
          boundingBox: img.bbox,
          metadata: {
            pageNumber,
            imageIndex: i,
            dimensions: {
              width: Math.round(img.bbox[2] - img.bbox[0]),
              height: Math.round(img.bbox[3] - img.bbox[1])
            },
            extractedAt: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract image sections:', error);
    }
    
    return sections;
  }

  /**
   * Extract form sections from a page
   */
  private async extractFormSections(
    page: mupdf.PDFPage, 
    pageNumber: number, 
    documentId: string, 
    startIndex: number
  ): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      const widgets = page.getWidgets();
      
      for (let i = 0; i < widgets.length; i++) {
        const widget = widgets[i];
        const fieldType = widget.getFieldType();
        const fieldName = widget.getFieldName();
        
        const formContent = `Form Field: ${fieldName} (${fieldType})`;
        const hasSensitiveContent = await this.detectSensitiveContent(formContent);
        
        sections.push({
          id: `${documentId}_form_${pageNumber}_${i}`,
          type: 'form',
          index: startIndex + i,
          pageNumber,
          content: formContent,
          preview: `${fieldType}: ${fieldName}`,
          length: formContent.length,
          hasSensitiveContent: hasSensitiveContent.hasSensitive,
          sensitivePatterns: hasSensitiveContent.patterns,
          confidence: hasSensitiveContent.confidence,
          metadata: {
            pageNumber,
            formIndex: i,
            fieldType,
            fieldName,
            extractedAt: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract form sections:', error);
    }
    
    return sections;
  }

  /**
   * Extract link sections from a page
   */
  private async extractLinkSections(
    page: mupdf.PDFPage, 
    pageNumber: number, 
    documentId: string, 
    startIndex: number
  ): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      const links = page.getLinks();
      
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const uri = link.getURI();
        
        const linkContent = `Link: ${uri}`;
        const hasSensitiveContent = await this.detectSensitiveContent(linkContent);
        
        sections.push({
          id: `${documentId}_link_${pageNumber}_${i}`,
          type: 'link',
          index: startIndex + i,
          pageNumber,
          content: linkContent,
          preview: `Link: ${this.createPreview(uri, 50)}`,
          length: linkContent.length,
          hasSensitiveContent: hasSensitiveContent.hasSensitive,
          sensitivePatterns: hasSensitiveContent.patterns,
          confidence: hasSensitiveContent.confidence,
          metadata: {
            pageNumber,
            linkIndex: i,
            uri,
            extractedAt: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract link sections:', error);
    }
    
    return sections;
  }

  /**
   * Extract annotation sections from a page
   */
  private async extractAnnotationSections(
    page: mupdf.PDFPage, 
    pageNumber: number, 
    documentId: string, 
    startIndex: number
  ): Promise<ContentSection[]> {
    const sections: ContentSection[] = [];
    
    try {
      const annotations = page.getAnnotations();
      
      for (let i = 0; i < annotations.length; i++) {
        const annotation = annotations[i];
        const type = annotation.getType();
        const content = annotation.getContents() || `Annotation: ${type}`;
        
        const hasSensitiveContent = await this.detectSensitiveContent(content);
        
        sections.push({
          id: `${documentId}_annotation_${pageNumber}_${i}`,
          type: 'annotation',
          index: startIndex + i,
          pageNumber,
          content,
          preview: this.createPreview(content, 50),
          length: content.length,
          hasSensitiveContent: hasSensitiveContent.hasSensitive,
          sensitivePatterns: hasSensitiveContent.patterns,
          confidence: hasSensitiveContent.confidence,
          metadata: {
            pageNumber,
            annotationIndex: i,
            annotationType: type,
            extractedAt: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.warn('⚠️ [ContentAnalysis] Failed to extract annotation sections:', error);
    }
    
    return sections;
  }

  /**
   * Detect sensitive content in text
   */
  private async detectSensitiveContent(text: string): Promise<{
    hasSensitive: boolean;
    patterns: string[];
    confidence: number;
  }> {
    // This would integrate with the existing redaction patterns
    // For now, return a simple implementation
    const patterns: string[] = [];
    let confidence = 0;
    
    // Simple email detection
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    if (emailRegex.test(text)) {
      patterns.push('Email Address');
      confidence = Math.max(confidence, 0.9);
    }
    
    // Simple phone detection
    const phoneRegex = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    if (phoneRegex.test(text)) {
      patterns.push('Phone Number');
      confidence = Math.max(confidence, 0.8);
    }
    
    return {
      hasSensitive: patterns.length > 0,
      patterns,
      confidence
    };
  }

  /**
   * Split text into logical blocks
   */
  private splitTextIntoBlocks(text: string): string[] {
    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    
    // If no paragraphs, split by single newlines
    if (paragraphs.length <= 1) {
      return text.split('\n').filter(line => line.trim());
    }
    
    return paragraphs;
  }

  /**
   * Create a preview of text content
   */
  private createPreview(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Group sections by type for metadata
   */
  private groupSectionsByType(sections: ContentSection[]): { [type: string]: number } {
    const groups: { [type: string]: number } = {};
    
    for (const section of sections) {
      groups[section.type] = (groups[section.type] || 0) + 1;
    }
    
    return groups;
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get document analysis results
   */
  async getDocumentAnalysis(documentId: string): Promise<DocumentAnalysis | null> {
    try {
      const document = await this.redactionDb.getDocument(documentId);
      if (!document) {
        return null;
      }
      
      const sections = await this.redactionDb.getDocumentSections(documentId);
      
      return {
        documentId: document.document_id,
        fileName: document.file_name,
        fileType: document.file_type,
        fileSize: document.file_size,
        sections: sections.map(s => ({
          id: s.section_id,
          type: s.section_type as any,
          index: s.section_index,
          pageNumber: s.page_number,
          content: s.content_preview,
          preview: s.content_preview,
          length: s.content_length,
          hasSensitiveContent: s.has_sensitive_content,
          sensitivePatterns: JSON.parse(s.sensitive_patterns_found),
          confidence: s.confidence_score,
          metadata: s.metadata ? JSON.parse(s.metadata) : null
        })),
        totalSections: sections.length,
        sensitiveSections: sections.filter(s => s.has_sensitive_content).length,
        analysisStatus: document.analysis_status as any,
        metadata: document.metadata
      };
      
    } catch (error) {
      console.error('❌ [ContentAnalysis] Failed to get document analysis:', error);
      throw error;
    }
  }

  /**
   * Get selected content for AI processing
   */
  async getSelectedContent(documentId: string): Promise<ContentSection[]> {
    try {
      const selectedSections = await this.redactionDb.getSelectedContent(documentId);
      
      return selectedSections.map(s => ({
        id: s.section_id,
        type: s.section_type as any,
        index: s.section_index,
        pageNumber: s.page_number,
        content: s.content_preview,
        preview: s.content_preview,
        length: s.content_length,
        hasSensitiveContent: s.has_sensitive_content,
        sensitivePatterns: JSON.parse(s.sensitive_patterns_found),
        confidence: s.confidence_score,
        metadata: s.metadata ? JSON.parse(s.metadata) : null
      }));
      
    } catch (error) {
      console.error('❌ [ContentAnalysis] Failed to get selected content:', error);
      throw error;
    }
  }

  /**
   * Update section selections
   */
  async updateSectionSelections(documentId: string, selections: { [sectionId: string]: boolean }): Promise<void> {
    try {
      await this.redactionDb.updateSectionSelectionBulk(documentId, selections);
      console.log('✅ [ContentAnalysis] Section selections updated');
    } catch (error) {
      console.error('❌ [ContentAnalysis] Failed to update section selections:', error);
      throw error;
    }
  }
}

export default ContentAnalysisService;
