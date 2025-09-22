@echo off
echo ========================================
echo Quick Device Setup for Android
echo ========================================

echo [1/3] Checking ADB and devices...
if "%ANDROID_HOME%"=="" (
    echo ❌ ANDROID_HOME not set. Please run setup-android-sdk.bat first
    pause
    exit /b 1
)

"%ANDROID_HOME%\platform-tools\adb.exe" version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ADB not found. Please check ANDROID_HOME setup
    pause
    exit /b 1
)

echo ✅ ADB found, checking connected devices...
"%ANDROID_HOME%\platform-tools\adb.exe" devices

echo.
echo [2/3] Options to get a device:
echo 1. Connect a physical Android device with USB debugging enabled
echo 2. Start an Android emulator
echo 3. Check if any devices are listed above

echo.
echo [3/3] To start an emulator (if available):
"%ANDROID_HOME%\emulator\emulator.exe" -list-avds 2>nul
if %errorlevel% equ 0 (
    echo.
    echo Available emulators above. To start one, use:
    echo "%ANDROID_HOME%\emulator\emulator.exe" -avd [EMULATOR_NAME]
) else (
    echo ❌ No emulators found. You may need to create one in Android Studio
)

echo.
echo After connecting a device or starting emulator, try:
echo npx cap run android
echo ========================================
echo Thank you for using Annadata!
echo Please visit https://annadata.ai for more information
echo npm config set @capawesome-team:registry https://npm.registry.capawesome.io
echo npm config set //npm.registry.capawesome.io/:_authToken POLAR-3ACA75A9-A3E5-4AAB-B25B-86B28059DE08
echo ========================================

pause
