# SwaGGa HQ - Scan and Push Automation Script

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "🛡️  Running Semgrep Security Scan for SwaGGa HQ..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$filesToScan = @("js/app.js", "js/calendar.js")

foreach ($file in $filesToScan) {
    if (Test-Path $file) {
        $absPath = (Get-Item $file).FullName -replace '\\', '/'
        Write-Host "Scanning $file..."
        
        # Serialize JSON dynamically using built-in command to avoid string quote/backslash parsing bugs
        $body = @{ filePath = $absPath } | ConvertTo-Json -Compress
        
        try {
            $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:10631/scan" -Headers @{"Content-Type"="application/json"} -Body $body
            
            if ($response.findings -and $response.findings.Count -gt 0) {
                Write-Host "⚠️ Found $($response.findings.Count) security findings in $file!" -ForegroundColor Yellow
                foreach ($f in $response.findings) {
                    Write-Host "  - [$($f.labels.severity)] $($f.labels.vulnerability_class) at line $($f.location.range.textRange.startLine)" -ForegroundColor Red
                    Write-Host "    $($f.message)"
                }
            } else {
                Write-Host "✅ Scan passed for $file! No vulnerabilities detected." -ForegroundColor Green
            }
        } catch {
            Write-Host "❌ Scan request failed for $file - $_" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️ File not found: $file" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "🚀 Pushing Updates to GitHub Repository..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

git add .
git commit -m "feat: implement P&L calendar heatmap, focus mindset banner, and version bump"
git push

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "✅ Done! All updates pushed and scanned." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
