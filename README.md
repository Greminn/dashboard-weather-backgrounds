# Dashboard Weather Backgrounds

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

Animated weather backgrounds for Home Assistant dashboards. Watches a weather entity and automatically displays a matching animated background across your configured dashboard views.

![Stormy background example](https://raw.githubusercontent.com/Greminn/dashboard-weather-backgrounds/main/docs/stormy-preview.png)

---

## Features

- 🌤️ Automatically switches background based on your weather entity state
- 🎨 Six included animated backgrounds: Sunny, Cloudy, Rainy, Snowy, Stormy, Foggy
- ⚙️ Configure via a sidebar UI panel — no YAML editing required
- 🔁 Apply to all views or restrict to specific dashboard paths
- 💧 Adjustable opacity

---

## Installation

### Via HACS (Recommended)

1. Open HACS → Frontend
2. Click the three-dot menu → **Custom Repositories**
3. Add `https://github.com/Greminn/dashboard-weather-backgrounds` as a **Frontend** repository
4. Search for **Dashboard Weather Backgrounds** and install
5. Add the resource to your dashboard (HACS does this automatically on newer versions)

### Manual

1. Copy `dist/dashboard-weather-backgrounds.js` to your `/config/www/` folder
2. Add it as a frontend resource in Settings → Dashboards → Resources:
   ```
   URL: /local/dashboard-weather-backgrounds.js
   Type: JavaScript module
   ```

---

## Background Files

Copy the included background HTML files to `/config/www/backgrounds/`:

| File | Weather Conditions |
|---|---|
| `sunny.html` | Sunny, Clear Night |
| `cloudy.html` | Cloudy, Partly Cloudy |
| `rainy.html` | Rainy, Drizzle, Pouring |
| `snowy.html` | Snowy |
| `stormy.html` | Lightning, Hail, Exceptional |
| `foggy.html` | Fog, Windy |

You can use your own HTML/CSS animated backgrounds — just reference the filename in the config panel.

---

## Configuration

After installation, a **Weather Backgrounds** entry will appear in your HA sidebar.

### Settings

| Setting | Description | Default |
|---|---|---|
| **Enable backgrounds** | Toggle the plugin on/off | `true` |
| **Weather Entity** | The entity ID to watch | _(required)_ |
| **Backgrounds Path** | Where your HTML files live | `/local/backgrounds` |
| **Views** | Comma-separated view paths to apply to. Leave blank for all views | _(all views)_ |
| **Opacity** | Background opacity (0.1–1.0) | `1.0` |
| **Weather State Mappings** | Map weather states to background filenames | _(see defaults)_ |

### Example view paths

If your dashboard URL is `/lovelace/kitchen-tablet`, enter `kitchen-tablet` in the Views field.

---

## MetService NZ State Mappings

If you use the MetService NZ integration, add these mappings in the config panel:

| MetService State | Maps To |
|---|---|
| fine | sunny |
| partly-cloudy | partlycloudy |
| mostly-cloudy | cloudy |
| rain | pouring |
| drizzle / few-showers | rainy |
| snow | snowy |
| thunder | lightning |
| wind-rain | exceptional |
| fog | fog |
| windy | windy |

The mappings are already pre-configured for standard HA weather states. MetService states are automatically translated to HA states by the integration before reaching this plugin.

---

## Troubleshooting

**Background not showing:**
- Check that your HTML files are accessible at `http://homeassistant.local:8123/local/backgrounds/sunny.html`
- Confirm the weather entity state in Developer Tools → States
- Open the browser console and look for `[dashboard-weather-backgrounds]` log messages

**Background shows on all views when I only want it on one:**
- Enter the view path(s) in the Views field in the config panel

**Background not switching when weather changes:**
- Verify the weather entity ID is correct in the config panel
- Check the state value matches one of the mapped states

---

## Contributing

PRs welcome! If you create custom backgrounds, feel free to submit them for inclusion.

---

## License

MIT License — see [LICENSE](LICENSE)
