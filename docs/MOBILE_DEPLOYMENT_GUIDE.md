# Mobile Deployment Guide - Complete Step-by-Step

## 🎯 Understanding Your Two Environments

### 1. **Development Environment** (PC Browser)
```
┌─────────────────────────────────────┐
│  YOUR PC                             │
│                                      │
│  Terminal: npm run dev               │
│            ↓                          │
│  Vite Server: http://localhost:5173 │
│            ↓                          │
│  Browser: Open localhost:5173        │
│            ↓                          │
│  Files served from: public/          │
│  ├── tesseract/ ✓                   │
│  └── tessdata/ ✓                    │
└─────────────────────────────────────┘

✅ Use this for testing OCR quickly!
```

### 2. **Production Environment** (Mobile App)
```
┌─────────────────────────────────────┐
│  YOUR PHONE                          │
│                                      │
│  Open: AnnaData.apk                 │
│         ↓                            │
│  Capacitor WebView                  │
│  URL: https://localhost (or         │
│       capacitor://localhost)        │
│         ↓                            │
│  Files served from: APK bundle      │
│  android/app/src/main/assets/public/│
│  ├── tesseract/ (need to copy!)    │
│  └── tessdata/ (need to copy!)     │
└─────────────────────────────────────┘

⚠️ Requires build process!
```

---

## 🚀 Quick Test Right Now (Browser)

**Do this first to verify OCR works:**

```bash
# 1. Make sure dev server is running
npm run dev

# 2. Open PC browser (NOT mobile!)
# Go to: http://localhost:5173

# 3. Upload your PDF
# Click attach → Select Abida_CV.pdf

# 4. Check console - should see:
🔍 [EnhancedPDFParser] Current URL: http://localhost:5173/
🔍 [EnhancedPDFParser] Origin: http://localhost:5173
🔍 [EnhancedPDFParser] Worker path: http://localhost:5173/tesseract/worker.min.js
✅ [EnhancedPDFParser] OCR initialized successfully
🔍 [EnhancedPDFParser] Running OCR on image 1...
✅ [EnhancedPDFParser] OCR extracted text!
```

**If this works in PC browser → OCR code is correct → Ready for mobile!**

---

## 📱 Mobile Deployment (Complete Process)

### Prerequisites

```bash
# Check these are installed:
node --version        # Should be v16+
npm --version         # Should be v8+
java -version         # Should be Java 11 or 17
npx cap doctor        # Check Capacitor setup
```

---

## 🔨 Step-by-Step Mobile Build

### STEP 1: Build Web App

```bash
# Clean old builds
Remove-Item -Recurse -Force dist

# Build production version
npm run build
```

**What this does:**
```
Creates dist/ folder:
├── index.html
├── assets/
│   ├── index-xxx.js (your compiled code)
│   └── *.css, *.wasm, etc.
├── tesseract/          ← COPIED from public/
│   ├── worker.min.js
│   └── *.wasm.js
└── tessdata/           ← COPIED from public/
    ├── eng.traineddata.gz
    └── hin.traineddata.gz
```

**Verify build:**
```powershell
# Check files exist
Test-Path dist\tesseract\worker.min.js
Test-Path dist\tessdata\eng.traineddata.gz
Test-Path dist\tessdata\hin.traineddata.gz

# Should all return: True
```

---

### STEP 2: Sync to Capacitor

```bash
npx cap sync android
```

**What this does:**
```
Copies dist/ to Android project:

dist/                        →  android/app/src/main/assets/public/
├── index.html              →  ├── index.html
├── assets/                 →  ├── assets/
├── tesseract/              →  ├── tesseract/
│   ├── worker.min.js       →  │   ├── worker.min.js
│   └── *.wasm.js           →  │   └── *.wasm.js
└── tessdata/               →  └── tessdata/
    ├── eng.traineddata.gz  →      ├── eng.traineddata.gz
    └── hin.traineddata.gz  →      └── hin.traineddata.gz

All files bundled in Android project!
```

**Verify sync:**
```powershell
# Check Android assets
Test-Path android\app\src\main\assets\public\tesseract\worker.min.js
Test-Path android\app\src\main\assets\public\tessdata\eng.traineddata.gz

# Should return: True
```

---

### STEP 3: Build Android APK

#### Option A: Using Gradle (Command Line)

```bash
cd android
.\gradlew assembleDebug
cd ..
```

**Output:**
```
APK location: android\app\build\outputs\apk\debug\app-debug.apk
Size: ~100-120 MB (includes all OCR files)
```

#### Option B: Using Android Studio (GUI)

```bash
# Open project in Android Studio
npx cap open android
```

**In Android Studio:**
1. Wait for Gradle sync to complete
2. Click: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build (2-5 minutes)
4. Click: **locate** in notification
5. APK is in: `app/build/outputs/apk/debug/app-debug.apk`

---

### STEP 4: Install on Phone

#### Method A: USB Cable + ADB

```bash
# Connect phone via USB
# Enable USB debugging on phone

# Check device connected
adb devices

# Install APK
adb install android\app\build\outputs\apk\debug\app-debug.apk

# Launch app
adb shell am start -n io.ionic.starter/.MainActivity
```

#### Method B: Direct Install

```bash
# 1. Copy APK to phone
# Send via: Email, Drive, USB, Bluetooth

# 2. On phone:
# - Open file manager
# - Tap app-debug.apk
# - Allow "Install from unknown sources"
# - Click Install

# 3. Open app
# - Find "AnnaData" in app drawer
# - Tap to open
```

#### Method C: Android Studio Direct

```
In Android Studio:
1. Connect phone via USB
2. Enable USB debugging on phone
3. Select your device in device dropdown
4. Click green "Run" button (▶️)
5. App installs and launches automatically
```

---

## 🧪 Testing OCR on Mobile

### After Installation

```
1. Open app on phone
2. Click attach button
3. Select PDF with images
4. Check logs (if using Chrome DevTools)

Expected console output:
🔍 [EnhancedPDFParser] Current URL: https://localhost/
🔍 [EnhancedPDFParser] Origin: https://localhost
🔍 [EnhancedPDFParser] Worker path: https://localhost/tesseract/worker.min.js
🔍 [EnhancedPDFParser] Lang path: https://localhost/tessdata
✅ [EnhancedPDFParser] OCR initialized successfully
📷 [EnhancedPDFParser] Found 3 images
🔍 [EnhancedPDFParser] Running OCR on image 1...
✅ [EnhancedPDFParser] OCR extracted 250 characters
```

---

## 🔍 Debugging Mobile App

### Option 1: Chrome DevTools (Android)

```bash
# 1. Connect phone via USB
# 2. Enable USB debugging
# 3. Open Chrome on PC
# 4. Go to: chrome://inspect#devices
# 5. Find your device
# 6. Click "inspect"
# 7. See console logs from phone!
```

### Option 2: Logcat (Android Studio)

```bash
# View logs in terminal
adb logcat -s Capacitor Console chromium

# Or in Android Studio:
# Bottom toolbar → Logcat → Filter: "Capacitor"
```

### Option 3: Add Visual Alerts

```typescript
// In ChatFooter.tsx, add visible feedback
if (image.ocrText) {
  alert(`OCR Success! Extracted: ${image.ocrText.substring(0, 50)}...`);
}
```

---

## 📦 What Gets Bundled in APK

```
YOUR APK FILE (~100-120 MB)
├── Native Android code (~5 MB)
├── Capacitor runtime (~3 MB)
├── WebView assets (~90 MB)
│   ├── Your app code (~1 MB)
│   ├── React/Ionic (~2 MB)
│   ├── MuPDF (~10 MB)
│   ├── Fonts (~15 MB)
│   ├── SQLite (~1 MB)
│   ├── Tesseract worker/core (~13 MB)
│   └── OCR languages (~12 MB)
│       ├── English: 11 MB
│       └── Hindi: 1.4 MB
└── Other resources (~2 MB)
```

**User downloads once, works forever offline!**

---

## 🎯 Complete Workflow Diagram

```
DEVELOPMENT → PRODUCTION → DEPLOYMENT

┌──────────────────────┐
│ 1. DEVELOP           │
│  npm run dev         │
│  Test on PC browser  │
│  localhost:5173      │
└──────────────────────┘
         ↓
┌──────────────────────┐
│ 2. BUILD WEB APP     │
│  npm run build       │
│  Creates dist/       │
└──────────────────────┘
         ↓
┌──────────────────────┐
│ 3. SYNC TO ANDROID   │
│  npx cap sync        │
│  Copies to android/  │
└──────────────────────┘
         ↓
┌──────────────────────┐
│ 4. BUILD APK         │
│  .\gradlew assemble  │
│  Creates APK file    │
└──────────────────────┘
         ↓
┌──────────────────────┐
│ 5. INSTALL ON PHONE  │
│  adb install app.apk │
│  Or manual install   │
└──────────────────────┘
         ↓
┌──────────────────────┐
│ 6. USER USES APP     │
│  Open app            │
│  Upload PDF          │
│  OCR extracts text   │
│  WORKS OFFLINE! ✓    │
└──────────────────────┘
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: 404 on Mobile (Your Current Issue)

**Problem:**
```
URL: https://localhost/
Error: 404 on /tessdata/eng.traineddata.gz
```

**Cause:** Files not in Android assets

**Solution:**
```bash
# Rebuild everything
npm run build

# Check files exist in dist
ls dist/tessdata

# Sync to Android
npx cap sync android

# Verify files copied
ls android/app/src/main/assets/public/tessdata

# If files missing, manually copy:
Copy-Item -Recurse dist\tessdata android\app\src\main\assets\public\
Copy-Item -Recurse dist\tesseract android\app\src\main\assets\public\

# Rebuild APK
cd android
.\gradlew assembleDebug
cd ..

# Reinstall on phone
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### Issue 2: Testing on Browser Shows https://localhost

**Problem:** Opening wrong URL in browser

**Solution:**
```bash
# Make sure dev server is running
npm run dev

# Should show:
➜  Local:   http://localhost:5173/  ← Use this!

# Open browser to:
http://localhost:5173  (NOT https!)
```

### Issue 3: Files Not Copied to Android

**Verify:**
```powershell
# Check source files exist
Get-ChildItem public\tessdata
Get-ChildItem public\tesseract

# Check built files exist
Get-ChildItem dist\tessdata
Get-ChildItem dist\tesseract

# Check Android files exist
Get-ChildItem android\app\src\main\assets\public\tessdata
Get-ChildItem android\app\src\main\assets\public\tesseract
```

**If missing at any step, re-run that step!**

---

## 📱 Complete Mobile Build Process

```bash
# ════════════════════════════════════════
# COMPLETE BUILD SCRIPT
# ════════════════════════════════════════

# 1. Clean old builds
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# 2. Verify OCR files exist
Get-ChildItem public\tessdata
Get-ChildItem public\tesseract
# Should show: eng.traineddata.gz, hin.traineddata.gz, worker.min.js, etc.

# 3. Build web app
npm run build

# 4. Verify OCR files in dist
Get-ChildItem dist\tessdata
Get-ChildItem dist\tesseract
# Should show same files

# 5. Sync to Capacitor
npx cap sync android

# 6. Verify OCR files in Android
Get-ChildItem android\app\src\main\assets\public\tessdata
Get-ChildItem android\app\src\main\assets\public\tesseract
# Should show same files

# 7. Build APK
cd android
.\gradlew clean assembleDebug
cd ..

# 8. Install on phone
adb install -r android\app\build\outputs\apk\debug\app-debug.apk

# 9. Test!
# Open app on phone
# Upload PDF
# Watch for OCR processing
```

---

## 🔧 Your Current Situation

**Based on your console logs:**

```
Current URL: https://localhost/          ← Capacitor/Android app
Origin: https://localhost                 ← Not Vite dev server
Worker path: https://localhost/tesseract/worker.min.js
Error: 404                                ← Files not in Android assets!
```

**What this means:**
1. You're running the **Android app** (not browser dev server)
2. The app is looking for files in Android assets
3. Files are **NOT** in Android assets yet
4. You need to run `npx cap sync android` to copy them

---

## ✅ Immediate Action Plan

### For Quick Testing (5 minutes)

```bash
# 1. Open PC browser (NOT mobile browser!)
# 2. Go to: http://localhost:5173
# 3. Upload PDF
# 4. OCR should work!
```

### For Mobile App (30 minutes)

```bash
# Complete rebuild process:

# 1. Build web app
npm run build

# 2. Check files exist
Get-ChildItem dist\tessdata
# Should show: eng.traineddata.gz, hin.traineddata.gz

# 3. Sync to Android
npx cap sync android

# 4. Check files copied
Get-ChildItem android\app\src\main\assets\public\tessdata
# Should show: eng.traineddata.gz, hin.traineddata.gz

# 5. If files NOT there, manually copy:
Copy-Item -Recurse -Force dist\tessdata android\app\src\main\assets\public\
Copy-Item -Recurse -Force dist\tesseract android\app\src\main\assets\public\

# 6. Build APK
cd android
.\gradlew assembleDebug
cd ..

# 7. Install on phone
adb install -r android\app\build\outputs\apk\debug\app-debug.apk

# 8. Open app and test!
```

---

## 🎓 Understanding Capacitor URLs

### The Confusing Part

```
CAPACITOR URLS:
├─ https://localhost
├─ http://localhost
├─ capacitor://localhost
└─ ionic://localhost

ALL MEAN THE SAME THING!
└─> "Load from app bundle"

NOT related to:
├─ http://localhost:5173 (Vite dev server)
└─ Your PC's localhost
```

### How It Works

```
WHEN USER OPENS APK:

Capacitor creates WebView
    ↓
Sets URL: https://localhost/
    ↓
This tells Android:
"Serve files from: assets/public/"
    ↓
Files are served as if from web server
    ↓
JavaScript runs exactly like in browser
    ↓
OCR loads files from same "server"
    ↓
Everything works! ✓
```

---

## 📊 Deployment Checklist

### Before Building

- [ ] OCR files in `public/tesseract/`
- [ ] Language packs in `public/tessdata/`
- [ ] OCR enabled in `ChatFooter.tsx`
- [ ] Code tested in browser (`http://localhost:5173`)

### After Building

- [ ] `dist/tesseract/` exists
- [ ] `dist/tessdata/` exists
- [ ] Run `npm run build` successfully

### After Syncing

- [ ] `android/app/src/main/assets/public/tesseract/` exists
- [ ] `android/app/src/main/assets/public/tessdata/` exists
- [ ] Run `npx cap sync android` successfully

### After Installing

- [ ] APK installs without errors
- [ ] App opens successfully
- [ ] Upload PDF works
- [ ] OCR extracts text
- [ ] Works without internet

---

## 🔍 Debugging Commands

```bash
# Check Vite dev server
npm run dev
# Open: http://localhost:5173

# Check dist folder
Get-ChildItem dist -Recurse -Name | Select-String "tessdata|tesseract"

# Check Android assets
Get-ChildItem android\app\src\main\assets\public -Recurse -Name | Select-String "tessdata|tesseract"

# Check APK contents (after building)
cd android\app\build\outputs\apk\debug
jar tf app-debug.apk | Select-String "tessdata|tesseract"
cd ..\..\..\..\..\..

# View mobile logs
adb logcat | Select-String "EnhancedPDFParser|OCR"
```

---

## 🎯 Quick Reference

### Test in Browser
```bash
npm run dev
# Open: http://localhost:5173
```

### Build for Mobile
```bash
npm run build
npx cap sync android
cd android && .\gradlew assembleDebug && cd ..
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### Add More Languages
```bash
.\scripts\download-tessdata.ps1 -Languages "tam", "ben"
npm run build
npx cap sync android
# Rebuild APK
```

---

## 📚 File Locations Reference

| Environment | URL Pattern | Files Served From |
|-------------|-------------|-------------------|
| **Vite Dev** | `http://localhost:5173` | `public/` |
| **Vite Build** | `http://localhost:4173` | `dist/` |
| **Android App** | `https://localhost` | `android/.../assets/public/` |
| **iOS App** | `capacitor://localhost` | `ios/.../public/` |

---

## ✅ Summary

**To answer your original question:**

> "Do I need to run localhost on mobile?"

**NO!** 

- **For testing in browser**: YES, run `npm run dev` on PC
- **For mobile APK**: NO, Capacitor provides the "server" (WebView)

**The mobile app:**
- Has all files bundled inside APK
- Capacitor WebView serves them using `https://localhost` protocol
- Works completely offline
- No external server needed
- No internet needed

**Just build → sync → install → done!** 🚀

---

**Next step: Test in PC browser first (`http://localhost:5173`), then deploy to mobile!**
