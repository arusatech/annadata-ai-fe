/**
 * Enhanced Document Processor - Integration Example
 * 
 * This file demonstrates how to use the new enhanced PDF annotation system
 * with the existing redaction workflow.
 */

import PDFAnnotationService from './PDFAnnotationService';
import PDFAnnotationTester from './PDFAnnotationTester';
import DocumentRedactionService from './DocumentRedactionService';
import ContentAnalysisService from './ContentAnalysisService';

/**
 * Example 1: Basic PDF Processing with Enhanced Annotations
 */
export async function processDocumentWithAnnotations(
  pdfBuffer: ArrayBuffer,
  fileName: string
) {
  console.log('📄 Processing document:', fileName);
  
  // Step 1: Parse and annotate PDF
  const annotationService = PDFAnnotationService.getInstance();
  const result = await annotationService.parseAndAnnotatePDF(
    pdfBuffer,
    fileName,
    'session-123',
    'message-456'
  );
  
  // Step 2: Review annotations
  console.log('\n📊 Annotation Results:');
  console.log(`  - Document ID: ${result.documentId}`);
  console.log(`  - Pages: ${result.report.pageCount}`);
  console.log(`  - Images: ${result.report.totalImages}`);
  console.log(`  - Text Sections: ${result.report.totalTextSections}`);
  console.log(`  - Images with Captions: ${result.report.imagesWithCaptions}`);
  
  // Step 3: Query specific page
  const page0Annotations = await annotationService.getDocumentAnnotations(
    result.documentId,
    0
  );
  
  console.log(`\n📄 Page 1 Content:`);
  console.log(`  - ${page0Annotations.images.length} images`);
  console.log(`  - ${page0Annotations.textSections.length} text sections`);
  
  // Step 4: Examine images with details
  for (const image of page0Annotations.images) {
    console.log(`\n  🖼️  Image ${image.image_index + 1}:`);
    console.log(`    - Size: ${image.width_cm}cm × ${image.height_cm}cm`);
    console.log(`    - Position: [${image.bbox_x1}, ${image.bbox_y1}] to [${image.bbox_x2}, ${image.bbox_y2}]`);
    
    if (image.caption_text) {
      console.log(`    - Caption: "${image.caption_text}"`);
      console.log(`    - Caption Position: ${image.caption_position}`);
    }
    
    if (image.format) {
      console.log(`    - Format: ${image.format}`);
    }
  }
  
  // Step 5: Examine text hierarchy
  const hierarchy = await annotationService.getPageTextHierarchy(
    result.documentId,
    0
  );
  
  console.log(`\n📝 Text Hierarchy (Page 1):`);
  for (const section of hierarchy.slice(0, 5)) {
    const indent = '  '.repeat(section.section_level);
    console.log(`  ${indent}[L${section.section_level}] ${section.content_type.toUpperCase()}: ${section.content_text.substring(0, 50)}...`);
  }
  
  return result;
}

/**
 * Example 2: Integration with Redaction System
 */
export async function processWithRedaction(
  pdfBuffer: ArrayBuffer,
  fileName: string
) {
  console.log('🔐 Processing document with redaction:', fileName);
  
  // Step 1: Get annotations first
  const annotationService = PDFAnnotationService.getInstance();
  const annotationResult = await annotationService.parseAndAnnotatePDF(
    pdfBuffer,
    fileName
  );
  
  // Step 2: Apply redaction
  const redactionService = DocumentRedactionService.getInstance();
  const redactionResult = await redactionService.processPDF(pdfBuffer);
  
  // Step 3: Combine results
  const combinedReport = {
    documentId: annotationResult.documentId,
    fileName,
    annotations: {
      totalImages: annotationResult.report.totalImages,
      totalTextSections: annotationResult.report.totalTextSections,
      imagesWithCaptions: annotationResult.report.imagesWithCaptions
    },
    redactions: {
      totalRedactions: redactionResult.redactionSummary.totalRedactions,
      piiRedactions: redactionResult.redactionSummary.piiRedactions,
      financialRedactions: redactionResult.redactionSummary.financialRedactions
    },
    safeContent: redactionResult.redactedText
  };
  
  console.log('\n📊 Combined Report:', JSON.stringify(combinedReport, null, 2));
  
  return combinedReport;
}

/**
 * Example 3: Testing and Validation
 */
export async function testAndValidateDocument(
  pdfBuffer: ArrayBuffer,
  fileName: string
) {
  console.log('🧪 Testing document:', fileName);
  
  const tester = PDFAnnotationTester.getInstance();
  
  // Run comprehensive test
  const testResult = await tester.testPDFAnnotation(pdfBuffer, fileName);
  
  if (testResult.success) {
    console.log('✅ All tests passed!');
    
    // Print visualization
    if (testResult.documentId) {
      await tester.printVisualization(testResult.documentId);
      
      // Export results
      const exportData = await tester.exportTestResults(
        testResult.documentId,
        testResult
      );
      
      console.log('\n📤 Export Data (first 500 chars):');
      console.log(exportData.substring(0, 500) + '...');
    }
  } else {
    console.error('❌ Tests failed:');
    testResult.errors.forEach(err => console.error(`  - ${err}`));
  }
  
  return testResult;
}

/**
 * Example 4: Query and Analysis
 */
export async function analyzeDocumentStructure(documentId: string) {
  console.log('🔍 Analyzing document structure:', documentId);
  
  const annotationService = PDFAnnotationService.getInstance();
  const report = await annotationService.getAnnotationReport(documentId);
  
  console.log('\n📊 Structure Analysis:');
  console.log(`  - Total Pages: ${report.pageCount}`);
  console.log(`  - Content Density: ${(report.totalTextSections / report.pageCount).toFixed(1)} sections/page`);
  console.log(`  - Image Density: ${(report.totalImages / report.pageCount).toFixed(1)} images/page`);
  console.log(`  - Caption Rate: ${report.totalImages > 0 ? ((report.imagesWithCaptions / report.totalImages) * 100).toFixed(1) : 0}%`);
  
  // Analyze content distribution
  console.log('\n📊 Content Distribution by Page:');
  for (let page = 0; page < report.pageCount; page++) {
    const imageCount = report.imagesByPage[page] || 0;
    const textCount = report.textSectionsByPage[page] || 0;
    
    if (imageCount > 0 || textCount > 0) {
      console.log(`  Page ${page + 1}: ${imageCount} images, ${textCount} text sections`);
    }
  }
  
  // Get detailed annotations for first page
  const page0 = await annotationService.getDocumentAnnotations(documentId, 0);
  
  // Analyze text types
  const textTypes = page0.textSections.reduce((acc, section) => {
    acc[section.content_type] = (acc[section.content_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📝 Text Types (Page 1):');
  for (const [type, count] of Object.entries(textTypes)) {
    console.log(`  - ${type}: ${count}`);
  }
  
  return report;
}

/**
 * Example 5: Export for External Use
 */
export async function exportDocumentAnnotations(documentId: string) {
  console.log('📤 Exporting annotations:', documentId);
  
  const annotationService = PDFAnnotationService.getInstance();
  
  // Export as JSON
  const jsonExport = await annotationService.exportAnnotationsAsJSON(documentId);
  
  console.log('\n📦 Export completed');
  console.log(`  Size: ${(jsonExport.length / 1024).toFixed(2)} KB`);
  
  // Parse and show structure
  const data = JSON.parse(jsonExport);
  console.log(`  - Images: ${data.annotations.images.length}`);
  console.log(`  - Text Sections: ${data.annotations.textSections.length}`);
  
  return jsonExport;
}

/**
 * Example 6: Page-by-Page Processing
 */
export async function processPageByPage(documentId: string) {
  console.log('📄 Processing pages individually:', documentId);
  
  const annotationService = PDFAnnotationService.getInstance();
  const report = await annotationService.getAnnotationReport(documentId);
  
  for (let page = 0; page < report.pageCount; page++) {
    console.log(`\n📄 Processing Page ${page + 1}:`);
    
    // Get page annotations
    const annotations = await annotationService.getDocumentAnnotations(
      documentId,
      page
    );
    
    // Process images
    if (annotations.images.length > 0) {
      console.log(`  🖼️  Found ${annotations.images.length} images:`);
      for (const image of annotations.images) {
        const sizeInfo = `${image.width_cm}cm × ${image.height_cm}cm`;
        const captionInfo = image.caption_text 
          ? ` [Caption: ${image.caption_text.substring(0, 30)}...]`
          : ' [No caption]';
        console.log(`    - Image ${image.image_index}: ${sizeInfo}${captionInfo}`);
      }
    }
    
    // Process text with hierarchy
    if (annotations.textSections.length > 0) {
      console.log(`  📝 Found ${annotations.textSections.length} text sections`);
      
      // Get hierarchy
      const hierarchy = await annotationService.getPageTextHierarchy(
        documentId,
        page
      );
      
      // Show top-level sections
      const topLevel = hierarchy.filter(s => s.section_level === 1);
      console.log(`    - Top-level sections: ${topLevel.length}`);
      for (const section of topLevel.slice(0, 3)) {
        console.log(`      * ${section.content_type}: ${section.content_text.substring(0, 40)}...`);
      }
    }
  }
}

/**
 * Example Usage Script
 */
export async function runExamples(pdfBuffer: ArrayBuffer, fileName: string) {
  console.log('\n' + '='.repeat(60));
  console.log('ENHANCED PDF ANNOTATION EXAMPLES');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Example 1: Basic processing
    console.log('\n' + '─'.repeat(60));
    console.log('EXAMPLE 1: Basic Processing with Annotations');
    console.log('─'.repeat(60));
    const result = await processDocumentWithAnnotations(pdfBuffer, fileName);
    
    // Example 2: Testing
    console.log('\n' + '─'.repeat(60));
    console.log('EXAMPLE 2: Testing and Validation');
    console.log('─'.repeat(60));
    const testResult = await testAndValidateDocument(pdfBuffer, fileName);
    
    if (testResult.documentId) {
      // Example 3: Analysis
      console.log('\n' + '─'.repeat(60));
      console.log('EXAMPLE 3: Structure Analysis');
      console.log('─'.repeat(60));
      await analyzeDocumentStructure(testResult.documentId);
      
      // Example 4: Export
      console.log('\n' + '─'.repeat(60));
      console.log('EXAMPLE 4: Export Annotations');
      console.log('─'.repeat(60));
      await exportDocumentAnnotations(testResult.documentId);
      
      // Example 5: Page-by-page
      console.log('\n' + '─'.repeat(60));
      console.log('EXAMPLE 5: Page-by-Page Processing');
      console.log('─'.repeat(60));
      await processPageByPage(testResult.documentId);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('ALL EXAMPLES COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
    throw error;
  }
}

// Export all examples
export default {
  processDocumentWithAnnotations,
  processWithRedaction,
  testAndValidateDocument,
  analyzeDocumentStructure,
  exportDocumentAnnotations,
  processPageByPage,
  runExamples
};
