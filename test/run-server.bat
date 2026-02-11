@echo off
echo Starte lokalen Test-Server...
echo.
echo Oeffne im Browser: http://localhost:8080/test/
echo.
cd /d "%~dp0.."
python -m http.server 8080
