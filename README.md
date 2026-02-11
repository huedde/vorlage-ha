# Interaktiver Raumplan

Lovelace-Karte für einen **Raumplan als Bild** mit per **Koordinaten (x, y)** positionierten Entitäten. Entitäten werden als **Kreise mit Icons** dargestellt und können per **Drag & Drop** im Editor platziert werden.

## Installation

### Über HACS

1. HACS → **Frontend** → **Custom repositories** → `https://github.com/MarvinSMX/homeassistant-raumplan`
2. Karte „Interaktiver Raumplan“ installieren

### Manuell

1. `dist/homeassistant-raumplan.js` nach `config/www/` kopieren
2. Dashboard-Ressource: URL `/local/homeassistant-raumplan.js`, Typ **JavaScript-Modul**

## Konfiguration

### YAML

```yaml
type: custom:room-plan-card
image: /local/raumplan.png
rotation: 0
entities:
  - entity: light.wohnzimmer
    x: 25
    y: 30
    scale: 1
    color: "#ffc107"
  - entity: sensor.temperatur_bad
    x: 75
    y: 40
    scale: 1.2
  - entity: light.kueche
    x: 50
    y: 70
    icon: mdi:ceiling-light
    scale: 0.8
    color: "#4caf50"
walls:
  - x1: 10
    y1: 20
    x2: 90
    y2: 25
    thickness: 2
    height: 8
  - x1: 50
    y1: 30
    x2: 55
    y2: 80
    thickness: 3
    color: "#8d6e63"
```

### Parameter

| Parameter    | Beschreibung                                           |
|-------------|--------------------------------------------------------|
| `image`     | URL des Raumplan-Bildes (PNG, JPG, SVG)               |
| `rotation`  | Optional: Drehung des Bildes in Grad (0, 90, 180, 270)|
| `entities`  | Liste mit `entity`, `x`, `y` (Prozent 0–100)           |
| `icon`      | Optional: MDI-Icon (z.B. `mdi:ceiling-light`)         |
| `scale`     | Optional: Skalierung pro Entität (0.3–2, Standard: 1)|
| `color`     | Optional: Farbe pro Entität (Hex, z.B. `#ffc107`)    |
| `walls`     | Optional: Top-Down-Wände (x1,y1,x2,y2, thickness, height) |
| `title`     | Optional: Überschrift über der Karte                  |

### Wände (Top-Down)

Wände werden als 2D-Rechtecke von oben dargestellt. Im Editor: **„Wand einzeichnen“** klicken, dann **Startpunkt** und **Endpunkt** auf dem Plan setzen. In der Position-Ansicht: **Wandfläche verschieben** oder **blaue Endpunkte ziehen** zum Verlängern. Pro Wand: `x1,y1` (Start), `x2,y2` (Ende), `thickness` (Dicke, Standard: 2), optional `height` und `color`.

### Anzeige in Home Assistant

Die Karte skaliert **responsive** zur konfigurierten Card-Größe im Dashboard. Bild, Wände und Entitäten passen sich automatisch an. Die Karte enthält Anpassungen für HA (kein Padding, Theme-Variablen). Wenn Layout-Probleme auftreten, kannst du mit **card-mod** nachhelfen:

```yaml
type: custom:room-plan-card
# ... deine config ...
card_mod:
  style: |
    ha-card { padding: 0 !important; }
```

## Koordinaten

- **x** und **y** sind Prozentwerte (0–100) relativ zur Bildbreite und -höhe
- **x: 0** = links, **x: 100** = rechts
- **y: 0** = oben, **y: 100** = unten
- Im Konfigurations-Editor: Kreise per **Drag & Drop** auf dem Vorschau-Bild verschieben

## Nutzung

1. Bild des Raumplans unter `config/www/` ablegen (z.B. `raumplan.png`)
2. Karte „Interaktiver Raumplan“ zum Dashboard hinzufügen
3. Bild-URL eintragen (z.B. `/local/raumplan.png`)
4. Entitäten hinzufügen und in der Vorschau per Drag & Drop auf die richtigen Stellen ziehen
5. Speichern – Klick auf einen Kreis öffnet die Entity-Details

## Lokale Test-UI

Frontend ohne Home Assistant testen:

```bash
cd homeassistant-raumplan
python -m http.server 8080
```

Dann **http://localhost:8080/test/** im Browser öffnen. Siehe `test/README.md`.

## Lizenz

Frei nutzbar für den privaten Einsatz mit Home Assistant.
