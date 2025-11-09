/**
 * Enhanced PDF Parser with OCR - Usage Examples
 * 
 * This file demonstrates how to use the EnhancedPDFParser with Tesseract.js OCR
 * for multilingual text extraction from PDFs and images.
 */

import EnhancedPDFParser, { OCRConfig, PDFParseResult } from './EnhancedPDFParser';

// ============================================================================
// Example 1: Basic PDF Parsing with Hindi + English OCR
// ============================================================================
export async function example1_BasicHindiOCR(fileBuffer: ArrayBuffer): Promise<void> {
  console.log('📖 Example 1: Basic Hindi + English OCR\n');
  
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, 'doc_hindi_001', {
    extractImages: true,
    extractText: true,
    detectCaptions: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'hindi',
      fallbackLanguages: ['english', 'hindi'],
      minImageSize: 100
    }
  });
  
  console.log('✅ Results:');
  console.log(`   Pages: ${result.pageCount}`);
  console.log(`   Images: ${result.images.length}`);
  console.log(`   OCR Processed: ${result.metadata.totalOcrImages}`);
  console.log(`   Processing Time: ${result.metadata.ocrProcessingTime}ms`);
  console.log(`   Languages: ${result.metadata.ocrLanguages}\n`);
  
  // Display OCR text from first image
  const firstImageWithOCR = result.images.find(img => img.ocrText);
  if (firstImageWithOCR) {
    console.log('📷 First Image OCR:');
    console.log(`   Text: ${firstImageWithOCR.ocrText?.substring(0, 100)}...`);
    console.log(`   Confidence: ${firstImageWithOCR.ocrConfidence}%`);
  }
}

// ============================================================================
// Example 2: Multi-language Document (Indian Languages)
// ============================================================================
export async function example2_MultiLanguageIndian(fileBuffer: ArrayBuffer): Promise<void> {
  console.log('📖 Example 2: Multi-language Indian Document\n');
  
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, 'doc_multilang_001', {
    extractImages: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'auto', // Auto-detect
      fallbackLanguages: [
        'english',
        'hindi',
        'tamil',
        'bengali',
        'gujarati',
        'kannada',
        'malayalam',
        'marathi'
      ],
      minImageSize: 50,
      progressCallback: (current, total, imageIndex) => {
        console.log(`   Processing page ${current}/${total}, image ${imageIndex}`);
      }
    }
  });
  
  console.log('✅ Results:');
  console.log(`   Total Images: ${result.images.length}`);
  console.log(`   Images with OCR: ${result.metadata.totalOcrImages}`);
  
  // Show language distribution
  const languageMap = new Map<string, number>();
  result.images.forEach(img => {
    img.ocrDetectedLanguages?.forEach(lang => {
      languageMap.set(lang.lang, (languageMap.get(lang.lang) || 0) + 1);
    });
  });
  
  console.log('\n📊 Language Distribution:');
  languageMap.forEach((count, lang) => {
    console.log(`   ${lang}: ${count} occurrences`);
  });
}

// ============================================================================
// Example 3: High-Quality Scanned Document
// ============================================================================
export async function example3_HighQualityScan(fileBuffer: ArrayBuffer): Promise<void> {
  console.log('📖 Example 3: High-Quality Scanned Document\n');
  
  const parser = EnhancedPDFParser.getInstance();
  
  // For high-quality scans, we can be more selective
  const result = await parser.parsePDF(fileBuffer, 'doc_scan_001', {
    extractImages: true,
    extractText: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'english',
      fallbackLanguages: ['english'],
      minImageSize: 200, // Only process large, clear images
      progressCallback: (current, total) => {
        const progress = Math.round((current / total) * 100);
        console.log(`   Progress: ${progress}%`);
      }
    }
  });
  
  // Filter high-confidence results
  const highConfidenceImages = result.images.filter(
    img => img.ocrConfidence && img.ocrConfidence > 80
  );
  
  console.log('✅ High-Confidence OCR Results:');
  console.log(`   Total Images: ${result.images.length}`);
  console.log(`   High Confidence (>80%): ${highConfidenceImages.length}`);
  
  highConfidenceImages.forEach(img => {
    console.log(`\n   Image ${img.index + 1}:`);
    console.log(`      Confidence: ${img.ocrConfidence?.toFixed(1)}%`);
    console.log(`      Text Length: ${img.ocrText?.length} chars`);
  });
}

// ============================================================================
// Example 4: International Document (Chinese, Japanese, Korean)
// ============================================================================
export async function example4_CJKLanguages(fileBuffer: ArrayBuffer): Promise<void> {
  console.log('📖 Example 4: CJK Languages Document\n');
  
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, 'doc_cjk_001', {
    extractImages: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'chinese',
      fallbackLanguages: ['chinese', 'japanese', 'korean', 'english'],
      minImageSize: 100
    }
  });
  
  console.log('✅ CJK OCR Results:');
  result.images.forEach(img => {
    if (img.ocrText) {
      console.log(`\n   Image ${img.index + 1}:`);
      console.log(`      Size: ${img.widthPx}x${img.heightPx}px`);
      console.log(`      Confidence: ${img.ocrConfidence}%`);
      console.log(`      Detected Languages:`, img.ocrDetectedLanguages?.map(l => l.lang).join(', '));
    }
  });
}

// ============================================================================
// Example 5: Batch Processing with Progress Tracking
// ============================================================================
export async function example5_BatchProcessing(fileBuffers: ArrayBuffer[]): Promise<void> {
  console.log('📖 Example 5: Batch Processing Multiple PDFs\n');
  
  const parser = EnhancedPDFParser.getInstance();
  const results: PDFParseResult[] = [];
  
  for (let i = 0; i < fileBuffers.length; i++) {
    console.log(`\n📄 Processing document ${i + 1}/${fileBuffers.length}`);
    
    const result = await parser.parsePDF(fileBuffers[i], `batch_doc_${i}`, {
      extractImages: true,
      ocr: {
        enabled: true,
        primaryLanguage: 'english',
        fallbackLanguages: ['english', 'hindi'],
        minImageSize: 100,
        progressCallback: (current, total) => {
          console.log(`   Page ${current}/${total}`);
        }
      }
    });
    
    results.push(result);
  }
  
  // Aggregate statistics
  const totalImages = results.reduce((sum, r) => sum + r.images.length, 0);
  const totalOCR = results.reduce((sum, r) => sum + (r.metadata.totalOcrImages || 0), 0);
  const totalTime = results.reduce((sum, r) => sum + (r.metadata.ocrProcessingTime || 0), 0);
  
  console.log('\n✅ Batch Processing Complete:');
  console.log(`   Documents: ${results.length}`);
  console.log(`   Total Images: ${totalImages}`);
  console.log(`   OCR Processed: ${totalOCR}`);
  console.log(`   Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Average per Doc: ${(totalTime / results.length / 1000).toFixed(2)}s`);
}

// ============================================================================
// Example 6: Extract and Save OCR Results
// ============================================================================
export async function example6_ExtractAndSave(fileBuffer: ArrayBuffer): Promise<string> {
  console.log('📖 Example 6: Extract and Save OCR Results\n');
  
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, 'doc_extract_001', {
    extractImages: true,
    extractText: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'english',
      fallbackLanguages: ['english', 'hindi']
    }
  });
  
  // Build comprehensive text output
  let extractedText = '';
  
  extractedText += `Document: ${result.documentId}\n`;
  extractedText += `Pages: ${result.pageCount}\n`;
  extractedText += `Date: ${new Date().toISOString()}\n\n`;
  extractedText += '='.repeat(80) + '\n\n';
  
  // Add text sections
  extractedText += '📝 TEXT SECTIONS\n\n';
  result.textSections.forEach(section => {
    extractedText += `[Page ${section.pageNumber + 1}] ${section.type.toUpperCase()}\n`;
    extractedText += `${section.text}\n\n`;
  });
  
  // Add OCR results
  extractedText += '\n' + '='.repeat(80) + '\n\n';
  extractedText += '🔍 OCR EXTRACTED TEXT\n\n';
  result.images.forEach(img => {
    if (img.ocrText) {
      extractedText += `[Page ${img.pageNumber + 1}, Image ${img.index + 1}]\n`;
      extractedText += `Confidence: ${img.ocrConfidence}%\n`;
      extractedText += `Languages: ${img.ocrDetectedLanguages?.map(l => l.lang).join(', ')}\n\n`;
      extractedText += `${img.ocrText}\n\n`;
      extractedText += '-'.repeat(80) + '\n\n';
    }
  });
  
  console.log('✅ Extraction Complete');
  console.log(`   Total Length: ${extractedText.length} characters`);
  
  return extractedText;
}

// ============================================================================
// Example 7: Quality Assessment
// ============================================================================
export async function example7_QualityAssessment(fileBuffer: ArrayBuffer): Promise<void> {
  console.log('📖 Example 7: OCR Quality Assessment\n');
  
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, 'doc_quality_001', {
    extractImages: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'english',
      fallbackLanguages: ['english', 'hindi']
    }
  });
  
  // Categorize by confidence
  const excellent = result.images.filter(img => img.ocrConfidence && img.ocrConfidence >= 90);
  const good = result.images.filter(img => img.ocrConfidence && img.ocrConfidence >= 70 && img.ocrConfidence < 90);
  const fair = result.images.filter(img => img.ocrConfidence && img.ocrConfidence >= 50 && img.ocrConfidence < 70);
  const poor = result.images.filter(img => img.ocrConfidence && img.ocrConfidence < 50);
  
  console.log('📊 OCR Quality Distribution:\n');
  console.log(`   Excellent (90-100%): ${excellent.length} images`);
  console.log(`   Good (70-90%):       ${good.length} images`);
  console.log(`   Fair (50-70%):       ${fair.length} images`);
  console.log(`   Poor (<50%):         ${poor.length} images`);
  
  console.log('\n⚠️  Images Requiring Review:');
  [...fair, ...poor].forEach(img => {
    console.log(`   Image ${img.index + 1}: ${img.ocrConfidence}% confidence`);
  });
}

// ============================================================================
// Example 8: Real-time Progress Updates (React Component)
// ============================================================================
export async function example8_ReactProgress(
  fileBuffer: ArrayBuffer,
  onProgress: (progress: number, status: string) => void
): Promise<PDFParseResult> {
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, 'doc_react_001', {
    extractImages: true,
    extractText: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'hindi',
      fallbackLanguages: ['english', 'hindi'],
      minImageSize: 100,
      progressCallback: (current, total, imageIndex) => {
        const progress = Math.round((current / total) * 100);
        const status = `Processing page ${current}/${total} (image ${imageIndex})`;
        onProgress(progress, status);
      }
    }
  });
  
  onProgress(100, 'Complete!');
  return result;
}

// ============================================================================
// Main Demo Function
// ============================================================================
export async function runAllExamples(sampleBuffer: ArrayBuffer): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 Tesseract.js OCR Examples - All Scenarios');
  console.log('='.repeat(80) + '\n');
  
  try {
    await example1_BasicHindiOCR(sampleBuffer);
    console.log('\n' + '-'.repeat(80) + '\n');
    
    await example2_MultiLanguageIndian(sampleBuffer);
    console.log('\n' + '-'.repeat(80) + '\n');
    
    await example3_HighQualityScan(sampleBuffer);
    console.log('\n' + '-'.repeat(80) + '\n');
    
    const extractedText = await example6_ExtractAndSave(sampleBuffer);
    console.log('Sample Output:', extractedText.substring(0, 200) + '...');
    console.log('\n' + '-'.repeat(80) + '\n');
    
    await example7_QualityAssessment(sampleBuffer);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ All examples completed successfully!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

