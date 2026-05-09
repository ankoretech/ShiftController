
/**
 * ShiftController Service Worker
 * Handles background logic, kill switch checks, and config management
 */

// Import config system functions (available globally after this script loads)
// config.js must be loaded before this script

const CHROME_RESERVED = {
  'ctrl+t': 'for new tab',
  'ctrl+w': 'to close tab',
  'ctrl+n': 'for new window',
  'ctrl+shift+n': 'for incognito window',
  'ctrl+tab': 'to switch tabs',
  'ctrl+shift+tab': 'to switch tabs',
  'ctrl+l': 'for address bar',
  'ctrl+r': 'to refresh page',
  'ctrl+shift+j': 'for dev tools',
  'ctrl+shift+i': 'for dev tools',
  'ctrl+u': 'to view source',
  'ctrl+s': 'for saving sites',
  'ctrl+p': 'to print page',
  'ctrl+f': 'to find text',
  'ctrl+g': 'to find next',
  'ctrl+shift+g': 'to find prev',
  'ctrl+h': 'for history',
  'ctrl+j': 'for downloads',
  'ctrl+shift+delete': 'to clear data',
  'ctrl+shift+b': 'for bookmarks bar',
  'ctrl+shift+o': 'for bookmarks',
  'ctrl+1': 'to jump tabs',
  'ctrl+2': 'to jump tabs',
  'ctrl+3': 'to jump tabs',
  'ctrl+4': 'to jump tabs',
  'ctrl+5': 'to jump tabs',
  'ctrl+6': 'to jump tabs',
  'ctrl+7': 'to jump tabs',
  'ctrl+8': 'to jump tabs',
  'ctrl+9': 'for rightmost tab',
  'alt+f4': 'to close app',
  'f5': 'to refresh page',
  'f11': 'for full screen',
  'f12': 'for dev tools',
  'ctrl+x': 'to cut item',
  'ctrl+c': 'to copy item',
  'ctrl+v': 'to paste item',
  'ctrl+z': 'to undo action',
  'alt+tab': 'to switch apps',
  'ctrl+shift+esc': 'for task manager'
};

const ENCRYPTION_KEY_NAME = 'ks_encryption_key';

// Normalize shortcut keys for consistent comparison across the extension
function normalizeShortcut(shortcut) {
  return shortcut
    .toLowerCase()
    .split('+')
    .map(k => k.trim())
    .filter(Boolean)
    .sort((a, b) => {
      // Always sort modifiers first: ctrl > alt > shift > meta > key
      const order = { ctrl: 0, alt: 1, shift: 2, meta: 3 };
      const aO = order[a] ?? 99;
      const bO = order[b] ?? 99;
      return aO - bO;
    })
    .join('+');
}

async function getEncryptionKey() {
  const data = await chrome.storage.local.get(ENCRYPTION_KEY_NAME);
  if (data[ENCRYPTION_KEY_NAME]) {
    const rawKey = Uint8Array.from(atob(data[ENCRYPTION_KEY_NAME]), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
      "raw", rawKey, "AES-GCM", true, ["encrypt", "decrypt"]
    );
  } else {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
    const exported = await crypto.subtle.exportKey("raw", key);
    const rawStr = btoa(String.fromCharCode(...new Uint8Array(exported)));
    await chrome.storage.local.set({ [ENCRYPTION_KEY_NAME]: rawStr });
    return key;
  }
}

async function encryptData(plainText) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherText = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv }, key, encoded
  );
  const ctArray = Array.from(new Uint8Array(cipherText));
  const ivArray = Array.from(iv);
  return JSON.stringify({ ct: ctArray, iv: ivArray });
}

async function decryptData(encryptedObjString) {
  try {
    const { ct, iv } = JSON.parse(encryptedObjString);
    const key = await getEncryptionKey();
    const cipherText = new Uint8Array(ct);
    const ivArray = new Uint8Array(iv);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivArray }, key, cipherText
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
}

/**
 * Self-contained function for element triggering via executeScript
 * Must be defined before message listener
 */
async function triggerElement(selector, selectorType, fallbacks = null) {
  function findElement(sel, type) {
    const searchIn = (root) => {
      let el = null;
      if (type === 'css') {
        try { el = root.querySelector(sel); } catch (_) {}
      } else if (type === 'xpath') {
        try {
          const result = document.evaluate(sel, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          el = result.singleNodeValue;
        } catch (_) {}
      } else if (type === 'testid') {
        el = root.querySelector('[data-testid="' + sel + '"]');
      } else if (type === 'aria') {
        el = root.querySelector('[aria-label="' + sel + '"]');
      }
      if (el) return el;
      const all = root.querySelectorAll('*');
      for (const node of all) {
        if (node.shadowRoot) {
          const found = searchIn(node.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    };
    return searchIn(document);
  }
  let el = findElement(selector, selectorType);
  if (!el) {
    let attempts = 0;
    while (!el && attempts < 20) {
      await new Promise(r => setTimeout(r, 150));
      el = findElement(selector, selectorType);
      attempts++;
    }
  }
  if (!el && fallbacks) {
    if (fallbacks.id) el = findElement('#' + CSS.escape(fallbacks.id), 'css');
    if (!el && fallbacks.aria) el = findElement(fallbacks.aria, 'aria');
    if (!el && fallbacks.text) {
      const cleanText = fallbacks.text.replace(/'/g, "\\'");
      el = findElement(`//*[normalize-space(text())='${cleanText}']`, 'xpath');
    }
  }
  if (!el) return false;
  el.focus();
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  if (el.tagName === 'A' && el.href && !el.onclick) {
    el.click();
  }
  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Only allow messages from this extension's own content scripts or pages
  if (sender.origin && sender.origin !== 'chrome-extension://' + chrome.runtime.id) {
    if (!sender.tab) {
      console.warn('Rejected message from unknown origin');
      return;
    }
  }

  // Check kill switch for critical operations
  if (_killSwitchStatus?.active && 
      ['EXECUTE_ACTIONS', 'SAVE_SHORTCUT', 'START_INSPECTOR'].includes(msg.type)) {
    sendResponse({ 
      ok: false, 
      bricked: true,
      error: _killSwitchStatus.message || 'Extension is disabled' 
    });
    return true;
  }

  switch (msg.type) {

    case 'ELEMENT_RECORDED':
    case 'INSPECTOR_CANCELLED':
      chrome.runtime.sendMessage(msg).catch(() => {});
      sendResponse({ ok: true });
      return true;

    case 'GET_SHORTCUTS':
      getShortcuts().then(sendResponse);
      return true;

    case 'SAVE_SHORTCUT':
      saveShortcut(msg.entry).then(sendResponse);
      return true;

    case 'DELETE_SHORTCUT':
      deleteShortcut(msg.id).then(sendResponse);
      return true;

    case 'TOGGLE_SHORTCUT':
      toggleShortcut(msg.id, msg.enabled).then(sendResponse);
      return true;

    case 'TOGGLE_DOMAIN':
      toggleDomain(msg.domain, msg.enabled).then(sendResponse);
      return true;

    case 'CHECK_CONFLICT':
      checkConflict(msg.shortcut, msg.excludeId, msg.domain).then(sendResponse);
      return true;

    case 'EXECUTE_ACTIONS':
      if (_remoteConfig?.is_killed) {
        sendResponse({ ok: false, error: _remoteConfig.maintenance_message || 'Maintenance mode.' });
      } else {
        executeActions(msg.actions, sender.tab.id);
        sendResponse({ ok: true });
      }
      return true;

    case 'GET_DOMAIN_STATES':
      getDomainStates().then(sendResponse);
      return true;

    case 'CHECK_DOMAIN_ALLOWED':
      const blacklist = _remoteConfig?.blacklisted_domains || [];
      const blocked = blacklist.some(b => msg.domain.endsWith(b));
      sendResponse({ blocked });
      return true;

    case 'UNDO_DELETE':
      undoDelete().then(sendResponse);
      return true;

    case 'GET_MACROS':
      getMacros().then(sendResponse);
      return true;

    case 'SAVE_MACRO':
      saveMacro(msg.macro).then(sendResponse);
      return true;

    case 'DELETE_MACRO':
      deleteMacro(msg.id).then(sendResponse);
      return true;

    case 'EXECUTE_MACRO':
      executeMacro(msg.macroId, sender.tab.id).then(sendResponse);
      return true;
  }
});

let cachedShortcuts = null;
let _remoteConfig = null;
let _undoStack = [];  // max 5 entries for undo functionality
let _killSwitchStatus = null;

/**
 * Load remote config using the new config system
 * This replaces the old fetchRemoteConfig logic
 */
async function loadAndValidateConfig() {
  try {
    // Try to load config using config.js functions if available
    if (typeof loadConfig === 'function') {
      const config = await loadConfig();
      if (config) {
        _remoteConfig = config;
        // Check kill switch status
        if (typeof checkKillSwitch === 'function') {
          _killSwitchStatus = await checkKillSwitch(config);
          if (_killSwitchStatus.active && _killSwitchStatus.mode === 'brick') {
            // Mark as bricked
            await chrome.storage.local.set({ sc_bricked: true });
          }
        }
        return config;
      }
    }
    // Fallback to old config loading
    return await fetchRemoteConfigLegacy();
  } catch (e) {
    console.warn('[ShiftController] Config load error:', e);
    return await fetchRemoteConfigLegacy();
  }
}

/**
 * Legacy config fetching (kept for backwards compatibility)
 */
async function fetchRemoteConfigLegacy() {
  try {
    const stored = await chrome.storage.local.get('sc_remote_config');
    const lastFetch = stored.sc_remote_config?.ts || 0;
    const CACHE_TTL = 3600 * 1000; // 1 hour
    
    // Use cache if fresh
    if (Date.now() - lastFetch < CACHE_TTL && stored.sc_remote_config?.data) {
      _remoteConfig = stored.sc_remote_config.data;
      return _remoteConfig;
    }
    
    const resp = await fetch('https://nayem.net/shiftcontroller/config.json', { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      _remoteConfig = data;
      await chrome.storage.local.set({ sc_remote_config: { data, ts: Date.now() } });
      return data;
    }
  } catch (e) {
    console.warn('[ShiftController] Config fetch failed:', e);
  }
  
  // Fall back to cached stale data
  const stored = await chrome.storage.local.get('sc_remote_config');
  if (stored.sc_remote_config?.data) {
    _remoteConfig = stored.sc_remote_config.data;
    return _remoteConfig;
  }
  return null;
}

// Initialize config on service worker startup
loadAndValidateConfig();

// Re-fetch config every hour
chrome.alarms.create('configRefresh', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'configRefresh') loadAndValidateConfig();
});

async function getShortcuts() {
  if (cachedShortcuts) return cachedShortcuts;
  const data = await chrome.storage.local.get('shortcuts');
  if (!data.shortcuts) return {};
  try {
    const decrypted = await decryptData(data.shortcuts);
    cachedShortcuts = decrypted ? JSON.parse(decrypted) : {};
    return cachedShortcuts;
  } catch {
    cachedShortcuts = (typeof data.shortcuts === 'string') ? JSON.parse(data.shortcuts) : (data.shortcuts || {});
    return cachedShortcuts;
  }
}

async function saveShortcut(entry) {
  try {

    const conflict = await checkConflict(entry.shortcut, entry.id, entry.domain);
    if (conflict.conflict) {
      return { ok: false, error: conflict.message };
    }
    const shortcuts = await getShortcuts();
    shortcuts[entry.id] = entry;
    cachedShortcuts = shortcuts;
    const encrypted = await encryptData(JSON.stringify(shortcuts));
    await chrome.storage.local.set({ shortcuts: encrypted });
    return { ok: true };
  } catch (err) {
    console.error('saveShortcut error:', err);
    return { ok: false, error: err.message };
  }
}

async function deleteShortcut(id) {
  const shortcuts = await getShortcuts();
  if (shortcuts[id]) {
    _undoStack.push({ type: 'delete', entry: shortcuts[id] });
    if (_undoStack.length > 5) _undoStack.shift();
  }
  delete shortcuts[id];
  cachedShortcuts = shortcuts;
  const encrypted = await encryptData(JSON.stringify(shortcuts));
  await chrome.storage.local.set({ shortcuts: encrypted });
  return { ok: true };
}

async function toggleShortcut(id, enabled) {
  const shortcuts = await getShortcuts();
  if (shortcuts[id]) {
    shortcuts[id].enabled = enabled;
    cachedShortcuts = shortcuts;
    const encrypted = await encryptData(JSON.stringify(shortcuts));
    await chrome.storage.local.set({ shortcuts: encrypted });
  }
  return { ok: true };
}

async function toggleDomain(domain, enabled) {
  const data = await chrome.storage.local.get('domainStates');
  const states = data.domainStates || {};
  states[domain] = enabled;
  await chrome.storage.local.set({ domainStates: states });
  return { ok: true };
}

async function getDomainStates() {
  const data = await chrome.storage.local.get('domainStates');
  return data.domainStates || {};
}

async function checkConflict(shortcut, excludeId = null, domain = null) {
  const normalized = normalizeShortcut(shortcut);
  if (CHROME_RESERVED[normalized]) {
    return { conflict: true, type: 'chrome', message: `"${shortcut}" is reserved by Chrome ${CHROME_RESERVED[normalized]}.` };
  }
  const shortcuts = await getShortcuts();
  for (const [id, entry] of Object.entries(shortcuts)) {
    if (id === excludeId) continue;
    const entryNorm = normalizeShortcut(entry.shortcut);
    if (entryNorm !== normalized) continue;
    // Only conflict if same domain, OR if either is global (no domain)
    const sameOrGlobal = !domain || !entry.domain || entry.domain === domain;
    if (sameOrGlobal) {
      return { conflict: true, type: 'conflict', existingId: id, existingName: entry.name, message: `Already used by "${entry.name}" on ${entry.domain || 'all sites'}.` };
    }
  }
  return { conflict: false };
}

async function executeActions(actions, tabId) {
  let successCount = 0;
  
  // Check blacklist
  const blacklist = _remoteConfig?.blacklisted_domains || [];
  const tab = await chrome.tabs.get(tabId);
  let domain = '';
  try { domain = new URL(tab.url).hostname; } catch (_) {}
  if (blacklist.some(b => domain.endsWith(b))) {
    console.warn('ShiftController: Blocked on blacklisted domain', domain);
    return;
  }
  
  for (const action of actions) {
    try {
      // triggerElement must be fully self-contained (no external references)
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },  // allFrames:false = top frame only
        func: triggerElement,
        args: [action.selector, action.selectorType, action.fallbacks]
      });
      if (results && results[0] && results[0].result === true) successCount++;
    } catch (err) {
      console.warn('executeActions: scripting failed for action', action.selector, err);
    }
    if (action.delay > 0) {
      await new Promise(r => setTimeout(r, action.delay));
    }
  }
  if (successCount > 0) {
    const data = await chrome.storage.local.get('analytics');
    const analytics = data.analytics || { clicksSaved: 0 };
    analytics.clicksSaved += successCount;
    await chrome.storage.local.set({ analytics });
  }
}



chrome.alarms.create("dataPurge", { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dataPurge") {
    pruneOldAnalytics();
  }
});

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sc_assign',
    title: 'Assign ShiftController Shortcut',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'sc_assign') return;
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_INSPECTOR',
      sessionId: Date.now().toString()
    });
  } catch (err) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/inspector.js'] });
    chrome.tabs.sendMessage(tab.id, { type: 'START_INSPECTOR', sessionId: Date.now().toString() });
  }
});

async function pruneOldAnalytics() {
  const data = await chrome.storage.local.get('analytics');
  if (data.analytics && data.analytics.clicksSaved > 999999) {
    await chrome.storage.local.set({ analytics: { clicksSaved: 0 } });
  }
}

// Undo deletion support
async function undoDelete() {
  if (!_undoStack.length) return { ok: false, message: 'Nothing to undo.' };
  const last = _undoStack.pop();
  if (last.type === 'delete') {
    const result = await saveShortcut(last.entry);
    return result;
  }
  return { ok: false };
}

// Macro support functions
async function getMacros() {
  const data = await chrome.storage.local.get('macros');
  if (!data.macros) return {};
  try {
    const decrypted = await decryptData(data.macros);
    return decrypted ? JSON.parse(decrypted) : {};
  } catch {
    return (typeof data.macros === 'string') ? JSON.parse(data.macros) : (data.macros || {});
  }
}

async function saveMacro(macro) {
  try {
    const macros = await getMacros();
    macros[macro.id] = macro;
    const encrypted = await encryptData(JSON.stringify(macros));
    await chrome.storage.local.set({ macros: encrypted });
    return { ok: true };
  } catch (err) {
    console.error('saveMacro error:', err);
    return { ok: false, error: err.message };
  }
}

async function deleteMacro(id) {
  const macros = await getMacros();
  delete macros[id];
  const encrypted = await encryptData(JSON.stringify(macros));
  await chrome.storage.local.set({ macros: encrypted });
  return { ok: true };
}

async function executeMacro(macroId, tabId) {
  const macros = await getMacros();
  const macro = macros[macroId];
  if (!macro || !macro.enabled) return { ok: false };
  const shortcuts = await getShortcuts();

  async function runSteps(steps) {
    for (const step of steps) {
      if (step.type === 'shortcut') {
        const target = shortcuts[step.targetId];
        if (target && target.actions) {
          await executeActions(target.actions, tabId);
        }
      } else if (step.type === 'delay') {
        await new Promise(r => setTimeout(r, step.ms || 500));
      } else if (step.type === 'loop') {
        for (let i = 0; i < (step.count || 1); i++) {
          await runSteps(step.steps || []);
          if (i < step.count - 1) {
            await new Promise(r => setTimeout(r, step.intervalMs || 1000));
          }
        }
      }
    }
  }

  await runSteps(macro.steps);
  return { ok: true };
}
