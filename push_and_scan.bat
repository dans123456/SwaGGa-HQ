@echo off
title SwaGGa HQ - Push & Scan Utility
echo ===================================================
echo 🛡️  Running Semgrep Security Scan for SwaGGa HQ...
echo ===================================================
echo.
echo Scanning js/app.js ...
powershell -Command "Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:10631/scan' -Headers @{'Content-Type'='application/json'} -Body '{\"filePath\": \"%CD%/js/app.js\"}'"
echo.
echo Scanning js/calendar.js ...
powershell -Command "Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:10631/scan' -Headers @{'Content-Type'='application/json'} -Body '{\"filePath\": \"%CD%/js/calendar.js\"}'"
echo.
echo ===================================================
echo 🚀  Pushing Updates to GitHub Repository...
echo ===================================================
echo.
git add .
git commit -m "feat: implement P&L calendar heatmap, focus mindset banner, and version bump"
git push
echo.
echo ===================================================
echo ✅ Done! All updates pushed and scanned.
echo ===================================================
pause
