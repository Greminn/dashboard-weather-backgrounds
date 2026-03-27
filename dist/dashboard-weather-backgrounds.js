/**
 * Dashboard Weather Backgrounds
 * A HACS frontend plugin for Home Assistant
 * https://github.com/Greminn/dashboard-weather-backgrounds
 *
 * Watches a weather entity and injects an animated background
 * iframe into configured dashboard views.
 */

const PLUGIN_NAME = "dashboard-weather-backgrounds";
const STORAGE_KEY = `${PLUGIN_NAME}-config`;
const VERSION = "1.0.0";

// Default weather state → background file mappings
const DEFAULT_MAPPINGS = {
  "sunny":        "sunny.html",
  "clear-night":  "sunny.html",
  "partlycloudy": "cloudy.html",
  "cloudy":       "cloudy.html",
  "rainy":        "rainy.html",
  "pouring":      "rainy.html",
  "snowy":        "snowy.html",
  "snowy-rainy":  "snowy.html",
  "lightning":    "stormy.html",
  "lightning-rainy": "stormy.html",
  "hail":         "stormy.html",
  "exceptional":  "stormy.html",
  "fog":          "foggy.html",
  "windy":        "foggy.html",
  "windy-variant":"foggy.html",
};

// Default config
const DEFAULT_CONFIG = {
  weather_entity: "",
  backgrounds_path: "/local/backgrounds",
  mappings: DEFAULT_MAPPINGS,
  views: [],        // empty = apply to all views
  opacity: 1.0,
  enabled: true,
};

class DashboardWeatherBackgrounds {
  constructor() {
    this.config = this._loadConfig();
    this.currentState = null;
    this.currentIframe = null;
    this.hass = null;
    this.unsubscribe = null;
    this.observer = null;
    this._init();
  }

  // ─── Config persistence ───────────────────────────────────────────────────

  _loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults so new keys always exist
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          mappings: { ...DEFAULT_MAPPINGS, ...(parsed.mappings || {}) },
        };
      }
    } catch (e) {
      console.warn(`[${PLUGIN_NAME}] Failed to load config:`, e);
    }
    return { ...DEFAULT_CONFIG, mappings: { ...DEFAULT_MAPPINGS } };
  }

  saveConfig(config) {
    this.config = { ...this.config, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    console.info(`[${PLUGIN_NAME}] Config saved.`);
    this._applyBackground();
  }

  // ─── Initialisation ───────────────────────────────────────────────────────

  async _init() {
    console.info(`[${PLUGIN_NAME}] v${VERSION} initialising...`);

    // Wait for HA to be ready
    await this._waitForHass();
    await this._subscribeToWeather();

    // Watch for view/navigation changes
    this._watchNavigation();

    console.info(`[${PLUGIN_NAME}] Ready.`);
  }

  _waitForHass() {
    return new Promise((resolve) => {
      const check = () => {
        const panel = document.querySelector("home-assistant");
        if (panel && panel.hass) {
          this.hass = panel.hass;
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  // ─── WebSocket subscription ───────────────────────────────────────────────

  async _subscribeToWeather() {
    if (!this.config.weather_entity) {
      console.warn(`[${PLUGIN_NAME}] No weather entity configured. Open the config panel to set one.`);
      return;
    }

    // Use HA's built-in connection from the hass object
    const conn = this.hass.connection;

    // Subscribe to state changes for the weather entity
    this.unsubscribe = await conn.subscribeMessage(
      (event) => {
        if (
          event.event_type === "state_changed" &&
          event.data.entity_id === this.config.weather_entity
        ) {
          const newState = event.data.new_state?.state;
          if (newState && newState !== this.currentState) {
            console.info(`[${PLUGIN_NAME}] Weather changed: ${this.currentState} → ${newState}`);
            this.currentState = newState;
            this._applyBackground();
          }
        }
      },
      { type: "subscribe_events", event_type: "state_changed" }
    );

    // Get the current state immediately
    const state = this.hass.states[this.config.weather_entity];
    if (state) {
      this.currentState = state.state;
      this._applyBackground();
    }
  }

  // ─── Navigation watcher ───────────────────────────────────────────────────

  _watchNavigation() {
    // Re-apply background when the URL changes (view navigation)
    window.addEventListener("location-changed", () => {
      setTimeout(() => this._applyBackground(), 300);
    });

    window.addEventListener("popstate", () => {
      setTimeout(() => this._applyBackground(), 300);
    });

    // Also watch DOM for view element appearing
    this.observer = new MutationObserver(() => {
      if (this._getViewElement() && !this.currentIframe?.isConnected) {
        this._applyBackground();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ─── Background injection ─────────────────────────────────────────────────

  _getCurrentViewPath() {
    // Extract view path from URL e.g. /lovelace/kitchen-tablet → kitchen-tablet
    const match = window.location.pathname.match(/\/(?:lovelace|dashboard-[^/]+)\/([^/?]+)/);
    return match ? match[1] : null;
  }

  _shouldApplyToCurrentView() {
    if (!this.config.views || this.config.views.length === 0) {
      return true; // Apply to all views if none specified
    }
    const currentPath = this._getCurrentViewPath();
    return this.config.views.includes(currentPath);
  }

  _getBackgroundUrl() {
    if (!this.currentState) return null;
    const filename = this.config.mappings[this.currentState];
    if (!filename) return null;
    return `${this.config.backgrounds_path}/${filename}`;
  }

  _getViewElement() {
    // Try to find the main view/panel element
    return (
      document.querySelector("hui-sections-view") ||
      document.querySelector("hui-masonry-view") ||
      document.querySelector("hui-panel-view") ||
      document.querySelector("hui-sidebar-view")
    );
  }

  _removeExistingBackground() {
    const existing = document.getElementById(`${PLUGIN_NAME}-iframe`);
    if (existing) existing.remove();
    this.currentIframe = null;
  }

  _applyBackground() {
    this._removeExistingBackground();

    if (!this.config.enabled) return;
    if (!this._shouldApplyToCurrentView()) return;

    const url = this._getBackgroundUrl();
    if (!url) {
      console.warn(`[${PLUGIN_NAME}] No background mapped for state: ${this.currentState}`);
      return;
    }

    // Inject a style tag to make HA transparent and set up layering
    this._injectStyles();

    const iframe = document.createElement("iframe");
    iframe.id = `${PLUGIN_NAME}-iframe`;
    iframe.src = url;
    iframe.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      border: none !important;
      z-index: 1 !important;
      pointer-events: none !important;
      opacity: ${this.config.opacity} !important;
    `;

    // Insert before everything else in body
    document.body.insertBefore(iframe, document.body.firstChild);
    this.currentIframe = iframe;

    console.info(`[${PLUGIN_NAME}] Applied background: ${url}`);
  }

  _injectStyles() {
    // Remove any existing style tag
    const existing = document.getElementById(`${PLUGIN_NAME}-styles`);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = `${PLUGIN_NAME}-styles`;
    style.textContent = `
      html, body {
        background: transparent !important;
        background-color: transparent !important;
      }
      home-assistant {
        position: relative !important;
        z-index: 2 !important;
        background: transparent !important;
        background-color: transparent !important;
      }
      body > #${PLUGIN_NAME}-iframe {
        z-index: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Config Panel (sidebar UI) ────────────────────────────────────────────────

class WeatherBackgroundsConfigPanel extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  get plugin() {
    return window._dashboardWeatherBackgrounds;
  }

  render() {
    const config = this.plugin?.config || DEFAULT_CONFIG;

    this.innerHTML = `
      <style>
        :host { display: block; }
        .panel {
          max-width: 640px;
          margin: 24px auto;
          padding: 0 16px;
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
          color: var(--primary-text-color);
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 400;
          margin-bottom: 4px;
          color: var(--primary-text-color);
        }
        .subtitle {
          color: var(--secondary-text-color);
          font-size: 0.875rem;
          margin-bottom: 24px;
        }
        .card {
          background: var(--card-background-color, #fff);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 16px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.1));
        }
        .card h2 {
          font-size: 1rem;
          font-weight: 500;
          margin: 0 0 16px;
          color: var(--primary-text-color);
        }
        label {
          display: block;
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
          margin-top: 12px;
        }
        input[type="text"], input[type="number"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 8px;
          background: var(--input-fill-color, transparent);
          color: var(--primary-text-color);
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        input[type="range"] {
          width: 100%;
          margin-top: 8px;
        }
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
        }
        .toggle-row span {
          font-size: 0.9rem;
        }
        .mapping-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .mapping-row {
          display: contents;
        }
        .mapping-label {
          padding: 8px 12px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
        }
        .mapping-input input {
          margin-top: 0;
        }
        .save-btn {
          background: var(--primary-color, #03a9f4);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 0.9rem;
          cursor: pointer;
          width: 100%;
          margin-top: 8px;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        .save-btn:hover { opacity: 0.9; }
        .status {
          text-align: center;
          font-size: 0.8rem;
          color: var(--success-color, green);
          margin-top: 8px;
          min-height: 20px;
        }
        .views-hint {
          font-size: 0.78rem;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .version {
          text-align: center;
          font-size: 0.75rem;
          color: var(--disabled-text-color);
          margin-top: 24px;
        }
      </style>

      <div class="panel">
        <h1>Dashboard Weather Backgrounds</h1>
        <p class="subtitle">Animated weather backgrounds for your HA dashboards</p>

        <div class="card">
          <h2>General</h2>

          <div class="toggle-row">
            <span>Enable backgrounds</span>
            <ha-switch id="enabled" ${config.enabled ? "checked" : ""}></ha-switch>
          </div>

          <label>Weather Entity</label>
          <input type="text" id="weather_entity" value="${config.weather_entity}"
            placeholder="e.g. weather.metservice" />

          <label>Backgrounds Path</label>
          <input type="text" id="backgrounds_path" value="${config.backgrounds_path}"
            placeholder="/local/backgrounds" />

          <label>Views to apply background (comma separated paths, leave blank for all)</label>
          <input type="text" id="views" value="${(config.views || []).join(", ")}"
            placeholder="e.g. kitchen-tablet, lounge" />
          <p class="views-hint">Use the view path from the URL, e.g. for /lovelace/kitchen-tablet enter kitchen-tablet</p>

          <label>Background Opacity: <span id="opacity-value">${config.opacity}</span></label>
          <input type="range" id="opacity" min="0.1" max="1" step="0.05" value="${config.opacity}" />
        </div>

        <div class="card">
          <h2>Weather State Mappings</h2>
          <div class="mapping-grid">
            ${Object.entries(config.mappings).map(([state, file]) => `
              <div class="mapping-label">${state}</div>
              <div class="mapping-input">
                <input type="text" data-state="${state}" value="${file}" placeholder="filename.html" />
              </div>
            `).join("")}
          </div>
        </div>

        <button class="save-btn" id="save">Save Configuration</button>
        <div class="status" id="status"></div>
        <div class="version">v${VERSION} · Dashboard Weather Backgrounds</div>
      </div>
    `;

    // Opacity slider live update
    const opacitySlider = this.querySelector("#opacity");
    const opacityValue = this.querySelector("#opacity-value");
    opacitySlider.addEventListener("input", () => {
      opacityValue.textContent = opacitySlider.value;
    });

    // Save button
    this.querySelector("#save").addEventListener("click", () => {
      const mappings = {};
      this.querySelectorAll("[data-state]").forEach((el) => {
        if (el.value.trim()) mappings[el.dataset.state] = el.value.trim();
      });

      const viewsRaw = this.querySelector("#views").value;
      const views = viewsRaw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const newConfig = {
        enabled: this.querySelector("#enabled").checked,
        weather_entity: this.querySelector("#weather_entity").value.trim(),
        backgrounds_path: this.querySelector("#backgrounds_path").value.trim(),
        views,
        opacity: parseFloat(this.querySelector("#opacity").value),
        mappings,
      };

      this.plugin?.saveConfig(newConfig);

      const status = this.querySelector("#status");
      status.textContent = "✓ Saved! Reload the page to apply changes.";
      setTimeout(() => (status.textContent = ""), 4000);
    });
  }
}

// ─── Register config panel ────────────────────────────────────────────────────

customElements.define("weather-backgrounds-config-panel", WeatherBackgroundsConfigPanel);

// Register as a HA panel so it appears in the sidebar
window.customPanels = window.customPanels || [];
window.customPanels.push({
  component_name: "weather-backgrounds-config-panel",
  sidebar_title: "Weather Backgrounds",
  sidebar_icon: "mdi:weather-partly-cloudy",
  url_path: "weather-backgrounds-config",
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

window._dashboardWeatherBackgrounds = new DashboardWeatherBackgrounds();

console.info(
  `%c DASHBOARD WEATHER BACKGROUNDS %c v${VERSION} `,
  "background:#1a3a6b;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:bold;",
  "background:#e8832a;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0;"
);