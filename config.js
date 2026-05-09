/**
 * ShiftController Configuration System
 * Handles remote config fetching, validation, theme application, and kill switch management
 * Version: 1.0.0
 */

// Safe defaults to use when remote config cannot be loaded
const DEFAULT_CONFIG = {
  kill_switch: { active: false },
  branding: {
    company_name: "ShiftController",
    company_tagline: "Record any clickable element. Map it to a shortcut.",
    website_url: "https://ShiftController.nayem.net",
    author_name: "Nayem Hasan",
    author_url: "https://nayem.net",
    show_author: true,
    logo_type: "builtin_bolt"
  },
  theme: {
    preset: "dark_neon",
    base_mode: "dark",
    color_bg: "#0d0d0d",
    color_surface: "#141414",
    color_surface2: "#1c1c1c",
    color_border: "rgba(255,255,255,0.08)",
    color_accent: "#a3ff00",
    color_accent_dim: "rgba(163,255,0,0.15)",
    color_accent_glow: "rgba(163,255,0,0.4)",
    color_text: "#f0f0f0",
    color_text_muted: "#aaaaaa",
    color_danger: "#ff4444",
    border_radius: "10px",
    sharp_mode: false
  },
  typography: {
    font_family: "'Montserrat', system-ui, sans-serif",
    font_url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",
    heading_weight: "700",
    heading_tracking: "-0.02em",
    heading_leading: "1.1",
    body_size: "13px",
    body_weight: "400",
    body_leading: "1.5",
    mono_family: "monospace"
  },
  layout: {
    popup_width: "340px",
    popup_min_height: "420px",
    section_padding: "12px 16px",
    sharp_corners: false
  },
  animations: {
    enabled: true,
    entry_fade: true,
    entry_slide_y: "12px",
    duration_fast: "150ms",
    duration_normal: "300ms",
    duration_slow: "700ms",
    hover_scale: "1.03",
    image_hover_scale: "1.05"
  },
  features: {
    show_shortcut_hints: true,
    show_domain_toggle: true,
    show_analytics: false,
    show_developer_panel: true,
    consent_required: true,
    record_hotkey: "shift+s",
    stop_hotkey: "Escape"
  }
};

// Preset themes library
const THEME_PRESETS = {
  dark_neon: {
    base_mode: "dark",
    color_bg: "#0d0d0d",
    color_surface: "#141414",
    color_surface2: "#1c1c1c",
    color_border: "rgba(255,255,255,0.08)",
    color_accent: "#a3ff00",
    color_accent_dim: "rgba(163,255,0,0.15)",
    color_accent_glow: "rgba(163,255,0,0.4)",
    color_text: "#f0f0f0",
    color_text_muted: "#aaa",
    color_danger: "#ff4444"
  },
  dark_orange: {
    base_mode: "light",
    color_bg: "#ebebed",
    color_surface: "#ffffff",
    color_surface2: "#f5f5f5",
    color_border: "#e5e5e5",
    color_accent: "#ff5a36",
    color_accent_dim: "rgba(255,90,54,0.15)",
    color_accent_glow: "rgba(255,90,54,0.4)",
    color_text: "#1a1a1a",
    color_text_muted: "#666",
    color_danger: "#cc0000"
  },
  dark_charcoal: {
    base_mode: "dark",
    color_bg: "#111111",
    color_surface: "#1a1a1a",
    color_surface2: "#222222",
    color_border: "#333333",
    color_accent: "#ffffff",
    color_accent_dim: "rgba(255,255,255,0.15)",
    color_accent_glow: "rgba(255,255,255,0.4)",
    color_text: "#f5f5f5",
    color_text_muted: "#888",
    color_danger: "#ff4040"
  },
  midnight_blue: {
    base_mode: "dark",
    color_bg: "#0b0f1a",
    color_surface: "#111827",
    color_surface2: "#1f2937",
    color_border: "rgba(255,255,255,0.06)",
    color_accent: "#60a5fa",
    color_accent_dim: "rgba(96,165,250,0.15)",
    color_accent_glow: "rgba(96,165,250,0.4)",
    color_text: "#f1f5f9",
    color_text_muted: "#94a3b8",
    color_danger: "#f87171"
  },
  forest_dark: {
    base_mode: "dark",
    color_bg: "#0d1117",
    color_surface: "#161b22",
    color_surface2: "#21262d",
    color_border: "rgba(255,255,255,0.07)",
    color_accent: "#3fb950",
    color_accent_dim: "rgba(63,185,80,0.15)",
    color_accent_glow: "rgba(63,185,80,0.4)",
    color_text: "#e6edf3",
    color_text_muted: "#8b949e",
    color_danger: "#f85149"
  },
  pure_white: {
    base_mode: "light",
    color_bg: "#ffffff",
    color_surface: "#f9f9f9",
    color_surface2: "#f0f0f0",
    color_border: "#e0e0e0",
    color_accent: "#1a1a1a",
    color_accent_dim: "rgba(26,26,26,0.15)",
    color_accent_glow: "rgba(26,26,26,0.4)",
    color_text: "#1a1a1a",
    color_text_muted: "#666",
    color_danger: "#cc0000"
  }
};

/**
 * Fetch and validate remote config with caching
 */
async function loadConfig() {
  const CACHE_KEY = 'sc_remote_config';
  const CACHE_TTL = 3600 * 1000; // 1 hour
  const CONFIG_URL = 'https://ShiftController.nayem.net/shiftcontroller/config.json';

  try {
    // Try cache first
    const cached = await chrome.storage.local.get(CACHE_KEY);
    if (cached[CACHE_KEY]) {
      const { data, ts } = cached[CACHE_KEY];
      if (Date.now() - ts < CACHE_TTL) {
        console.log('[ShiftController] Using cached config');
        return data;
      }
    }

    // Attempt remote fetch
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      validateConfig(data);
      await chrome.storage.local.set({ [CACHE_KEY]: { data, ts: Date.now() } });
      console.log('[ShiftController] Config fetched from remote');
      return data;
    } catch (err) {
      console.warn('[ShiftController] Config fetch failed, checking cache:', err);
      // Return stale cached data if available
      if (cached[CACHE_KEY]?.data) {
        console.log('[ShiftController] Using stale cached config');
        return cached[CACHE_KEY].data;
      }
      return null;
    }
  } catch (err) {
    console.error('[ShiftController] Config load error:', err);
    return null;
  }
}

/**
 * Validate config structure
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config: must be an object');
  }
  
  // Check required top-level keys
  const required = ['kill_switch', 'branding', 'theme', 'typography', 'layout', 'animations', 'features'];
  for (const key of required) {
    if (!(key in config)) {
      console.warn(`[ShiftController] Missing config key: ${key}`);
    }
  }
  
  return true;
}

/**
 * Apply theme to DOM
 */
function applyTheme(themeConfig) {
  const root = document.documentElement;
  const style = themeConfig || DEFAULT_CONFIG.theme;
  
  // Apply CSS variables
  Object.entries(style).forEach(([key, value]) => {
    const cssVar = `--sc-${key.replace(/_/g, '-')}`;
    root.style.setProperty(cssVar, value);
  });
  
  console.log('[ShiftController] Theme applied:', style.preset || 'custom');
}

/**
 * Get current active config
 */
async function getConfig() {
  try {
    const remote = await loadConfig();
    const config = remote || DEFAULT_CONFIG;
    
    // Check kill switch
    if (config.kill_switch?.active) {
      console.warn('[ShiftController] Kill switch is ACTIVE - extension disabled');
      return null;
    }
    
    return config;
  } catch (err) {
    console.error('[ShiftController] Error getting config:', err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get theme preset by name
 */
function getThemePreset(presetName) {
  return THEME_PRESETS[presetName] || THEME_PRESETS.dark_neon;
}

/**
 * Merge custom config with defaults
 */
function mergeConfig(userConfig, defaults = DEFAULT_CONFIG) {
  const merged = JSON.parse(JSON.stringify(defaults));
  
  if (!userConfig) return merged;
  
  Object.keys(userConfig).forEach(key => {
    if (typeof userConfig[key] === 'object' && typeof merged[key] === 'object') {
      merged[key] = { ...merged[key], ...userConfig[key] };
    } else {
      merged[key] = userConfig[key];
    }
  });
  
  return merged;
}

/**
 * Initialize configuration system
 */
async function initializeConfig() {
  try {
    const config = await getConfig();
    
    if (!config) {
      console.warn('[ShiftController] Configuration unavailable - using safe defaults');
      applyTheme(DEFAULT_CONFIG.theme);
      return DEFAULT_CONFIG;
    }
    
    // Apply theme
    const themePreset = config.theme?.preset;
    const themeData = themePreset ? getThemePreset(themePreset) : config.theme;
    applyTheme(mergeConfig({ theme: themeData }, DEFAULT_CONFIG).theme);
    
    console.log('[ShiftController] Configuration initialized successfully');
    return config;
  } catch (err) {
    console.error('[ShiftController] Initialization failed:', err);
    applyTheme(DEFAULT_CONFIG.theme);
    return DEFAULT_CONFIG;
  }
}

/**
 * Export for use in other modules
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_CONFIG,
    THEME_PRESETS,
    loadConfig,
    getConfig,
    getThemePreset,
    applyTheme,
    validateConfig,
    mergeConfig,
    initializeConfig
  };
}
function validateConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') {
    throw new Error('Invalid config: not an object');
  }
  // Kill switch must always be present and parseable
  if (!cfg.kill_switch || typeof cfg.kill_switch.active !== 'boolean') {
    throw new Error('Invalid config: missing or invalid kill_switch');
  }
}

/**
 * Merge preset theme into config if needed
 */
function resolveTheme(config) {
  const t = config.theme || {};
  
  // If individual colors are provided, use them (they override preset)
  if (t.color_bg || t.color_surface || t.color_accent) {
    return config;
  }
  
  // Otherwise, apply preset
  const presetName = t.preset || 'dark_neon';
  const preset = THEME_PRESETS[presetName] || THEME_PRESETS.dark_neon;
  
  return {
    ...config,
    theme: { ...preset, ...t }
  };
}

/**
 * Derive hover color by darkening hex value by ~12%
 */
function deriveHoverColor(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return hex;
  }
  try {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.floor(r * 0.88));
    g = Math.max(0, Math.floor(g * 0.88));
    b = Math.max(0, Math.floor(b * 0.88));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch (e) {
    return hex;
  }
}

/**
 * Apply theme as CSS custom properties
 */
function applyTheme(config, doc = document) {
  const t = config.theme || {};
  const ty = config.typography || {};
  const sharp = t.sharp_mode === true;
  
  const vars = {
    '--bg': t.color_bg,
    '--surface': t.color_surface,
    '--surface-2': t.color_surface2,
    '--border': t.color_border,
    '--accent': t.color_accent,
    '--accent-dim': t.color_accent_dim,
    '--accent-glow': t.color_accent_glow,
    '--text': t.color_text,
    '--text-muted': t.color_text_muted,
    '--danger': t.color_danger,
    '--radius': sharp ? '0px' : (t.border_radius || '10px'),
    '--font': ty.font_family || "'Montserrat', system-ui, sans-serif",
    '--font-mono': ty.mono_family || 'monospace',
    '--heading-weight': ty.heading_weight || '700',
    '--heading-tracking': ty.heading_tracking || '-0.02em',
    '--heading-leading': ty.heading_leading || '1.1',
    '--body-size': ty.body_size || '13px',
    '--body-weight': ty.body_weight || '400',
    '--body-leading': ty.body_leading || '1.5',
    '--duration-fast': (config.animations || {}).duration_fast || '150ms',
    '--duration-normal': (config.animations || {}).duration_normal || '300ms',
    '--duration-slow': (config.animations || {}).duration_slow || '700ms',
    '--hover-scale': (config.animations || {}).hover_scale || '1.03',
    '--image-hover-scale': (config.animations || {}).image_hover_scale || '1.05',
    '--accent-hover': deriveHoverColor(t.color_accent)
  };

  const root = doc.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined && v !== null && v !== '') {
      root.style.setProperty(k, v);
    }
  }
  
  console.log('[ShiftController] Theme applied');
}

/**
 * Load and apply font if specified
 */
function applyTypography(config, doc = document) {
  const fontUrl = config.typography?.font_url;
  if (!fontUrl) return;
  
  // Check if font is already loaded
  const existing = Array.from(doc.head.querySelectorAll('link')).find(
    l => l.href === fontUrl
  );
  if (existing) return;
  
  const link = doc.createElement('link');
  link.rel = 'preconnect';
  link.href = fontUrl;
  doc.head.appendChild(link);
}

/**
 * Check kill switch and return action
 * Returns: { active: false } | { active: true, mode, message, ... }
 */
async function checkKillSwitch(config) {
  if (!config || !config.kill_switch) {
    return { active: false };
  }
  
  const ks = config.kill_switch;
  
  // Check if already bricked locally
  const bricked = await chrome.storage.local.get('sc_bricked');
  if (bricked.sc_bricked) {
    return {
      active: true,
      mode: 'brick',
      message: ks.brick_message || 'This extension is no longer authorized.',
      permanently_bricked: true
    };
  }
  
  if (!ks.active) {
    return { active: false };
  }
  
  // Kill switch is active
  if (ks.wipe_data) {
    await chrome.storage.local.clear();
  }
  
  // Mark as bricked if in brick mode
  if (ks.mode === 'brick') {
    await chrome.storage.local.set({ sc_bricked: true });
  }
  
  return {
    active: true,
    mode: ks.mode || 'silent',
    message: ks.message || 'Extension maintenance in progress',
    brick_message: ks.brick_message || 'This extension has been disabled.',
    disable_content_scripts: ks.disable_content_scripts || false
  };
}

/**
 * Apply branding to UI elements
 */
function applyBranding(config, doc = document) {
  const b = config.branding || {};
  
  // Update company name and logo
  const logoText = doc.querySelector('.logo-text');
  if (logoText && b.company_name) {
    const [first, ...rest] = b.company_name.split(' ');
    logoText.textContent = first;
    if (rest.length > 0) {
      const span = doc.createElement('span');
      span.className = 'accent';
      span.textContent = ' ' + rest.join(' ');
      logoText.appendChild(span);
    }
  }
  
  // Update logo URL
  const logoLink = doc.querySelector('.logo').closest('a');
  if (logoLink && b.website_url) {
    logoLink.href = b.website_url;
  }
  
  // Apply custom logo if specified
  if (b.logo_type === 'url' && b.logo_url) {
    const logoIcon = doc.querySelector('.logo-icon');
    if (logoIcon && logoIcon.tagName === 'svg') {
      const img = doc.createElement('img');
      img.src = b.logo_url;
      img.className = 'logo-icon';
      img.style.cssText = 'filter: drop-shadow(0 0 6px var(--accent-glow));';
      logoIcon.replaceWith(img);
    }
  } else if (b.logo_type === 'svg_inline' && b.logo_svg_string) {
    const logoIcon = doc.querySelector('.logo-icon');
    if (logoIcon) {
      const wrapper = doc.createElement('div');
      wrapper.innerHTML = b.logo_svg_string;
      const svg = wrapper.querySelector('svg');
      if (svg) {
        svg.className = 'logo-icon';
        svg.style.cssText = 'filter: drop-shadow(0 0 6px var(--accent-glow));';
        logoIcon.replaceWith(svg);
      }
    }
  }
  
  // Update author credit
  const authorLink = doc.querySelector('a[href*="nayem.net"]');
  if (authorLink && b.show_author === false) {
    authorLink.style.display = 'none';
  } else if (authorLink && b.author_name) {
    authorLink.textContent = '' + b.author_name; //by nayem hasan
    if (b.author_url) {
      authorLink.href = b.author_url;
    }
  }
}

/**
 * Create and show brick/tombstone UI (kill switch brick mode)
 */
function showBrickUI(config, doc = document) {
  const ks = config.kill_switch || {};
  const root = doc.getElementById('popup-root');
  
  if (!root) return;
  
  // Clear all children
  root.innerHTML = '';
  
  // Create tombstone UI
  root.style.cssText = `
    background: #0a0a0a !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  // Lock icon SVG
  const lockIcon = doc.createElement('svg');
  lockIcon.setAttribute('viewBox', '0 0 24 24');
  lockIcon.setAttribute('fill', 'none');
  lockIcon.setAttribute('stroke', '#ff4444');
  lockIcon.setAttribute('stroke-width', '2');
  lockIcon.style.cssText = 'width: 48px; height: 48px; margin-bottom: 20px;';
  lockIcon.innerHTML = `
    <rect x="3" y="13" width="18" height="8" rx="2"/>
    <path d="M7 13V7a5 5 0 0 1 10 0v6"/>
  `;
  
  // Heading
  const heading = doc.createElement('h1');
  heading.textContent = 'Extension Disabled';
  heading.style.cssText = `
    color: white;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px 0;
    text-align: center;
  `;
  
  // Message
  const message = doc.createElement('p');
  message.textContent = ks.brick_message || 'This extension is no longer authorized to run.';
  message.style.cssText = `
    color: #888;
    font-size: 12px;
    margin: 0 0 20px 0;
    text-align: center;
    line-height: 1.4;
    max-width: 280px;
  `;
  
  // Footer version
  const footer = doc.createElement('div');
  const manifest = chrome.runtime.getManifest?.();
  footer.textContent = `v${manifest?.version || '0.0.0.2'}`;
  footer.style.cssText = `
    color: #333;
    font-size: 10px;
    position: absolute;
    bottom: 10px;
    right: 10px;
  `;
  
  root.appendChild(lockIcon);
  root.appendChild(heading);
  root.appendChild(message);
  root.appendChild(footer);
  
  console.log('[ShiftController] Brick UI applied');
}

/**
 * Show kill switch message in popup (message mode)
 */
function showKillSwitchMessage(config, doc = document) {
  const ks = config.kill_switch || {};
  const root = doc.getElementById('popup-root');
  
  if (!root) return;
  
  // Create message panel
  const panel = doc.createElement('div');
  panel.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  `;
  
  // Icon
  const icon = doc.createElement('div');
  icon.style.cssText = `
    width: 48px;
    height: 48px;
    margin-bottom: 20px;
    color: var(--accent);
  `;
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  `;
  
  // Message
  const msg = doc.createElement('p');
  msg.textContent = ks.message || 'Extension is under maintenance';
  msg.style.cssText = `
    color: var(--text);
    font-size: 14px;
    margin: 0;
    line-height: 1.4;
  `;
  
  panel.appendChild(icon);
  panel.appendChild(msg);
  root.innerHTML = '';
  root.appendChild(panel);
  
  console.log('[ShiftController] Kill switch message shown');
}

/**
 * Initialize config system (to be called from popup/service_worker)
 */
async function initializeConfig() {
  const config = await loadConfig();
  const finalConfig = config ? resolveTheme(config) : resolveTheme(DEFAULT_CONFIG);
  
  return finalConfig;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadConfig,
    validateConfig,
    resolveTheme,
    applyTheme,
    applyTypography,
    applyBranding,
    checkKillSwitch,
    showBrickUI,
    showKillSwitchMessage,
    initializeConfig,
    DEFAULT_CONFIG,
    THEME_PRESETS
  };
}
