# Tesseract.js OCR Integration Guide

## Overview

This guide documents the integration of **Tesseract.js** - a JavaScript OCR library - into the AnnaData AI Frontend for multilingual text extraction from images and PDFs.

## 🎯 Features

- ✅ **30+ Languages** - Full support for Indian languages (Hindi, Tamil, Telugu, Bengali, Gujarati, etc.) and international languages
- ✅ **Automatic Language Detection** - Detects the language in images automatically
- ✅ **Confidence Scoring** - Provides OCR confidence metrics for quality assessment
- ✅ **PDF Integration** - Seamlessly integrated with MuPDF for PDF image extraction
- ✅ **Standalone Image OCR** - Process individual image files
- ✅ **Progress Tracking** - Real-time progress callbacks during OCR processing
- ✅ **Lazy Loading** - Language packs loaded on-demand from CDN
- ✅ **Auto Cleanup** - Worker automatically terminates after processing

## 📦 Installation

The Tesseract.js library has been installed:

```bash
npm install tesseract.js
```

## 🏗️ Architecture

### Components Modified

#### 1. `EnhancedPDFParser.ts`
**Location:** `src/services/EnhancedPDFParser.ts`

**New Interfaces:**
```typescript
export interface OCRConfig {
  enabled: boolean;
  primaryLanguage?: string;
  fallbackLanguages?: string[];
  minImageSize?: number;
  maxImageSize?: number;
  progressCallback?: (current: number, total: number, imageIndex: number) => void;
}
```

**New Fields in `ParsedImage`:**
- `ocrText?: string` - Extracted text from image
- `ocrConfidence?: number` - OCR confidence score (0-100)
- `ocrLanguage?: string` - Detected primary language
- `ocrDetectedLanguages?: Array<{lang: string; confidence: number}>` - All detected languages

**New Methods:**
- `initializeOCR()` - Initialize Tesseract worker
- `getLanguageCodes()` - Convert language names to Tesseract codes
- `performOCR()` - Perform OCR on image element
- `detectLanguage()` - Detect language in image
- `imageToCanvas()` - Convert MuPDF image to HTML canvas
- `terminateOCR()` - Cleanup OCR worker

#### 2. `ChatFooter.tsx`
**Location:** `src/components/ChatFooter.tsx`

**Changes:**
- Added `EnhancedPDFParser` import and instance
- Added image OCR detection in `processFileForRedaction()`
- OCR configuration and progress tracking

## 🔤 Supported Languages

### Indian Languages
- Hindi (`hin`)
- Tamil (`tam`)
- Telugu (`tel`)
- Bengali (`ben`)
- Gujarati (`guj`)
- Kannada (`kan`)
- Malayalam (`mal`)
- Marathi (`mar`)
- Punjabi (`pan`)
- Urdu (`urd`)
- Nepali (`nep`)
- Assamese (`asm`)
- Oriya (`ori`)
- Sinhala (`sin`)

### International Languages
- English (`eng`)
- Arabic (`ara`)
- Chinese Simplified + Traditional (`chi_sim+chi_tra`)
- Japanese (`jpn`)
- Korean (`kor`)
- Spanish (`spa`)
- French (`fra`)
- German (`deu`)
- Russian (`rus`)
- Portuguese (`por`)
- Italian (`ita`)
- And 15+ more...

## 📝 Usage Examples

### Example 1: Parse PDF with OCR (Hindi + English)

```typescript
import EnhancedPDFParser from './services/EnhancedPDFParser';

async function parsePDFWithOCR(fileBuffer: ArrayBuffer, documentId: string) {
  const parser = EnhancedPDFParser.getInstance();
  
  const result = await parser.parsePDF(fileBuffer, documentId, {
    extractImages: true,
    extractText: true,
    detectCaptions: true,
    ocr: {
      enabled: true,
      primaryLanguage: 'hindi',
      fallbackLanguages: ['english', 'hindi', 'tamil'],
      minImageSize: 100, // Skip images < 100px
      progressCallback: (current, total, imageIndex) => {
        console.log(`Processing page ${current}/${total}, image ${imageIndex}`);
      }
    }
  });
  
  // Access OCR results
  console.log('OCR Metadata:', result.metadata.ocrEnabled);
  console.log('Languages:', result.metadata.ocrLanguages);
  console.log('OCR Images:', result.metadata.totalOcrImages);
  console.log('Processing Time:', result.metadata.ocrProcessingTime, 'ms');
  
  // Access individual image OCR results
  result.images.forEach(image => {
    if (image.ocrText) {
      console.log(`Image ${image.index}:`);
      console.log(`  Text: ${image.ocrText}`);
      console.log(`  Confidence: ${image.ocrConfidence}%`);
      console.log(`  Languages:`, image.ocrDetectedLanguages);
    }
  });
  
  return result;
}
```

### Example 2: Multilingual Document (Auto-detect)

```typescript
const result = await parser.parsePDF(fileBuffer, documentId, {
  extractImages: true,
  ocr: {
    enabled: true,
    primaryLanguage: 'auto', // Auto-detect
    fallbackLanguages: ['english', 'hindi', 'bengali', 'tamil', 'gujarati'],
    minImageSize: 50
  }
});
```

### Example 3: International Document

```typescript
const result = await parser.parsePDF(fileBuffer, documentId, {
  extractImages: true,
  ocr: {
    enabled: true,
    primaryLanguage: 'chinese',
    fallbackLanguages: ['chinese', 'japanese', 'korean', 'english']
  }
});
```

### Example 4: High-Quality Scanned Documents

```typescript
const result = await parser.parsePDF(fileBuffer, documentId, {
  extractImages: true,
  ocr: {
    enabled: true,
    primaryLanguage: 'english',
    fallbackLanguages: ['english'],
    minImageSize: 200, // Process only large images for better accuracy
    progressCallback: (current, total, imageIndex) => {
      // Update UI progress bar
      updateProgressBar((current / total) * 100);
    }
  }
});
```

## 🎨 How It Works

### OCR Processing Flow

```
1. User uploads PDF or image
   ↓
2. EnhancedPDFParser extracts images
   ↓
3. For each image:
   a. Check size (skip if < minImageSize)
   b. Convert MuPDF image → HTML Canvas
   c. Initialize Tesseract worker (if not already)
   d. Perform OCR recognition
   e. Detect languages
   f. Store results in ParsedImage
   ↓
4. Aggregate results in metadata
   ↓
5. Terminate OCR worker
   ↓
6. Return parsed document with OCR data
```

### Language Detection Flow

```
Image → Canvas → Tesseract.detect() → Languages Array
                                        ↓
                                    [{lang: 'hin', confidence: 0.89},
                                     {lang: 'eng', confidence: 0.11}]
```

## ⚡ Performance Considerations

### Processing Speed
- **Average**: 2-5 seconds per image (depends on size)
- **Small images** (<100KB): ~1-2 seconds
- **Large images** (>500KB): ~5-10 seconds
- **Multi-language**: +20% processing time

### Memory Usage
- **Tesseract Worker**: ~50MB RAM
- **Language Pack**: 1-3MB per language (cached)
- **Canvas Processing**: Varies by image size

### Optimization Tips

1. **Set minimum image size** to skip tiny images:
   ```typescript
   minImageSize: 100  // Skip images < 100x100px
   ```

2. **Use specific languages** instead of loading all:
   ```typescript
   fallbackLanguages: ['english', 'hindi']  // Only 2 languages
   ```

3. **Process pages in batches** for large PDFs:
   ```typescript
   // Process 5 pages at a time
   for (let i = 0; i < pageCount; i += 5) {
     await processBatch(pages.slice(i, i + 5));
   }
   ```

4. **Use progress callbacks** for UI updates:
   ```typescript
   progressCallback: (current, total) => {
     showLoadingSpinner(`Processing ${current}/${total}...`);
   }
   ```

## 🐛 Troubleshooting

### Issue: OCR not working

**Solution:**
- Check if `ocr.enabled` is set to `true`
- Verify internet connection (for CDN language download)
- Check browser console for errors

### Issue: Poor OCR accuracy

**Solutions:**
- Increase image resolution before processing
- Use specific language instead of auto-detect
- Check if image has sufficient contrast
- Verify correct language is selected

### Issue: Slow processing

**Solutions:**
- Increase `minImageSize` to skip small images
- Reduce number of fallback languages
- Process images in background thread
- Consider server-side OCR for large batches

### Issue: Language not detected

**Solutions:**
- Add language to `fallbackLanguages` array
- Check if language is in `TESSERACT_LANGUAGES` mapping
- Verify language pack is available on CDN
- Try with higher resolution image

## 📊 OCR Quality Metrics

### Confidence Scores

- **90-100%**: Excellent quality, highly reliable
- **70-90%**: Good quality, minor errors possible
- **50-70%**: Fair quality, review recommended
- **<50%**: Poor quality, manual review required

### Typical Accuracy by Content Type

| Content Type | Expected Confidence |
|--------------|-------------------|
| Printed English | 95-99% |
| Printed Hindi | 85-95% |
| Handwritten | 50-70% |
| Low contrast | 40-60% |
| Complex layouts | 60-80% |

## 🔐 Security Considerations

1. **Privacy**: OCR processes images client-side (no server upload)
2. **Language packs**: Downloaded from CDN (tessdata.projectnaptha.com)
3. **Memory**: Worker terminated after processing to free resources
4. **Data**: No OCR data sent to external services

## 🚀 Future Enhancements

- [ ] Add preprocessing filters (contrast, brightness)
- [ ] Support for handwriting recognition
- [ ] Custom trained models for domain-specific text
- [ ] Batch processing with web workers
- [ ] OCR result caching
- [ ] Spell-check post-processing
- [ ] Table structure recognition
- [ ] Layout analysis improvements

## 📚 References

- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [Tesseract Language Packs](https://github.com/tesseract-ocr/tessdata)
- [MuPDF.js Documentation](https://mupdf.com/docs/mupdf-js.html)

## 🤝 Contributing

When adding new languages:

1. Add to `TESSERACT_LANGUAGES` mapping in `EnhancedPDFParser.ts`
2. Test with sample documents
3. Update this documentation
4. Verify language pack availability on CDN

## 📄 License

This integration uses:
- **Tesseract.js**: Apache 2.0 License
- **Tesseract OCR**: Apache 2.0 License

---

**Last Updated:** October 9, 2025
**Version:** 1.0.0
**Authors:** AnnaData AI Team

