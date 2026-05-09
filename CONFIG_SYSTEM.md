# ShiftController Configuration System

## Overview

The ShiftController extension features a powerful, server-driven configuration system that allows real-time control over styling, branding, feature toggles, and extension lifecycle (including a kill switch for disabling the extension remotely).

All visual decisions, branding elements, and feature flags flow through a remote configuration file that is fetched and cached locally.

## Configuration Flow

```
1. Extension loads
   ↓
2. Popup/Service Worker calls loadConfig()
   ↓
3. Try fetch https://nayem.net/shiftcontroller/config.json
   ↓
   ├─ Success → Cache & apply immediately
   ├─ Fail → Use cached version (if available)
   └─ No cache → Use DEFAULT_CONFIG
   ↓
4. Apply theme, branding, and features
   ↓
5. Check kill_switch.active
   ├─ true → Handle based on mode (silent/message/brick)
   └─ false → Render normal UI
```

## Configuration File Structure

### Minimal Valid Config

```json
{
  "kill_switch": {
    "active": false
  }
}
```

All other values will use defaults.

### Full Configuration Example

```json
{
  "kill_switch": {
    "active": false,
    "mode": "silent",
    "message": "Extension is under maintenance",
    "brick_message": "This extension is no longer available.",
    "wipe_data": false,
    "disable_content_scripts": false
  },
  
  "branding": {
    "company_name": "ShiftController",
    "company_tagline": "Record any clickable element. Map it to a shortcut.",
    "website_url": "https://ShiftController.nayem.net",
    "author_name": "Nayem Hasan",
    "author_url": "https://nayem.net",
    "show_author": true,
    "logo_type": "builtin_bolt",
    "logo_url": null,
    "logo_svg_string": null
  },
  
  "theme": {
    "preset": "dark_neon",
    "base_mode": "dark",
    "color_bg": "#0d0d0d",
    "color_surface": "#141414",
    "color_surface2": "#1c1c1c",
    "color_border": "rgba(255,255,255,0.08)",
    "color_accent": "#a3ff00",
    "color_accent_dim": "rgba(163,255,0,0.15)",
    "color_accent_glow": "rgba(163,255,0,0.4)",
    "color_text": "#f0f0f0",
    "color_text_muted": "#aaaaaa",
    "color_danger": "#ff4444",
    "border_radius": "10px",
    "sharp_mode": false
  },
  
  "typography": {
    "font_family": "'Montserrat', system-ui, sans-serif",
    "font_url": "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",
    "heading_weight": "700",
    "heading_tracking": "-0.02em",
    "heading_leading": "1.1",
    "body_size": "13px",
    "body_weight": "400",
    "body_leading": "1.5",
    "mono_family": "monospace"
  },
  
  "layout": {
    "popup_width": "340px",
    "popup_min_height": "420px",
    "section_padding": "12px 16px",
    "sharp_corners": false
  },
  
  "animations": {
    "enabled": true,
    "entry_fade": true,
    "entry_slide_y": "12px",
    "duration_fast": "150ms",
    "duration_normal": "300ms",
    "duration_slow": "700ms",
    "hover_scale": "1.03",
    "image_hover_scale": "1.05"
  },
  
  "features": {
    "show_shortcut_hints": true,
    "show_domain_toggle": true,
    "show_analytics": false,
    "show_developer_panel": true,
    "consent_required": true,
    "record_hotkey": "shift+s",
    "stop_hotkey": "Escape"
  }
}
```

## Key Configuration Sections

### Kill Switch (Control Extension Lifecycle)

**Purpose**: Remotely enable/disable the extension

- `active` (boolean): Activates the kill switch
- `mode` (string): How to handle deactivation
  - `"silent"`: Silently disable, show blank popup
  - `"message"`: Show maintenance message to user
  - `"brick"`: Permanently brick extension with tombstone UI
- `message`: Message shown in "message" mode
- `brick_message`: Message shown in "brick" mode
- `wipe_data` (boolean): Clear all local storage on activation
- `disable_content_scripts` (boolean): Disable content script execution

**Example**: Activate maintenance mode

```json
{
  "kill_switch": {
    "active": true,
    "mode": "message",
    "message": "ShiftController is currently under maintenance. We'll be back soon!"
  }
}
```

### Branding (Customize Company Identity)

**Purpose**: Change company name, logos, links, and credits

- `company_name`: Display name (can be multi-word)
- `website_url`: Link when clicking logo
- `author_name`: Name shown in credit line
- `author_url`: Link for author credit
- `show_author` (boolean): Show/hide author line
- `logo_type`: How to display logo
  - `"builtin_bolt"`: Lightning bolt SVG (default)
  - `"builtin_shield"`: Shield SVG
  - `"builtin_zap"`: Zap/lightning SVG
  - `"url"`: Load from `logo_url`
  - `"svg_inline"`: Inject `logo_svg_string` directly

**Example**: Custom branding

```json
{
  "branding": {
    "company_name": "My Automation Suite",
    "website_url": "https://mycompany.com/automation",
    "author_name": "MyTeam",
    "author_url": "https://mycompany.com",
    "show_author": true,
    "logo_type": "url",
    "logo_url": "https://mycompany.com/logo.svg"
  }
}
```

### Theme (Control Colors & Appearance)

**Purpose**: Restyle entire UI with custom colors and modes

#### Using Presets

Set `preset` to one of:
- `"dark_neon"` (DEFAULT): Neon green on dark
- `"dark_orange"`: Orange premium aesthetic
- `"dark_charcoal"`: Minimal charcoal
- `"midnight_blue"`: Cool blue palette
- `"forest_dark"`: Green forest aesthetic
- `"pure_white"`: Clean white design

```json
{ "theme": { "preset": "dark_orange" } }
```

#### Custom Colors

Preset + individual overrides:

```json
{
  "theme": {
    "preset": "dark_neon",
    "color_accent": "#ff5a36",
    "color_accent_glow": "rgba(255,90,54,0.4)"
  }
}
```

**Individual color options**:
- `color_bg`: Main background
- `color_surface`: Card/surface backgrounds
- `color_surface2`: Secondary surface (hover states)
- `color_border`: Border color
- `color_accent`: Primary accent (CTA buttons, highlights)
- `color_accent_dim`: Dimmed accent (hover states)
- `color_accent_glow`: Glow/shadow accent
- `color_text`: Primary text
- `color_text_muted`: Muted/secondary text
- `color_danger`: Error/delete color
- `border_radius`: Button/card corner radius (ignored if `sharp_mode: true`)
- `sharp_mode`: Remove all border-radius (zero-radius design)

**Light Mode**:

```json
{
  "theme": {
    "base_mode": "light",
    "color_bg": "#f5f5f5",
    "color_surface": "#ffffff",
    "color_text": "#1a1a1a"
  }
}
```

### Typography (Control Fonts & Text)

**Purpose**: Customize fonts and text appearance

- `font_family`: Font stack CSS string
- `font_url`: Google Fonts or custom font URL (auto-injected)
- `heading_weight`: Font weight for headings (400-900)
- `heading_tracking`: Letter spacing for headings (e.g., "-0.02em")
- `heading_leading`: Line height for headings
- `body_size`: Base font size (e.g., "13px")
- `body_weight`: Font weight for body text
- `body_leading`: Line height for body text
- `mono_family`: Monospace font for code/shortcuts

**Example**: Premium typography

```json
{
  "typography": {
    "font_family": "'Montserrat', system-ui, sans-serif",
    "font_url": "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap",
    "heading_weight": "600",
    "heading_tracking": "-0.03em",
    "heading_leading": "1.05",
    "body_size": "14px",
    "body_weight": "400",
    "body_leading": "1.6"
  }
}
```

### Layout (Control Dimensions)

**Purpose**: Customize popup size and spacing

- `popup_width`: Popup window width (e.g., "380px")
- `popup_min_height`: Minimum popup height (e.g., "480px")
- `section_padding`: Padding for content sections (e.g., "16px 20px")

### Animations (Control Motion)

**Purpose**: Configure transitions and motion effects

- `enabled`: Master switch for all animations
- `entry_fade`: Fade-in on element appearance
- `entry_slide_y`: Distance to slide on entry (e.g., "12px")
- `duration_fast`: Fast transition duration (e.g., "150ms")
- `duration_normal`: Normal transition duration (e.g., "300ms")
- `duration_slow`: Slow animation duration (e.g., "700ms")
- `hover_scale`: Scale factor on hover (e.g., "1.03" = 3% larger)
- `image_hover_scale`: Scale for image hovers (e.g., "1.05")

**Disable all animations**:

```json
{ "animations": { "enabled": false } }
```

### Features (Control Functionality)

**Purpose**: Enable/disable extension features and UI elements

- `show_shortcut_hints` (boolean): Show keyboard hint strip
- `show_domain_toggle` (boolean): Show domain on/off toggle
- `show_analytics` (boolean): Show analytics panel
- `show_developer_panel` (boolean): Show developer tab
- `consent_required` (boolean): Require consent before using
- `record_hotkey` (string): Keyboard shortcut to start recording (e.g., "shift+s")
- `stop_hotkey` (string): Keyboard shortcut to stop recording (e.g., "Escape")

**Example**: Minimal feature set

```json
{
  "features": {
    "show_shortcut_hints": false,
    "show_domain_toggle": false,
    "show_developer_panel": false,
    "consent_required": false,
    "record_hotkey": "ctrl+shift+r",
    "stop_hotkey": "Escape"
  }
}
```

## Configuration Precedence

1. **Hardcoded values** that must NOT be in code: ✓ All handled by config
2. **Config file values**: Fetched from remote server
3. **Cached values**: Used if fetch fails (1hr old max)
4. **DEFAULT_CONFIG**: Fallback when no cache available

## Config Caching & Refresh

- **Cache TTL**: 1 hour
- **Refresh alarm**: Every 1 hour (can be manual or via alarm)
- **Fallback**: If fetch fails, uses 1hr-old cache or defaults
- **Storage**: `chrome.storage.local` under key `sc_remote_config`

## Deployment Steps

1. **Host config.json** at `https://nayem.net/shiftcontroller/config.json`
   - Must be publicly accessible
   - Must return valid JSON
   - CORS should allow extension origin

2. **Test locally** by adding to extension storage:
   ```javascript
   // In DevTools console for the extension
   await chrome.storage.local.set({
     sc_remote_config: {
       data: { kill_switch: { active: false }, ... },
       ts: Date.now()
     }
   });
   ```

3. **Monitor config updates** by checking service worker logs

## CSS Variables Available

All config values are injected as CSS custom properties:

```css
:root {
  --bg: #0d0d0d;
  --surface: #141414;
  --surface-2: #1c1c1c;
  --border: rgba(255,255,255,0.08);
  --accent: #a3ff00;
  --accent-dim: rgba(163,255,0,0.15);
  --accent-glow: rgba(163,255,0,0.4);
  --accent-hover: #8bcc00;
  --text: #f0f0f0;
  --text-muted: #aaa;
  --danger: #ff4444;
  --radius: 10px;
  --font: 'Montserrat', system-ui, sans-serif;
  --font-mono: monospace;
  --heading-weight: 700;
  --body-size: 13px;
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 700ms;
  --hover-scale: 1.03;
}
```

Use in custom CSS:

```css
.my-element {
  background: var(--accent);
  color: var(--text);
  transition: all var(--duration-fast);
}

.my-element:hover {
  transform: scale(var(--hover-scale));
}
```

## Error Handling

### Config Fetch Fails
- Uses last cached version (if available)
- Falls back to DEFAULT_CONFIG after 1hr
- Logs warning to console
- UI still renders normally

### Invalid Config
- Kill switch must be present
- Missing sections use defaults
- Individual missing color values use defaults
- Malformed values are logged and skipped

### Kill Switch Activation
- All operations blocked (silent mode)
- UI replaced with tombstone (brick mode)
- Message shown to user (message mode)
- Cannot be recovered from brick mode (persists via flag)

## Security Considerations

- ✓ No eval() or dynamic script injection
- ✓ All CSP-compliant (no unsafe-inline for code)
- ✓ Config URL must be HTTPS
- ✓ Encryption for stored shortcuts (AES-GCM)
- ✓ Kill switch cannot be bypassed once bricked
- ✓ No credentials or sensitive data in config

## API Reference

### config.js Functions

#### `loadConfig()`
Fetches and validates config with caching

```javascript
const config = await loadConfig();
// Returns: config object or null on error
```

#### `applyTheme(config, doc = document)`
Injects CSS variables for theming

```javascript
applyTheme(config);
```

#### `applyBranding(config, doc = document)`
Updates branding elements (name, logo, author)

```javascript
applyBranding(config);
```

#### `checkKillSwitch(config)`
Returns kill switch status

```javascript
const status = await checkKillSwitch(config);
// Returns: { active: false } | { active: true, mode, message, ... }
```

#### `showBrickUI(config, doc = document)`
Render tombstone UI (brick mode)

```javascript
showBrickUI(config);
```

## Testing

### Test Kill Switch

```javascript
// In extension DevTools for popup
await chrome.storage.local.set({
  sc_remote_config: {
    data: {
      kill_switch: { active: true, mode: 'message', message: 'Test' }
    },
    ts: Date.now()
  }
});
location.reload();
```

### Test Theme Change

```javascript
await chrome.storage.local.set({
  sc_remote_config: {
    data: {
      kill_switch: { active: false },
      theme: { preset: 'dark_orange' }
    },
    ts: Date.now()
  }
});
location.reload();
```

### Test Feature Toggles

```javascript
await chrome.storage.local.set({
  sc_remote_config: {
    data: {
      kill_switch: { active: false },
      features: { show_domain_toggle: false, consent_required: false }
    },
    ts: Date.now()
  }
});
location.reload();
```

## Troubleshooting

### Config not loading
1. Check service worker logs for fetch errors
2. Verify config URL is accessible and returns valid JSON
3. Check manifest.json has `https://*/shiftcontroller/*` in host_permissions
4. Verify JSON is valid (use JSON.parse)

### Theme not applying
1. Clear cache: `chrome.storage.local.clear()`
2. Reload extension and popup
3. Check CSS variables in DevTools `:root` styles

### Kill switch not working
1. Verify `kill_switch.active: true` in config
2. Check for `sc_bricked` flag in storage (prevents recovery)
3. Check kill_switch.mode is one of: silent, message, brick

---

**Version**: 1.0.0  
**Last Updated**: 2026-05-09  
**Author**: Configuration System Implementation
