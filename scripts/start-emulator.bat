@echo off
echo Starting Android Emulator...

REM Check if ANDROID_HOME is set
if "%ANDROID_HOME%"=="" (
    echo Setting ANDROID_HOME...
    set ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
)

REM List available emulators
echo Available emulators:
%ANDROID_HOME%\emulator\emulator.exe -list-avds

REM Start first available emulator (you can modify this)
echo Starting emulator...
%ANDROID_HOME%\emulator\emulator.exe -avd Pixel_7_API_34

pause