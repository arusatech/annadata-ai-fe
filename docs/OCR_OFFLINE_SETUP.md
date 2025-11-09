# Tesseract.js Offline OCR Setup Guide

## 🎉 OCR Now Works Offline!

Tesseract.js is now configured to work **completely offline** by bundling worker files and language packs locally.

---

## 📦 What's Bundled

### Worker Files (in `public/tesseract/`)
- `worker.min.js` - Tesseract worker script (~111 KB)
- `tesseract-core-lstm.wasm.js` - Core WASM (~3.9 MB)
- `tesseract-core-simd-lstm.wasm.js` - SIMD optimized (~3.9 MB)
- `tesseract-core.wasm.js` - Alternative core (~4.8 MB)

### Language Packs (in `public/tessdata/`)
- `eng.traineddata.gz` - English (~10.9 MB)
- `hin.traineddata.gz` - Hindi (~1.4 MB)

**Total Size**: ~25 MB (English + Hindi)

---

## ✅ Current Configuration

### EnhancedPDFParser.ts
```typescript
workerPath: '/tesseract/worker.min.js',  // Local path
langPath: '/tessdata',                    // Local path
corePath: '/tesseract/tesseract-core-lstm.wasm.js',  // Local path
cacheMethod: 'none',  // No caching needed
gzip: true            // Language files are gzipped
```

### ChatFooter.tsx
```typescript
enabled: true,  // ✅ OCR enabled for offline use
fallbackLanguages: ['english', 'hindi']  // Only bundled languages
```

---

## 📥 Adding More Languages

### Method 1: Use the Download Script

```powershell
# Download specific languages
.\scripts\download-tessdata.ps1 -Languages "tam", "ben", "guj"

# Download multiple languages
.\scripts\download-tessdata.ps1 -Languages "eng", "hin", "tam", "ben", "tel", "kan", "mal", "mar"
```

### Method 2: Manual Download

1. Visit: https://tessdata.projectnaptha.com/4.0.0/
2. Download `{language}.traineddata.gz`
3. Save to `public/tessdata/`

### Available Language Codes

| Language | Code | Size (MB) |
|----------|------|-----------|
| English | `eng` | 10.9 |
| Hindi | `hin` | 1.4 |
| Tamil | `tam` | 3.9 |
| Telugu | `tel` | 4.2 |
| Bengali | `ben` | 5.8 |
| Gujarati | `guj` | 1.5 |
| Kannada | `kan` | 3.8 |
| Malayalam | `mal` | 3.9 |
| Marathi | `mar` | 4.5 |
| Punjabi | `pan` | 1.4 |
| Urdu | `urd` | 1.0 |
| Arabic | `ara` | 1.7 |
| Chinese Simplified | `chi_sim` | 13.2 |
| Japanese | `jpn` | 7.6 |
| Korean | `kor` | 3.8 |
| Spanish | `spa` | 9.9 |
| French | `fra` | 10.4 |
| German | `deu` | 9.7 |
| Russian | `rus` | 4.5 |

---

## 🔧 Configuration Options

### Enable/Disable OCR

**File**: `src/components/ChatFooter.tsx` (line ~918)

```typescript
const ocrConfig: OCRConfig = {
  enabled: true,  // Set to false to disable OCR
  primaryLanguage: 'english',
  fallbackLanguages: ['english', 'hindi'],  // Only use downloaded languages!
  minImageSize: 100,
};
```

### Change Languages

**Important**: Only use languages you've downloaded!

```typescript
// ✅ Good - Using downloaded languages
fallbackLanguages: ['english', 'hindi']

// ❌ Bad - Using un-downloaded language (will fail)
fallbackLanguages: ['english', 'tamil']  // tamil not downloaded!
```

### Download Tamil first:
```powershell
.\scripts\download-tessdata.ps1 -Languages "tam"
```

Then update config:
```typescript
fallbackLanguages: ['english', 'hindi', 'tamil']
```

---

## 🚀 Performance

### OCR Processing Times (per image)
- Small images (<500px): ~1-2 seconds
- Medium images (500-1000px): ~2-5 seconds
- Large images (>1000px): ~5-10 seconds

### Disk Space Usage
- Worker files: ~13 MB (one-time)
- Per language: 1-13 MB
- Total for 5 languages: ~30-50 MB

---

## 🧪 Testing Offline OCR

### Step 1: Disconnect from Internet
Turn off WiFi/Mobile Data

### Step 2: Upload a PDF
Upload a PDF with images containing text

### Step 3: Check Console
You should see:
```
🔍 [EnhancedPDFParser] Initializing Tesseract OCR...
🔍 [EnhancedPDFParser] Loading OCR languages: eng+hin
✅ [EnhancedPDFParser] OCR initialized successfully
📷 [EnhancedPDFParser] Found 3 images on page 1
🔍 [EnhancedPDFParser] Running OCR on image 1...
🔍 [OCR Progress] 50%
🔍 [OCR Progress] 100%
✅ [EnhancedPDFParser] OCR extracted 250 characters (confidence: 85.2%)
```

---

## 📱 Mobile Device Considerations

### Storage Impact
- App size increases by ~25 MB (English + Hindi)
- Consider user's device storage
- Option: Download languages on-demand

### Performance
- Mobile devices are slower than desktop
- Expect 2-3x longer processing times
- Consider showing progress indicators

### Battery
- OCR is CPU intensive
- Show battery warning for large documents
- Process in chunks

---

## 🔍 Troubleshooting

### Issue: "Failed to load worker.min.js"

**Solution**: Check file exists
```powershell
Get-Item public\tesseract\worker.min.js
```

If missing, copy it:
```powershell
Copy-Item "node_modules\tesseract.js\dist\worker.min.js" "public\tesseract\"
```

### Issue: "Language 'xyz' not found"

**Solution**: Download the language pack
```powershell
.\scripts\download-tessdata.ps1 -Languages "xyz"
```

### Issue: "OCR very slow"

**Solutions**:
1. Reduce image size:
   ```typescript
   minImageSize: 200  // Skip smaller images
   ```

2. Use fewer languages:
   ```typescript
   fallbackLanguages: ['english']  // Just one language
   ```

3. Process fewer images:
   ```typescript
   // Only process first 5 images
   ```

### Issue: "Low OCR confidence"

**Solutions**:
1. Use correct language
2. Ensure good image quality
3. Pre-process images (contrast, brightness)

---

## 🎯 Build Configuration

The files in `public/` are automatically served by Vite.

### During Development
Files accessible at:
- `http://localhost:5173/tesseract/worker.min.js`
- `http://localhost:5173/tessdata/eng.traineddata.gz`

### In Production
Files accessible at:
- `https://yourdomain.com/tesseract/worker.min.js`
- `https://yourdomain.com/tessdata/eng.traineddata.gz`

---

## 📊 Comparison: Online vs Offline

| Feature | Online Mode | Offline Mode (Current) |
|---------|-------------|------------------------|
| Internet Required | ✅ Yes | ❌ No |
| First Load Time | 🐢 Slow (download) | ⚡ Fast (local) |
| Subsequent Loads | ⚡ Fast (cached) | ⚡ Fast (local) |
| Storage Used | 📦 Browser cache | 📦 App bundle |
| Works Offline | ❌ No | ✅ **Yes** |
| Language Selection | 🌍 All 100+ | 📦 Bundled only |
| App Size | 🎈 Small | 📦 +25 MB |

---

## 🔄 Updating Tesseract.js

To update to the latest version:

```bash
# Update package
npm install tesseract.js@latest

# Re-copy worker files
Copy-Item "node_modules\tesseract.js\dist\worker.min.js" "public\tesseract\" -Force
Copy-Item "node_modules\tesseract.js-core\*.wasm*" "public\tesseract\" -Force

# Rebuild
npm run build
```

---

## 📚 Resources

- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [Language Data Repository](https://github.com/naptha/tessdata)
- [Language Code List](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files-in-different-versions.md)

---

## ✅ Summary

**Your OCR now works completely offline!**

- ✅ Worker files bundled locally
- ✅ English + Hindi languages included
- ✅ No internet required
- ✅ Works on mobile devices
- ✅ ~25 MB total size
- ✅ Easy to add more languages

**To add more languages**:
```powershell
.\scripts\download-tessdata.ps1 -Languages "tam", "ben", "guj"
```

**To enable/disable OCR**:
Edit `src/components/ChatFooter.tsx` line 918:
```typescript
enabled: true  // or false
```

---

**Last Updated**: October 9, 2025  
**Tesseract.js Version**: 6.0.1  
**Bundled Languages**: English, Hindi  
**Total Size**: ~25 MB
