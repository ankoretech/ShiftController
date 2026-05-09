
/**
 * ShiftController Popup Script
 * Handles config loading, theme application, and UI initialization
 */

const $ = id => document.getElementById(id);

let currentTab = null;
let recordingSession = null;
let currentConfig = null;
let isCapturingShortcut = false;

/**
 * Initialize popup with config-driven system
 */
async function init() {
  try {
    // Load and resolve config
    console.log('[ShiftController] Initializing popup...');
    currentConfig = await initializeConfig();
    
    // Apply theme and branding immediately
    applyTheme(currentConfig);
    applyTypography(currentConfig);
    applyBranding(currentConfig);
    
    // Check kill switch FIRST before anything else
    const killSwitchStatus = await checkKillSwitch(currentConfig);
    if (killSwitchStatus.active) {
      return handleKillSwitch(killSwitchStatus);
    }
    
    // Check consent requirement
    const consentRequired = currentConfig.features?.consent_required !== false;
    if (consentRequired) {
      const localData = await chrome.storage.local.get('hasConsented');
      if (!localData.hasConsented) {
        return showConsentOverlay();
      }
    } else {
      // Hide consent overlay if not required
      $('consent-overlay').style.display = 'none';
    }
    
    // Initialize app normally
    await initializeApp();
    
  } catch (err) {
    console.error('[ShiftController] Init error:', err);
    // Fallback: still show the app with defaults
    currentConfig = DEFAULT_CONFIG;
    applyTheme(currentConfig);
    applyBranding(currentConfig);
    await initializeApp();
  }
}

/**
 * Handle kill switch activation
 */
async function handleKillSwitch(status) {
  console.log('[ShiftController] Kill switch active, mode:', status.mode);
  
  if (status.mode === 'brick') {
    // Show brick/tombstone UI
    showBrickUI(currentConfig);
  } else if (status.mode === 'message') {
    // Show message panel
    showKillSwitchMessage(currentConfig);
  }
  // else 'silent' - do nothing, just blank popup
}

/**
 * Show consent overlay with config-driven messages
 */
function showConsentOverlay() {
  const overlay = $('consent-overlay');
  overlay.style.display = 'flex';
  
  const acceptBtn = $('btn-consent-accept');
  acceptBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ hasConsented: true });
    overlay.style.display = 'none';
    initializeApp();
  });
}

/**
 * Initialize main app after config/consent checks
 */
async function initializeApp() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Extract domain
    let domain = '';
    try {
      domain = new URL(tab.url).hostname;
    } catch (_) {}
    $('domain-label').textContent = domain || tab.url || 'Unknown';

    // Show/hide domain row based on config
    const showDomainToggle = currentConfig.features?.show_domain_toggle !== false;
    if (!showDomainToggle) {
      $('domain-row').classList.add('hidden');
    }

    // Get domain states
    const states = await bg('GET_DOMAIN_STATES');
    const enabled = !states || states[domain] !== false;
    $('domain-toggle').checked = enabled;

    $('domain-toggle').addEventListener('change', async (e) => {
      await bg('TOGGLE_DOMAIN', { domain, enabled: e.target.checked });
    });

    // Update author credit visibility
    const authorLink = document.querySelector('.author-credit') || document.querySelector('a[href*="nayem.net"]');
    const showAuthor = currentConfig.branding?.show_author !== false;
    if (authorLink && !showAuthor) {
      authorLink.classList.add('hidden');
    }

    // Update shortcut hints if needed
    const showHints = currentConfig.features?.show_shortcut_hints !== false;
    const hintsDiv = document.querySelector('.shortcut-hints') || 
                     document.querySelector('[style*="font-size:10px"]');
    if (hintsDiv && !showHints) {
      hintsDiv.style.display = 'none';
    } else if (hintsDiv) {
      // Update with config hotkeys
      const recordHotkey = currentConfig.features?.record_hotkey || 'shift+s';
      const stopHotkey = currentConfig.features?.stop_hotkey || 'Escape';
      hintsDiv.textContent = `Start Record: ${recordHotkey} | Stop: ${stopHotkey}`;
    }

    // Show/hide developer panel tab if it exists
    const showDevPanel = currentConfig.features?.show_developer_panel !== false;
    const devPanel = document.querySelector('[data-panel="developer"]') || 
                     document.querySelector('#developer-tab');
    if (devPanel && !showDevPanel) {
      devPanel.style.display = 'none';
    }

    // Render shortcuts
    await renderShortcuts();

    // Attach event listeners
    $('btn-record').addEventListener('click', startRecording);
    $('btn-dashboard').addEventListener('click', openDashboard);

  } catch (err) {
    console.error('[ShiftController] App init error:', err);
  }
}

/**
 * Send message to background script
 */
function bg(type, extra = {}) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('bg:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (e) {
      console.warn('bg:', e);
      resolve(null);
    }
  });
}

/**
 * Inject inspector content script
 */
async function injectInspectorScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/inspector.js']
    });
  } catch (error) {
    console.error('Inspector injection failed:', error);
  }
}

/**
 * Render shortcuts list
 */
async function renderShortcuts() {
  const shortcuts = await bg('GET_SHORTCUTS') || {};
  const list = $('shortcuts-list');
  const empty = $('empty-state');
  const count = $('shortcut-count');
  let domain = '';
  try {
    domain = currentTab ? new URL(currentTab.url).hostname : '';
  } catch (_) {}

  const entries = Object.values(shortcuts).filter(e => !e.domain || e.domain === domain);
  count.textContent = entries.length;
  empty.style.display = entries.length ? 'none' : 'flex';

  list.querySelectorAll('.shortcut-item').forEach(el => el.remove());

  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <img class="shortcut-item-favicon" src="https://www.google.com/s2/favicons?sz=16&domain=${entry.domain || 'global'}" onerror="this.style.display='none'"/>
      <div class="shortcut-item-info">
        <div class="shortcut-item-name">${escHtml(entry.name)}</div>
        <span class="shortcut-item-key">${escHtml(entry.shortcut)}</span>
      </div>
      <div class="shortcut-item-actions">
        <label class="toggle item-toggle">
          <input type="checkbox" ${entry.enabled ? 'checked' : ''} data-id="${entry.id}"/>
          <span class="slider"></span>
        </label>
        <button class="btn-edit" data-id="${entry.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-delete" data-id="${entry.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `;
    item.querySelector('input[type=checkbox]').addEventListener('change', async (e) => {
      await bg('TOGGLE_SHORTCUT', { id: entry.id, enabled: e.target.checked });
    });
    item.querySelector('.btn-edit').addEventListener('click', async () => {
      await chrome.storage.session.set({ editingShortcutId: entry.id, editingShortcut: entry });
      await injectInspectorScript(currentTab.id);
      try {
        await chrome.tabs.sendMessage(currentTab.id, { 
          type: 'START_INSPECTOR', 
          sessionId: Date.now().toString(),
          editMode: true,
          editingShortcut: entry
        });
        window.close();
      } catch (err) {
        console.error('Failed to start inspector in edit mode:', err);
      }
    });
    item.querySelector('.btn-delete').addEventListener('click', async () => {
      await bg('DELETE_SHORTCUT', { id: entry.id });
      showUndoToast();
      await renderShortcuts();
    });
    list.appendChild(item);
  }
}

/**
 * Show undo toast notification
 */
async function showUndoToast() {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = 'Shortcut deleted <button id="undo-btn">Undo</button>';
  document.body.appendChild(toast);
  
  document.getElementById('undo-btn').addEventListener('click', async () => {
    await bg('UNDO_DELETE');
    toast.remove();
    await renderShortcuts();
  });
  
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5000);
}

/**
 * Start recording a new shortcut
 */
async function startRecording() {
  if (!currentTab || !currentTab.id) {
    alert('Unable to identify the active tab. Please try again on a normal website.');
    return;
  }

  recordingSession = Date.now().toString();

  try {
    await chrome.tabs.sendMessage(currentTab.id, { type: 'START_INSPECTOR', sessionId: recordingSession });
    window.close();
  } catch (err) {
    console.warn('Start inspector message failed, attempting injection', err);
    await injectInspectorScript(currentTab.id);
    try {
      await chrome.tabs.sendMessage(currentTab.id, { type: 'START_INSPECTOR', sessionId: recordingSession });
      window.close();
    } catch (sendErr) {
      console.error('Unable to start ShiftController inspector on this page.', sendErr);
      alert('ShiftController cannot start recording on this page. Please open a normal website and try again.');
      recordingSession = null;
    }
  }
}

/**
 * Open dashboard in new tab
 */
function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
}

/**
 * Escape HTML special characters
 */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', init);

