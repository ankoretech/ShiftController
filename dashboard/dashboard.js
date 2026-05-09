
const $ = id => document.getElementById(id);

function bg(type, extra = {}) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (response) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(response);
      });
    } catch (e) { resolve(null); }
  });
}

let allShortcuts = {};
let domainStates = {};
let currentView = 'shortcuts';

async function init() {
  allShortcuts = await bg('GET_SHORTCUTS') || {};
  domainStates = await bg('GET_DOMAIN_STATES') || {};

  chrome.storage.local.get('analytics', (data) => {
    if (data.analytics && data.analytics.clicksSaved > 0) {
      const savedEl = $('stat-saved');
      if (savedEl) {
        const clicks = data.analytics.clicksSaved;
        const timeSaved = (clicks * 1.5).toFixed(1);
        savedEl.textContent = `${clicks} clicks saved (~${timeSaved}s)`;
        savedEl.style.display = 'block';
      }
    }
  });

  renderShortcuts(Object.values(allShortcuts));
  renderDomains();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  $('search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = Object.values(allShortcuts).filter(s =>
      s.name.toLowerCase().includes(q) || s.shortcut.toLowerCase().includes(q) || (s.domain || '').includes(q)
    );
    renderShortcuts(filtered);
  });

  const devBtn = $('dev-profile-btn');
  if (devBtn) {
    devBtn.addEventListener('click', openDevProfile);
  }

  const exportBtn = $('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
  const importInput = $('input-import');
  if (importInput) {
    importInput.addEventListener('change', handleImport);
  }
  const deleteBtn = $('btn-delete-all');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm("Are you sure you want to delete ALL shortcuts? This cannot be undone.")) {
        for (const id of Object.keys(allShortcuts)) {
          await bg('DELETE_SHORTCUT', { id });
        }
        allShortcuts = await bg('GET_SHORTCUTS') || {};
        renderShortcuts(Object.values(allShortcuts));
        renderDomains();
      }
    });
  }

  const newBatchBtn = $('btn-new-batch');
  const batchBuilder = $('batch-builder');
  const closeBatchBtn = $('btn-close-batch');
  const addStepBtn = $('btn-add-step');
  const addLoopBtn = $('btn-add-loop');
  const batchSteps = $('batch-steps');

  if (newBatchBtn) {
    newBatchBtn.addEventListener('click', () => {
      batchBuilder.style.display = 'block';
      $('batch-name').value = '';
      batchSteps.innerHTML = '';
      $('saved-batches-list').style.display = 'none';
    });
  }

  if (closeBatchBtn) {
    closeBatchBtn.addEventListener('click', () => {
      batchBuilder.style.display = 'none';
      $('saved-batches-list').style.display = 'grid';
    });
  }

  if (addStepBtn) {
    addStepBtn.addEventListener('click', () => {
      const step = document.createElement('div');
      step.style = 'background:var(--surface); padding:10px 15px; border-radius:8px; display:flex; gap:10px; align-items:center; border:1px solid var(--border);';
      step.innerHTML = `
        <span style="font-weight:600; color:var(--text-muted);">Step</span>
        <select style="background:var(--surface-3); border:none; color:var(--text); padding:4px 8px; border-radius:4px; outline:none;">
          <option>Click Shortcut</option>
          <option>Wait (Delay)</option>
        </select>
        <input type="text" placeholder="Value (e.g. 500ms or shortcut name)" style="flex:1; background:transparent; border:none; border-bottom:1px solid var(--border); color:var(--text); outline:none;">
        <button class="btn-icon-danger">X</button>
      `;
      step.querySelector('.btn-icon-danger').addEventListener('click', () => step.remove());
      batchSteps.appendChild(step);
    });
  }

  if (addLoopBtn) {
    addLoopBtn.addEventListener('click', () => {
      const step = document.createElement('div');
      step.style = 'background:rgba(163,255,0,0.05); padding:10px 15px; border-radius:8px; display:flex; gap:10px; align-items:center; border:1px solid rgba(163,255,0,0.2);';
      step.innerHTML = `
        <span style="font-weight:600; color:var(--accent);">Loop</span>
        <input type="number" placeholder="Repeat Count" value="10" style="width:80px; background:var(--surface-3); border:none; color:var(--text); padding:4px 8px; border-radius:4px; outline:none;">
        <span style="color:var(--text-muted);">times, every</span>
        <input type="number" placeholder="ms" value="1000" style="width:80px; background:var(--surface-3); border:none; color:var(--text); padding:4px 8px; border-radius:4px; outline:none;">
        <span style="color:var(--text-muted);">ms</span>
        <button class="btn-icon-danger" style="margin-left:auto;">X</button>
      `;
      step.querySelector('.btn-icon-danger').addEventListener('click', () => step.remove());
      batchSteps.appendChild(step);
    });
  }

  const saveBatchBtn = $('btn-save-batch');
  if (saveBatchBtn) {
    saveBatchBtn.addEventListener('click', async () => {
      const name = $('batch-name').value || 'Untitled Batch';
      const steps = [];

      // Parse all steps from the batch builder
      const stepDivs = $('batch-steps').querySelectorAll('div');
      for (const stepDiv of stepDivs) {
        const firstSpan = stepDiv.querySelector('span');
        const isLoop = firstSpan && firstSpan.textContent.includes('Loop');

        if (isLoop) {
          const inputs = stepDiv.querySelectorAll('input[type="number"]');
          const count = parseInt(inputs[0]?.value || '1', 10) || 1;
          const intervalMs = parseInt(inputs[1]?.value || '1000', 10) || 1000;
          steps.push({
            type: 'loop',
            count,
            intervalMs,
            steps: []
          });
        } else {
          const select = stepDiv.querySelector('select');
          const input = stepDiv.querySelector('input[type="text"]');
          const stepType = select?.value;
          const value = input?.value;

          if (stepType === 'Click Shortcut' && value) {
            // Find shortcut by name
            const shortcut = Object.values(allShortcuts).find(s => s.name === value);
            if (shortcut) {
              steps.push({
                type: 'shortcut',
                targetId: shortcut.id
              });
            }
          } else if (stepType === 'Wait (Delay)' && value) {
            const ms = parseInt(value.replace(/ms$/, ''), 10) || 500;
            steps.push({
              type: 'delay',
              ms
            });
          }
        }
      }

      if (steps.length === 0) {
        alert('Macro must have at least one step.');
        return;
      }

      const macro = {
        id: Date.now().toString(),
        name,
        domain: window.location.hostname || 'global',
        shortcut: 'alt+m',  // Default; user can edit later
        steps,
        enabled: true
      };

      const result = await bg('SAVE_MACRO', { macro });
      if (result && result.ok) {
        alert(`Macro "${name}" saved successfully!`);
        batchBuilder.style.display = 'none';
        $('saved-batches-list').style.display = 'grid';
      } else {
        alert('Failed to save macro.');
      }
    });
  }
}

function handleExport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allShortcuts, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "shiftcontroller_shortcuts.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedShortcuts = JSON.parse(event.target.result);
      if (typeof importedShortcuts !== 'object' || importedShortcuts === null) {
        throw new Error('Invalid JSON format');
      }

      let successCount = 0;
      let failCount = 0;
      for (const [id, entry] of Object.entries(importedShortcuts)) {
        if (entry && entry.id && entry.shortcut && entry.actions && entry.domain) {
          const result = await bg('SAVE_SHORTCUT', { entry });
          if (result && result.ok) successCount++;
          else failCount++;
        }
      }
      alert(`Imported ${successCount} shortcuts.${failCount ? ` ${failCount} skipped (conflicts).` : ''}`);

      allShortcuts = await bg('GET_SHORTCUTS');
      renderShortcuts(Object.values(allShortcuts));
      renderDomains();
    } catch (err) {
      alert("Failed to parse JSON file.");
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function openDevProfile() {
  chrome.tabs.create({ url: chrome.runtime.getURL('developer/developer.html') });
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  $(`view-${view}`).classList.add('active');
  currentView = view;
}

function renderShortcuts(entries) {
  const tbody = $('shortcuts-tbody');
  const empty = $('empty-table');
  $('stat-total').textContent = `${Object.values(allShortcuts).length} shortcuts`;
  tbody.innerHTML = '';

  if (!entries.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  for (const entry of entries) {
    const tr = document.createElement('tr');
    const keys = entry.shortcut.split('+').map(k => `<span>${escHtml(k)}</span>`).join('<span style="opacity:0.4;margin:0 1px">+</span>');
    tr.innerHTML = `
      <td class="td-name">${escHtml(entry.name)}</td>
      <td><span class="key-badge">${keys}</span></td>
      <td class="td-domain">
        <img src="https://www.google.com/s2/favicons?sz=16&domain=${escHtml(entry.domain)}" style="filter: drop-shadow(0 0 4px rgba(255,255,255,0.2));" onerror="this.style.display='none'"/>
        ${escHtml(entry.domain || 'Global')}
      </td>
      <td><span class="action-count">${entry.actions.length} action${entry.actions.length !== 1 ? 's' : ''}</span></td>
      <td><span class="status-badge ${entry.enabled ? 'on' : 'off'}">${entry.enabled ? 'Active' : 'Off'}</span></td>
      <td class="td-actions">
        <label class="toggle">
          <input type="checkbox" ${entry.enabled ? 'checked' : ''} data-id="${entry.id}"/>
          <span class="slider"></span>
        </label>
        <button class="btn-icon-danger" data-id="${entry.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    `;
    tr.querySelector('input[type=checkbox]').addEventListener('change', async (e) => {
      await bg('TOGGLE_SHORTCUT', { id: entry.id, enabled: e.target.checked });
      allShortcuts = await bg('GET_SHORTCUTS');
      renderShortcuts(Object.values(allShortcuts));
      renderDomains();
    });
    tr.querySelector('.btn-icon-danger').addEventListener('click', async () => {
      await bg('DELETE_SHORTCUT', { id: entry.id });
      allShortcuts = await bg('GET_SHORTCUTS');
      renderShortcuts(Object.values(allShortcuts));
      renderDomains();
    });
    tbody.appendChild(tr);
  }
}

function renderDomains() {
  const grid = $('domains-grid');
  const empty = $('empty-domains');
  grid.innerHTML = '';

  const domainMap = {};
  for (const entry of Object.values(allShortcuts)) {
    const d = entry.domain || 'global';
    domainMap[d] = (domainMap[d] || 0) + 1;
  }

  const domains = Object.entries(domainMap);
  if (!domains.length) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  for (const [domain, count] of domains) {
    const card = document.createElement('div');
    card.className = 'domain-card';
    card.style.cursor = 'pointer';
    const enabled = domainStates[domain] !== false;
    card.innerHTML = `
      <div class="domain-card-info">
        <img src="https://www.google.com/s2/favicons?sz=20&domain=${escHtml(domain)}" style="filter: drop-shadow(0 0 6px rgba(255,255,255,0.2));" onerror="this.style.display='none'"/>
        <div>
          <div class="domain-card-name">${escHtml(domain)}</div>
          <div class="domain-card-count">${count} shortcut${count !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${enabled ? 'checked' : ''} data-domain="${domain}"/>
        <span class="slider"></span>
      </label>
    `;

    card.addEventListener('click', (e) => {

      if (e.target.closest('.toggle')) return;

      switchView('shortcuts');
      const searchInput = $('search-input');
      searchInput.value = domain;
      searchInput.dispatchEvent(new Event('input'));
    });

    card.querySelector('input').addEventListener('change', async (e) => {
      await bg('TOGGLE_DOMAIN', { domain, enabled: e.target.checked });
      domainStates = await bg('GET_DOMAIN_STATES');
    });
    grid.appendChild(card);
  }
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', init);
