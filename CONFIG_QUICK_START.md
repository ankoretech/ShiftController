# ShiftController Configuration - Quick Reference

## Quickest Start

### Minimal Valid Config (Copy & Paste)

```json
{
  "kill_switch": { "active": false }
}
```

This uses all defaults. Add features below as needed.

---

## Common Configuration Tasks

### 1. Change Brand Name

```json
{
  "kill_switch": { "active": false },
  "branding": {
    "company_name": "My Cool Extension"
  }
}
```

### 2. Change Colors (Orange Theme)

```json
{
  "kill_switch": { "active": false },
  "theme": {
    "preset": "dark_orange"
  }
}
```

Other presets: `dark_neon`, `dark_charcoal`, `midnight_blue`, `forest_dark`, `pure_white`

### 3. Maintenance Mode (Show Message)

```json
{
  "kill_switch": {
    "active": true,
    "mode": "message",
    "message": "We're updating ShiftController. Back in 30 minutes!"
  }
}
```

### 4. Disable Extension (Silent)

```json
{
  "kill_switch": {
    "active": true,
    "mode": "silent"
  }
}
```

### 5. Permanently Disable Extension (Brick)

```json
{
  "kill_switch": {
    "active": true,
    "mode": "brick",
    "brick_message": "This version is no longer supported.",
    "wipe_data": true
  }
}
```

⚠️ **WARNING**: Brick mode cannot be reversed. Users cannot recover even if you set `active: false` later.

### 6. Hide UI Elements

```json
{
  "kill_switch": { "active": false },
  "features": {
    "show_domain_toggle": false,
    "show_shortcut_hints": false,
    "show_developer_panel": false,
    "consent_required": false
  }
}
```

### 7. Change Hotkeys

```json
{
  "kill_switch": { "active": false },
  "features": {
    "record_hotkey": "ctrl+shift+r",
    "stop_hotkey": "Escape"
  }
}
```

### 8. Custom Font

```json
{
  "kill_switch": { "active": false },
  "typography": {
    "font_family": "'Montserrat', system-ui, sans-serif",
    "font_url": "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
  }
}
```

### 9. Light Mode

```json
{
  "kill_switch": { "active": false },
  "theme": {
    "base_mode": "light",
    "color_bg": "#f5f5f5",
    "color_surface": "#ffffff",
    "color_text": "#1a1a1a",
    "color_accent": "#0066cc"
  }
}
```

### 10. Custom Colors

```json
{
  "kill_switch": { "active": false },
  "theme": {
    "preset": "dark_neon",
    "color_accent": "#ff00ff",
    "color_accent_glow": "rgba(255,0,255,0.4)"
  }
}
```

### 11. Disable Animations

```json
{
  "kill_switch": { "active": false },
  "animations": {
    "enabled": false
  }
}
```

### 12. Custom Author Credit

```json
{
  "kill_switch": { "active": false },
  "branding": {
    "author_name": "My Team",
    "author_url": "https://mycompany.com",
    "show_author": true
  }
}
```

### 13. Change Popup Size

```json
{
  "kill_switch": { "active": false },
  "layout": {
    "popup_width": "400px",
    "popup_min_height": "500px"
  }
}
```

### 14. Sharp Corners (No Border Radius)

```json
{
  "kill_switch": { "active": false },
  "theme": {
    "sharp_mode": true
  }
}
```

### 15. Clear All Data on Kill Switch

```json
{
  "kill_switch": {
    "active": true,
    "mode": "silent",
    "wipe_data": true
  }
}
```

---

## Complete Example (Premium Config)

```json
{
  "kill_switch": { "active": false },
  
  "branding": {
    "company_name": "TaskRunner Pro",
    "website_url": "https://taskrunner.pro",
    "author_name": "TaskRunner Team",
    "author_url": "https://taskrunner.pro/team",
    "show_author": true,
    "logo_type": "builtin_bolt"
  },
  
  "theme": {
    "preset": "dark_orange",
    "sharp_mode": false
  },
  
  "typography": {
    "font_family": "'Montserrat', system-ui, sans-serif",
    "font_url": "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap",
    "heading_weight": "600",
    "body_size": "14px"
  },
  
  "layout": {
    "popup_width": "360px",
    "popup_min_height": "450px"
  },
  
  "animations": {
    "enabled": true,
    "duration_fast": "150ms",
    "hover_scale": "1.03"
  },
  
  "features": {
    "show_shortcut_hints": true,
    "show_domain_toggle": true,
    "show_developer_panel": true,
    "consent_required": false,
    "record_hotkey": "shift+s",
    "stop_hotkey": "Escape"
  }
}
```

---

## Hosting Your Config

### Option 1: GitHub Pages

1. Create `public/config.json` with your config
2. Push to GitHub
3. URL: `https://username.github.io/repo/config.json`

### Option 2: AWS S3

1. Upload `config.json` to S3 bucket
2. Make public
3. Enable CORS: Allow `https://` origins
4. URL: `https://your-bucket.s3.amazonaws.com/config.json`

### Option 3: Netlify

1. Add `config.json` to root or `public/` folder
2. Deploy with Netlify
3. URL: `https://yoursite.netlify.app/config.json`

### Option 4: Custom Server

1. Host on your server
2. Set `Content-Type: application/json`
3. Enable CORS if cross-origin
4. URL: `https://yourserver.com/config.json`

---

## Validation Checklist

Before deploying config, verify:

- [ ] Valid JSON (use JSONLint.com)
- [ ] `kill_switch` object exists with `active` boolean
- [ ] All color values are valid hex or rgba
- [ ] All timeouts are valid CSS values
- [ ] URLs are HTTPS (http will fail)
- [ ] No trailing commas in JSON
- [ ] Font URLs return actual font files
- [ ] All image URLs are valid

---

## Testing Config Locally

### Via Browser DevTools

```javascript
// In extension popup console:

// Test with custom config
await chrome.storage.local.set({
  sc_remote_config: {
    data: {
      kill_switch: { active: false },
      theme: { preset: 'dark_orange' }
    },
    ts: Date.now()
  }
});

// Reload popup
location.reload();
```

### Clear Cache

```javascript
// Remove cached config
await chrome.storage.local.remove('sc_remote_config');
location.reload();
```

### Check Current Config

```javascript
// See what config is loaded
const data = await chrome.storage.local.get('sc_remote_config');
console.log(data.sc_remote_config);
```

---

## Troubleshooting

### Config Not Loading?

1. Check config.json is valid JSON
2. Verify URL is HTTPS
3. Check CORS headers: `Access-Control-Allow-Origin: *`
4. Look for network errors in service worker logs

### Theme Not Changing?

1. Clear cache: `chrome.storage.local.remove('sc_remote_config')`
2. Reload extension
3. Check CSS variables in DevTools `:root`

### Kill Switch Not Working?

1. Verify `kill_switch.active: true`
2. Check `kill_switch.mode` is valid
3. If bricked, check `sc_bricked` flag in storage
4. Can't un-brick: must use development/test config

### Features Not Toggling?

1. Check feature name spelling
2. Verify value is boolean (true/false, not string)
3. Reload popup after config change

---

## Advanced Patterns

### A/B Testing

```json
{
  "kill_switch": { "active": false },
  "theme": {
    "preset": "dark_neon"
  },
  "features": {
    "show_domain_toggle": true
  }
}
```

Then change `preset` or feature flags to test different UI.

### Regional Configurations

Serve different configs based on user region:

```
https://api.example.com/config.json?region=us
https://api.example.com/config.json?region=eu
https://api.example.com/config.json?region=asia
```

### Canary Deployments

1. Small user group: `"experimental_ui": true`
2. Monitor logs/feedback
3. Rollout to all: `"experimental_ui": true` globally

### Emergency Maintenance

```json
{
  "kill_switch": {
    "active": true,
    "mode": "message",
    "message": "Emergency maintenance in progress. Est. 2 hours."
  }
}
```

Then revert config when done.

---

## Common Mistakes

❌ **Wrong**: String boolean
```json
{ "kill_switch": { "active": "false" } }  // ← String, not boolean
```

✅ **Right**: Real boolean
```json
{ "kill_switch": { "active": false } }  // ← Correct
```

---

❌ **Wrong**: Hardcoded color without hash
```json
{ "theme": { "color_accent": "a3ff00" } }  // ← Missing #
```

✅ **Right**: Proper hex format
```json
{ "theme": { "color_accent": "#a3ff00" } }  // ← Correct
```

---

❌ **Wrong**: Unknown preset name
```json
{ "theme": { "preset": "my_custom_theme" } }  // ← Won't work
```

✅ **Right**: Valid preset
```json
{ "theme": { "preset": "dark_neon" } }  // ← Correct
```

---

## Need Help?

1. Check [CONFIG_SYSTEM.md](./CONFIG_SYSTEM.md) for detailed docs
2. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details
3. Read source in `config.js` for exact behavior
4. Test locally before deploying

---

**Quick Links**
- Config File Format: See DEFAULT_CONFIG in config.js
- Color Presets: THEME_PRESETS in config.js
- API Reference: CONFIG_SYSTEM.md § API Reference
- Examples: This file

**Version**: 1.0.0  
**Last Updated**: 2026-05-09
