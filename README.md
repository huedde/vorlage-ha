# Alfen Wallbox Karte

Lovelace-Karte für eine oder mehrere **Alfen-Wallboxen**. Die Karte zeigt kompakt **Status, aktuelle Ladeleistung, Energie der Session, Stromstärke, Stecker-/Ladezustand** und erlaubt optional **Start/Stopp des Ladevorgangs** sowie **Verriegeln/Entriegeln** direkt aus dem Dashboard.

## Installation

### Über HACS

1. HACS → **Frontend** → **Custom repositories** → dein GitHub-Repository dieser Karte
2. Karte „Alfen Wallbox Karte“ installieren

### Manuell

1. `dist/alfen-wallbox-card.js` nach `config/www/` kopieren
2. Dashboard-Ressource: URL `/local/alfen-wallbox-card.js`, Typ **JavaScript-Modul**

## Konfiguration

### YAML

```yaml
type: custom:alfen-wallbox-card
title: Wallbox Garage
status_entity: sensor.alfen_status              # optional, z.B. „Charging“, „Ready“, …
power_entity: sensor.alfen_power                # aktuelle Leistung (kW)
energy_entity: sensor.alfen_session_energy      # Energie der aktuellen Session (kWh)
current_entity: sensor.alfen_current            # Stromstärke (A)
plugged_entity: binary_sensor.alfen_plugged     # Kabel gesteckt ja/nein
charging_entity: binary_sensor.alfen_charging   # lädt ja/nein
lock_entity: lock.alfen_connector_lock          # Verriegelung des Steckers
switch_entity: switch.alfen_charging_enable     # Laden erlauben/sperren

# optional: Farben
charging_color: '#00b894'
idle_color: '#636e72'
error_color: '#d63031'
```

### Parameter

| Parameter         | Beschreibung                                                                 |
|------------------|------------------------------------------------------------------------------|
| `title`          | Überschrift über der Karte                                                   |
| `status_entity`  | (Optional) Sensor mit textlichem Status der Wallbox                         |
| `power_entity`   | Sensor mit aktueller Ladeleistung in kW                                      |
| `energy_entity`  | Sensor mit Energie der aktuellen Session in kWh                              |
| `current_entity` | (Optional) Sensor mit aktueller Stromstärke in A                             |
| `plugged_entity` | (Optional) Binary-Sensor, ob Fahrzeug/Stecker angesteckt ist (`on`/`off`)    |
| `charging_entity`| (Optional) Binary-Sensor, ob gerade geladen wird (`on`/`off`)                |
| `lock_entity`    | (Optional) `lock`-Entity für die Verriegelung des Steckers                   |
| `switch_entity`  | (Optional) `switch`-Entity, um Laden zu erlauben/zu sperren                  |
| `charging_color` | Farbe der Statusanzeige, wenn geladen wird (Standard: `var(--primary-color)`|
| `idle_color`     | Farbe der Statusanzeige im Leerlauf                                          |
| `error_color`    | Farbe der Statusanzeige bei Fehler                                           |

### Anzeige in Home Assistant

- Großer Kreis mit **aktueller Leistung (kW)**.
- Status-Chip mit Text (z.B. „Lädt“, „Bereit“, „Fehler“) und farblicher Hervorhebung.
- Detailzeilen für **Session-Energie, Stromstärke, Lock/Freigabe**.
- Kleine Chips für „Stecker angesteckt“ und „Ladevorgang aktiv“ (falls konfiguriert).
- Buttons zum **Starten/Stoppen** des Ladevorgangs (`switch_entity`) und zum **Verriegeln/Entriegeln** (`lock_entity`), sofern die Entitäten gesetzt sind.

## Lokale Test-UI

Frontend ohne Home Assistant testen:

```bash
cd homeassistant-raumplan
python -m http.server 8080
```

Dann **http://localhost:8080/test/** im Browser öffnen. Siehe `test/README.md`.

## Lizenz

Frei nutzbar für den privaten Einsatz mit Home Assistant.
