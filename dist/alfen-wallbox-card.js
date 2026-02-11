class AlfenWallboxCard extends HTMLElement {
  setConfig(config) {
    if (!config) {
      throw new Error("Konfiguration für alfen-wallbox-card fehlt.");
    }

    // In internes, vereinheitlichtes Sockets-Array überführen
    let sockets = [];

    if (Array.isArray(config.sockets)) {
      sockets = config.sockets.map((socket, index) => ({
        name: socket.name || `Socket ${index + 1}`,
        status_entity: socket.status_entity,
        power_entity: socket.power_entity,
        energy_entity: socket.energy_entity,
        current_entity: socket.current_entity,
        plugged_entity: socket.plugged_entity,
        charging_entity: socket.charging_entity,
        lock_entity: socket.lock_entity,
        switch_entity: socket.switch_entity,
      }));
    } else if (config.sockets) {
      // Falls nur ein Objekt statt Array angegeben wurde
      const socket = config.sockets;
      sockets = [
        {
          name: socket.name || "Socket 1",
          status_entity: socket.status_entity,
          power_entity: socket.power_entity,
          energy_entity: socket.energy_entity,
          current_entity: socket.current_entity,
          plugged_entity: socket.plugged_entity,
          charging_entity: socket.charging_entity,
          lock_entity: socket.lock_entity,
          switch_entity: socket.switch_entity,
        },
      ];
    } else {
      // Rückwärtskompatibilität: Single-Socket-Konfiguration aus Top-Level-Entitäten
      sockets = [
        {
          name: config.socket_name || "Socket 1",
          status_entity: config.status_entity,
          power_entity: config.power_entity,
          energy_entity: config.energy_entity,
          current_entity: config.current_entity,
          plugged_entity: config.plugged_entity,
          charging_entity: config.charging_entity,
          lock_entity: config.lock_entity,
          switch_entity: config.switch_entity,
        },
      ];
    }

    this._config = {
      title: config.title || "Wallbox",
      sockets,
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

  _asBool(stateObj) {
    if (!stateObj) return undefined;
    const raw = stateObj.state;
    if (raw === null || raw === undefined) return undefined;

    const str = String(raw).trim().toLowerCase();
    if (["on", "true", "yes", "1", "open"].includes(str)) return true;
    if (["off", "false", "no", "0", "closed"].includes(str)) return false;

    const num = Number(raw);
    if (!Number.isNaN(num)) return num !== 0;

    return undefined;
  }

  _deriveStatus(socketCfg) {
    const cfg = this._config;
    const statusObj = this._entityState(socketCfg.status_entity);
    const chargingObj = this._entityState(socketCfg.charging_entity);
    const pluggedObj = this._entityState(socketCfg.plugged_entity);

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

    // Kein dediziertes Status-Entity: aus Binary-Sensoren / numerischen Sensoren ableiten
    const isCharging = this._asBool(chargingObj);
    const isPlugged = this._asBool(pluggedObj);

    if (isCharging === true) {
      return { key: "charging", label: "Lädt", color: cfg.charging_color };
    }
    if (isPlugged === true) {
      return { key: "ready", label: "Angesteckt", color: cfg.idle_color };
    }

    return { key: "disconnected", label: "Getrennt", color: cfg.idle_color };
  }

  _render() {
    if (!this._config || !this._hass) return;

    const root = this.shadowRoot;
    const cfg = this._config;

    const sockets = cfg.sockets || [];
    const globalStatusInfo =
      sockets.length > 0 ? this._deriveStatus(sockets[0]) : null;

    const socketsHtml = sockets
      .map((socketCfg, index) => {
        const statusInfo = this._deriveStatus(socketCfg);
        const powerObj = this._entityState(socketCfg.power_entity);
        const energyObj = this._entityState(socketCfg.energy_entity);
        const currentObj = this._entityState(socketCfg.current_entity);
        const lockObj = this._entityState(socketCfg.lock_entity);
        const switchObj = this._entityState(socketCfg.switch_entity);
        const pluggedObj = this._entityState(socketCfg.plugged_entity);

        const power = this._formatNumber(powerObj, 1, "0");
        const energy = this._formatNumber(energyObj, 2, "-");
        const current = this._formatNumber(currentObj, 0, "-");

        const isCharging = statusInfo.key === "charging";
        const isLocked = lockObj?.state === "locked";
        const isEnabled = switchObj
          ? this._asBool(switchObj) ?? switchObj.state !== "off"
          : false;
        const isPlugged = this._asBool(pluggedObj) === true;

        const lockLabel = isLocked ? "Gesperrt" : "Entriegelt";
        const enableLabel = isEnabled ? "Laden erlaubt" : "Laden gesperrt";
        const pluggedLabel = isPlugged ? "Angesteckt" : "Nicht angesteckt";

        return `
          <div class="socket">
            <div class="socket-header">
              <div class="socket-title">${socketCfg.name || `Socket ${
          index + 1
        }`}</div>
              <div class="status-chip" style="background-color: ${
                statusInfo.color
              }">
                <div class="status-dot"></div>
                <span>${statusInfo.label}</span>
              </div>
            </div>

            <div class="socket-content">
              <div class="power-circle ${
                isCharging ? "power-circle--charging" : ""
              }">
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
                    socketCfg.charging_entity
                      ? `<div class="chip">
                          <div class="chip-dot ${
                            isCharging ? "chip-dot--on" : "chip-dot--off"
                          }"></div>
                          <span>${
                            isCharging
                              ? "Ladevorgang aktiv"
                              : "Nicht am Laden"
                          }</span>
                        </div>`
                      : ""
                  }
                </div>

                <div class="actions">
                  ${
                    socketCfg.switch_entity
                      ? `<button class="action primary" data-action="toggle-charging" data-socket-index="${index}">
                          ${isEnabled ? "Laden stoppen" : "Laden starten"}
                        </button>`
                      : ""
                  }
                  ${
                    socketCfg.lock_entity
                      ? `<button class="action secondary" data-action="toggle-lock" data-socket-index="${index}">
                          ${isLocked ? "Entriegeln" : "Verriegeln"}
                        </button>`
                      : ""
                  }
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

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
            background-color: var(--primary-color);
          }

          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--primary-background-color);
          }

          .sockets-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
          }

          .socket {
            padding: 12px;
            border-radius: 12px;
            background: var(--ha-card-background, rgba(255,255,255,0.02));
            border: 1px solid var(--divider-color);
          }

          .socket-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }

          .socket-title {
            font-weight: 500;
          }

          .socket-content {
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 2fr);
            gap: 12px;
            align-items: center;
          }

          .power-circle {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 6px solid var(--divider-color);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin: 0 auto;
          }

          .power-circle--charging {
            border-color: ${cfg.charging_color};
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
            .socket-content {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        </style>

        <div class="header">
          <div class="title">${cfg.title}</div>
          ${
            globalStatusInfo
              ? `<div class="status-chip">
                  <div class="status-dot"></div>
                  <span>${globalStatusInfo.label}</span>
                </div>`
              : ""
          }
        </div>

        <div class="sockets-grid">
          ${socketsHtml}
        </div>
      </ha-card>
    `;

    this._attachEventListeners();
  }

  _attachEventListeners() {
    const root = this.shadowRoot;
    if (!root) return;

    const toggleChargingBtns = root.querySelectorAll(
      'button[data-action="toggle-charging"]'
    );
    const toggleLockBtns = root.querySelectorAll(
      'button[data-action="toggle-lock"]'
    );

    toggleChargingBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.getAttribute("data-socket-index") || "0", 10);
        this._toggleCharging(index);
      });
    });

    toggleLockBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.getAttribute("data-socket-index") || "0", 10);
        this._toggleLock(index);
      });
    });
  }

  _toggleCharging(socketIndex = 0) {
    const socketCfg = this._config.sockets?.[socketIndex];
    const entityId = socketCfg?.switch_entity;
    if (!entityId || !this._hass) return;

    const stateObj = this._entityState(entityId);
    const domain = entityId.split(".")[0];
    const isOn = stateObj?.state === "on";
    const service = isOn ? "turn_off" : "turn_on";

    this._hass.callService(domain, service, { entity_id: entityId });
  }

  _toggleLock(socketIndex = 0) {
    const socketCfg = this._config.sockets?.[socketIndex];
    const entityId = socketCfg?.lock_entity;
    if (!entityId || !this._hass) return;

    const stateObj = this._entityState(entityId);
    const isLocked = stateObj?.state === "locked";
    const service = isLocked ? "unlock" : "lock";

    this._hass.callService("lock", service, { entity_id: entityId });
  }

  static getStubConfig() {
    return {
      title: "Alfen Wallbox Pro Duo",
      sockets: [
        {
          name: "Socket 1",
          power_entity: "sensor.alfen_ladestation_1_s1_apparent_power_sum",
          energy_entity: "sensor.alfen_ladestation_1_s1_current_session_wh",
          charging_entity: "sensor.alfen_ladestation_1_s1_car_charging",
          plugged_entity: "sensor.alfen_ladestation_1_s1_car_connected",
        },
        {
          name: "Socket 2",
          power_entity: "sensor.alfen_ladestation_1_s2_apparent_power_sum",
          energy_entity: "sensor.alfen_ladestation_1_s2_current_session_wh",
          charging_entity: "sensor.alfen_ladestation_1_s2_car_charging",
          plugged_entity: "sensor.alfen_ladestation_1_s2_car_connected",
        },
      ],
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

