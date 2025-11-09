# Download Tesseract Language Data for Offline OCR
# Usage: .\scripts\download-tessdata.ps1 -Languages "eng", "hin", "tam"

param(
    [string[]]$Languages = @("eng", "hin")
)

$tessDataUrl = "https://tessdata.projectnaptha.com/4.0.0"
$outputDir = "public\tessdata"

# Create output directory if it doesn't exist
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    Write-Host "✅ Created directory: $outputDir" -ForegroundColor Green
}

Write-Host "`n🌍 Downloading Tesseract Language Packs" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

foreach ($lang in $Languages) {
    $url = "$tessDataUrl/$lang.traineddata.gz"
    $output = "$outputDir\$lang.traineddata.gz"
    
    Write-Host "`n📦 Downloading: $lang" -ForegroundColor Yellow
    Write-Host "   URL: $url"
    Write-Host "   Output: $output"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $output -ErrorAction Stop
        $size = (Get-Item $output).Length / 1MB
        Write-Host "   ✅ Downloaded: $([math]::Round($size, 2)) MB" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ Failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "📊 Downloaded Language Packs:" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

Get-ChildItem $outputDir | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 2)
    Write-Host "   $($_.Name.PadRight(30)) $sizeMB MB" -ForegroundColor White
}

$totalSize = (Get-ChildItem $outputDir | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "`n   Total: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

Write-Host "`n✅ Language packs ready for offline OCR!`n" -ForegroundColor Green
