class AlfenWallboxCard extends HTMLElement {
  setConfig(config) {
    if (!config) {
      throw new Error("Konfiguration für alfen-wallbox-card fehlt.");
    }

    // Mindestens eine Entity sollte angegeben sein
    if (
      !config.status_entity &&
      !config.power_entity &&
      !config.energy_entity &&
      !config.charging_entity
    ) {
      throw new Error(
        "Bitte mindestens eine Entity (z.B. power_entity oder charging_entity) angeben."
      );
    }

    this._config = {
      title: config.title || "Wallbox",
      status_entity: config.status_entity,
      power_entity: config.power_entity,
      energy_entity: config.energy_entity,
      current_entity: config.current_entity,
      plugged_entity: config.plugged_entity,
      charging_entity: config.charging_entity,
      lock_entity: config.lock_entity,
      switch_entity: config.switch_entity,
      // optionale Farben / Einstellungen
      charging_color: config.charging_color || "var(--primary-color)",
      idle_color: config.idle_color || "var(--secondary-text-color)",
      error_color: config.error_color || "var(--error-color)",
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this._render();
  }

  getCardSize() {
    return 3;
  }

  _entityState(entityId) {
    if (!entityId || !this._hass || !this._hass.states) return undefined;
    return this._hass.states[entityId];
  }

  _formatNumber(stateObj, digits = 1, fallback = "-") {
    if (!stateObj) return fallback;
    const value = parseFloat(stateObj.state);
    if (Number.isNaN(value)) return fallback;
    const locale = this._hass?.language || navigator.language || "de-DE";
    return value.toLocaleString(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
  }

  _deriveStatus() {
    const cfg = this._config;
    const statusObj = this._entityState(cfg.status_entity);
    const chargingObj = this._entityState(cfg.charging_entity);
    const pluggedObj = this._entityState(cfg.plugged_entity);

    // Wenn es ein dediziertes Status-Entity gibt, verwenden wir das
    if (statusObj) {
      const raw = (statusObj.state || "").toLowerCase();
      // Typische Zustände bei Wallboxen versuchen abzudecken
      if (["charging", "ladevorgang", "laden"].includes(raw)) {
        return { key: "charging", label: "Lädt", color: cfg.charging_color };
      }
      if (["ready", "bereit", "standby", "available"].includes(raw)) {
        return { key: "ready", label: "Bereit", color: cfg.idle_color };
      }
      if (["error", "fault", "störung"].includes(raw)) {
        return { key: "error", label: "Fehler", color: cfg.error_color };
      }
      // Fallback: Rohstatus anzeigen
      return {
        key: "custom",
        label: statusObj.state || "Unbekannt",
        color: cfg.idle_color,
      };
    }

    // Kein dediziertes Status-Entity: aus Binary-Sensoren ableiten
    const isCharging = chargingObj?.state === "on";
    const isPlugged = pluggedObj?.state === "on";

    if (isCharging) {
      return { key: "charging", label: "Lädt", color: cfg.charging_color };
    }
    if (isPlugged) {
      return { key: "ready", label: "Angesteckt", color: cfg.idle_color };
    }

    return { key: "disconnected", label: "Getrennt", color: cfg.idle_color };
  }

  _render() {
    if (!this._config || !this._hass) return;

    const root = this.shadowRoot;
    const cfg = this._config;

    const statusInfo = this._deriveStatus();
    const powerObj = this._entityState(cfg.power_entity);
    const energyObj = this._entityState(cfg.energy_entity);
    const currentObj = this._entityState(cfg.current_entity);
    const lockObj = this._entityState(cfg.lock_entity);
    const switchObj = this._entityState(cfg.switch_entity);
    const pluggedObj = this._entityState(cfg.plugged_entity);

    const power = this._formatNumber(powerObj, 1, "0");
    const energy = this._formatNumber(energyObj, 2, "-");
    const current = this._formatNumber(currentObj, 0, "-");

    const isCharging = statusInfo.key === "charging";
    const isLocked = lockObj?.state === "locked";
    const isEnabled = switchObj?.state !== "off";
    const isPlugged = pluggedObj?.state === "on";

    const lockLabel = isLocked ? "Gesperrt" : "Entriegelt";
    const enableLabel = isEnabled ? "Laden erlaubt" : "Laden gesperrt";
    const pluggedLabel = isPlugged ? "Angesteckt" : "Nicht angesteckt";

    root.innerHTML = `
      <ha-card>
        <style>
          :host {
            --alfen-card-padding: 16px;
            --alfen-card-bg: var(--card-background-color);
            --alfen-text-color: var(--primary-text-color);
          }

          ha-card {
            padding: var(--alfen-card-padding);
            box-sizing: border-box;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          .title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--primary-text-color);
          }

          .status-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--primary-background-color);
            background-color: ${statusInfo.color};
          }

          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--primary-background-color);
          }

          .content {
            display: grid;
            grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
            gap: 16px;
            align-items: center;
          }

          .power-circle {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 6px solid ${
              isCharging ? cfg.charging_color : "var(--divider-color)"
            };
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin: 0 auto;
          }

          .power-value {
            font-size: 1.4rem;
            font-weight: 600;
          }

          .power-unit {
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          .details {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 12px;
            font-size: 0.85rem;
          }

          .details-row {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .details-label {
            color: var(--secondary-text-color);
            font-size: 0.75rem;
            text-transform: uppercase;
          }

          .details-value {
            font-weight: 500;
          }

          .chips-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
            font-size: 0.75rem;
          }

          .chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 2px 8px;
            border-radius: 999px;
            background-color: var(--ha-card-border-color, rgba(0,0,0,0.05));
            color: var(--secondary-text-color);
          }

          .chip-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
          }

          .chip-dot--on {
            background-color: var(--primary-color);
          }

          .chip-dot--off {
            background-color: var(--disabled-text-color);
          }

          .actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
          }

          button.action {
            border: none;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            background-color: var(--primary-color);
            color: var(--primary-text-color, #fff);
          }

          button.action.secondary {
            background-color: transparent;
            border: 1px solid var(--primary-color);
            color: var(--primary-color);
          }

          button.action:disabled {
            opacity: 0.5;
            cursor: default;
          }

          @media (max-width: 500px) {
            .content {
              grid-template-columns: minmax(0, 1fr);
            }
            .power-circle {
              width: 80px;
              height: 80px;
            }
          }
        </style>

        <div class="header">
          <div class="title">${cfg.title}</div>
          <div class="status-chip">
            <div class="status-dot"></div>
            <span>${statusInfo.label}</span>
          </div>
        </div>

        <div class="content">
          <div class="power-circle">
            <div class="power-value">${power}</div>
            <div class="power-unit">kW</div>
          </div>

          <div>
            <div class="details">
              <div class="details-row">
                <div class="details-label">Energie (Session)</div>
                <div class="details-value">${energy} kWh</div>
              </div>
              <div class="details-row">
                <div class="details-label">Stromstärke</div>
                <div class="details-value">${current} A</div>
              </div>
              <div class="details-row">
                <div class="details-label">Lock</div>
                <div class="details-value">${lockLabel}</div>
              </div>
              <div class="details-row">
                <div class="details-label">Freigabe</div>
                <div class="details-value">${enableLabel}</div>
              </div>
            </div>

            <div class="chips-row">
              <div class="chip">
                <div class="chip-dot ${
                  isPlugged ? "chip-dot--on" : "chip-dot--off"
                }"></div>
                <span>${pluggedLabel}</span>
              </div>
              ${
                cfg.charging_entity
                  ? `<div class="chip">
                      <div class="chip-dot ${
                        isCharging ? "chip-dot--on" : "chip-dot--off"
                      }"></div>
                      <span>${
                        isCharging ? "Ladevorgang aktiv" : "Nicht am Laden"
                      }</span>
                    </div>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div class="actions">
          ${
            cfg.switch_entity
              ? `<button class="action primary" data-action="toggle-charging">
                    ${isEnabled ? "Laden stoppen" : "Laden starten"}
                 </button>`
              : ""
          }
          ${
            cfg.lock_entity
              ? `<button class="action secondary" data-action="toggle-lock">
                    ${isLocked ? "Entriegeln" : "Verriegeln"}
                 </button>`
              : ""
          }
        </div>
      </ha-card>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    const root = this.shadowRoot;
    if (!root) return;

    const toggleChargingBtn = root.querySelector(
      'button[data-action="toggle-charging"]'
    );
    const toggleLockBtn = root.querySelector(
      'button[data-action="toggle-lock"]'
    );

    if (toggleChargingBtn) {
      toggleChargingBtn.addEventListener("click", () =>
        this._toggleCharging()
      );
    }

    if (toggleLockBtn) {
      toggleLockBtn.addEventListener("click", () => this._toggleLock());
    }
  }

  _toggleCharging() {
    const entityId = this._config.switch_entity;
    if (!entityId || !this._hass) return;

    const stateObj = this._entityState(entityId);
    const domain = entityId.split(".")[0];
    const isOn = stateObj?.state === "on";
    const service = isOn ? "turn_off" : "turn_on";

    this._hass.callService(domain, service, { entity_id: entityId });
  }

  _toggleLock() {
    const entityId = this._config.lock_entity;
    if (!entityId || !this._hass) return;

    const stateObj = this._entityState(entityId);
    const isLocked = stateObj?.state === "locked";
    const service = isLocked ? "unlock" : "lock";

    this._hass.callService("lock", service, { entity_id: entityId });
  }

  static getStubConfig() {
    return {
      title: "Alfen Wallbox",
      power_entity: "sensor.alfen_power",
      energy_entity: "sensor.alfen_session_energy",
      charging_entity: "binary_sensor.alfen_charging",
      plugged_entity: "binary_sensor.alfen_cable_plugged",
    };
  }
}

customElements.define("alfen-wallbox-card", AlfenWallboxCard);

// Registrierung für die Lovelace-Kartenübersicht
window.customCards = window.customCards || [];
window.customCards.push({
  type: "alfen-wallbox-card",
  name: "Alfen Wallbox Karte",
  description:
    "Kompakte Übersicht und Steuerung für eine Alfen-Ladestation (Wallbox).",
});

