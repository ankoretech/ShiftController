# ShiftController Configuration System - Technical Implementation Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Extension Lifecycle                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Extension Loads                                              │
│     ├─ service_worker.js starts                                  │
│     └─ loadAndValidateConfig() called                            │
│                                                                  │
│  2. Config Loading                                               │
│     ├─ Try: fetch https://nayem.net/shiftcontroller/config.json  │
│     ├─ Fallback: Use cached config (1hr TTL)                     │
│     └─ Fallback: Use DEFAULT_CONFIG                              │
│                                                                  │
│  3. Config Resolution                                            │
│     ├─ Apply theme presets if needed                             │
│     ├─ Resolve individual color overrides                        │
│     ├─ Validate kill_switch structure                            │
│     └─ Store in chrome.storage.local                             │
│                                                                  │
│  4. Popup Opens                                                  │
│     ├─ popup.js init() called                                    │
│     ├─ initializeConfig() loaded config                          │
│     ├─ applyTheme() injects CSS variables                        │
│     ├─ applyBranding() updates DOM                               │
│     ├─ checkKillSwitch() checks status                           │
│     │  ├─ active:false → continue                                │
│     │  ├─ active:true → handleKillSwitch()                       │
│     │  │  ├─ mode:silent → blank UI                              │
│     │  │  ├─ mode:message → show message                         │
│     │  │  └─ mode:brick → show tombstone                         │
│     ├─ initializeApp() if not killed                             │
│     └─ Render normal UI with config values                       │
│                                                                  │
│  5. User Interaction                                             │
│     ├─ All hotkeys come from config.features                     │
│     ├─ All colors via CSS variables                              │
│     ├─ All animations governed by config.animations              │
│     └─ All features toggled via config.features.*                │
│                                                                  │
│  6. Background Tasks                                             │
│     ├─ Service worker checks kill switch on messages             │
│     ├─ Blocks EXECUTE_ACTIONS if bricked                         │
│     ├─ Config refreshes every 1 hour via alarm                   │
│     └─ Broadcasts kill switch to all tabs                        │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
c:\Users\!\Desktop\7.final\
├── config.js                          ← Configuration system (NEW)
│   ├── loadConfig()                   ← Fetch with caching
│   ├── validateConfig()               ← Validation
│   ├── applyTheme()                   ← CSS injection
│   ├── applyTypography()              ← Font injection
│   ├── applyBranding()                ← DOM updates
│   ├── checkKillSwitch()              ← Kill switch logic
│   ├── showBrickUI()                  ← Tombstone renderer
│   ├── DEFAULT_CONFIG                 ← Fallback values
│   └── THEME_PRESETS                  ← Color presets
│
├── popup/
│   ├── popup.html                     ← Updated with config.js
│   ├── popup.css                      ← Enhanced with CSS vars
│   ├── popup.js                       ← Rewritten for config
│   
├── background/
│   ├── service_worker.js              ← Updated kill switch checks
│   
├── manifest.json                      ← Updated for MV3
└── CONFIG_SYSTEM.md                   ← Documentation (NEW)
```

## Code Flow - Config Loading

### config.js: `loadConfig()`

```
Step 1: Check Local Cache
  ├─ Get 'sc_remote_config' from chrome.storage.local
  └─ If exists AND (now - timestamp) < 1hr → return cached data

Step 2: Fetch Remote
  ├─ GET https://nayem.net/shiftcontroller/config.json
  ├─ { cache: 'no-store' } to prevent browser cache
  └─ Response must be JSON

Step 3: Validate
  ├─ Check if object
  ├─ Check if kill_switch exists
  └─ Throw if invalid

Step 4: Cache Result
  ├─ Store in chrome.storage.local['sc_remote_config']
  ├─ Timestamp = Date.now()
  └─ TTL = 3600000ms (1hr)

Step 5: Return
  └─ Return parsed config object
```

### config.js: `resolveTheme(config)`

```
Step 1: Check for Individual Colors
  └─ If color_bg || color_surface || color_accent exists
     └─ Return config as-is (individual overrides win)

Step 2: Apply Preset
  ├─ Get preset name from config.theme.preset (default: 'dark_neon')
  ├─ Look up THEME_PRESETS[presetName]
  └─ Merge preset with config.theme

Step 3: Return Merged Config
  └─ Return { ...config, theme: { ...preset, ...config.theme } }
```

### config.js: `applyTheme(config)`

```
Step 1: Extract Theme Values
  ├─ const t = config.theme
  ├─ const ty = config.typography
  └─ const sharp = t.sharp_mode

Step 2: Build CSS Variables Object
  ├─ Map all theme colors to --css-vars
  ├─ Map typography to --css-vars
  ├─ Map animations to --css-vars
  └─ Handle sharp_mode: replace --radius with '0px'

Step 3: Derive Hover Color
  ├─ Call deriveHoverColor(t.color_accent)
  ├─ Darken hex by 12% using RGB manipulation
  └─ Store as --accent-hover

Step 4: Inject into DOM
  ├─ Get document.documentElement (:root)
  └─ For each [key, value] in vars:
     └─ root.style.setProperty(key, value)

Step 5: Log Success
  └─ console.log('[ShiftController] Theme applied')
```

## Code Flow - Kill Switch System

### popup.js: `checkKillSwitch()` → `handleKillSwitch()`

```
Step 1: Load Config
  ├─ currentConfig = await initializeConfig()
  └─ Apply theme/branding first

Step 2: Check Kill Switch
  ├─ killStatus = await checkKillSwitch(currentConfig)
  ├─ If kill_switch.active === true
  │  └─ Call handleKillSwitch(killStatus)
  └─ Else continue to initializeApp()

Step 3: Handle Kill Switch
  ├─ Check killStatus.mode
  │  ├─ 'brick' → showBrickUI(currentConfig)
  │  ├─ 'message' → showKillSwitchMessage(currentConfig)
  │  └─ 'silent' → do nothing (blank popup)
  └─ Return early, don't init app

Step 4: showBrickUI()
  ├─ Clear popup-root innerHTML
  ├─ Set background to #0a0a0a
  ├─ Create SVG lock icon (#ff4444)
  ├─ Add heading: "Extension Disabled"
  ├─ Add message from config.kill_switch.brick_message
  ├─ Add version footer
  └─ CSS prevents any scrolling/interaction
```

### service_worker.js: Kill Switch Check on Messages

```
On message received:
├─ Check if _killSwitchStatus?.active === true
├─ For critical operations (EXECUTE_ACTIONS, SAVE_SHORTCUT):
│  ├─ Return { ok: false, bricked: true, error: message }
│  └─ Don't proceed with operation
└─ For read-only operations (GET_SHORTCUTS):
   └─ Proceed normally
```

### config.js: `checkKillSwitch(config)`

```
Step 1: Get Kill Switch Config
  ├─ ks = config.kill_switch
  └─ If not present or not object → return { active: false }

Step 2: Check for Persistent Brick Flag
  ├─ Get 'sc_bricked' from chrome.storage.local
  └─ If exists → return { active: true, mode: 'brick', ... }
     (Extension can never recover from brick)

Step 3: Check Active Status
  ├─ If ks.active === false
  │  └─ return { active: false }
  └─ If ks.active === true
     └─ Continue to Step 4

Step 4: Execute Kill Switch Actions
  ├─ If wipe_data === true
  │  └─ chrome.storage.local.clear()
  ├─ If mode === 'brick'
  │  └─ Set 'sc_bricked' flag in storage
  └─ Return status object

Step 5: Return Status Object
  └─ { active: true, mode, message, brick_message, ... }
```

## CSS Variable Injection System

### Dynamic Variables

```javascript
// Built at runtime in applyTheme()
const vars = {
  // Color palette (theme section)
  '--bg': config.theme.color_bg,
  '--surface': config.theme.color_surface,
  '--border': config.theme.color_border,
  '--accent': config.theme.color_accent,
  '--text': config.theme.color_text,
  '--danger': config.theme.color_danger,
  
  // Typography (typography section)
  '--font': config.typography.font_family,
  '--heading-weight': config.typography.heading_weight,
  '--body-size': config.typography.body_size,
  
  // Animation timings (animations section)
  '--duration-fast': config.animations.duration_fast,
  '--hover-scale': config.animations.hover_scale,
  
  // Derived values
  '--accent-hover': deriveHoverColor(config.theme.color_accent),
  '--radius': sharpMode ? '0px' : config.theme.border_radius,
};

// Injected into :root
document.documentElement.style.setProperty(key, value);
```

### Usage in CSS

```css
/* popup.css */
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: var(--body-size);
}

.record-btn {
  background: var(--accent-dim);
  color: var(--accent);
  transition: background var(--duration-fast);
}

.record-btn:hover {
  box-shadow: 0 0 12px var(--accent-glow);
}
```

## Branding System - DOM Manipulation

### applyBranding() Implementation

```javascript
function applyBranding(config, doc = document) {
  const b = config.branding;
  
  // 1. Update Company Name
  const logoText = doc.querySelector('.logo-text');
  if (logoText && b.company_name) {
    const parts = b.company_name.split(' ');
    logoText.innerHTML = parts[0]; // "Shift"
    if (parts.length > 1) {
      const accent = doc.createElement('span');
      accent.className = 'accent';
      accent.textContent = ' ' + parts.slice(1).join(' '); // "Controller"
      logoText.appendChild(accent);
    }
  }
  
  // 2. Update Logo Link
  const link = doc.querySelector('.logo').closest('a');
  if (link && b.website_url) {
    link.href = b.website_url;
    link.target = '_blank';
  }
  
  // 3. Update Logo Icon (by type)
  const logoIcon = doc.querySelector('.logo-icon');
  if (b.logo_type === 'url' && b.logo_url) {
    // Load from URL
    const img = doc.createElement('img');
    img.src = b.logo_url;
    img.className = 'logo-icon';
    logoIcon.replaceWith(img);
  } else if (b.logo_type === 'svg_inline' && b.logo_svg_string) {
    // Inject SVG directly
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = b.logo_svg_string;
    const svg = wrapper.querySelector('svg');
    svg.className = 'logo-icon';
    logoIcon.replaceWith(svg);
  }
  // else: keep built-in SVG (builtin_bolt, etc.)
  
  // 4. Update Author Credit
  const authorLink = doc.querySelector('a[href*="nayem.net"]');
  if (b.show_author === false) {
    authorLink.classList.add('hidden');
  } else if (b.author_name) {
    authorLink.textContent = 'x' + b.author_name;
    authorLink.href = b.author_url;
  }
}
```

## Feature Toggle System

### Implementing Feature Flags

```javascript
// In popup.js after config loads:

// 1. Hide domain toggle
if (config.features?.show_domain_toggle === false) {
  document.getElementById('domain-row').classList.add('hidden');
}

// 2. Hide shortcut hints
if (config.features?.show_shortcut_hints === false) {
  document.querySelector('.shortcut-hints').style.display = 'none';
}

// 3. Update hotkey hints with config values
const recordHotkey = config.features?.record_hotkey || 'shift+s';
const stopHotkey = config.features?.stop_hotkey || 'Escape';
document.querySelector('.shortcut-hints').textContent = 
  `Start Record: ${recordHotkey} | Stop: ${stopHotkey}`;

// 4. Hide developer panel
if (config.features?.show_developer_panel === false) {
  document.getElementById('developer-tab').style.display = 'none';
}
```

## Theme Preset System

### Preset Resolution

```javascript
const THEME_PRESETS = {
  dark_neon: {
    color_bg: "#0d0d0d",
    color_accent: "#a3ff00",
    // ... full palette
  },
  dark_orange: {
    color_bg: "#ebebed",
    color_accent: "#ff5a36",
    // ... full palette
  },
  // ... more presets
};

// Usage:
const presetName = config.theme.preset || 'dark_neon';
const preset = THEME_PRESETS[presetName] || THEME_PRESETS.dark_neon;
const finalTheme = { ...preset, ...individualColorOverrides };
```

## Animation System

### CSS Keyframes

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(var(--entry-slide-y, 12px));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
  50% { box-shadow: 0 0 0 6px rgba(163,255,0,0.1); }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

### Respect prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Storage Schema

### chrome.storage.local

```javascript
{
  // Config System
  "sc_remote_config": {
    "data": { /* full config object */ },
    "ts": 1234567890
  },
  
  // Kill Switch Persistence
  "sc_bricked": true, // Only set if bricked
  
  // Legacy (for backwards compat)
  "hasConsented": true,
  "domainStates": { "example.com": true },
  
  // Encryption
  "ks_encryption_key": "base64_encoded_key",
  
  // Shortcuts (encrypted)
  "shortcuts": "encrypted_json_string"
}
```

## Message Passing Flow

### Popup → Service Worker

```javascript
// popup.js
chrome.runtime.sendMessage({
  type: 'GET_SHORTCUTS'
}, (response) => {
  console.log('Shortcuts:', response);
});
```

### Service Worker Response

```javascript
// service_worker.js
case 'GET_SHORTCUTS':
  getShortcuts().then(sendResponse);
  return true;
```

### Kill Switch Rejection

```javascript
// service_worker.js - all messages
if (_killSwitchStatus?.active && criticalOperations.includes(msg.type)) {
  sendResponse({ 
    ok: false, 
    bricked: true, 
    error: 'Extension disabled'
  });
  return true;
}
```

## Error Recovery

### Config Fetch Failures

```
1. Fetch fails
   ├─ Log to console
   ├─ Try use cached config (if < 24hrs old)
   └─ Fallback to DEFAULT_CONFIG

2. Validation fails
   ├─ Log error
   ├─ Kill switch must be valid
   └─ Individual values use defaults if missing

3. CSS injection fails
   └─ Styles are optional (CSS vars are fallback)

4. Branding updates fail
   ├─ DOM updates are non-critical
   └─ UI still functions with defaults
```

## Performance Considerations

1. **Config Loading**
   - Cached for 1 hour (minimal network)
   - Background refresh doesn't block popup
   - Async/await used throughout

2. **CSS Variables**
   - Injected once at startup
   - No recalculation during runtime
   - Browser handles cascading

3. **DOM Manipulation**
   - Minimal changes (logo, branding, toggles)
   - No excessive reflows/repaints
   - Applied before render (sync)

4. **Animation System**
   - GPU-accelerated transforms
   - Respects reduced-motion preferences
   - No JavaScript-based animation loops

## Security Analysis

### Threats Mitigated

1. **XSS Prevention**
   - No innerHTML for user content
   - No eval() or dynamic scripts
   - config.branding text properly escaped

2. **CSP Compliance**
   - No unsafe-inline for scripts
   - No unsafe-eval
   - Fonts loaded from trusted CDN

3. **Injection Prevention**
   - Kill switch cannot be bypassed (persisted as flag)
   - Config validation prevents malformed data
   - Content scripts only run if not disabled

4. **Man-in-the-Middle**
   - Config fetched over HTTPS only
   - Optional domain pinning possible
   - Cached config as backup

## Testing Checklists

### Unit Tests (config.js)

- [ ] loadConfig() returns valid config
- [ ] loadConfig() uses cache if fresh
- [ ] validateConfig() rejects invalid data
- [ ] resolveTheme() applies preset
- [ ] resolveTheme() respects overrides
- [ ] applyTheme() injects all CSS variables
- [ ] checkKillSwitch() detects active:true
- [ ] checkKillSwitch() respects brick flag
- [ ] deriveHoverColor() darkens hex correctly

### Integration Tests (popup.js)

- [ ] popup loads with config
- [ ] theme applies to all elements
- [ ] branding updates correctly
- [ ] kill switch halts initialization
- [ ] consent overlay shows/hides
- [ ] domain toggle hides when configured
- [ ] hotkey hints update from config
- [ ] author credit hides when configured

### E2E Tests (Extension)

- [ ] Extension loads without errors
- [ ] Config caches for 1 hour
- [ ] Manual config update via storage works
- [ ] Brick mode persists across reload
- [ ] Feature toggles work correctly
- [ ] All CSS variables apply
- [ ] Light mode theme works
- [ ] Animations respect prefers-reduced-motion

---

**Last Updated**: 2026-05-09
