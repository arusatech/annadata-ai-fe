// src/services/PDFAnnotationTester.ts
import PDFAnnotationService, { AnnotationReport } from './PDFAnnotationService';
import { OCRConfig } from './EnhancedPDFParser';
import RedactionDatabaseService, {
  ImageAnnotation,
  TextSectionAnnotation
} from './RedactionDatabaseService';

/**
 * PDF Annotation Tester - Utility for testing and visualizing annotations
 * 
 * Features:
 * - Test PDF parsing and annotation
 * - Generate detailed reports
 * - Visualize annotation structure
 * - Export results
 * - Validate data integrity
 */

export interface TestResult {
  success: boolean;
  documentId?: string;
  errors: string[];
  warnings: string[];
  metrics: {
    parsingTime: number;
    storageTime: number;
    totalTime: number;
  };
  report?: AnnotationReport;
}

export interface VisualizationData {
  documentId: string;
  fileName: string;
  pages: Array<{
    pageNumber: number;
    images: Array<{
      index: number;
      dimensions: string;
      caption: string | null;
      position: string;
    }>;
    textSections: Array<{
      index: number;
      type: string;
      level: number;
      preview: string;
      wordCount: number;
    }>;
  }>;
}

class PDFAnnotationTester {
  private static instance: PDFAnnotationTester;
  private annotationService: PDFAnnotationService;
  private db: RedactionDatabaseService;

  private constructor() {
    this.annotationService = PDFAnnotationService.getInstance();
    this.db = RedactionDatabaseService.getInstance();
  }

  public static getInstance(): PDFAnnotationTester {
    if (!PDFAnnotationTester.instance) {
      PDFAnnotationTester.instance = new PDFAnnotationTester();
    }
    return PDFAnnotationTester.instance;
  }

  /**
   * Test PDF annotation workflow
   */
  async testPDFAnnotation(
    fileBuffer: ArrayBuffer,
    fileName: string
  ): Promise<TestResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const startTime = Date.now();
    let documentId: string | undefined;
    let parsingTime = 0;
    let storageTime = 0;
    
    try {
      console.log('\n🧪 ========================================');
      console.log('🧪 PDF ANNOTATION TEST');
      console.log('🧪 ========================================');
      console.log(`📄 File: ${fileName}`);
      console.log(`📦 Size: ${(fileBuffer.byteLength / 1024).toFixed(2)} KB`);
      console.log('🧪 ========================================\n');
      
      // Test parsing with OCR
      console.log('⏱️  Starting parsing phase with OCR...');
      const parseStart = Date.now();
      
      // OCR configuration for testing (works offline with bundled files)
      const ocrConfig: OCRConfig = {
        enabled: true, // ✅ ENABLED - Works offline!
        primaryLanguage: 'english',
        fallbackLanguages: ['english', 'hindi'],
        minImageSize: 100,
        progressCallback: (current, total, imageIndex) => {
          console.log(`   🔍 OCR: Page ${current}/${total}, Image ${imageIndex}`);
        }
      };
      
      const result = await this.annotationService.parseAndAnnotatePDF(
        fileBuffer,
        fileName,
        'test-session',
        'test-message',
        {
          extractImages: true,
          extractText: true,
          detectCaptions: true,
          analyzeHierarchy: true,
          ocr: ocrConfig
        }
      );
      
      parsingTime = Date.now() - parseStart;
      storageTime = Date.now() - parseStart; // Includes storage
      documentId = result.documentId;
      
      console.log(`✅ Parsing completed in ${parsingTime}ms`);
      console.log('\n📊 ========================================');
      console.log('📊 ANNOTATION REPORT');
      console.log('📊 ========================================');
      this.printReport(result.report);
      
      // Validate data
      console.log('\n🔍 ========================================');
      console.log('🔍 DATA VALIDATION');
      console.log('🔍 ========================================');
      const validationResult = await this.validateAnnotations(documentId);
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);
      
      // Print validation results
      if (errors.length > 0) {
        console.log('\n❌ ERRORS:');
        errors.forEach(err => console.log(`   - ${err}`));
      }
      
      if (warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        warnings.forEach(warn => console.log(`   - ${warn}`));
      }
      
      if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ All validations passed!');
      }
      
      // Test retrieval
      console.log('\n🔍 ========================================');
      console.log('🔍 RETRIEVAL TEST');
      console.log('🔍 ========================================');
      await this.testRetrieval(documentId);
      
      const totalTime = Date.now() - startTime;
      
      console.log('\n✅ ========================================');
      console.log('✅ TEST COMPLETED SUCCESSFULLY');
      console.log('✅ ========================================');
      console.log(`⏱️  Total Time: ${totalTime}ms`);
      console.log(`📄 Document ID: ${documentId}`);
      console.log('✅ ========================================\n');
      
      return {
        success: errors.length === 0,
        documentId,
        errors,
        warnings,
        metrics: {
          parsingTime,
          storageTime,
          totalTime
        },
        report: result.report
      };
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      
      console.error('\n❌ ========================================');
      console.error('❌ TEST FAILED');
      console.error('❌ ========================================');
      console.error(`❌ Error: ${errorMsg}`);
      console.error('❌ ========================================\n');
      
      return {
        success: false,
        documentId,
        errors,
        warnings,
        metrics: {
          parsingTime,
          storageTime,
          totalTime
        }
      };
    }
  }

  /**
   * Print annotation report
   */
  private printReport(report: AnnotationReport): void {
    console.log(`📄 File Name: ${report.fileName}`);
    console.log(`📖 Page Count: ${report.pageCount}`);
    console.log(`🖼️  Total Images: ${report.totalImages}`);
    console.log(`📝 Total Text Sections: ${report.totalTextSections}`);
    console.log(`🏷️  Images with Captions: ${report.imagesWithCaptions} (${report.totalImages > 0 ? ((report.imagesWithCaptions / report.totalImages) * 100).toFixed(1) : 0}%)`);
    
    if (report.totalImages > 0) {
      console.log('\n📏 Average Image Size:');
      console.log(`   - ${report.averageImageSize.widthCm} cm × ${report.averageImageSize.heightCm} cm`);
      console.log(`   - ${report.averageImageSize.widthInches}" × ${report.averageImageSize.heightInches}"`);
    }
    
    console.log('\n📊 Content by Page:');
    const allPages = new Set([
      ...Object.keys(report.imagesByPage).map(Number),
      ...Object.keys(report.textSectionsByPage).map(Number)
    ]);
    
    for (const pageNum of Array.from(allPages).sort((a, b) => a - b)) {
      const imageCount = report.imagesByPage[pageNum] || 0;
      const textCount = report.textSectionsByPage[pageNum] || 0;
      console.log(`   Page ${pageNum + 1}: ${imageCount} images, ${textCount} text sections`);
    }
    
    if (report.metadata && Object.keys(report.metadata).length > 0) {
      console.log('\n📋 Document Metadata:');
      for (const [key, value] of Object.entries(report.metadata)) {
        if (value) {
          console.log(`   ${key}: ${value}`);
        }
      }
    }
  }

  /**
   * Validate stored annotations
   */
  private async validateAnnotations(documentId: string): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check document exists
      const document = await this.db.getDocument(documentId);
      if (!document) {
        errors.push('Document not found in database');
        return { errors, warnings };
      }
      
      console.log('✅ Document record exists');
      
      // Check image annotations
      const images = await this.db.getImageAnnotations(documentId);
      console.log(`✅ Retrieved ${images.length} image annotations`);
      
      for (const image of images) {
        // Validate dimensions
        if (image.width_px <= 0 || image.height_px <= 0) {
          errors.push(`Image ${image.section_id}: Invalid dimensions (${image.width_px}×${image.height_px})`);
        }
        
        if (!image.width_cm || !image.height_cm) {
          warnings.push(`Image ${image.section_id}: Missing cm dimensions`);
        }
        
        if (!image.width_inches || !image.height_inches) {
          warnings.push(`Image ${image.section_id}: Missing inch dimensions`);
        }
        
        // Validate bounding box
        if (image.bbox_x1 >= image.bbox_x2 || image.bbox_y1 >= image.bbox_y2) {
          errors.push(`Image ${image.section_id}: Invalid bounding box`);
        }
      }
      
      // Check text annotations
      const textSections = await this.db.getTextAnnotations(documentId);
      console.log(`✅ Retrieved ${textSections.length} text annotations`);
      
      for (const textSection of textSections) {
        // Validate content
        if (!textSection.content_text || textSection.content_text.trim().length === 0) {
          errors.push(`Text section ${textSection.section_id}: Empty content`);
        }
        
        // Validate word count
        const actualWordCount = textSection.content_text.split(/\s+/).filter(w => w.length > 0).length;
        if (Math.abs(actualWordCount - textSection.word_count) > 1) {
          warnings.push(`Text section ${textSection.section_id}: Word count mismatch (stored: ${textSection.word_count}, actual: ${actualWordCount})`);
        }
        
        // Validate character count
        if (textSection.char_count !== textSection.content_text.length) {
          warnings.push(`Text section ${textSection.section_id}: Character count mismatch`);
        }
      }
      
      // Check caption associations
      const imagesWithCaptions = images.filter(img => img.caption_text);
      console.log(`✅ Found ${imagesWithCaptions.length} images with captions`);
      
      for (const image of imagesWithCaptions) {
        if (!image.caption_position) {
          warnings.push(`Image ${image.section_id}: Caption exists but position not set`);
        }
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return { errors, warnings };
  }

  /**
   * Test data retrieval
   */
  private async testRetrieval(documentId: string): Promise<void> {
    try {
      // Test document retrieval
      const document = await this.db.getDocument(documentId);
      console.log(`✅ Document retrieval: ${document?.file_name}`);
      
      // Test section retrieval
      const sections = await this.db.getDocumentSections(documentId);
      console.log(`✅ Section retrieval: ${sections.length} sections`);
      
      // Test image annotation retrieval
      const images = await this.db.getImageAnnotations(documentId);
      console.log(`✅ Image annotation retrieval: ${images.length} images`);
      
      // Test text annotation retrieval
      const textSections = await this.db.getTextAnnotations(documentId);
      console.log(`✅ Text annotation retrieval: ${textSections.length} text sections`);
      
      // Test page-specific retrieval
      if (images.length > 0) {
        const firstPageNum = images[0].page_number;
        const pageImages = await this.db.getImageAnnotations(documentId, firstPageNum);
        console.log(`✅ Page-specific image retrieval: ${pageImages.length} images on page ${firstPageNum + 1}`);
      }
      
      // Test hierarchy retrieval
      if (textSections.length > 0) {
        const firstPageNum = textSections[0].page_number;
        const hierarchy = await this.db.getTextHierarchy(documentId, firstPageNum);
        console.log(`✅ Text hierarchy retrieval: ${hierarchy.length} sections in hierarchy on page ${firstPageNum + 1}`);
      }
      
      // Test report generation
      const report = await this.annotationService.getAnnotationReport(documentId);
      console.log(`✅ Report generation: ${report.totalImages} images, ${report.totalTextSections} text sections`);
      
    } catch (error) {
      console.error(`❌ Retrieval test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Generate visualization data for UI
   */
  async generateVisualization(documentId: string): Promise<VisualizationData> {
    try {
      const report = await this.annotationService.getAnnotationReport(documentId);
      const annotations = await this.annotationService.getDocumentAnnotations(documentId);
      
      const pages: VisualizationData['pages'] = [];
      
      // Group by page
      const pageNumbers = new Set([
        ...annotations.images.map(img => img.page_number),
        ...annotations.textSections.map(txt => txt.page_number)
      ]);
      
      for (const pageNum of Array.from(pageNumbers).sort((a, b) => a - b)) {
        const pageImages = annotations.images
          .filter(img => img.page_number === pageNum)
          .map(img => ({
            index: img.image_index,
            dimensions: `${img.width_cm}cm × ${img.height_cm}cm (${img.width_inches}" × ${img.height_inches}")`,
            caption: img.caption_text || null,
            position: `[${img.bbox_x1.toFixed(1)}, ${img.bbox_y1.toFixed(1)}, ${img.bbox_x2.toFixed(1)}, ${img.bbox_y2.toFixed(1)}]`
          }));
        
        const pageTextSections = annotations.textSections
          .filter(txt => txt.page_number === pageNum)
          .map(txt => ({
            index: txt.section_index,
            type: txt.content_type,
            level: txt.section_level,
            preview: txt.content_text.substring(0, 50) + (txt.content_text.length > 50 ? '...' : ''),
            wordCount: txt.word_count
          }));
        
        pages.push({
          pageNumber: pageNum,
          images: pageImages,
          textSections: pageTextSections
        });
      }
      
      return {
        documentId: report.documentId,
        fileName: report.fileName,
        pages
      };
      
    } catch (error) {
      console.error('❌ [PDFAnnotationTester] Failed to generate visualization:', error);
      throw error;
    }
  }

  /**
   * Print visualization to console
   */
  async printVisualization(documentId: string): Promise<void> {
    try {
      const viz = await this.generateVisualization(documentId);
      
      console.log('\n📊 ========================================');
      console.log('📊 DOCUMENT VISUALIZATION');
      console.log('📊 ========================================');
      console.log(`📄 Document: ${viz.fileName}`);
      console.log(`🆔 ID: ${viz.documentId}`);
      console.log('📊 ========================================\n');
      
      for (const page of viz.pages) {
        console.log(`\n📄 Page ${page.pageNumber + 1}`);
        console.log('─────────────────────────────────────────');
        
        if (page.images.length > 0) {
          console.log(`\n  🖼️  Images (${page.images.length}):`);
          for (const image of page.images) {
            console.log(`    [${image.index}] ${image.dimensions}`);
            console.log(`        Position: ${image.position}`);
            if (image.caption) {
              console.log(`        Caption: ${image.caption}`);
            }
          }
        }
        
        if (page.textSections.length > 0) {
          console.log(`\n  📝 Text Sections (${page.textSections.length}):`);
          for (const section of page.textSections) {
            const indent = '  '.repeat(section.level);
            console.log(`    ${indent}[${section.index}] ${section.type.toUpperCase()} (L${section.level})`);
            console.log(`    ${indent}    "${section.preview}"`);
            console.log(`    ${indent}    ${section.wordCount} words`);
          }
        }
      }
      
      console.log('\n📊 ========================================\n');
      
    } catch (error) {
      console.error('❌ [PDFAnnotationTester] Failed to print visualization:', error);
      throw error;
    }
  }

  /**
   * Export test results
   */
  async exportTestResults(documentId: string, testResult: TestResult): Promise<string> {
    try {
      const annotations = await this.annotationService.exportAnnotationsAsJSON(documentId);
      const visualization = await this.generateVisualization(documentId);
      
      const exportData = {
        testResult,
        visualization,
        annotationsJSON: JSON.parse(annotations),
        exportedAt: new Date().toISOString()
      };
      
      return JSON.stringify(exportData, null, 2);
      
    } catch (error) {
      console.error('❌ [PDFAnnotationTester] Failed to export test results:', error);
      throw error;
    }
  }
}

export default PDFAnnotationTester;
