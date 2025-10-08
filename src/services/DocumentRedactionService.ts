// @ts-ignore - MuPDF types may not be fully compatible
import * as mupdf from "mupdf";

/**
 * DocumentRedactionService - Handles sensitive content redaction for PDF and image files
 * 
 * Features:
 * - PII detection and redaction
 * - Sensitive content identification
 * - Safe text extraction for AI processing
 * - PDF and image format support
 * - User confirmation workflow
 */

export interface RedactionPattern {
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
  category: 'pii' | 'financial' | 'medical' | 'legal' | 'other';
}

export interface RedactionResult {
  originalText: string;
  redactedText: string;
  redactedAreas: RedactedArea[];
  extractedText: string;
  confidence: number;
  redactionSummary: RedactionSummary;
}

export interface RedactedArea {
  id: string;
  type: 'text' | 'image' | 'metadata';
  originalContent: string;
  redactedContent: string;
  boundingBox?: mupdf.Rect;
  pageNumber?: number;
  confidence: number;
  category: string;
}

export interface RedactionSummary {
  totalRedactions: number;
  piiRedactions: number;
  financialRedactions: number;
  medicalRedactions: number;
  legalRedactions: number;
  otherRedactions: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

export interface DocumentProcessingOptions {
  enablePIIRedaction: boolean;
  enableFinancialRedaction: boolean;
  enableMedicalRedaction: boolean;
  enableLegalRedaction: boolean;
  enableMetadataRedaction: boolean;
  confidenceThreshold: number;
  preserveFormatting: boolean;
  userConfirmationRequired: boolean;
}

class DocumentRedactionService {
  private static instance: DocumentRedactionService;
  private redactionPatterns: RedactionPattern[] = [];
  private isInitialized: boolean = false;

  private constructor() {
    this.initializeRedactionPatterns();
  }

  public static getInstance(): DocumentRedactionService {
    if (!DocumentRedactionService.instance) {
      DocumentRedactionService.instance = new DocumentRedactionService();
    }
    return DocumentRedactionService.instance;
  }

  /**
   * Initialize the service with default redaction patterns
   */
  private initializeRedactionPatterns(): void {
    this.redactionPatterns = [
      // PII Patterns
      {
        name: 'Email Address',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        severity: 'high',
        category: 'pii'
      },
      {
        name: 'Phone Number',
        pattern: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
        severity: 'high',
        category: 'pii'
      },
      {
        name: 'SSN',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        severity: 'high',
        category: 'pii'
      },
      {
        name: 'Credit Card',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        severity: 'high',
        category: 'financial'
      },
      {
        name: 'Bank Account',
        pattern: /\b\d{8,17}\b/g,
        severity: 'high',
        category: 'financial'
      },
      {
        name: 'Address',
        pattern: /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Place|Pl)\b/gi,
        severity: 'medium',
        category: 'pii'
      },
      {
        name: 'Date of Birth',
        pattern: /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,
        severity: 'high',
        category: 'pii'
      },
      {
        name: 'Driver License',
        pattern: /\b[A-Z]\d{7,8}\b/g,
        severity: 'high',
        category: 'pii'
      },
      {
        name: 'Passport',
        pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
        severity: 'high',
        category: 'pii'
      },
      {
        name: 'Medical Record',
        pattern: /\b(?:MRN|Medical Record|Patient ID)[:\s]*\d{6,12}\b/gi,
        severity: 'high',
        category: 'medical'
      },
      {
        name: 'Case Number',
        pattern: /\b(?:Case|Docket|File)[\s#:]*[A-Z0-9\-]{6,20}\b/gi,
        severity: 'medium',
        category: 'legal'
      }
    ];
    this.isInitialized = true;
  }

  /**
   * Process a PDF document for sensitive content redaction
   */
  public async processPDF(
    fileBuffer: ArrayBuffer,
    options: Partial<DocumentProcessingOptions> = {}
  ): Promise<RedactionResult> {
    try {
      const defaultOptions: DocumentProcessingOptions = {
        enablePIIRedaction: true,
        enableFinancialRedaction: true,
        enableMedicalRedaction: true,
        enableLegalRedaction: true,
        enableMetadataRedaction: true,
        confidenceThreshold: 0.7,
        preserveFormatting: true,
        userConfirmationRequired: true,
        ...options
      };

      // Load PDF document
      console.log(`📄 Loading PDF document, buffer size: ${fileBuffer.byteLength} bytes`);
      const document = mupdf.Document.openDocument(fileBuffer, "application/pdf") as mupdf.PDFDocument;
      
      if (document.needsPassword()) {
        throw new Error("Password-protected PDFs are not supported");
      }
      
      console.log(`📄 PDF document loaded successfully`);

      const redactedAreas: RedactedArea[] = [];
      let extractedText = "";
      let originalText = "";

      // Process each page
      const pageCount = document.countPages();
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = document.loadPage(pageIndex);
        console.log(`📄 Processing page ${pageIndex + 1}/${pageCount}`);
        
        // Extract original text using the correct API
        let pageText = "";
        try {
          const structuredText = page.toStructuredText("preserve-whitespace");
          pageText = structuredText.asText();
          console.log(`📄 Extracted ${pageText.length} characters from page ${pageIndex + 1}: "${pageText.substring(0, 100)}..."`);
        } catch (extractError) {
          console.error(`❌ Error extracting text from page ${pageIndex + 1}:`, extractError);
          pageText = "";
        }
        originalText += pageText + "\n";

        // Apply redaction patterns to the extracted text (simpler approach)
        const pageRedactions = await this.applyTextRedactionPatterns(
          pageText,
          pageIndex,
          defaultOptions
        );
        
        redactedAreas.push(...pageRedactions);

        // Create redaction annotations
        await this.createRedactionAnnotations(page, pageRedactions);

        // Extract clean text after redaction
        const cleanText = this.extractCleanText(pageText, pageRedactions);
        extractedText += cleanText + "\n";
      }

      // Clean metadata if enabled
      if (defaultOptions.enableMetadataRedaction) {
        this.cleanDocumentMetadata(document);
      }

      // Apply redactions to document
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const page = document.loadPage(pageIndex);
        page.applyRedactions();
      }

      // Generate redaction summary
      const redactionSummary = this.generateRedactionSummary(redactedAreas);

      return {
        originalText: originalText.trim(),
        redactedText: extractedText.trim(),
        redactedAreas,
        extractedText: extractedText.trim(),
        confidence: this.calculateOverallConfidence(redactedAreas),
        redactionSummary
      };

    } catch (error) {
      console.error('PDF processing error:', error);
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process an image file for sensitive content redaction
   */
  public async processImage(
    fileBuffer: ArrayBuffer,
    mimeType: string,
    options: Partial<DocumentProcessingOptions> = {}
  ): Promise<RedactionResult> {
    try {
      const defaultOptions: DocumentProcessingOptions = {
        enablePIIRedaction: true,
        enableFinancialRedaction: true,
        enableMedicalRedaction: true,
        enableLegalRedaction: true,
        enableMetadataRedaction: true,
        confidenceThreshold: 0.7,
        preserveFormatting: true,
        userConfirmationRequired: true,
        ...options
      };

      // Load image document
      console.log(`🖼️ Loading image document, buffer size: ${fileBuffer.byteLength} bytes, mimeType: ${mimeType}`);
      const document = mupdf.Document.openDocument(fileBuffer, mimeType);
      const page = document.loadPage(0);
      console.log(`🖼️ Image document loaded successfully`);

      // Extract text using the correct API
      let originalText = "";
      try {
        const structuredText = page.toStructuredText("preserve-whitespace");
        originalText = structuredText.asText();
        console.log(`🖼️ Extracted ${originalText.length} characters from image: "${originalText.substring(0, 100)}..."`);
      } catch (extractError) {
        console.error(`❌ Error extracting text from image:`, extractError);
        originalText = "";
      }
      
      if (!originalText.trim()) {
        // If no text extracted, return empty result
        return {
          originalText: "",
          redactedText: "",
          redactedAreas: [],
          extractedText: "",
          confidence: 1.0,
          redactionSummary: {
            totalRedactions: 0,
            piiRedactions: 0,
            financialRedactions: 0,
            medicalRedactions: 0,
            legalRedactions: 0,
            otherRedactions: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
          }
        };
      }

      // Apply redaction patterns to extracted text
      const redactedAreas = await this.applyTextRedactionPatterns(
        originalText,
        0,
        defaultOptions
      );

      const redactedText = this.applyRedactionsToText(originalText, redactedAreas);

      const redactionSummary = this.generateRedactionSummary(redactedAreas);

      return {
        originalText: originalText.trim(),
        redactedText: redactedText.trim(),
        redactedAreas,
        extractedText: redactedText.trim(),
        confidence: this.calculateOverallConfidence(redactedAreas),
        redactionSummary
      };

    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get page words for redaction analysis
   */
  private getPageWords(page: mupdf.PDFPage): Array<{rect: mupdf.Rect, text: string}> {
    const words: Array<{rect: mupdf.Rect, text: string}> = [];
    let currentWord = { rect: [0, 0, 0, 0] as mupdf.Rect, text: "" };

    page.toStructuredText("preserve-whitespace,preserve-spans").walk({
      onChar(char: any, origin: any, font: any, size: any, quad: any) {
        if (char === ' ') {
          if (currentWord.text.trim()) {
            words.push({
              rect: currentWord.rect,
              text: currentWord.text.trim()
            });
            currentWord = { rect: [0, 0, 0, 0], text: "" };
          }
        } else {
          currentWord.text += char;
          // Update bounding box
          if (currentWord.rect[0] === 0 && currentWord.rect[1] === 0) {
            currentWord.rect = [quad[0], quad[1], quad[6], quad[7]];
          } else {
            currentWord.rect[0] = Math.min(currentWord.rect[0], quad[0]);
            currentWord.rect[1] = Math.min(currentWord.rect[1], quad[1]);
            currentWord.rect[2] = Math.max(currentWord.rect[2], quad[6]);
            currentWord.rect[3] = Math.max(currentWord.rect[3], quad[7]);
          }
        }
      },
      endLine: () => {
        if (currentWord.text.trim()) {
          words.push({
            rect: currentWord.rect,
            text: currentWord.text.trim()
          });
          currentWord = { rect: [0, 0, 0, 0], text: "" };
        }
      }
    });

    return words;
  }

  /**
   * Apply redaction patterns to page words
   */
  private async applyRedactionPatterns(
    words: Array<{rect: mupdf.Rect, text: string}>,
    pageNumber: number,
    options: DocumentProcessingOptions
  ): Promise<RedactedArea[]> {
    const redactedAreas: RedactedArea[] = [];

    for (const word of words) {
      const text = word.text;
      
      for (const pattern of this.redactionPatterns) {
        // Skip patterns based on options
        if (!this.shouldApplyPattern(pattern, options)) {
          continue;
        }

        if (pattern.pattern.test(text)) {
          const confidence = this.calculatePatternConfidence(text, pattern);
          
          if (confidence >= options.confidenceThreshold) {
            redactedAreas.push({
              id: `redaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'text',
              originalContent: text,
              redactedContent: this.generateRedactedContent(pattern.category),
              boundingBox: word.rect,
              pageNumber,
              confidence,
              category: pattern.category
            });
          }
        }
      }
    }

    return redactedAreas;
  }

  /**
   * Apply redaction patterns to plain text
   */
  private async applyTextRedactionPatterns(
    text: string,
    pageNumber: number,
    options: DocumentProcessingOptions
  ): Promise<RedactedArea[]> {
    const redactedAreas: RedactedArea[] = [];

    for (const pattern of this.redactionPatterns) {
      if (!this.shouldApplyPattern(pattern, options)) {
        continue;
      }

      let match;
      while ((match = pattern.pattern.exec(text)) !== null) {
        const matchedText = match[0];
        const confidence = this.calculatePatternConfidence(matchedText, pattern);
        
        if (confidence >= options.confidenceThreshold) {
          redactedAreas.push({
            id: `redaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'text',
            originalContent: matchedText,
            redactedContent: this.generateRedactedContent(pattern.category),
            pageNumber,
            confidence,
            category: pattern.category
          });
        }
      }
    }

    return redactedAreas;
  }

  /**
   * Check if pattern should be applied based on options
   */
  private shouldApplyPattern(pattern: RedactionPattern, options: DocumentProcessingOptions): boolean {
    switch (pattern.category) {
      case 'pii':
        return options.enablePIIRedaction;
      case 'financial':
        return options.enableFinancialRedaction;
      case 'medical':
        return options.enableMedicalRedaction;
      case 'legal':
        return options.enableLegalRedaction;
      default:
        return true;
    }
  }

  /**
   * Calculate confidence score for a pattern match
   */
  private calculatePatternConfidence(text: string, pattern: RedactionPattern): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on pattern severity
    switch (pattern.severity) {
      case 'high':
        confidence += 0.3;
        break;
      case 'medium':
        confidence += 0.1;
        break;
      case 'low':
        confidence -= 0.1;
        break;
    }

    // Adjust based on text characteristics
    if (text.length > 5) confidence += 0.1;
    if (text.match(/\d/) && text.match(/[A-Za-z]/)) confidence += 0.1;
    
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Generate redacted content based on category
   */
  private generateRedactedContent(category: string): string {
    switch (category) {
      case 'pii':
        return '[PII_REDACTED]';
      case 'financial':
        return '[FINANCIAL_REDACTED]';
      case 'medical':
        return '[MEDICAL_REDACTED]';
      case 'legal':
        return '[LEGAL_REDACTED]';
      default:
        return '[REDACTED]';
    }
  }

  /**
   * Create redaction annotations on PDF page
   */
  private async createRedactionAnnotations(
    page: mupdf.PDFPage,
    redactedAreas: RedactedArea[]
  ): Promise<void> {
    for (const area of redactedAreas) {
      if (area.type === 'text' && area.boundingBox) {
        try {
          const annotation = page.createAnnotation("Redact");
          annotation.setRect(area.boundingBox);
          // Note: applyRedaction will be called at page level later
        } catch (error) {
          console.warn('Failed to create redaction annotation:', error);
        }
      }
    }
  }

  /**
   * Clean document metadata
   */
  private cleanDocumentMetadata(document: mupdf.PDFDocument): void {
    try {
      // Clear all standard PDF metadata fields
      document.setMetaData("info:Title", "");
      document.setMetaData("info:Author", "");
      document.setMetaData("info:Subject", "");
      document.setMetaData("info:Keywords", "");
      document.setMetaData("info:Creator", "");
      document.setMetaData("info:Producer", "");
      document.setMetaData("info:CreationDate", "");
      document.setMetaData("info:ModDate", "");
      
      // Remove XML metadata
      const root = document.getTrailer().get("Root");
      root.delete("Metadata");
    } catch (error) {
      console.warn('Failed to clean metadata:', error);
    }
  }

  /**
   * Extract clean text after redaction
   */
  private extractCleanText(originalText: string, redactedAreas: RedactedArea[]): string {
    let cleanText = originalText;
    
    for (const area of redactedAreas) {
      cleanText = cleanText.replace(area.originalContent, area.redactedContent);
    }
    
    return cleanText;
  }

  /**
   * Apply redactions to text
   */
  private applyRedactionsToText(text: string, redactedAreas: RedactedArea[]): string {
    let redactedText = text;
    
    for (const area of redactedAreas) {
      redactedText = redactedText.replace(area.originalContent, area.redactedContent);
    }
    
    return redactedText;
  }

  /**
   * Generate redaction summary
   */
  private generateRedactionSummary(redactedAreas: RedactedArea[]): RedactionSummary {
    const summary: RedactionSummary = {
      totalRedactions: redactedAreas.length,
      piiRedactions: 0,
      financialRedactions: 0,
      medicalRedactions: 0,
      legalRedactions: 0,
      otherRedactions: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0
    };

    for (const area of redactedAreas) {
      switch (area.category) {
        case 'pii':
          summary.piiRedactions++;
          break;
        case 'financial':
          summary.financialRedactions++;
          break;
        case 'medical':
          summary.medicalRedactions++;
          break;
        case 'legal':
          summary.legalRedactions++;
          break;
        default:
          summary.otherRedactions++;
          break;
      }

      if (area.confidence >= 0.8) {
        summary.highConfidence++;
      } else if (area.confidence >= 0.6) {
        summary.mediumConfidence++;
      } else {
        summary.lowConfidence++;
      }
    }

    return summary;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(redactedAreas: RedactedArea[]): number {
    if (redactedAreas.length === 0) return 1.0;
    
    const totalConfidence = redactedAreas.reduce((sum, area) => sum + area.confidence, 0);
    return totalConfidence / redactedAreas.length;
  }

  /**
   * Get redaction patterns for UI display
   */
  public getRedactionPatterns(): RedactionPattern[] {
    return [...this.redactionPatterns];
  }

  /**
   * Add custom redaction pattern
   */
  public addRedactionPattern(pattern: RedactionPattern): void {
    this.redactionPatterns.push(pattern);
  }

  /**
   * Remove redaction pattern
   */
  public removeRedactionPattern(patternName: string): boolean {
    const index = this.redactionPatterns.findIndex(p => p.name === patternName);
    if (index !== -1) {
      this.redactionPatterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export default DocumentRedactionService;
