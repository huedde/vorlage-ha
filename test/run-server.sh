#!/bin/sh
echo "Starte lokalen Test-Server..."
echo ""
echo "Öffne im Browser: http://localhost:8080/test/"
echo ""
cd "$(dirname "$0")/.."
python3 -m http.server 8080
