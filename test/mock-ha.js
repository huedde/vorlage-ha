/**
 * Mock Home Assistant Komponenten für lokales Testen
 */
(function () {
  if (!document.querySelector('[data-mdi-loaded]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';
    link.dataset.mdiLoaded = '1';
    document.head.appendChild(link);
  }

  class HaCard extends HTMLElement {
    connectedCallback() {
      this.style.cssText = 'display: block; overflow: hidden; border-radius: 12px; ' +
        'background: var(--ha-card-background, var(--card-background-color, rgba(30,30,30,0.95))); ' +
        'box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);';
    }
  }

  class HaIcon extends HTMLElement {
    static get observedAttributes() { return ['icon']; }
    connectedCallback() {
      const icon = this.getAttribute('icon') || 'mdi:circle';
      const mdiClass = 'mdi-' + (icon.replace('mdi:', '').replace(/-/g, '_'));
      const size = getComputedStyle(this).getPropertyValue('--mdc-icon-size') || '24px';
      this.innerHTML = `<span class="mdi ${mdiClass}" style="font-size:${size};display:inline-block;width:1em;height:1em;line-height:1;color:inherit;"></span>`;
    }
    attributeChangedCallback() { this.connectedCallback(); }
  }

  customElements.define('ha-card', HaCard);
  customElements.define('ha-icon', HaIcon);
})();
