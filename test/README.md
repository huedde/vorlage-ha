# Lokale Test-UI

Frontend der **Alfen Wallbox Karte** ohne Home Assistant testen.

## Starten

### Windows (Batch)
```bash
test\run-server.bat
```

### Linux/Mac
```bash
chmod +x test/run-server.sh
./test/run-server.sh
```

### Manuell (Python)
```bash
cd homeassistant-raumplan
python -m http.server 8080
```

Dann im Browser öffnen: **http://localhost:8080/test/**

## Inhalt

- **Karte**: Zeigt die Alfen-Wallbox-Karte mit Mock-Entitäten (Leistung, Status, etc.)
- **Steuerung**: Buttons zum Simulieren von Laden an/aus, verriegelt/entriegelt

## Hinweis

`file://` funktioniert nicht – ein lokaler Server ist nötig (z.B. `python -m http.server`).
