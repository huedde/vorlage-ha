/**
 * Interaktiver Raumplan - Bild mit per Koordinaten positionierten Entitäten
 * Entitäten als Kreise mit Icons, Position per x,y (Prozent).
 */

(function () {
  const CARD_TAG = 'room-plan-card';
  const EDITOR_TAG = 'room-plan-editor';

  function getEntityIcon(hass, entityId) {
    const state = hass?.states?.[entityId];
    if (!state) return 'mdi:help-circle';
    const icon = state.attributes?.icon;
    if (icon) return icon;
    const domain = entityId.split('.')[0];
    const stateVal = state.state;
    if (domain === 'light' || domain === 'switch') return stateVal === 'on' ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline';
    if (domain === 'cover') return 'mdi:blinds';
    if (domain === 'climate') return 'mdi:thermostat';
    if (domain === 'sensor') return 'mdi:gauge';
    if (domain === 'binary_sensor') return 'mdi:motion-sensor';
    return 'mdi:circle';
  }

  function getFriendlyName(hass, entityId) {
    const state = hass?.states?.[entityId];
    return state?.attributes?.friendly_name || entityId;
  }

  function getStateDisplay(hass, entityId) {
    const state = hass?.states?.[entityId];
    if (!state) return '—';
    const uom = state.attributes?.unit_of_measurement;
    if (uom) return state.state + ' ' + uom;
    return state.state;
  }

  function wallToTopDownRect(wall) {
    const x1 = Number(wall.x1) || 0;
    const y1 = Number(wall.y1) || 0;
    const x2 = Number(wall.x2) || 0;
    const y2 = Number(wall.y2) || 0;
    const thick = Math.max(0.5, Math.min(15, Number(wall.thickness) || 2));
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * (thick / 2), py = (dx / len) * (thick / 2);
    const a1 = `${x1 + px},${y1 + py}`;
    const a2 = `${x1 - px},${y1 - py}`;
    const b1 = `${x2 + px},${y2 + py}`;
    const b2 = `${x2 - px},${y2 - py}`;
    return `${a1} ${b1} ${b2} ${a2}`;
  }

  // ---------- Hauptkarte ----------
  class RoomPlanCard extends HTMLElement {
    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig() {
      return {
        image: '/local/raumplan.png',
        rotation: 0,
        entities: [
          { entity: 'light.example', x: 25, y: 30, scale: 1, color: '#ffc107' },
          { entity: 'sensor.example', x: 75, y: 40, scale: 1 }
        ],
        walls: []
      };
    }

    constructor() {
      super();
      this._config = {};
      this._hass = null;
      this._root = null;
      this._container = null;
    }

    setConfig(config) {
      const img = (config && config.image) ? (typeof config.image === 'string' ? config.image : config.image.location || config.image) : '';
      this._config = {
        image: img,
        entities: Array.isArray(config && config.entities) ? config.entities : [],
        walls: Array.isArray(config && config.walls) ? config.walls : [],
        title: (config && config.title) ? config.title : '',
        rotation: Number(config && config.rotation) || 0
      };
      if (this._root) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._root) this._render();
    }

    getCardSize() {
      return 4;
    }

    connectedCallback() {
      if (!this._root) {
        this._injectStyles();
        this._root = document.createElement('ha-card');
        this._root.className = 'room-plan-ha-card';
        this._root.style.cssText = 'overflow: hidden; padding: 0 !important;';
        this._container = document.createElement('div');
        this._container.className = 'room-plan-container';
        this._root.appendChild(this._container);
        this.appendChild(this._root);
      }
      this._render();
    }

    _injectStyles() {
      if (this.querySelector('style[data-room-plan]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-room-plan', '1');
      style.textContent = `
        room-plan-card { display: block; height: 100%; min-height: 0; }
        room-plan-card .room-plan-ha-card { padding: 0 !important; overflow: hidden !important; height: 100%; display: flex; flex-direction: column; min-height: 0; }
        room-plan-card .room-plan-container { position: relative; flex: 1; min-height: 120px; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
        room-plan-card .room-plan-wrapper { display: grid; flex: 1; width: 100%; min-height: 0; position: relative; }
        room-plan-card .room-plan-wrapper > * { grid-area: 1/1; }
        room-plan-card .room-plan-img-wrap { overflow: hidden; transform-origin: center center; display: flex; align-items: center; justify-content: center; }
        room-plan-card .room-plan-img-wrap > img { width: 100%; height: 100%; object-fit: contain; display: block; }
        room-plan-card .room-plan-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }
        room-plan-card .room-plan-overlay > * { pointer-events: auto; }
        room-plan-card .room-plan-walls { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 1; }
        room-plan-card .room-plan-walls svg { width: 100%; height: 100%; }
        room-plan-card .room-plan-walls .wall-topdown { fill: rgba(90,90,90,0.9); stroke: rgba(60,60,60,0.95); stroke-width: 0.2; }
        room-plan-card .room-plan-entity { position: absolute; transform: translate(-50%,-50%);
          width: calc(44px * var(--entity-scale, 1)); height: calc(44px * var(--entity-scale, 1)); min-width: 24px; min-height: 24px; border-radius: 50%;
          background: var(--card-background-color, var(--ha-card-background, #1e1e1e));
          color: var(--primary-text-color, #e1e1e1);
          box-shadow: 0 2px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 2; border: 3px solid rgba(255,255,255,0.15);
          transition: transform 0.15s; }
        room-plan-card .room-plan-entity:hover { transform: translate(-50%,-50%) scale(1.1); }
        room-plan-card .room-plan-entity ha-icon { --mdc-icon-size: calc(24px * var(--entity-scale, 1)); }
        room-plan-card .room-plan-entity.state-on { color: var(--state-icon-on-color, var(--state-icon-active-color, #ffc107)) !important; }
      `;
      this.appendChild(style);
    }

    _render() {
      if (!this._container) return;

      if (!this._config.image) {
        this._container.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--secondary-text-color);">
            <ha-icon icon="mdi:cog" style="font-size: 48px; margin-bottom: 16px; display: block;"></ha-icon>
            <p><strong>Interaktiver Raumplan</strong></p>
            <p>Bitte konfigurieren: Bild-URL und Entitäten mit Koordinaten.</p>
          </div>`;
        return;
      }

      const img = this._config.image;
      const entities = this._config.entities || [];
      const walls = this._config.walls || [];
      const title = this._config.title;
      const rotation = Number(this._config.rotation) || 0;

      let html = '';
      if (title) html += `<div style="padding: 8px 16px; font-weight: 600; color: var(--primary-text-color, #e1e1e1);">${title}</div>`;
      html += `<div class="room-plan-wrapper">`;
      html += `<div class="room-plan-img-wrap" style="transform: rotate(${rotation}deg);">`;
      html += `<img src="${img}" alt="Raumplan" />`;
      html += `</div>`;
      html += `<div class="room-plan-overlay">`;
      if (walls.length > 0) {
        html += `<div class="room-plan-walls"><svg viewBox="0 0 100 100" preserveAspectRatio="none">`;
        walls.forEach((wall) => {
          const wc = wall.color || 'rgba(90,90,90,0.9)';
          const rect = wallToTopDownRect(wall);
          html += `<polygon class="wall-topdown" points="${rect}" fill="${wc}" stroke="rgba(60,60,60,0.95)" stroke-width="0.2" />`;
        });
        html += `</svg></div>`;
      }

      entities.forEach((ent) => {
        const x = Math.min(100, Math.max(0, Number(ent.x) || 50));
        const y = Math.min(100, Math.max(0, Number(ent.y) || 50));
        const scale = Math.min(2, Math.max(0.3, Number(ent.scale) || 1));
        const state = this._hass?.states?.[ent.entity]?.state;
        const stateClass = state === 'on' ? ' state-on' : '';
        let entStyle = `left:${x}%;top:${y}%;--entity-scale:${scale};`;
        if (ent.color) entStyle += `background:${ent.color};color:#fff;`;
        html += `<div class="room-plan-entity${stateClass}" data-entity="${ent.entity}" style="${entStyle}" title="${getFriendlyName(this._hass, ent.entity)}: ${getStateDisplay(this._hass, ent.entity)}">
          <ha-icon icon="${ent.icon || getEntityIcon(this._hass, ent.entity)}"></ha-icon>
        </div>`;
      });

      html += '</div></div>';
      this._container.innerHTML = html;

      this._container.querySelectorAll('.room-plan-entity').forEach(el => {
        el.addEventListener('click', () => {
          const entityId = el.dataset.entity;
          const ev = new Event('hass-more-info', { bubbles: true, composed: true });
          ev.detail = { entityId };
          this.dispatchEvent(ev);
        });
      });
    }
  }

  // ---------- Konfigurations-Editor (Drag & Drop) ----------
  class RoomPlanEditor extends HTMLElement {
    constructor() {
      super();
      this._config = { image: '', entities: [], walls: [] };
      this._hass = null;
      this._dragging = null;
      this._dragOffset = { x: 0, y: 0 };
      this._dragListenersAdded = false;
      this._wallDrawMode = false;
      this._wallDrawStart = null;
    }

    setConfig(c) {
      this._config = c ? { ...c } : { image: '', entities: [], walls: [] };
      this._config.entities = Array.isArray(this._config.entities) ? this._config.entities : [];
      this._config.walls = Array.isArray(this._config.walls) ? this._config.walls : [];
      this._config.rotation = Number(this._config.rotation) || 0;
      this._wallDrawMode = false;
      this._wallDrawStart = null;
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    set lovelace(l) { this._lovelace = l; }

    connectedCallback() {
      this._render();
    }

    _fireConfigChanged(cfg) {
      this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: cfg } }));
    }

    _injectEditorStyles() {
      if (this.querySelector('style[data-room-plan-editor]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-room-plan-editor', '1');
      style.textContent = `
        room-plan-editor .rp-editor { padding: 20px; max-width: 560px; }
        room-plan-editor .rp-editor * { box-sizing: border-box; }
        room-plan-editor .rp-section { margin-bottom: 24px; }
        room-plan-editor .rp-section-title { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 14px; font-weight: 600; color: var(--primary-text-color, #e1e1e1); }
        room-plan-editor .rp-section-title ha-icon { color: var(--primary-color, #03a9f4); }
        room-plan-editor .rp-field { margin-bottom: 16px; }
        room-plan-editor .rp-field label { display: block; font-size: 12px; font-weight: 500; color: var(--secondary-text-color, #9e9e9e); margin-bottom: 6px; }
        room-plan-editor .rp-field input { width: 100%; padding: 12px 14px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); border-radius: 8px;
          background: var(--ha-card-background, #1e1e1e); color: var(--primary-text-color, #e1e1e1); font-size: 14px; }
        room-plan-editor .rp-field input:focus { outline: none; border-color: var(--primary-color, #03a9f4); }
        room-plan-editor .rp-hint { font-size: 12px; color: var(--secondary-text-color, #9e9e9e); margin-top: 6px; line-height: 1.4; }
        room-plan-editor .rp-hint code { background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 11px; }
        room-plan-editor .rp-entity-list { display: flex; flex-direction: column; gap: 10px; }
        room-plan-editor .rp-entity-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px;
          background: var(--ha-card-background, #1e1e1e); border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 10px; }
        room-plan-editor .rp-entity-row input[data-field] { flex: 1; min-width: 120px; padding: 10px 12px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 8px; font-size: 14px; background: var(--ha-card-background, #1e1e1e); color: var(--primary-text-color, #e1e1e1); }
        room-plan-editor .rp-entity-row input[type="number"] { width: 70px; flex: none; }
        room-plan-editor .rp-entity-row input[type="color"] { width: 36px; height: 36px; padding: 2px; flex: none; cursor: pointer; border-radius: 6px; }
        room-plan-editor .rp-entity-row input:focus { outline: none; border-color: var(--primary-color, #03a9f4); }
        room-plan-editor .rp-entity-pos { font-size: 11px; color: var(--secondary-text-color, #9e9e9e); min-width: 70px; text-align: right; }
        room-plan-editor .rp-btn-remove { padding: 8px 12px; border-radius: 8px; border: none; background: rgba(244, 67, 54, 0.2);
          color: #f44336; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        room-plan-editor .rp-btn-remove:hover { background: rgba(244, 67, 54, 0.3); }
        room-plan-editor .rp-btn-add { padding: 12px 18px; border-radius: 10px; border: 2px dashed var(--divider-color, rgba(255,255,255,0.12));
          background: transparent; color: var(--primary-color, #03a9f4); font-size: 14px; font-weight: 500;
          cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; margin-top: 12px; }
        room-plan-editor .rp-btn-add:hover { border-color: var(--primary-color, #03a9f4); background: rgba(3, 169, 244, 0.08); }
        room-plan-editor .rp-preview-wrap { position: relative; margin-top: 12px; min-height: 260px; border-radius: 12px;
          overflow: hidden; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background: #1a1a1a;
          display: grid; }
        room-plan-editor .rp-preview-img-wrap { grid-area: 1/1; overflow: hidden; transform-origin: center center; }
        room-plan-editor .rp-preview-img-wrap > img { width: 100%; height: auto; display: block; pointer-events: none; }
        room-plan-editor .rp-preview-overlay { grid-area: 1/1; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }
        room-plan-editor .rp-preview-overlay > * { pointer-events: auto; }
        room-plan-editor .rp-editor-dot { position: absolute; width: 44px; height: 44px; left: 0; top: 0;
          transform: translate(-50%,-50%); border-radius: 50%; background: var(--primary-color, #03a9f4); color: white;
          display: flex; align-items: center; justify-content: center; cursor: grab;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25); z-index: 10; user-select: none; touch-action: none;
          border: 3px solid rgba(255,255,255,0.9); }
        room-plan-editor .rp-editor-dot:hover { transform: translate(-50%,-50%) scale(1.08); }
        room-plan-editor .rp-editor-dot:active { cursor: grabbing; }
        room-plan-editor .rp-editor-dot ha-icon { --mdc-icon-size: 22px; }
        room-plan-editor .rp-wall-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; max-height: 120px; overflow-y: auto; }
        room-plan-editor .rp-wall-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.05);
          border-radius: 8px; font-size: 12px; color: var(--secondary-text-color, #9e9e9e); }
        room-plan-editor .rp-wall-row span { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        room-plan-editor .rp-btn-draw { padding: 10px 16px; border-radius: 8px; border: none; background: var(--primary-color, #03a9f4);
          color: white; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        room-plan-editor .rp-btn-draw:hover { opacity: 0.9; }
        room-plan-editor .rp-btn-draw.active { background: #4caf50; }
        room-plan-editor .rp-preview-wrap.draw-mode { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
        room-plan-editor .rp-draw-line { position: absolute; pointer-events: none; z-index: 15; }
        room-plan-editor .rp-editor-wall { cursor: move; }
        room-plan-editor .rp-editor-wall:hover { fill: rgba(120,120,120,0.85); }
        room-plan-editor .rp-wall-handle { cursor: nwse-resize; pointer-events: all; }
        room-plan-editor .rp-wall-handle:hover { fill: #4fc3f7; }
        room-plan-editor .rp-wall-row input[type="number"] { width: 52px; padding: 6px 8px; font-size: 12px; }
        room-plan-editor .rp-wall-row label { display: flex; align-items: center; gap: 4px; }
        room-plan-editor .rp-wall-label { font-size: 11px; color: var(--secondary-text-color); }
      `;
      this.appendChild(style);
    }

    _render() {
      const img = typeof this._config.image === 'string' ? this._config.image : (this._config.image?.location || '');
      const rotation = Number(this._config.rotation) || 0;
      const entities = this._config.entities || [];
      const entityIds = this._hass && this._hass.states ? Object.keys(this._hass.states).sort() : [];

      let html = `
        <div class="rp-editor">
          <div class="rp-section">
            <div class="rp-section-title"><ha-icon icon="mdi:image"></ha-icon> Raumplan-Bild</div>
            <div class="rp-field">
              <label>Bild-URL</label>
              <input type="text" id="rp-image-url" value="${img}" placeholder="/local/raumplan.png" />
              <div class="rp-hint">Bild unter <code>config/www/</code> speichern, dann <code>/local/dateiname.png</code> angeben.</div>
            </div>
            <div class="rp-field rp-field-inline">
              <label>Drehung (Grad)</label>
              <select id="rp-rotation" style="padding: 10px 12px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background: var(--ha-card-background, #1e1e1e); color: var(--primary-text-color, #e1e1e1); font-size: 14px;">
                <option value="0" ${rotation === 0 ? 'selected' : ''}>0°</option>
                <option value="90" ${rotation === 90 ? 'selected' : ''}>90°</option>
                <option value="180" ${rotation === 180 ? 'selected' : ''}>180°</option>
                <option value="270" ${rotation === 270 ? 'selected' : ''}>270°</option>
              </select>
            </div>
          </div>
          <div class="rp-section">
            <div class="rp-section-title"><ha-icon icon="mdi:format-list-bulleted"></ha-icon> Entitäten (Koordinaten per Drag & Drop)</div>
            <div class="rp-entity-list">`;

      entities.forEach((ent, i) => {
        const listId = 'rp-entity-list-' + i;
        const x = Number(ent.x) || 50;
        const y = Number(ent.y) || 50;
        const scale = Math.min(2, Math.max(0.3, Number(ent.scale) || 1));
        const color = ent.color || '';
        html += `<div class="rp-entity-row" data-index="${i}">
          <input type="text" data-field="entity" list="${listId}" value="${ent.entity}" placeholder="light.wohnzimmer" />
          <datalist id="${listId}">${entityIds.slice(0, 200).map(eid => `<option value="${eid}">${getFriendlyName(this._hass, eid)}</option>`).join('')}</datalist>
          <input type="number" data-field="scale" min="0.3" max="2" step="0.1" value="${scale}" placeholder="1" title="Skalierung" />
          <input type="color" data-field="color" value="${color || '#03a9f4'}" title="Farbe" />
          <span class="rp-entity-pos">${x.toFixed(1)}%, ${y.toFixed(1)}%</span>
          <button type="button" class="rp-btn-remove rp-remove-entity" data-index="${i}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </div>`;
      });

      html += `
            </div>
            <button type="button" class="rp-btn-add" id="rp-add-entity"><ha-icon icon="mdi:plus"></ha-icon> Entität hinzufügen</button>
          </div>
          <div class="rp-section">
            <div class="rp-section-title"><ha-icon icon="mdi:gesture"></ha-icon> Position setzen (Entitäten & Wände)</div>
            <div class="rp-hint">Entitäten: Kreise verschieben. Wände: Fläche verschieben, Endpunkte (blaue Punkte) zum Verlängern ziehen.</div>
            <div class="rp-wall-list">`;
      (this._config.walls || []).forEach((wall, i) => {
        const x1 = (Number(wall.x1) || 0).toFixed(1);
        const y1 = (Number(wall.y1) || 0).toFixed(1);
        const x2 = (Number(wall.x2) || 0).toFixed(1);
        const y2 = (Number(wall.y2) || 0).toFixed(1);
        const thick = Math.min(15, Math.max(0.5, Number(wall.thickness) || 2));
        const h = Math.min(25, Math.max(0.5, Number(wall.height) || 8));
        html += `<div class="rp-wall-row" data-wall-index="${i}">
          <span>(${x1},${y1}) → (${x2},${y2})</span>
          <label><span class="rp-wall-label">D:</span><input type="number" class="rp-wall-thickness" data-wall-index="${i}" min="0.5" max="15" step="0.5" value="${thick}" title="Dicke (Prozent)" /></label>
          <label><span class="rp-wall-label">H:</span><input type="number" class="rp-wall-height" data-wall-index="${i}" min="0.5" max="25" step="0.5" value="${h}" title="Höhe (Prozent)" /></label>
          <button type="button" class="rp-btn-remove rp-remove-wall" data-index="${i}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </div>`;
      });
      html += `</div>
            <button type="button" class="rp-btn-draw" id="rp-draw-wall">
              <ha-icon icon="mdi:vector-line"></ha-icon>
              <span id="rp-draw-label">${this._wallDrawMode ? 'Fertig / Abbrechen' : 'Wand einzeichnen'}</span>
            </button>
            <div class="rp-hint rp-draw-hint" id="rp-draw-hint" style="display:${this._wallDrawMode ? 'block' : 'none'}">Klicke Startpunkt, dann Endpunkt auf dem Plan</div>
            <div class="rp-preview-wrap${this._wallDrawMode ? ' draw-mode' : ''}" id="rp-preview">
              <div class="rp-preview-img-wrap" style="transform: rotate(${rotation}deg);">
                <img id="rp-preview-img" src="${img || ''}" alt="Vorschau" onerror="this.style.display='none'" />
              </div>
              <div class="rp-preview-overlay">
              ${this._wallDrawMode ? '<div class="rp-draw-canvas" id="rp-draw-canvas" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:8;cursor:crosshair;"></div>' : ''}`;
      if ((this._config.walls || []).length > 0) {
        html += `<div class="rp-preview-walls" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:5;"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;">`;
        (this._config.walls || []).forEach((wall, wi) => {
          const rect = wallToTopDownRect(wall);
          html += `<polygon class="rp-editor-wall" data-wall-index="${wi}" points="${rect}" fill="rgba(100,100,100,0.7)" stroke="rgba(60,60,60,0.9)" stroke-width="0.15" />`;
          html += `<circle class="rp-wall-handle rp-wall-handle-start" data-wall-index="${wi}" data-end="1" cx="${Number(wall.x1) || 0}" cy="${Number(wall.y1) || 0}" r="1.5" fill="var(--primary-color,#03a9f4)" stroke="#fff" stroke-width="0.3" />`;
          html += `<circle class="rp-wall-handle rp-wall-handle-end" data-wall-index="${wi}" data-end="2" cx="${Number(wall.x2) || 0}" cy="${Number(wall.y2) || 0}" r="1.5" fill="var(--primary-color,#03a9f4)" stroke="#fff" stroke-width="0.3" />`;
        });
        html += `</svg></div>`;
      }

      entities.forEach((ent, i) => {
        const x = Math.min(100, Math.max(0, Number(ent.x) || 50));
        const y = Math.min(100, Math.max(0, Number(ent.y) || 50));
        const scale = Math.min(2, Math.max(0.3, Number(ent.scale) || 1));
        const size = Math.round(44 * scale);
        const iconSize = Math.round(22 * scale);
        const icon = ent.icon || getEntityIcon(this._hass, ent.entity);
        let dotStyle = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;`;
        if (ent.color) dotStyle += `background:${ent.color};`;
        html += `<div class="rp-editor-dot editor-dot" data-index="${i}" style="${dotStyle}" title="${ent.entity}"><ha-icon icon="${icon}" style="--mdc-icon-size:${iconSize}px;"></ha-icon></div>`;
      });

      html += `
              </div>
            </div>
          </div>
        </div>`;

      this.innerHTML = html;

      this.querySelector('#rp-image-url').addEventListener('input', (e) => {
        const v = e.target.value.trim();
        this._config.image = v;
        this.querySelector('#rp-preview-img').src = v || '';
        this._fireConfigChanged(this._config);
      });

      const rotEl = this.querySelector('#rp-rotation');
      if (rotEl) {
        rotEl.addEventListener('change', () => {
          this._config.rotation = Number(rotEl.value) || 0;
          const wrap = this.querySelector('.rp-preview-img-wrap');
          if (wrap) wrap.style.transform = `rotate(${this._config.rotation}deg)`;
          this._fireConfigChanged(this._config);
        });
      }

      this.querySelectorAll('.rp-entity-row input').forEach(input => {
        input.addEventListener('change', () => this._syncEntities());
        input.addEventListener('input', (e) => {
          if (e.target.dataset.field === 'scale' || e.target.dataset.field === 'color') this._syncEntities();
        });
      });

      this.querySelectorAll('.rp-remove-entity').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.index, 10);
          this._config.entities.splice(i, 1);
          this._fireConfigChanged(this._config);
        });
      });

      this.querySelector('#rp-add-entity').addEventListener('click', () => {
        this._config.entities.push({ entity: '', x: 50, y: 50 });
        this._fireConfigChanged(this._config);
      });

      this.querySelector('#rp-draw-wall').addEventListener('click', () => {
        this._wallDrawMode = !this._wallDrawMode;
        this._wallDrawStart = null;
        this._render();
      });

      this.querySelectorAll('.rp-remove-wall').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.index, 10);
          this._config.walls.splice(i, 1);
          this._fireConfigChanged(this._config);
          this._render();
        });
      });

      const preview = this.querySelector('#rp-preview');
      if (preview) {
        preview.querySelectorAll('.editor-dot').forEach(dot => {
          dot.addEventListener('mousedown', (e) => this._startDrag(e, dot));
          dot.addEventListener('touchstart', (e) => this._startDrag(e, dot), { passive: false });
        });
        preview.querySelectorAll('.rp-editor-wall').forEach((el) => {
          el.addEventListener('mousedown', (e) => this._startWallDrag(e, el));
          el.addEventListener('touchstart', (e) => this._startWallDrag(e, el), { passive: false });
        });
        preview.querySelectorAll('.rp-wall-handle').forEach((el) => {
          el.addEventListener('mousedown', (e) => this._startWallHandleDrag(e, el));
          el.addEventListener('touchstart', (e) => this._startWallHandleDrag(e, el), { passive: false });
        });
      }

      this.querySelectorAll('.rp-wall-thickness, .rp-wall-height').forEach((input) => {
        input.addEventListener('input', () => this._syncWallInputs());
        input.addEventListener('change', () => this._syncWallInputs());
      });

      const drawCanvas = this.querySelector('#rp-draw-canvas');
      if (drawCanvas && this._wallDrawMode) {
        drawCanvas.addEventListener('click', (e) => this._onWallDrawClick(e));
        drawCanvas.addEventListener('mousemove', (e) => this._onWallDrawMove(e));
      }

      if (!this._dragListenersAdded) {
        this._dragListenersAdded = true;
        document.addEventListener('mousemove', (e) => this._onDrag(e));
        document.addEventListener('mouseup', () => this._endDrag());
        document.addEventListener('touchmove', (e) => this._onDrag(e), { passive: false });
        document.addEventListener('touchend', () => this._endDrag());
      }

      this._injectEditorStyles();
    }

    _syncEntities() {
      const rows = this.querySelectorAll('.rp-entity-row');
      const entities = [];
      rows.forEach((row, i) => {
        const entityInput = row.querySelector('input[data-field="entity"]');
        const scaleInput = row.querySelector('input[data-field="scale"]');
        const colorInput = row.querySelector('input[data-field="color"]');
        const ent = this._config.entities[i] || {};
        const scale = scaleInput ? Math.min(2, Math.max(0.3, Number(scaleInput.value) || 1)) : (ent.scale ?? 1);
        const colorVal = colorInput?.value?.trim() || '';
        const hadColor = !!ent.color;
        const color = (colorVal && (colorVal !== '#03a9f4' || hadColor)) ? colorVal : undefined;
        entities.push({
          entity: (entityInput?.value || '').trim() || ent.entity || '',
          x: ent.x ?? 50,
          y: ent.y ?? 50,
          icon: ent.icon,
          scale: scale,
          color: color
        });
      });
      this._config.entities = entities;
      this._fireConfigChanged(this._config);
    }

    _startDrag(ev, dot) {
      ev.preventDefault();
      ev.stopPropagation();
      const idx = parseInt(dot.dataset.index, 10);
      const ent = this._config.entities[idx];
      if (!ent) return;
      const rect = this._getPreviewRect();
      if (!rect) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const leftPct = (clientX - rect.left) / rect.width * 100;
      const topPct = (clientY - rect.top) / rect.height * 100;
      this._dragOffset = { x: leftPct - (Number(ent.x) || 50), y: topPct - (Number(ent.y) || 50) };
      this._dragging = { type: 'entity', index: idx, element: dot };
    }

    _startWallDrag(ev, el) {
      if (this._wallDrawMode) return;
      ev.preventDefault();
      ev.stopPropagation();
      const idx = parseInt(el.dataset.wallIndex, 10);
      const wall = this._config.walls[idx];
      if (!wall) return;
      const rect = this._getPreviewRect();
      if (!rect) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const curX = (clientX - rect.left) / rect.width * 100;
      const curY = (clientY - rect.top) / rect.height * 100;
      const cx = ((Number(wall.x1) || 0) + (Number(wall.x2) || 0)) / 2;
      const cy = ((Number(wall.y1) || 0) + (Number(wall.y2) || 0)) / 2;
      this._dragOffset = { x: curX - cx, y: curY - cy };
      this._dragging = { type: 'wall', index: idx, element: el };
    }

    _startWallHandleDrag(ev, el) {
      if (this._wallDrawMode) return;
      ev.preventDefault();
      ev.stopPropagation();
      const idx = parseInt(el.dataset.wallIndex, 10);
      const end = parseInt(el.dataset.end, 10);
      this._dragging = { type: 'wallEnd', index: idx, end, element: el };
    }

    _getPreviewRect() {
      const overlay = this.querySelector('.rp-preview-overlay');
      const preview = this.querySelector('#rp-preview');
      const wrap = overlay || preview;
      return wrap ? wrap.getBoundingClientRect() : null;
    }

    _onDrag(ev) {
      if (!this._dragging) return;
      if (!this._dragging.element.isConnected) { this._dragging = null; return; }
      ev.preventDefault();
      const rect = this._getPreviewRect();
      if (!rect || rect.width === 0) return;
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      let x = (clientX - rect.left) / rect.width * 100;
      let y = (clientY - rect.top) / rect.height * 100;
      x = Math.min(100, Math.max(0, x));
      y = Math.min(100, Math.max(0, y));

      if (this._dragging.type === 'entity') {
        x -= this._dragOffset.x;
        y -= this._dragOffset.y;
        x = Math.min(100, Math.max(0, x));
        y = Math.min(100, Math.max(0, y));
        const ent = this._config.entities[this._dragging.index];
        ent.x = Math.round(x * 10) / 10;
        ent.y = Math.round(y * 10) / 10;
        this._dragging.element.style.left = ent.x + '%';
        this._dragging.element.style.top = ent.y + '%';
        const posSpan = this.querySelectorAll('.rp-entity-pos')[this._dragging.index];
        if (posSpan) posSpan.textContent = ent.x.toFixed(1) + '%, ' + ent.y.toFixed(1) + '%';
      } else if (this._dragging.type === 'wall') {
        x -= this._dragOffset.x;
        y -= this._dragOffset.y;
        const wall = this._config.walls[this._dragging.index];
        const cx = ((Number(wall.x1) || 0) + (Number(wall.x2) || 0)) / 2;
        const cy = ((Number(wall.y1) || 0) + (Number(wall.y2) || 0)) / 2;
        const dx = x - cx, dy = y - cy;
        wall.x1 = Math.round((Number(wall.x1) + dx) * 10) / 10;
        wall.y1 = Math.round((Number(wall.y1) + dy) * 10) / 10;
        wall.x2 = Math.round((Number(wall.x2) + dx) * 10) / 10;
        wall.y2 = Math.round((Number(wall.y2) + dy) * 10) / 10;
        wall.x1 = Math.min(100, Math.max(0, wall.x1));
        wall.y1 = Math.min(100, Math.max(0, wall.y1));
        wall.x2 = Math.min(100, Math.max(0, wall.x2));
        wall.y2 = Math.min(100, Math.max(0, wall.y2));
        this._updateWallInPreview(this._dragging.index);
      } else if (this._dragging.type === 'wallEnd') {
        const wall = this._config.walls[this._dragging.index];
        if (this._dragging.end === 1) {
          wall.x1 = Math.round(x * 10) / 10;
          wall.y1 = Math.round(y * 10) / 10;
        } else {
          wall.x2 = Math.round(x * 10) / 10;
          wall.y2 = Math.round(y * 10) / 10;
        }
        wall.x1 = Math.min(100, Math.max(0, Number(wall.x1)));
        wall.y1 = Math.min(100, Math.max(0, Number(wall.y1)));
        wall.x2 = Math.min(100, Math.max(0, Number(wall.x2)));
        wall.y2 = Math.min(100, Math.max(0, Number(wall.y2)));
        this._updateWallInPreview(this._dragging.index);
      }
    }

    _updateWallInPreview(idx) {
      const wall = this._config.walls[idx];
      if (!wall) return;
      const polygon = this.querySelector(`.rp-editor-wall[data-wall-index="${idx}"]`);
      const h1 = this.querySelector(`.rp-wall-handle-start[data-wall-index="${idx}"]`);
      const h2 = this.querySelector(`.rp-wall-handle-end[data-wall-index="${idx}"]`);
      if (polygon) polygon.setAttribute('points', wallToTopDownRect(wall));
      if (h1) { h1.setAttribute('cx', wall.x1); h1.setAttribute('cy', wall.y1); }
      if (h2) { h2.setAttribute('cx', wall.x2); h2.setAttribute('cy', wall.y2); }
      const row = this.querySelector(`.rp-wall-row[data-wall-index="${idx}"] span`);
      if (row) row.textContent = `(${Number(wall.x1).toFixed(1)},${Number(wall.y1).toFixed(1)}) → (${Number(wall.x2).toFixed(1)},${Number(wall.y2).toFixed(1)})`;
    }

    _syncWallInputs() {
      this.querySelectorAll('.rp-wall-row').forEach((row, i) => {
        const wall = this._config.walls[i];
        if (!wall) return;
        const thickIn = row.querySelector('.rp-wall-thickness');
        const heightIn = row.querySelector('.rp-wall-height');
        if (thickIn) wall.thickness = Math.min(15, Math.max(0.5, Number(thickIn.value) || 2));
        if (heightIn) wall.height = Math.min(25, Math.max(0.5, Number(heightIn.value) || 8));
      });
      this._fireConfigChanged(this._config);
      this._config.walls.forEach((_, i) => this._updateWallInPreview(i));
    }

    _endDrag() {
      if (this._dragging) {
        this._fireConfigChanged(this._config);
        this._dragging = null;
      }
    }

    _onWallDrawClick(ev) {
      if (!this._wallDrawMode) return;
      ev.preventDefault();
      const canvas = this.querySelector('#rp-draw-canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const x = Math.min(100, Math.max(0, (clientX - rect.left) / rect.width * 100));
      const y = Math.min(100, Math.max(0, (clientY - rect.top) / rect.height * 100));
      if (this._wallDrawStart === null) {
        this._wallDrawStart = { x, y };
        return;
      }
      const dx = x - this._wallDrawStart.x;
      const dy = y - this._wallDrawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) < 1) {
        this._wallDrawStart = null;
        return;
      }
      this._config.walls = this._config.walls || [];
      this._config.walls.push({
        x1: Math.round(this._wallDrawStart.x * 10) / 10,
        y1: Math.round(this._wallDrawStart.y * 10) / 10,
        x2: Math.round(x * 10) / 10,
        y2: Math.round(y * 10) / 10,
        thickness: 2,
        height: 8
      });
      this._wallDrawStart = null;
      this._fireConfigChanged(this._config);
      this._render();
    }

    _onWallDrawMove(ev) {
      if (!this._wallDrawMode || !this._wallDrawStart) return;
      const canvas = this.querySelector('#rp-draw-canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const x = (clientX - rect.left) / rect.width * 100;
      const y = (clientY - rect.top) / rect.height * 100;
      let line = canvas.querySelector('.rp-draw-line');
      if (!line) {
        line = document.createElement('div');
        line.className = 'rp-draw-line';
        line.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:15;';
        canvas.appendChild(line);
      }
      const x1 = this._wallDrawStart.x, y1 = this._wallDrawStart.y;
      line.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;"><line x1="${x1}" y1="${y1}" x2="${x}" y2="${y}" stroke="var(--primary-color,#03a9f4)" stroke-width="0.5" stroke-dasharray="2,2"/></svg>`;
    }
  }

  customElements.define(CARD_TAG, RoomPlanCard);
  customElements.define(EDITOR_TAG, RoomPlanEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'custom:' + CARD_TAG,
    name: 'Interaktiver Raumplan',
    description: 'Raumplan als Bild mit Entitäten per Koordinaten (x,y). Kreise mit Icons, Drag & Drop.',
    preview: true
  });
})();
