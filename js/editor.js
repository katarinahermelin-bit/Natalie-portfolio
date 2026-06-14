/* ── VISUAL SITE EDITOR ─────────────────────────────────────────────────────
   Activated when ?edit=1 in URL + valid admin token in sessionStorage.
   Saves overrides to Supabase Storage as site-overrides.json (public).
   Applied on every page load for all visitors via app.js.
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('edit') !== '1') return;
  const adminToken = sessionStorage.getItem('adminToken');
  if (!adminToken) return;

  const SB_URL   = window.SUPABASE_URL;
  const SB_KEY   = window.SUPABASE_KEY;
  const OV_FILE  = 'site-overrides.json';
  const OV_PUB   = `${SB_URL}/storage/v1/object/public/media/${OV_FILE}`;
  const OV_PUT   = `${SB_URL}/storage/v1/object/media/${OV_FILE}`;

  let overrides = {};
  let selected  = null;

  // ── SHADOW PRESETS ────────────────────────────────────────────────────────
  const SHADOWS = {
    none:        'none',
    soft:        '0 2px 14px rgba(0,0,0,0.38)',
    strong:      '0 2px 6px rgba(0,0,0,0.75), 0 5px 24px rgba(0,0,0,0.55)',
    'glow-lt':   '0 0 18px rgba(255,255,255,0.75), 0 0 40px rgba(255,255,255,0.4)',
    'glow-dk':   '0 0 18px rgba(0,0,0,0.85), 0 0 40px rgba(0,0,0,0.55)',
    outline:     '-1px -1px 0 rgba(0,0,0,.55), 1px -1px 0 rgba(0,0,0,.55), -1px 1px 0 rgba(0,0,0,.55), 1px 1px 0 rgba(0,0,0,.55)',
  };

  // ── INIT ──────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const r = await fetch(OV_PUB + '?t=' + Date.now());
      if (r.ok) overrides = await r.json();
    } catch (_) {}

    applyAll();
    document.body.classList.add('edit-mode');
    buildBar();
    buildPanel();
    attachTargets();
  }

  function applyAll() {
    Object.entries(overrides).forEach(([key, styles]) =>
      document.querySelectorAll(`[data-edit="${key}"]`).forEach(el => applyStyles(el, styles))
    );
  }

  function applyStyles(el, styles) {
    Object.entries(styles || {}).forEach(([p, v]) => { el.style[p] = v; });
  }

  // ── EDIT BAR ──────────────────────────────────────────────────────────────
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = 'edit-bar';
    bar.innerHTML = `
      <div class="eb-left">
        <span class="eb-badge">✏ Edit Mode</span>
        <span class="eb-hint" id="eb-hint">Click a glowing element to edit it</span>
      </div>
      <div class="eb-right">
        <button class="eb-btn eb-save" id="eb-save-btn" onclick="__edSave()">Save</button>
        <button class="eb-btn eb-exit" onclick="__edExit()">Exit</button>
      </div>`;
    document.body.appendChild(bar);
  }

  // ── FLOATING PANEL ────────────────────────────────────────────────────────
  function buildPanel() {
    const p = document.createElement('div');
    p.id = 'edit-panel';
    p.style.display = 'none';
    p.innerHTML = `
      <div class="ep-head">
        <span class="ep-title" id="ep-title">Element</span>
        <button class="ep-x" onclick="__edDeselect()">✕</button>
      </div>

      <div class="ep-sec">
        <div class="ep-row">
          <label>Size</label>
          <div class="ep-pair">
            <input type="range" id="ep-sz-r" min="6" max="160" step="1"
              oninput="document.getElementById('ep-sz-n').value=this.value; __edUp('fontSize',this.value+'px')">
            <input type="number" id="ep-sz-n" min="6" max="160" style="width:50px"
              oninput="document.getElementById('ep-sz-r').value=this.value; __edUp('fontSize',this.value+'px')">
          </div>
        </div>
        <div class="ep-row">
          <label>Color</label>
          <input type="color" id="ep-color" style="flex:1;height:30px"
            oninput="__edUp('color',this.value)">
        </div>
        <div class="ep-row">
          <label>Weight</label>
          <select id="ep-wt" style="flex:1" onchange="__edUp('fontWeight',this.value)">
            <option value="100">100 — Thin</option>
            <option value="200">200 — Extra Light</option>
            <option value="300">300 — Light</option>
            <option value="400">400 — Regular</option>
            <option value="600">600 — Semi Bold</option>
            <option value="700">700 — Bold</option>
          </select>
        </div>
        <div class="ep-row">
          <label>Spacing</label>
          <div class="ep-pair">
            <input type="range" id="ep-ls-r" min="0" max="1" step="0.01"
              oninput="document.getElementById('ep-ls-n').value=this.value; __edUp('letterSpacing',this.value+'em')">
            <input type="number" id="ep-ls-n" min="0" max="1" step="0.01" style="width:50px"
              oninput="document.getElementById('ep-ls-r').value=this.value; __edUp('letterSpacing',this.value+'em')">
          </div>
        </div>
        <div class="ep-row">
          <label>Opacity</label>
          <div class="ep-pair">
            <input type="range" id="ep-op-r" min="0" max="1" step="0.01"
              oninput="document.getElementById('ep-op-n').value=this.value; __edUp('opacity',this.value)">
            <input type="number" id="ep-op-n" min="0" max="1" step="0.01" style="width:50px"
              oninput="document.getElementById('ep-op-r').value=this.value; __edUp('opacity',this.value)">
          </div>
        </div>
      </div>

      <div class="ep-sec">
        <div class="ep-sec-title">Text Shadow</div>
        <div class="ep-shadow-grid">
          <button class="ep-sh-btn" data-sh="none"     onclick="__edShadow('none')">None</button>
          <button class="ep-sh-btn" data-sh="soft"     onclick="__edShadow('soft')">Soft</button>
          <button class="ep-sh-btn" data-sh="strong"   onclick="__edShadow('strong')">Strong</button>
          <button class="ep-sh-btn" data-sh="glow-lt"  onclick="__edShadow('glow-lt')">Glow Light</button>
          <button class="ep-sh-btn" data-sh="glow-dk"  onclick="__edShadow('glow-dk')">Glow Dark</button>
          <button class="ep-sh-btn" data-sh="outline"  onclick="__edShadow('outline')">Outline</button>
        </div>
      </div>

      <div class="ep-sec">
        <div class="ep-sec-title">Position Offset (px)</div>
        <div class="ep-pos-row">
          <label>X</label>
          <input type="number" id="ep-px" step="1" value="0" style="width:60px" oninput="__edPos()">
          <label>Y</label>
          <input type="number" id="ep-py" step="1" value="0" style="width:60px" oninput="__edPos()">
        </div>
      </div>

      <div class="ep-sec">
        <button class="ep-reset" onclick="__edReset()">↺ Reset this element</button>
      </div>`;
    document.body.appendChild(p);
  }

  // ── ELEMENT TARGETS ───────────────────────────────────────────────────────
  function attachTargets() {
    document.querySelectorAll('[data-edit]').forEach(el => {
      el.classList.add('edit-target');
      el.addEventListener('click', e => { e.stopPropagation(); selectEl(el); });
    });
    document.addEventListener('click', e => {
      if (!selected) return;
      if (!e.target.closest('[data-edit]') && !e.target.closest('#edit-panel') && !e.target.closest('#edit-bar')) {
        deselect();
      }
    });
  }

  function selectEl(el) {
    if (selected) selected.classList.remove('edit-selected');
    selected = el;
    el.classList.add('edit-selected');
    const label = el.dataset.editLabel || el.dataset.edit;
    document.getElementById('ep-title').textContent = label;
    document.getElementById('eb-hint').textContent  = 'Editing: ' + label;
    populatePanel(el);
    placePanel(el);
    document.getElementById('edit-panel').style.display = 'block';
  }

  function deselect() {
    if (selected) selected.classList.remove('edit-selected');
    selected = null;
    document.getElementById('edit-panel').style.display = 'none';
    document.getElementById('eb-hint').textContent = 'Click a glowing element to edit it';
  }

  // ── PANEL POPULATE ────────────────────────────────────────────────────────
  function populatePanel(el) {
    const cs  = window.getComputedStyle(el);
    const ov  = overrides[el.dataset.edit] || {};

    const fs  = parseInt(ov.fontSize  || cs.fontSize)  || 16;
    set('ep-sz-r', fs); set('ep-sz-n', fs);

    document.getElementById('ep-color').value = rgbToHex(ov.color || cs.color);
    document.getElementById('ep-wt').value    = ov.fontWeight || Math.round(parseFloat(cs.fontWeight)) || 300;

    const lsPx = parseFloat(ov.letterSpacing || cs.letterSpacing) || 0;
    const lsEm = ov.letterSpacing
      ? parseFloat(ov.letterSpacing)
      : +(lsPx / fs).toFixed(3);
    set('ep-ls-r', Math.max(0, lsEm)); set('ep-ls-n', Math.max(0, lsEm));

    const op = parseFloat(ov.opacity ?? cs.opacity ?? 1);
    set('ep-op-r', op); set('ep-op-n', op);

    const m = (ov.transform || '').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    set('ep-px', m ? m[1] : 0); set('ep-py', m ? m[2] : 0);

    document.querySelectorAll('.ep-sh-btn').forEach(b => b.classList.remove('active'));
    const curSh = ov.textShadow || 'none';
    const active = Object.entries(SHADOWS).find(([, v]) => v === curSh);
    if (active) {
      const btn = document.querySelector(`.ep-sh-btn[data-sh="${active[0]}"]`);
      if (btn) btn.classList.add('active');
    } else if (!ov.textShadow) {
      const nb = document.querySelector('.ep-sh-btn[data-sh="none"]');
      if (nb) nb.classList.add('active');
    }
  }

  function placePanel(el) {
    const panel = document.getElementById('edit-panel');
    const rect  = el.getBoundingClientRect();
    const PW    = 272;
    let left    = rect.right + window.scrollX + 16;
    if (left + PW > window.innerWidth - 8) left = rect.left + window.scrollX - PW - 16;
    if (left < 8) left = 8;
    let top     = rect.top + window.scrollY;
    const maxT  = window.scrollY + window.innerHeight - 520;
    if (top > maxT) top = maxT;
    if (top < window.scrollY + 54) top = window.scrollY + 54;
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
  }

  // ── LIVE UPDATE HELPERS (exposed globally for inline onclick) ─────────────
  window.__edUp = function (prop, val) {
    if (!selected) return;
    const key = selected.dataset.edit;
    if (!overrides[key]) overrides[key] = {};
    overrides[key][prop] = val;
    selected.style[prop] = val;
  };

  window.__edShadow = function (preset) {
    document.querySelectorAll('.ep-sh-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.ep-sh-btn[data-sh="${preset}"]`);
    if (btn) btn.classList.add('active');
    window.__edUp('textShadow', SHADOWS[preset] || 'none');
  };

  window.__edPos = function () {
    const x = parseFloat(document.getElementById('ep-px').value) || 0;
    const y = parseFloat(document.getElementById('ep-py').value) || 0;
    window.__edUp('transform', `translate(${x}px, ${y}px)`);
  };

  window.__edReset = function () {
    if (!selected) return;
    const key = selected.dataset.edit;
    delete overrides[key];
    selected.removeAttribute('style');
    populatePanel(selected);
  };

  window.__edDeselect = deselect;

  // ── SAVE ──────────────────────────────────────────────────────────────────
  window.__edSave = async function () {
    const btn = document.getElementById('eb-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
      const res = await fetch(OV_PUT, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        },
        body: JSON.stringify(overrides),
      });
      if (!res.ok) throw new Error(await res.text());
      if (btn) { btn.textContent = '✓ Saved'; }
      setTimeout(() => { if (btn) { btn.textContent = 'Save'; btn.disabled = false; } }, 2200);
    } catch (e) {
      alert('Save failed: ' + e.message);
      if (btn) { btn.textContent = 'Save'; btn.disabled = false; }
    }
  };

  window.__edExit = function () {
    if (Object.keys(overrides).length && !confirm('Exit edit mode? Save first if you want to keep changes.')) return;
    const url = new URL(location.href);
    url.searchParams.delete('edit');
    location.href = url.toString();
  };

  // ── UTILS ─────────────────────────────────────────────────────────────────
  function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return '#000000';
    if (rgb.startsWith('#')) return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // ── BOOT ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
