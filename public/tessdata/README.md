# Tesseract OCR Language Data

This directory contains language training data files for offline OCR.

## 📦 Currently Included

- `eng.traineddata.gz` - English (10.9 MB)
- `hin.traineddata.gz` - Hindi (1.4 MB)

## ➕ Adding More Languages

Use the download script:

```powershell
# From project root
.\scripts\download-tessdata.ps1 -Languages "tam", "ben", "guj"
```

Or download manually from:
https://tessdata.projectnaptha.com/4.0.0/

## 🌍 Available Languages

See full list at: `docs/OCR_OFFLINE_SETUP.md`

## ⚠️ Important

- Files must be `.traineddata.gz` format
- Update `ChatFooter.tsx` to use only downloaded languages
- Each language adds 1-13 MB to app size

## 🔄 Updating

To update language data:
1. Delete old `.traineddata.gz` files
2. Run download script with desired languages
3. Rebuild app: `npm run build`
