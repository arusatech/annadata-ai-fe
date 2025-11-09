# OCR Server Setup - Running the App

## ❗ Important: Server Required

The OCR files **cannot be loaded directly from the file system**. You need a web server running to serve the files.

---

## 🚀 Option 1: Development Server (Recommended for Testing)

### Start the Dev Server
```bash
npm run dev
```

This will:
- ✅ Start Vite dev server on `http://localhost:5173`
- ✅ Serve all files from `public/` directory
- ✅ Enable Hot Module Replacement (HMR)
- ✅ OCR files accessible at:
  - `http://localhost:5173/tesseract/worker.min.js`
  - `http://localhost:5173/tessdata/eng.traineddata.gz`

### Access Your App
Open browser to: **`http://localhost:5173`**

### Expected Console Output
```
VITE v5.2.14  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 🌐 Option 2: Preview Production Build

### Build and Preview
```bash
npm run build
npm run preview
```

This will:
- ✅ Build production version to `dist/`
- ✅ Start preview server on `http://localhost:4173`
- ✅ Serve production build with all optimizations
- ✅ OCR files accessible at:
  - `http://localhost:4173/tesseract/worker.min.js`
  - `http://localhost:4173/tessdata/eng.traineddata.gz`

### Access Your App
Open browser to: **`http://localhost:4173`**

---

## 📱 Option 3: Mobile Device Access

### Expose to Network
```bash
npm run dev -- --host
```

This will show:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

### Access from Mobile
1. Connect phone to **same WiFi network**
2. Open browser on phone
3. Navigate to: `http://192.168.1.100:5173`
4. OCR will work with local files!

---

## ❌ What DOESN'T Work

### Opening File Directly
```
file:///C:/annadata/prod/annadata-ai-fe/dist/index.html
```

**Why it fails:**
- ❌ No web server running
- ❌ CORS blocks file:// protocol
- ❌ Cannot load worker scripts
- ❌ Cannot load language packs

**Error:**
```
Error: Network error while fetching https://localhost/tessdata/eng.traineddata.gz
Response code: 404
```

---

## 🔧 Troubleshooting

### Issue: Port Already in Use

**Error:**
```
Port 5173 is already in use
```

**Solution:**
```bash
# Kill the process using port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Or use different port:
npm run dev -- --port 3000
```

### Issue: Cannot Access from Mobile

**Error:** Connection refused

**Solutions:**
1. Check firewall allows connections on port 5173
2. Ensure both devices on same WiFi network
3. Use `--host` flag: `npm run dev -- --host`

### Issue: Files Not Loading

**Check:**
```bash
# Verify files exist
ls public/tessdata
ls public/tesseract

# Should see:
# tessdata/eng.traineddata.gz
# tessdata/hin.traineddata.gz
# tesseract/worker.min.js
# tesseract/*.wasm*
```

---

## ✅ Correct Workflow

### For Development (Desktop)
```bash
# 1. Start dev server
npm run dev

# 2. Open browser
http://localhost:5173

# 3. Upload PDF and test OCR
```

### For Development (Mobile)
```bash
# 1. Start dev server with network access
npm run dev -- --host

# 2. Note the Network URL
# Example: http://192.168.1.100:5173

# 3. Open on phone
# Navigate to that URL on your mobile browser

# 4. Test OCR offline
# Turn off mobile data/WiFi after page loads
# OCR still works because files are cached!
```

### For Production
```bash
# 1. Build production version
npm run build

# 2. Preview locally
npm run preview

# 3. Or deploy to server
# Copy dist/ folder to your web server
```

---

## 🌍 Production Deployment

### Deploy to Web Server
```bash
# Build
npm run build

# Upload dist/ to server
# Ensure server serves:
# - /tesseract/* files
# - /tessdata/* files
# - All other assets
```

### Verify Deployment
Open browser console and check:
```javascript
// Should load successfully
fetch('https://yourdomain.com/tessdata/eng.traineddata.gz')
  .then(r => console.log('Status:', r.status)) // Should be 200

fetch('https://yourdomain.com/tesseract/worker.min.js')
  .then(r => console.log('Status:', r.status)) // Should be 200
```

---

## 📊 Server Status Check

### Is Server Running?

**Check Terminal:**
```
✅ Server Running:
VITE v5.2.14  ready in 234 ms
➜  Local:   http://localhost:5173/

❌ Server NOT Running:
(Empty terminal or error message)
```

**Check Browser:**
```
✅ Server Running:
URL: http://localhost:5173
Page loads correctly

❌ Server NOT Running:
URL: file:///C:/path/to/index.html
OCR fails with 404 errors
```

---

## 🎯 Summary

| Method | Command | URL | OCR Works? |
|--------|---------|-----|------------|
| **Dev Server** | `npm run dev` | `http://localhost:5173` | ✅ Yes |
| **Preview** | `npm run preview` | `http://localhost:4173` | ✅ Yes |
| **Mobile** | `npm run dev -- --host` | `http://192.168.x.x:5173` | ✅ Yes |
| **File Direct** | Open index.html | `file:///...` | ❌ No |

---

## ✅ Quick Start (Right Now)

```bash
# Start the dev server
npm run dev

# Open browser to:
http://localhost:5173

# Upload your Abida_CV.pdf
# Watch console for:
🔍 [EnhancedPDFParser] Initializing Tesseract OCR...
✅ [EnhancedPDFParser] OCR initialized successfully
🔍 [EnhancedPDFParser] Running OCR on image 1...
✅ [EnhancedPDFParser] OCR extracted 250 characters
```

---

**The dev server is now running! Open `http://localhost:5173` in your browser and test OCR! 🚀**
