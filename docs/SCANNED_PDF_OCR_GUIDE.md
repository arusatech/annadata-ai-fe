# Scanned PDF & OCR Guide

## Understanding the Issue

Your PDF (Abida_CV.pdf) shows:
```
📄 [EnhancedPDFParser] Found 1 images on page 1
📷 [EnhancedPDFParser] Image 1: 21.0cm x 27.2cm (full A4 page)
📄 [EnhancedPDFParser] Extracted 0 text blocks from page 1 ← No text!
```

This means the PDF is a **scanned document** (image-based), not a text-based PDF.

## PDF Types Explained

### Type 1: Text-Based PDF ✅
- Created from Word, Google Docs, LaTeX, etc.
- Contains selectable text
- Can copy/paste text
- **MuPDF.js extracts text natively**

### Type 2: Scanned PDF (Image-Based) 📸
- Created by scanning paper documents
- Entire page is an image
- Cannot select/copy text
- **Requires OCR to extract text**

### Type 3: Hybrid PDF (Scanned + OCR) 🔄
- Scanned document with OCR layer
- Has background image + invisible text layer
- Can select/copy text
- **MuPDF.js extracts the text layer**

## Your Situation

**Abida_CV.pdf is Type 2** (Scanned, no OCR layer):
- ❌ No extractable text
- ✅ Detected as image (correct behavior)
- 📐 Image size: 21.0cm × 27.2cm (full A4 page)

**MuPDF.js is working correctly** - it detects the image but has no text to extract.

## Solution: Add OCR Support

### Option 1: Tesseract.js (Browser-Based OCR)

**Pros**: 
- Runs entirely in browser
- No server needed
- Good accuracy

**Cons**:
- Large download (~4MB)
- Slower processing
- High memory usage

**Implementation**:

```bash
npm install tesseract.js
```

```typescript
// src/services/OCRService.ts
import { createWorker } from 'tesseract.js';

class OCRService {
  private static instance: OCRService;
  private worker: any = null;

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  async initialize(): Promise<void> {
    console.log('🔍 [OCR] Initializing Tesseract.js...');
    this.worker = await createWorker('eng'); // English language
    console.log('✅ [OCR] Tesseract.js initialized');
  }

  async extractTextFromImage(imageData: ArrayBuffer | Blob): Promise<string> {
    if (!this.worker) {
      await this.initialize();
    }

    console.log('🔍 [OCR] Processing image...');
    const startTime = Date.now();
    
    const { data: { text, confidence } } = await this.worker.recognize(imageData);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [OCR] Text extracted in ${processingTime}ms (confidence: ${confidence}%)`);
    
    return text;
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export default OCRService;
```

**Integrate with Enhanced Parser**:

```typescript
// In EnhancedPDFParser.ts
import OCRService from './OCRService';

private async extractTextSectionsFromPage(
  page: mupdf.PDFPage,
  pageNumber: number,
  documentId: string,
  startIndex: number,
  analyzeHierarchy: boolean
): Promise<ParsedTextSection[]> {
  const sections: ParsedTextSection[] = [];
  
  try {
    // Try to extract text normally
    const structuredText = page.toStructuredText("preserve-whitespace,preserve-spans");
    const textBlocks: TextBlock[] = [];
    // ... existing text extraction code ...
    
    // If no text found, try OCR
    if (textBlocks.length === 0) {
      console.log('📷 [EnhancedPDFParser] No text found, trying OCR...');
      
      // Render page to image
      const pixmap = page.toPixmap([1, 0, 0, 1, 0, 0], mupdf.ColorSpace.DeviceRGB, false);
      const imageData = pixmap.asPNG(); // Get PNG blob
      
      // Extract text using OCR
      const ocrService = OCRService.getInstance();
      const ocrText = await ocrService.extractTextFromImage(imageData);
      
      if (ocrText.trim()) {
        console.log(`✅ [EnhancedPDFParser] OCR extracted ${ocrText.length} characters`);
        
        // Create text section from OCR result
        sections.push({
          index: startIndex,
          pageNumber,
          sectionId: `${documentId}_ocr_p${pageNumber}`,
          level: 1,
          text: ocrText,
          type: 'paragraph',
          wordCount: ocrText.split(/\s+/).length,
          charCount: ocrText.length,
          isBold: false,
          isItalic: false,
          containsNumbers: /\d/.test(ocrText),
          containsUrls: /https?:\/\//.test(ocrText),
          metadata: {
            source: 'ocr',
            extractedAt: new Date().toISOString()
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ [EnhancedPDFParser] Failed to extract text:', error);
  }
  
  return sections;
}
```

### Option 2: Cloud OCR Service (Recommended for Production)

**Google Cloud Vision API**:

```typescript
// src/services/CloudOCRService.ts
class CloudOCRService {
  private readonly API_KEY = process.env.GOOGLE_CLOUD_API_KEY;

  async extractText(imageBase64: string): Promise<string> {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${this.API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
          }]
        })
      }
    );

    const data = await response.json();
    return data.responses[0].fullTextAnnotation?.text || '';
  }
}
```

**Pros**:
- Higher accuracy
- Faster processing
- Multiple languages
- Handles complex layouts

**Cons**:
- Requires API key
- Costs money (after free tier)
- Needs internet connection

### Option 3: Pre-process PDFs (Server-Side)

Add OCR layer to PDFs before sending to mobile app:

```bash
# Using Ghostscript + Tesseract
gs -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r300 -sOutputFile=page_%03d.png input.pdf
tesseract page_001.png output -l eng pdf
```

**Pros**:
- Best accuracy
- App stays lightweight
- Can use high-resolution OCR

**Cons**:
- Server processing required
- Network upload needed

## Detection Logic

Update parser to detect scanned PDFs:

```typescript
private isScannedPage(page: mupdf.PDFPage): boolean {
  // Extract text
  const text = page.toStructuredText("preserve-whitespace").asText();
  
  // Get images
  const images: any[] = [];
  page.toStructuredText("preserve-images").walk({
    onImageBlock: (bbox: any, matrix: any, image: any) => {
      images.push({ bbox, image });
    }
  });
  
  // Page is scanned if:
  // 1. Has at least one large image
  // 2. Image covers most of the page (>80%)
  // 3. Little or no extractable text
  
  if (images.length === 0) return false;
  if (text.trim().length > 100) return false;
  
  const pageBounds = page.getBounds();
  const pageArea = (pageBounds[2] - pageBounds[0]) * (pageBounds[3] - pageBounds[1]);
  
  for (const img of images) {
    const imageArea = (img.bbox[2] - img.bbox[0]) * (img.bbox[3] - img.bbox[1]);
    const coverage = imageArea / pageArea;
    
    if (coverage > 0.8) {
      console.log(`📸 [EnhancedPDFParser] Page appears to be scanned (${(coverage * 100).toFixed(1)}% image coverage)`);
      return true;
    }
  }
  
  return false;
}
```

## Usage Example

```typescript
// In ChatFooter.tsx or wherever you process PDFs
if (mimeType === 'application/pdf') {
  const result = await annotationService.parseAndAnnotatePDF(
    fileBuffer,
    fileName,
    sessionId,
    messageId,
    {
      extractImages: true,
      extractText: true,
      detectCaptions: true,
      analyzeHierarchy: true,
      useOCR: true  // ← Enable OCR for scanned pages
    }
  );
  
  console.log('📊 Parse Results:');
  console.log('  Text Sections:', result.report.totalTextSections);
  console.log('  Images:', result.report.totalImages);
  console.log('  OCR Pages:', result.metadata?.ocrPagesCount || 0);
}
```

## Performance Considerations

### Tesseract.js Performance

- **Single page**: ~2-5 seconds
- **10 pages**: ~20-50 seconds
- **Memory**: ~100-200MB per page

### Optimization Strategies

1. **Process in background**:
```typescript
async processInBackground(pages: number[]): Promise<void> {
  for (const pageNum of pages) {
    await this.processPage(pageNum);
    // Allow UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

2. **Show progress**:
```typescript
for (let i = 0; i < pageCount; i++) {
  onProgress?.({ current: i + 1, total: pageCount });
  await processPage(i);
}
```

3. **Cache results**:
```typescript
const cacheKey = `ocr_${documentId}_${pageNumber}`;
const cached = await storage.get(cacheKey);
if (cached) return cached;

const text = await ocrService.extractText(image);
await storage.set(cacheKey, text);
```

## Recommendations

For **Abida_CV.pdf** and similar scanned documents:

1. ✅ **Short-term**: Show user message that OCR is needed
2. ✅ **Medium-term**: Implement Tesseract.js for offline OCR
3. ✅ **Long-term**: Add cloud OCR for better accuracy

Example user message:
```typescript
if (isScannedPDF) {
  addMessage({
    text: '📸 This appears to be a scanned document. OCR (text recognition) is required to extract text. This feature is coming soon!',
    sender: 'bot'
  });
}
```

## Testing

Test with different PDF types:

1. **Text PDF**: Word/Google Docs export
2. **Scanned PDF**: Phone camera scan
3. **Hybrid PDF**: Adobe Scan output
4. **Mixed PDF**: Some pages scanned, some text

## Summary

| PDF Type | MuPDF.js | OCR Needed | Solution |
|----------|----------|------------|----------|
| Text-based | ✅ Works | ❌ No | Native extraction |
| Scanned (no OCR) | ⚠️ Detects as image | ✅ Yes | Add Tesseract.js |
| Hybrid (with OCR) | ✅ Works | ❌ No | Native extraction |

**Your case**: Scanned PDF → Add OCR support

---

Would you like me to implement Tesseract.js OCR integration for scanned PDFs?
