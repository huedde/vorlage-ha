# Lokale Test-UI

Frontend der Raumplan-Karte ohne Home Assistant testen.

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

- **Karte**: Zeigt die Raumplan-Karte mit Platzhalter-Bild und Mock-Entitäten
- **Editor**: Konfigurations-Dialog mit Drag & Drop zum Positionieren
- **Bild-URL**: Platzhalterbild (placehold.co) – kann auf lokale URL geändert werden
- **Licht simulieren**: Schaltet `light.wohnzimmer` zwischen an/aus

## Hinweis

`file://` funktioniert nicht – ein lokaler Server ist nötig (z.B. `python -m http.server`).
