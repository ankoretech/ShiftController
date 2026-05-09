
(function () {
  'use strict';
  try {

  if (window.__shiftcontroller_loaded__) return;
  window.__shiftcontroller_loaded__ = true;
  let inspectorActive = false;
  let hoveredEl = null;
  let overlay = null;
  let recordingActions = [];
  let currentSessionId = null;

  let shadowHost = null;
  let shadowRoot = null;
  let modalEl = null;
  let sidebarEl = null;

  let pendingSelectorInfo = null;
  let domainShortcuts = [];
  let editingShortcutId = null;

  async function injectUI() {
    if (shadowHost) return;

    shadowHost = document.createElement('div');
    shadowHost.id = '__ks_ui_host__';
    shadowHost.style.cssText = 'position:fixed; z-index:2147483647; top:0; left:0; width:0; height:0; pointer-events:none;';
    document.body.appendChild(shadowHost);

    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; font-family: 'Montserrat', sans-serif; }

      .sidebar {
        position: fixed; top: 20px; left: 20px; width: 280px; max-height: calc(100vh - 40px);
        background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
        color: #f0f0f0; padding: 15px; overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); pointer-events: auto;
        transition: transform 0.3s ease;
      }
      .sidebar h2 { font-size: 14px; margin: 0 0 10px 0; color: #a3ff00; text-transform: uppercase; letter-spacing: 1px; }
      .shortcut-item {
        display: flex; justify-content: space-between; align-items: center;
        background: #1c1c1c; margin-bottom: 8px; padding: 8px 10px; border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.05); font-size: 12px;
      }
      .shortcut-key { background: rgba(163,255,0,0.15); color: #a3ff00; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; }

      .exit-btn {
        position: fixed; bottom: 20px; right: 20px; background: #ff4444; color: white;
        border: none; border-radius: 50px; padding: 12px 24px; font-size: 14px; font-weight: bold;
        cursor: pointer; pointer-events: auto; box-shadow: 0 4px 15px rgba(255,68,68,0.4);
        transition: transform 0.2s, background 0.2s;
      }
      .exit-btn:hover { background: #ff2222; transform: scale(1.05); }

      .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);
        display: flex; justify-content: center; align-items: center;
        pointer-events: auto; opacity: 0; transition: opacity 0.2s;
      }
      .modal-overlay:not(.active) { pointer-events: none; }
      .modal-overlay.active { opacity: 1; }

      .modal {
        background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
        width: 320px; padding: 20px; color: white; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        transform: translateY(20px); transition: transform 0.2s;
      }
      .modal-overlay.active .modal { transform: translateY(0); }

      .modal h3 { margin: 0 0 15px 0; font-size: 16px; color: #a3ff00; }
      .form-group { margin-bottom: 15px; }
      .form-group label { display: block; font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 5px; }
      .form-group input { 
        width: 100%; background: #1c1c1c; border: 1px solid #333; color: white; 
        padding: 10px; border-radius: 6px; outline: none; font-size: 13px;
      }
      .form-group input:focus { border-color: #a3ff00; }

      .error-msg { color: #ff4444; font-size: 11px; margin-top: 5px; display: block; min-height: 14px; }
      .warning-msg { color: #ff8800; font-size: 11px; margin-top: 5px; display: block; min-height: 14px; }

      .btn-row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
      .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; border: none; }
      .btn-cancel { background: transparent; color: #aaa; border: 1px solid #444; }
      .btn-cancel:hover { background: #222; color: white; }
      .btn-overwrite { background: #ff8800; color: white; border: 1px solid #ff8800; }
      .btn-overwrite:hover { background: #ff6600; border-color: #ff6600; }
      .btn-overwrite:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-save { background: #a3ff00; color: black; }
      .btn-save:hover { background: #8fd900; }
      .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

      .btn-add { background: #333; color: white; margin-right: auto; }
      .btn-add:hover { background: #444; }

      .suggestion-chip {
        display: inline-block; background: #1c1c1c; border: 1px solid #333; color: #aaa;
        padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; margin: 0 4px 4px 0; font-family: monospace;
      }
      .suggestion-chip:hover { border-color: #a3ff00; color: #a3ff00; }
      .suggestion-chip.active { background: #a3ff00; color: black; border-color: #a3ff00; }
    `;
    shadowRoot.appendChild(style);

    sidebarEl = document.createElement('div');
    sidebarEl.className = 'sidebar';
    sidebarEl.innerHTML = `<h2>Site Shortcuts</h2><div id="ks-shortcut-list">Loading...</div>`;
    shadowRoot.appendChild(sidebarEl);

    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-btn';
    exitBtn.textContent = 'Exit Inspector';
    exitBtn.onclick = () => stopInspector();
    shadowRoot.appendChild(exitBtn);

    modalEl = document.createElement('div');
    modalEl.className = 'modal-overlay';
    modalEl.innerHTML = `
      <div class="modal">
        <h3>Assign Shortcut</h3>
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="ks-name" placeholder="e.g. Like Button" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Shortcut Key</label>
          <input type="text" id="ks-key" placeholder="Press keys... (Ctrl+Enter to save, X to cancel)" readonly />
          <span class="error-msg" id="ks-error"></span>
        </div>
        <div class="form-group" id="ks-suggestions-container">
          <label>Suggestions</label>
          <div id="ks-suggestions"></div>
        </div>
        <div class="form-group" id="ks-delay-group" style="display:none;">
          <label>Delay between steps (ms)</label>
          <input type="number" id="ks-delay" value="300" min="0" max="5000" step="50" />
        </div>
        <div class="form-group" id="ks-warning-group" style="display:none;">
          <span class="warning-msg" id="ks-warning" style="color: #ff8800;"></span>
        </div>
        <div class="btn-row">
          <button class="btn btn-cancel" id="ks-cancel-btn" title="Press X to cancel">Cancel</button>
          <button class="btn btn-overwrite" id="ks-overwrite-btn" style="display:none;" title="Ctrl+Enter to save">Overwrite</button>
          <button class="btn btn-save" id="ks-save-btn" disabled title="Press Ctrl+Enter to save">Save</button>
        </div>
      </div>
    `;
    shadowRoot.appendChild(modalEl);

    const keyInput = shadowRoot.getElementById('ks-key');
    const nameInput = shadowRoot.getElementById('ks-name');
    const cancelBtn = shadowRoot.getElementById('ks-cancel-btn');
    const overwriteBtn = shadowRoot.getElementById('ks-overwrite-btn');
    const saveBtn = shadowRoot.getElementById('ks-save-btn');

    keyInput.addEventListener('keydown', onModalKeyCapture);
    nameInput.addEventListener('input', validateModal);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const saveBtn = shadowRoot.getElementById('ks-save-btn');
        if (!saveBtn.disabled) saveModalShortcut();
      }
    });
    cancelBtn.addEventListener('click', closeModal);
    overwriteBtn.addEventListener('click', saveModalShortcut);
    saveBtn.addEventListener('click', saveModalShortcut);

    await updateSidebar();
  }

  async function updateSidebar() {
    if (!shadowRoot) return;
    const shortcuts = await new Promise(resolve => chrome.runtime.sendMessage({ type: 'GET_SHORTCUTS' }, resolve)) || {};
    const domain = window.location.hostname;

    domainShortcuts = Object.values(shortcuts).filter(s => s.domain === domain || !s.domain);
    const listEl = shadowRoot.getElementById('ks-shortcut-list');

    if (domainShortcuts.length === 0) {
      listEl.innerHTML = '<div style="color:#CFCFCF; font-size:12px;">No shortcuts assigned yet.</div>';
    } else {
      listEl.innerHTML = '';
      domainShortcuts.forEach(s => {
        const div = document.createElement('div');
        div.className = 'shortcut-item';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.title = 'Double-click to edit shortcut key';
        
        const infoSpan = document.createElement('span');
        infoSpan.style.flex = '1';
        infoSpan.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="flex: 1;">${s.name.length > 15 ? s.name.substring(0, 12) + '...' : s.name}</span>
            <span class="shortcut-key">${s.shortcut}</span>
          </div>
        `;
        infoSpan.addEventListener('dblclick', () => editShortcut(s));
        div.appendChild(infoSpan);
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.style.cssText = `
          background: #1c1c1c; border: 1px solid #333; color: #a3ff00; 
          padding: 4px 8px; border-radius: 4px; margin-left: 4px; cursor: pointer; 
          font-size: 11px; font-weight: bold;
        `;
        editBtn.textContent = '✎';
        editBtn.title = 'Edit shortcut';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          editShortcut(s);
        });
        div.appendChild(editBtn);
        
        // Delete button - minimal style
        const deleteBtn = document.createElement('button');
        deleteBtn.style.cssText = `
          background: transparent; border: none; color: #888; 
          padding: 4px 6px; border-radius: 4px; margin-left: 4px; cursor: pointer; 
          font-size: 12px; transition: color 0.2s;
        `;
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'Delete shortcut';
        deleteBtn.addEventListener('mouseover', () => deleteBtn.style.color = '#ff6666');
        deleteBtn.addEventListener('mouseout', () => deleteBtn.style.color = '#888');
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete shortcut "${s.name}"?`)) {
            await new Promise(resolve => chrome.runtime.sendMessage({ 
              type: 'DELETE_SHORTCUT', 
              id: s.id 
            }, resolve));
            await updateSidebar();
          }
        });
        div.appendChild(deleteBtn);
        
        listEl.appendChild(div);
      });
    }
  }

  async function editShortcut(s) {
    editingShortcutId = s.id;
    recordingActions = [...s.actions];

    hideOverlay();

    const nameInput = shadowRoot.getElementById('ks-name');
    const keyInput = shadowRoot.getElementById('ks-key');
    const errorMsg = shadowRoot.getElementById('ks-error');
    const saveBtn = shadowRoot.getElementById('ks-save-btn');
    const overwriteBtn = shadowRoot.getElementById('ks-overwrite-btn');
    const suggContainer = shadowRoot.getElementById('ks-suggestions');

    nameInput.value = s.name;
    keyInput.value = s.shortcut;
    errorMsg.textContent = '';
    saveBtn.disabled = false;
    
    // Show overwrite button for existing shortcuts
    overwriteBtn.style.display = 'inline-block';
    overwriteBtn.disabled = false;
    saveBtn.style.display = 'none';
    
    suggContainer.innerHTML = '<span style="color:#666; font-size:11px;">Editing existing shortcut... Press Ctrl+Enter to overwrite or X to cancel</span>';

    modalEl.classList.add('active');
    keyInput.focus();
    validateModal();
  }

  function removeUI() {
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
      modalEl = null;
      sidebarEl = null;
    }
  }

  function getElementLabel(el) {
    const tag = el.tagName.toLowerCase();
    const aria = el.getAttribute('aria-label');
    const title = el.getAttribute('title');
    const testid = el.dataset && el.dataset.testid;
    const id = el.id && !/^\d/.test(el.id) ? el.id : null;
    const cls = [...el.classList].filter(c => !/[0-9]{3,}/.test(c))[0] || null;
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    const readable = aria || title || testid || text || '';
    const qualifier = id ? `#${id}` : cls ? `.${cls}` : '';
    return `<${tag}${qualifier}>${readable ? '  ' + readable : ''}`;
  }

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = '__ks_overlay__';
    overlay.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:2147483646',
      'border:2px solid #a3ff00', 'border-radius:4px',
      'box-shadow:0 0 12px #a3ff0080,inset 0 0 8px #a3ff0020',
      'transition:top .08s,left .08s,width .08s,height .08s, border-color .15s, box-shadow .15s',
      'display:none', 'background:rgba(163,255,0,0.05)'
    ].join(';');
    const lbl = document.createElement('div');
    lbl.id = '__ks_elabel__';
    lbl.style.cssText = [
      'position:absolute', 'left:-2px',
      'background:#a3ff00', 'color:#000',
      'font:700 10px/1 monospace', 'padding:3px 7px',
      'border-radius:3px 3px 0 0', 'white-space:nowrap',
      'max-width:280px', 'overflow:hidden', 'text-overflow:ellipsis',
      'pointer-events:none', 'top:-20px', 'transition: background .15s, color .15s'
    ].join(';');
    overlay.appendChild(lbl);
    document.body.appendChild(overlay);
  }

  function positionOverlay(el, isUnique) {
    if (!overlay) return;
    const r = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = r.top + 'px';
    overlay.style.left = r.left + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';

    const color = isUnique ? '#a3ff00' : '#ff4444';
    const shadow = isUnique ? 'rgba(163,255,0,0.5)' : 'rgba(255,68,68,0.5)';
    overlay.style.borderColor = color;
    overlay.style.boxShadow = `0 0 12px ${shadow},inset 0 0 8px ${shadow.replace('0.5', '0.2')}`;

    const lbl = overlay.querySelector('#__ks_elabel__');
    if (lbl) {
      lbl.textContent = getElementLabel(el) + (isUnique ? '' : ' (Not Unique)');
      lbl.style.background = color;
      lbl.style.color = isUnique ? '#000' : '#fff';
      if (r.top < 28) {
        lbl.style.top = 'auto'; lbl.style.bottom = '-20px';
        lbl.style.borderRadius = '0 0 3px 3px';
      } else {
        lbl.style.top = '-20px'; lbl.style.bottom = 'auto';
        lbl.style.borderRadius = '3px 3px 0 0';
      }
    }
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  function getBestSelector(el) {
    const textContent = (el.textContent || '').trim().slice(0, 50);
    const fallbacks = {
      text: textContent.length > 0 ? textContent : null,
      id: el.id && !/^\d/.test(el.id) ? el.id : null,
      aria: el.getAttribute('aria-label') || null
    };

    function findPrimary() {

      if (el.dataset.testid) return { selector: el.dataset.testid, selectorType: 'testid' };

      const specificAttrs = ['aria-label', 'name', 'placeholder', 'alt', 'href'];
      for (const attr of specificAttrs) {
        const val = el.getAttribute(attr);
        if (val && document.querySelectorAll(`[${CSS.escape(attr)}="${CSS.escape(val)}"]`).length === 1) {
          if (attr === 'aria-label') return { selector: val, selectorType: 'aria' };
          return { selector: `[${CSS.escape(attr)}="${CSS.escape(val)}"]`, selectorType: 'css' };
        }
      }

      if (el.id && !/^\d/.test(el.id) && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
        return { selector: '#' + CSS.escape(el.id), selectorType: 'css' };
      }

      const cssPath = getCSSPath(el);
      if (cssPath && document.querySelectorAll(cssPath).length === 1) {
        return { selector: cssPath, selectorType: 'css' };
      }

      if (textContent && textContent.length < 50) {

        const tag = el.tagName.toLowerCase();
        const cleanText = textContent.replace(/'/g, "\\'");
        const xpathText = `//${tag}[normalize-space(text())='${cleanText}']`;
        try {
          const result = document.evaluate(xpathText, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) return { selector: xpathText, selectorType: 'xpath' };
        } catch (e) { }
      }

      return { selector: getXPath(el), selectorType: 'xpath' };
    }

    const primary = findPrimary();
    return { ...primary, fallbacks };
  }

  function getCSSPath(el) {
    if (!el || el === document.body) return null;
    const parts = [];
    let curr = el;
    while (curr && curr !== document.body && curr.nodeType === Node.ELEMENT_NODE) {
      let seg = curr.tagName.toLowerCase();
      // Prefer stable ID
      if (curr.id && !/^\d/.test(curr.id) &&
          document.querySelectorAll('#' + CSS.escape(curr.id)).length === 1) {
        return '#' + CSS.escape(curr.id) + (parts.length ? ' > ' + parts.join(' > ') : '');
      }
      // Use stable class(es) — skip classes with 3+ consecutive digits
      const stableClasses = curr.className && typeof curr.className === 'string'
        ? curr.className.split(/\s+/).filter(c => c && !/\d{3,}/.test(c) && c.length < 30).slice(0, 2)
        : [];
      if (stableClasses.length) seg += '.' + stableClasses.join('.');
      // Add nth-of-type only if siblings exist
      const parent = curr.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(c => c.tagName === curr.tagName);
        if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(curr) + 1})`;
      }
      parts.unshift(seg);
      curr = curr.parentElement;
      if (parts.length > 6) break;
    }
    return parts.length ? parts.join(' > ') : null;
  }

  function getXPath(el) {
    const parts = [];
    let curr = el;
    while (curr && curr.nodeType === Node.ELEMENT_NODE) {
      let idx = 1;
      let sib = curr.previousSibling;
      while (sib) {
        if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === curr.tagName) idx++;
        sib = sib.previousSibling;
      }
      parts.unshift(`${curr.tagName.toLowerCase()}[${idx}]`);
      curr = curr.parentNode;
    }
    return '/' + parts.join('/');
  }

  function isSelectorUnique(selectorInfo) {
    try {
      const { selector, selectorType } = selectorInfo;
      if (selectorType === 'css') {
        return document.querySelectorAll(selector).length === 1;
      } else if (selectorType === 'xpath') {
        const res = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return res.snapshotLength === 1;
      } else if (selectorType === 'testid') {
        return document.querySelectorAll(`[data-testid="${CSS.escape(selector)}"]`).length === 1;
      } else if (selectorType === 'aria') {
        return document.querySelectorAll(`[aria-label="${CSS.escape(selector)}"]`).length === 1;
      }
    } catch (e) { }
    return false;
  }

  async function startInspector(sessionId) {
    if (window.top !== window) return;
    inspectorActive = true;
    currentSessionId = sessionId;
    recordingActions = [];

    createOverlay();
    await injectUI();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onInspectorClick, true);
    document.addEventListener('keydown', onInspectorKey, true);

    document.body.style.cursor = 'crosshair';
  }

  function stopInspector() {
    inspectorActive = false;

    hideOverlay();
    removeUI();
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onInspectorClick, true);
    document.removeEventListener('keydown', onInspectorKey, true);

    document.body.style.cursor = '';

    try {
      chrome.runtime.sendMessage({ type: 'INSPECTOR_CANCELLED', sessionId: currentSessionId });
    } catch(e) {}
  }

  function isSensitiveField(el) {
    if (el.tagName === 'INPUT') {
      const type = el.type.toLowerCase();
      if (['password', 'hidden'].includes(type)) return true;
      const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (autocomplete.includes('cc-number') || autocomplete.includes('password') || autocomplete.includes('new-password')) return true;
    }
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    if (aria.includes('password') || aria.includes('credit card') || aria.includes('card number')) return true;
    return false;
  }

  let uniquenessTimeout;
  function onMouseOver(e) {
    if (!e.isTrusted) return;
    if (!inspectorActive || modalEl?.classList.contains('active')) return;
    const el = e.target;

    if (shadowHost && e.composedPath().includes(shadowHost)) return;
    if (el === overlay || el === document.body) return;
    if (isSensitiveField(el)) return;

    hoveredEl = el;

    if (sidebarEl) {
      const rect = sidebarEl.getBoundingClientRect();
      const margin = 80;
      if (
        e.clientX > rect.left - margin &&
        e.clientX < rect.right + margin &&
        e.clientY > rect.top - margin &&
        e.clientY < rect.bottom + margin
      ) {
        if (rect.left < window.innerWidth / 2) {
          sidebarEl.style.left = 'auto';
          sidebarEl.style.right = '20px';
        } else {
          sidebarEl.style.right = 'auto';
          sidebarEl.style.left = '20px';
        }
      }
    }

    positionOverlay(el, true);

    clearTimeout(uniquenessTimeout);
    uniquenessTimeout = setTimeout(() => {
      if (hoveredEl === el) {
        const selInfo = getBestSelector(el);
        const isUnique = isSelectorUnique(selInfo);
        positionOverlay(el, isUnique);
      }
    }, 50);
  }

  function onInspectorClick(e) {
    if (!e.isTrusted) return;
    if (!inspectorActive || !hoveredEl || modalEl?.classList.contains('active')) return;

    if (shadowHost && e.composedPath().includes(shadowHost)) return;

    e.preventDefault();
    e.stopPropagation();

    const selectorInfo = getBestSelector(hoveredEl);
    const actionItem = { ...selectorInfo, delay: recordingActions.length > 0 ? 400 : 0 };
    recordingActions.push(actionItem);

    // Visual feedback: flash the overlay green briefly
    showRecordedFeedback(hoveredEl, recordingActions.length);

    // Update the sidebar counter
    updateRecordingCounter();
  }

  function showRecordedFeedback(el, count) {
    if (!overlay) return;
    positionOverlay(el, true);
    const lbl = overlay.querySelector('#__ks_elabel__');
    if (lbl) {
      const prev = lbl.textContent;
      lbl.textContent = `✓ Step ${count} recorded`;
      lbl.style.background = '#00cc88';
      setTimeout(() => {
        lbl.textContent = prev;
        lbl.style.background = '#a3ff00';
      }, 800);
    }
  }

  function updateRecordingCounter() {
    if (!shadowRoot) return;
    const h2 = sidebarEl?.querySelector('h2');
    if (h2) {
      h2.textContent = recordingActions.length > 0
        ? `Recording: ${recordingActions.length} step(s) — Click more or press Escape to save`
        : 'Site Shortcuts';
    }
    const exitBtn = shadowRoot.querySelector('.exit-btn');
    if (exitBtn) {
      exitBtn.textContent = recordingActions.length > 0 ? `Save (${recordingActions.length} steps)` : 'Exit Inspector';
      exitBtn.onclick = () => {
        if (recordingActions.length > 0) {
          const el = hoveredEl || document.activeElement;
          const name = el ? (el.textContent.trim().slice(0, 50) || el.tagName.toLowerCase()) : 'Action Sequence';
          openModal(name, el ? el.tagName.toLowerCase() : 'div');
        } else {
          stopInspector();
        }
      };
    }
  }

  function buildComboFromEvent(e) {
    let parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    if (e.metaKey) parts.push('meta');

    if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(e.key)) {
      if (parts.length === 1) return '';
    } else {
      let key = e.key.toLowerCase();
      if (key === ' ') key = 'space';
      parts.push(key);
    }
    return parts.join('+');
  }

  function onInspectorKey(e) {
    if (!e.isTrusted) return;
    if (e.key === 'Escape' && !modalEl?.classList.contains('active')) {
      stopInspector();
      return;
    }

    if (!modalEl?.classList.contains('active') && hoveredEl) {

      const combo = buildComboFromEvent(e);
      if (combo) {
        e.preventDefault();
        e.stopPropagation();

        const selectorInfo = getBestSelector(hoveredEl);
        pendingSelectorInfo = { ...selectorInfo, delay: 300 };
        recordingActions.push(pendingSelectorInfo);

        const elementText = hoveredEl.textContent.trim().slice(0, 50) || hoveredEl.tagName.toLowerCase();
        openModal(elementText, hoveredEl.tagName.toLowerCase(), combo);
      }
    }
  }

  async function openModal(suggestedName, tag, prefillKey = '') {
    if (!modalEl) return;

    hideOverlay();

    const nameInput = shadowRoot.getElementById('ks-name');
    const keyInput = shadowRoot.getElementById('ks-key');
    const errorMsg = shadowRoot.getElementById('ks-error');
    const saveBtn = shadowRoot.getElementById('ks-save-btn');
    const overwriteBtn = shadowRoot.getElementById('ks-overwrite-btn');
    const suggContainer = shadowRoot.getElementById('ks-suggestions');
    const delayGroup = shadowRoot.getElementById('ks-delay-group');
    const warningGroup = shadowRoot.getElementById('ks-warning-group');
    const warningMsg = shadowRoot.getElementById('ks-warning');

    nameInput.value = suggestedName;
    keyInput.value = prefillKey;
    errorMsg.textContent = '';
    saveBtn.disabled = !prefillKey;
    
    // Hide overwrite button initially for new shortcuts
    overwriteBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    warningGroup.style.display = 'none';
    warningMsg.textContent = '';
    editingShortcutId = null;
    
    // Check for existing shortcut with same key
    if (prefillKey) {
      const conflict = await new Promise(resolve => chrome.runtime.sendMessage({ 
        type: 'CHECK_CONFLICT', 
        shortcut: prefillKey,
        excludeId: null,
        domain: window.location.hostname
      }, resolve));
      
      if (conflict && conflict.conflict) {
        // Check if it's a reserved key vs existing shortcut
        if (conflict.type === 'conflict') {
          // Existing shortcut found - show overwrite option
          overwriteBtn.style.display = 'inline-block';
          overwriteBtn.disabled = false;
          saveBtn.style.display = 'inline-block';
          warningGroup.style.display = 'block';
          warningMsg.textContent = '⚠ This shortcut key already exists. Use "Overwrite" to replace it.';
          editingShortcutId = conflict.existingId || null;
        } else {
          // Reserved key - don't show overwrite, will show error on keypress
          overwriteBtn.style.display = 'none';
          warningGroup.style.display = 'none';
          warningMsg.textContent = '';
        }
      }
    }
    
    suggContainer.innerHTML = 'Generating...';

    // Show delay input only if multiple actions recorded
    if (recordingActions.length > 1 && delayGroup) {
      delayGroup.style.display = 'block';
    } else if (delayGroup) {
      delayGroup.style.display = 'none';
    }

    const suggestions = await suggestShortcuts(suggestedName, tag);
    renderModalSuggestions(suggestions);

    modalEl.classList.add('active');
    keyInput.focus();
    validateModal();
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove('active');
    hoveredEl = null;
    pendingSelectorInfo = null;
    recordingActions = [];
    editingShortcutId = null;
  }

  function validateModal() {
    if (!shadowRoot) return;
    const nameInput = shadowRoot.getElementById('ks-name');
    const keyInput = shadowRoot.getElementById('ks-key');
    const errorMsg = shadowRoot.getElementById('ks-error');
    const saveBtn = shadowRoot.getElementById('ks-save-btn');

    if (!nameInput || !keyInput || !errorMsg || !saveBtn) return;

    const name = nameInput.value.trim();
    const key = keyInput.value.trim();
    const error = errorMsg.textContent;

    saveBtn.disabled = !(name.length > 0 && key.length > 0 && error === '');
  }

  async function onModalKeyCapture(e) {
    e.preventDefault();

    if (e.key === 'Escape' || e.key.toLowerCase() === 'x') {
      closeModal();
      return;
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const overwriteBtn = shadowRoot.getElementById('ks-overwrite-btn');
      const saveBtn = shadowRoot.getElementById('ks-save-btn');
      // If overwrite button is visible (editing mode), use overwrite, else use save
      if (overwriteBtn.style.display !== 'none' && !overwriteBtn.disabled) {
        saveModalShortcut();
      } else if (!saveBtn.disabled) {
        saveModalShortcut();
      }
      return;
    }

    if (e.key === 'Enter') {
      const saveBtn = shadowRoot.getElementById('ks-save-btn');
      if (!saveBtn.disabled) saveModalShortcut();
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      shadowRoot.getElementById('ks-key').value = '';
      shadowRoot.getElementById('ks-error').textContent = '';
      shadowRoot.querySelectorAll('.suggestion-chip').forEach(c => c.classList.remove('active'));
      validateModal();
      return;
    }

    const combo = buildCombo(e);
    if (!combo) return;

    const keyInput = shadowRoot.getElementById('ks-key');
    const errorMsg = shadowRoot.getElementById('ks-error');

    keyInput.value = combo;
    errorMsg.textContent = '';

    shadowRoot.querySelectorAll('.suggestion-chip').forEach(c => c.classList.remove('active'));

    const KS_HINTS = {
      'shift+s': 'start recording',
      'escape': 'stop inspector',
      'alt+/': 'show shortcuts'
    };

    const CHROME_HINTS = {
      'ctrl+t': 'new tab', 'ctrl+w': 'close tab', 'ctrl+n': 'new window',
      'ctrl+shift+n': 'incognito', 'ctrl+shift+t': 'reopen tab',
      'ctrl+tab': 'next tab', 'ctrl+pagedown': 'next tab',
      'ctrl+shift+tab': 'prev tab', 'ctrl+pageup': 'prev tab',
      'ctrl+1': 'tab 1', 'ctrl+2': 'tab 2', 'ctrl+3': 'tab 3',
      'ctrl+4': 'tab 4', 'ctrl+5': 'tab 5', 'ctrl+6': 'tab 6',
      'ctrl+7': 'tab 7', 'ctrl+8': 'tab 8', 'ctrl+9': 'last tab',
      'alt+home': 'home page', 'alt+arrowleft': 'go back',
      'alt+arrowright': 'go forward', 'ctrl+f4': 'close tab',
      'ctrl+shift+w': 'close window', 'alt+f4': 'close app',
      'alt+space': 'window menu', 'alt+f': 'chrome menu',
      'ctrl+shift+pageup': 'move tab', 'ctrl+shift+pagedown': 'move tab',
      'f11': 'fullscreen', 'f6': 'select tabs', 'ctrl+shift+h': 'select tabs',
      'ctrl+s': 'save page', 'ctrl+p': 'print page', 'ctrl+f': 'find text',
      'ctrl+h': 'history', 'ctrl+j': 'downloads', 'ctrl+l': 'address bar',
      'ctrl+r': 'refresh', 'f5': 'refresh', 'f12': 'dev tools',
      'ctrl+shift+i': 'dev tools', 'ctrl+shift+j': 'dev tools',
      'ctrl+u': 'view source', 'ctrl+shift+delete': 'clear data',
      'ctrl+shift+b': 'bookmarks bar', 'ctrl+shift+o': 'bookmarks',
      'ctrl+x': 'cut', 'ctrl+c': 'copy', 'ctrl+v': 'paste',
      'ctrl+z': 'undo', 'ctrl+shift+esc': 'task manager',
      'alt+tab': 'switch apps'
    };

    if (KS_HINTS[combo]) {
      errorMsg.textContent = `Reserved by ShiftController: ${KS_HINTS[combo]}`;
      validateModal();
      return;
    }

    if (CHROME_HINTS[combo]) {
      errorMsg.textContent = `Reserved by Chrome: ${CHROME_HINTS[combo]}`;
      validateModal();
      return;
    }

    try {
      chrome.runtime.sendMessage({
        type: 'CHECK_CONFLICT',
        shortcut: combo,
        domain: window.location.hostname
      }, (check) => {
        if (chrome.runtime.lastError) {

          validateModal();
          return;
        }
        
        const overwriteBtn = shadowRoot.getElementById('ks-overwrite-btn');
        const saveBtn = shadowRoot.getElementById('ks-save-btn');
        const warningGroup = shadowRoot.getElementById('ks-warning-group');
        const warningMsg = shadowRoot.getElementById('ks-warning');
        
        if (check && check.conflict) {
          // Check if it's a reserved key conflict vs existing shortcut
          if (check.type === 'conflict') {
            // Existing shortcut found - show overwrite option
            errorMsg.textContent = '';
            overwriteBtn.style.display = 'inline-block';
            overwriteBtn.disabled = false;
            saveBtn.style.display = 'inline-block';
            warningGroup.style.display = 'block';
            warningMsg.textContent = '⚠ This shortcut key already exists. Use "Overwrite" to replace it.';
            editingShortcutId = check.existingId || null;
          } else {
            // Reserved key - show error and hide overwrite
            errorMsg.textContent = check.message;
            overwriteBtn.style.display = 'none';
            warningGroup.style.display = 'none';
            warningMsg.textContent = '';
          }
        } else {
          // No conflict
          errorMsg.textContent = '';
          overwriteBtn.style.display = 'none';
          warningGroup.style.display = 'none';
          warningMsg.textContent = '';
          editingShortcutId = null;
        }
        validateModal();
      });
    } catch (err) {
      errorMsg.textContent = 'Extension context invalidated. Please refresh.';
      validateModal();
    }
  }

  async function saveModalShortcut() {
    const name = shadowRoot.getElementById('ks-name').value.trim();
    const shortcut = shadowRoot.getElementById('ks-key').value.trim();
    const currentError = shadowRoot.getElementById('ks-error').textContent.trim();

    if (!name || !shortcut || currentError !== '') return;

    const domain = window.location.hostname;
    const id = editingShortcutId || Date.now().toString();

    // Read delay from input if multiple actions
    const delayInput = shadowRoot.getElementById('ks-delay');
    const delay = recordingActions.length > 1 && delayInput
      ? parseInt(delayInput.value || '300', 10) || 300
      : 300;

    // Apply delay to all actions except the first
    const actions = recordingActions.map((a, i) => ({ ...a, delay: i === 0 ? 0 : delay }));

    const entry = {
      id, name, domain, shortcut,
      actions,
      enabled: true
    };

    const saveBtn = shadowRoot.getElementById('ks-save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      chrome.runtime.sendMessage({ type: 'SAVE_SHORTCUT', entry }, (response) => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;

        if (chrome.runtime.lastError || (response && !response.ok)) {
          const errMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : response.error;
          console.error('Save failed:', errMsg);
          shadowRoot.getElementById('ks-error').textContent = 'Save Failed: ' + errMsg;
          return;
        }

        closeModal();
        updateSidebar();
        refreshShortcutCache();
      });
    } catch (err) {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      console.error('Save failed due to extension error:', err);
      shadowRoot.getElementById('ks-error').textContent = 'Extension context invalidated. Please refresh the page.';
    }
  }

  async function suggestShortcuts(name, tag) {
    const cleaned = (name || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
    const letters = [];
    for (const w of words) if (w[0] && !letters.includes(w[0])) letters.push(w[0]);
    if (words[0]) for (const ch of words[0].slice(1)) if (!letters.includes(ch)) letters.push(ch);
    for (const ch of (tag || '')) if (/[a-z]/.test(ch) && !letters.includes(ch)) letters.push(ch);
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') if (!letters.includes(ch)) letters.push(ch);

    const modGroups = [['Alt'], ['Ctrl', 'Shift'], ['Alt', 'Shift']];
    const candidates = [];
    const seen = new Set();

    for (const mods of modGroups) {
      for (const ch of letters) {
        const combo = [...mods, ch.toUpperCase()].join('+');
        if (!seen.has(combo)) { seen.add(combo); candidates.push(combo); }
        if (candidates.length >= 15) break;
      }
      if (candidates.length >= 15) break;
    }

    const valid = [];
    for (const combo of candidates) {
      const check = await new Promise(res => chrome.runtime.sendMessage({
        type: 'CHECK_CONFLICT',
        shortcut: combo,
        domain: window.location.hostname
      }, res));
      if (!check || !check.conflict) {
        valid.push(combo);
        if (valid.length >= 3) break;
      }
    }
    return valid;
  }

  function renderModalSuggestions(suggestions) {
    const container = shadowRoot.getElementById('ks-suggestions');
    if (!container) return;
    container.innerHTML = '';
    if (!suggestions.length) {
      container.innerHTML = '<span style="color:#666; font-size:11px;">No suggestions</span>';
      return;
    }

    suggestions.forEach(combo => {
      const chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = combo;
      chip.onclick = () => {
        shadowRoot.getElementById('ks-key').value = combo;
        shadowRoot.getElementById('ks-error').textContent = '';
        shadowRoot.querySelectorAll('.suggestion-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        // Check for conflicts when suggestion is selected
        const overwriteBtn = shadowRoot.getElementById('ks-overwrite-btn');
        const saveBtn = shadowRoot.getElementById('ks-save-btn');
        const warningGroup = shadowRoot.getElementById('ks-warning-group');
        const warningMsg = shadowRoot.getElementById('ks-warning');
        const errorMsg = shadowRoot.getElementById('ks-error');
        
        chrome.runtime.sendMessage({
          type: 'CHECK_CONFLICT',
          shortcut: combo,
          domain: window.location.hostname
        }, (check) => {
          if (check && check.conflict) {
            if (check.type === 'conflict') {
              // Existing shortcut - show overwrite
              errorMsg.textContent = '';
              overwriteBtn.style.display = 'inline-block';
              overwriteBtn.disabled = false;
              warningGroup.style.display = 'block';
              warningMsg.textContent = '⚠ This shortcut key already exists. Use "Overwrite" to replace it.';
              editingShortcutId = check.existingId || null;
            } else {
              // Reserved key
              errorMsg.textContent = check.message;
              overwriteBtn.style.display = 'none';
              warningGroup.style.display = 'none';
            }
          } else {
            // No conflict
            errorMsg.textContent = '';
            overwriteBtn.style.display = 'none';
            warningGroup.style.display = 'none';
            warningMsg.textContent = '';
            editingShortcutId = null;
          }
          validateModal();
        });
      };
      container.appendChild(chip);
    });
  }

  let _shortcutCache = {};
  let _macroCache = {};
  let _domainStateCache = {};
  let _cacheReady = false;
  let refreshInterval;
  function refreshShortcutCache() {
    try {
      chrome.runtime.sendMessage({ type: 'GET_SHORTCUTS' }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('ShiftController: Error fetching shortcuts:', chrome.runtime.lastError.message);
          return;
        }
        _shortcutCache = res || {};
        _cacheReady = true;
      });
      chrome.runtime.sendMessage({ type: 'GET_DOMAIN_STATES' }, (res) => {
        if (chrome.runtime.lastError) return;
        _domainStateCache = res || {};
      });
      chrome.runtime.sendMessage({ type: 'GET_MACROS' }, (res) => {
        if (chrome.runtime.lastError) return;
        _macroCache = res || {};
      });
    } catch (e) {
      console.warn("ShiftController: Extension context invalidated or communication error. Stopping sync.", e);
      if (refreshInterval) clearInterval(refreshInterval);
    }
  }

  refreshShortcutCache();
  
  // Listen for storage changes to keep cache fresh without polling
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.shortcuts || changes.domainStates)) {
        refreshShortcutCache();
      }
    });
  } catch(e) {
    // Fallback to polling if storage listener unavailable
    refreshInterval = setInterval(refreshShortcutCache, 8000);
  }

  document.addEventListener('keydown', (e) => {
    // Reject synthetic/programmatic events (fixes YouTube auto-fire bug)
    if (!e.isTrusted) return;

    if (modalEl?.classList.contains('active')) return;

    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' ||
      document.activeElement?.isContentEditable;
    if (isEditable) return;

    const combo = buildCombo(e);
    if (!combo) return;

    // Shortcut hint overlay hotkey
    if (combo === 'alt+/' && !inspectorActive) {
      e.preventDefault();
      toggleShortcutHintOverlay();
      return;
    }

    if (combo === 'shift+s' && !inspectorActive) {
      e.preventDefault();
      e.stopPropagation();
      const sessionId = Date.now().toString();
      startInspector(sessionId);
      return;
    }

    if (!_cacheReady) return;

    const domain = window.location.hostname;
    if (_domainStateCache[domain] === false) return;

    for (const entry of Object.values(_shortcutCache)) {
      if (!entry.enabled) continue;
      if (entry.domain && entry.domain !== domain) continue;
      const entryCombo = entry.shortcut.toLowerCase().replace(/\s+/g, '').replace(/\+/g, '+');
      if (entryCombo === combo) {
        e.preventDefault();
        e.stopPropagation();
        try {
          chrome.runtime.sendMessage({ type: 'EXECUTE_ACTIONS', actions: entry.actions });
        } catch (err) {
          console.warn("ShiftController: Extension context invalidated. Please refresh the page to use shortcuts.");
        }
        break;
      }
    }

    // Also check macros
    for (const macro of Object.values(_macroCache || {})) {
      if (!macro.enabled) continue;
      if (macro.domain && macro.domain !== domain) continue;
      const macroCombo = macro.shortcut.toLowerCase().replace(/\s+/g, '').replace(/\+/g, '+');
      if (macroCombo === combo) {
        e.preventDefault();
        e.stopPropagation();
        try {
          chrome.runtime.sendMessage({ type: 'EXECUTE_MACRO', macroId: macro.id });
        } catch (err) {}
        break;
      }
    }
  }, true);

  function buildCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    const key = e.key.toLowerCase();
    if (['control', 'alt', 'shift', 'meta', 'escape', 'enter'].includes(key)) return null;
    parts.push(key);
    return parts.join('+');
  }

  function normalizeShortcut(shortcut) {
    return shortcut
      .toLowerCase()
      .split('+')
      .map(k => k.trim())
      .filter(Boolean)
      .sort((a, b) => {
        const order = { ctrl: 0, alt: 1, shift: 2, meta: 3 };
        const aO = order[a] ?? 99;
        const bO = order[b] ?? 99;
        return aO - bO;
      })
      .join('+');
  }

  let _hintOverlayHost = null;
  function toggleShortcutHintOverlay() {
    if (_hintOverlayHost) {
      _hintOverlayHost.remove();
      _hintOverlayHost = null;
      return;
    }
    if (!_cacheReady) return;
    const domain = window.location.hostname;
    const entries = Object.values(_shortcutCache).filter(e =>
      e.enabled && (!e.domain || e.domain === domain)
    );
    if (!entries.length) return;

    _hintOverlayHost = document.createElement('div');
    _hintOverlayHost.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:#141414;border:1px solid rgba(255,255,255,0.15);border-radius:12px;' +
      'padding:16px 20px;color:#f0f0f0;z-index:2147483647;min-width:280px;max-width:360px;' +
      'box-shadow:0 20px 40px rgba(0,0,0,0.7);font-family:monospace;font-size:12px;' +
      'pointer-events:auto;';
    _hintOverlayHost.innerHTML =
      `<div style="font-size:13px;font-weight:bold;color:#a3ff00;margin-bottom:12px;">Shortcuts — ${escHtmlInner(domain)}</div>` +
      entries.map(e =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
           <span style="color:#ccc;">${escHtmlInner(e.name)}</span>
           <span style="background:rgba(163,255,0,0.15);color:#a3ff00;padding:2px 6px;border-radius:4px;">${escHtmlInner(e.shortcut)}</span>
         </div>`
      ).join('') +
      `<div style="color:#555;font-size:10px;margin-top:10px;text-align:center;">Press Alt+/ to close</div>`;
    document.body.appendChild(_hintOverlayHost);
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeHint(ev) {
        if (!_hintOverlayHost?.contains(ev.target)) {
          _hintOverlayHost?.remove(); _hintOverlayHost = null;
          document.removeEventListener('click', closeHint);
        }
      });
    }, 100);
  }

  function escHtmlInner(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_INSPECTOR') {
      startInspector(msg.sessionId);
      sendResponse({ ok: true });
    } else if (msg.type === 'STOP_INSPECTOR') {
      stopInspector();
      sendResponse({ ok: true });
    }
  });

  } catch(e) {
    console.warn('ShiftController: Initialization error', e);
  }
})();
