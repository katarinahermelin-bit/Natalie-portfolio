/* ── VISUAL SITE EDITOR ─────────────────────────────────────────────────────
   Activated when ?edit=1 in URL + valid admin token in sessionStorage.
   Saves overrides + added elements to site-overrides.json in Supabase Storage.
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('edit') !== '1') return;
  const adminToken = sessionStorage.getItem('adminToken');
  if (!adminToken) return;

  const SB_URL  = window.SUPABASE_URL;
  const SB_KEY  = window.SUPABASE_KEY;
  const OV_PUB  = `${SB_URL}/storage/v1/object/public/media/site-overrides.json`;
  const OV_PUT  = `${SB_URL}/storage/v1/object/media/site-overrides.json`;

  let overrides = {};   // { editKey: {cssProp:val}, _added:[...] }
  let selected  = null; // currently selected element
  let addMenu   = null; // "+" dropdown reference

  const SHADOWS = {
    none:      'none',
    soft:      '0 2px 14px rgba(0,0,0,0.38)',
    strong:    '0 2px 6px rgba(0,0,0,0.75), 0 5px 24px rgba(0,0,0,0.55)',
    'glow-lt': '0 0 18px rgba(255,255,255,0.75), 0 0 40px rgba(255,255,255,0.4)',
    'glow-dk': '0 0 18px rgba(0,0,0,0.85), 0 0 40px rgba(0,0,0,0.55)',
    outline:   '-1px -1px 0 rgba(0,0,0,.55),1px -1px 0 rgba(0,0,0,.55),-1px 1px 0 rgba(0,0,0,.55),1px 1px 0 rgba(0,0,0,.55)',
  };

  // ── INIT ──────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const r = await fetch(OV_PUB + '?t=' + Date.now());
      if (r.ok) overrides = await r.json();
    } catch (_) {}

    applyStyleOverrides();
    renderAddedElements(true); // true = edit mode (adds drag handles)

    document.body.classList.add('edit-mode');
    buildBar();
    buildPanel();
    attachStaticTargets();
  }

  // ── STYLE OVERRIDES ───────────────────────────────────────────────────────
  function applyStyleOverrides() {
    Object.entries(overrides).forEach(([key, styles]) => {
      if (key === '_added') return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach(el => applyStyles(el, styles));
    });
  }

  function applyStyles(el, styles) {
    Object.entries(styles || {}).forEach(([p, v]) => { el.style[p] = v; });
  }

  // ── RENDER ADDED ELEMENTS ─────────────────────────────────────────────────
  function renderAddedElements(editMode) {
    (overrides._added || []).forEach(item => {
      if (document.getElementById(item.id)) return; // already rendered
      buildAddedEl(item, editMode);
    });
  }

  function buildAddedEl(item, editMode) {
    const zone = document.querySelector('.hero');
    if (!zone) return null;

    const wrapper = document.createElement('div');
    wrapper.id = item.id;
    wrapper.classList.add('site-added-el');
    if (editMode) wrapper.classList.add('edit-target', 'edit-added');
    wrapper.dataset.addedId  = item.id;
    wrapper.dataset.addedType = item.type;
    wrapper.dataset.edit      = item.id;
    wrapper.dataset.editLabel = item.type === 'text' ? 'Text Block' : item.type === 'image' ? 'Image' : 'Video';
    wrapper.style.cssText = `position:absolute;left:${item.x ?? 30}%;top:${item.y ?? 30}%;z-index:10;`;

    if (item.type === 'text') {
      wrapper.innerHTML = item.content || 'Double-click to edit text';
      Object.assign(wrapper.style, {
        fontFamily: "'Josefin Sans', sans-serif",
        fontSize:   '20px',
        color:      '#ffffff',
        fontWeight: '300',
        letterSpacing: '0.12em',
        cursor: editMode ? 'move' : 'default',
        userSelect: editMode ? 'none' : '',
        minWidth: '60px',
        whiteSpace: 'pre-wrap',
      });
      if (editMode) {
        wrapper.addEventListener('dblclick', e => {
          e.stopPropagation();
          wrapper.contentEditable = 'true';
          wrapper.style.cursor = 'text';
          wrapper.style.userSelect = 'text';
          wrapper.focus();
        });
        wrapper.addEventListener('blur', () => {
          wrapper.contentEditable = 'false';
          wrapper.style.cursor = 'move';
          wrapper.style.userSelect = 'none';
          syncAddedItem(item.id);
        });
      }
    } else if (item.type === 'image') {
      wrapper.style.width  = item.styles?.width  || '220px';
      wrapper.style.height = item.styles?.height || '160px';
      wrapper.style.overflow = 'hidden';
      if (item.src) {
        const img = document.createElement('img');
        img.src = item.src;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;';
        wrapper.appendChild(img);
      } else if (editMode) {
        wrapper.style.cssText += ';background:rgba(255,255,255,0.08);border:1px dashed rgba(255,255,255,0.3);';
        wrapper.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.45);font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;">Select → upload image</div>';
      }
    } else if (item.type === 'video') {
      wrapper.style.width  = item.styles?.width  || '400px';
      wrapper.style.height = item.styles?.height || '225px';
      wrapper.style.overflow = 'hidden';
      if (item.src) {
        const ytId = extractYTId(item.src);
        if (ytId) {
          const iframe = document.createElement('iframe');
          iframe.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
          iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;pointer-events:none;';
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
          wrapper.appendChild(iframe);
          if (!editMode) iframe.style.pointerEvents = 'auto';
        }
      } else if (editMode) {
        wrapper.style.cssText += ';background:rgba(0,0,0,0.5);border:1px dashed rgba(255,255,255,0.3);';
        wrapper.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.45);font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;">Select → paste video URL</div>';
      }
    }

    // Apply saved styles
    applyStyles(wrapper, item.styles);

    zone.appendChild(wrapper);

    if (editMode) {
      makeDraggable(wrapper, item);
      wrapper.addEventListener('click', e => {
        if (wrapper.contentEditable === 'true') return;
        e.stopPropagation();
        selectEl(wrapper);
      });
    }

    return wrapper;
  }

  // ── DRAG ADDED ELEMENTS ───────────────────────────────────────────────────
  function makeDraggable(el, item) {
    let startMX, startMY, startL, startT, dragging = false;

    el.addEventListener('mousedown', e => {
      if (el.contentEditable === 'true') return;
      if (e.target.closest('#edit-panel') || e.target.closest('#edit-bar')) return;
      dragging = true;
      startMX = e.clientX; startMY = e.clientY;
      startL  = el.offsetLeft; startT = el.offsetTop;
      e.preventDefault(); e.stopPropagation();

      function onMove(ev) {
        if (!dragging) return;
        const zone = el.parentElement;
        const cw   = zone.offsetWidth, ch = zone.offsetHeight;
        const newL = Math.max(0, startL + ev.clientX - startMX);
        const newT = Math.max(0, startT + ev.clientY - startMY);
        el.style.left = (newL / cw * 100).toFixed(2) + '%';
        el.style.top  = (newT / ch * 100).toFixed(2) + '%';
        item.x = parseFloat(el.style.left);
        item.y = parseFloat(el.style.top);
        if (selected === el) placePanel(el);
      }
      function onUp() {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
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
        <div class="eb-add-wrap">
          <button class="eb-btn eb-add" id="eb-add-btn" onclick="__edToggleAdd(event)">+ Add ▾</button>
          <div class="eb-add-menu" id="eb-add-menu" style="display:none">
            <button onclick="__edAddEl('text')">✏ Text Block</button>
            <button onclick="__edAddEl('image')">🖼 Image</button>
            <button onclick="__edAddEl('video')">▶ Video</button>
          </div>
        </div>
        <button class="eb-btn eb-save" id="eb-save-btn" onclick="__edSave()">Save</button>
        <button class="eb-btn eb-exit" onclick="__edExit()">Exit</button>
      </div>`;
    document.body.appendChild(bar);
    addMenu = document.getElementById('eb-add-menu');
    document.addEventListener('click', e => {
      if (!e.target.closest('.eb-add-wrap')) hideAddMenu();
    });
  }

  function hideAddMenu() { if (addMenu) addMenu.style.display = 'none'; }

  window.__edToggleAdd = function (e) {
    e.stopPropagation();
    addMenu.style.display = addMenu.style.display === 'none' ? 'block' : 'none';
  };

  window.__edAddEl = function (type) {
    hideAddMenu();
    const id   = 'ael-' + Date.now();
    const item = { id, type, x: 25, y: 30, src: '', content: '', styles: {} };
    if (!overrides._added) overrides._added = [];
    overrides._added.push(item);
    const el = buildAddedEl(item, true);
    if (el) selectEl(el);
  };

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

      <!-- STYLE CONTROLS (all elements) -->
      <div class="ep-sec" id="ep-style-sec">
        <div class="ep-row">
          <label>Size</label>
          <div class="ep-pair">
            <input type="range" id="ep-sz-r" min="6" max="160" step="1"
              oninput="document.getElementById('ep-sz-n').value=this.value;__edUp('fontSize',this.value+'px')">
            <input type="number" id="ep-sz-n" min="6" max="160" style="width:50px"
              oninput="document.getElementById('ep-sz-r').value=this.value;__edUp('fontSize',this.value+'px')">
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
              oninput="document.getElementById('ep-ls-n').value=this.value;__edUp('letterSpacing',this.value+'em')">
            <input type="number" id="ep-ls-n" min="0" max="1" step="0.01" style="width:50px"
              oninput="document.getElementById('ep-ls-r').value=this.value;__edUp('letterSpacing',this.value+'em')">
          </div>
        </div>
        <div class="ep-row">
          <label>Opacity</label>
          <div class="ep-pair">
            <input type="range" id="ep-op-r" min="0" max="1" step="0.01"
              oninput="document.getElementById('ep-op-n').value=this.value;__edUp('opacity',this.value)">
            <input type="number" id="ep-op-n" min="0" max="1" step="0.01" style="width:50px"
              oninput="document.getElementById('ep-op-r').value=this.value;__edUp('opacity',this.value)">
          </div>
        </div>
      </div>

      <!-- SHADOW -->
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

      <!-- POSITION (static elements only) -->
      <div class="ep-sec" id="ep-pos-sec">
        <div class="ep-sec-title">Position Offset (px)</div>
        <div class="ep-pos-row">
          <label>X</label>
          <input type="number" id="ep-px" step="1" value="0" style="width:60px" oninput="__edPos()">
          <label>Y</label>
          <input type="number" id="ep-py" step="1" value="0" style="width:60px" oninput="__edPos()">
        </div>
      </div>

      <!-- ADDED ELEMENT EXTRAS (text/image/video controls) -->
      <div class="ep-sec" id="ep-added-sec" style="display:none">
        <!-- text -->
        <div id="ep-text-ctrl" style="display:none">
          <div class="ep-sec-title">Text Content</div>
          <textarea id="ep-text-val" rows="3" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:6px;font-family:inherit;font-size:11px;resize:vertical;"
            oninput="__edTextContent(this.value)"></textarea>
        </div>
        <!-- image -->
        <div id="ep-img-ctrl" style="display:none">
          <div class="ep-sec-title">Image</div>
          <button class="ep-upload-btn" onclick="document.getElementById('ep-img-file').click()">↑ Upload Image</button>
          <input type="file" id="ep-img-file" accept="image/*" style="display:none" onchange="__edUploadImg(this.files[0])">
          <input type="text" id="ep-img-url" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;"
            oninput="__edImgUrl(this.value)">
        </div>
        <!-- video -->
        <div id="ep-vid-ctrl" style="display:none">
          <div class="ep-sec-title">Video URL (YouTube)</div>
          <input type="text" id="ep-vid-url" placeholder="https://youtube.com/watch?v=…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;"
            oninput="__edVidUrl(this.value)">
        </div>
        <!-- size (image + video) -->
        <div id="ep-size-ctrl" style="display:none;margin-top:10px">
          <div class="ep-sec-title">Size (px)</div>
          <div class="ep-pos-row">
            <label>W</label>
            <input type="number" id="ep-sw" step="1" min="40" style="width:60px" oninput="__edSize()">
            <label>H</label>
            <input type="number" id="ep-sh" step="1" min="40" style="width:60px" oninput="__edSize()">
          </div>
        </div>
        <!-- delete -->
        <button class="ep-del" style="margin-top:10px" onclick="__edDeleteAdded()">🗑 Delete element</button>
      </div>

      <!-- RESET (static elements) -->
      <div class="ep-sec" id="ep-reset-sec">
        <button class="ep-reset" onclick="__edReset()">↺ Reset this element</button>
      </div>`;
    document.body.appendChild(p);
  }

  // ── ELEMENT SELECTION ─────────────────────────────────────────────────────
  function attachStaticTargets() {
    document.querySelectorAll('[data-edit]:not(.edit-added)').forEach(el => {
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
    const isAdded = el.classList.contains('edit-added');
    const type    = el.dataset.addedType;
    const cs      = window.getComputedStyle(el);
    const ov      = isAdded ? (getAddedItem(el.id)?.styles || {}) : (overrides[el.dataset.edit] || {});

    const fs = parseInt(ov.fontSize || cs.fontSize) || 20;
    setV('ep-sz-r', fs); setV('ep-sz-n', fs);
    document.getElementById('ep-color').value = rgbToHex(ov.color || cs.color);
    document.getElementById('ep-wt').value    = ov.fontWeight || Math.round(parseFloat(cs.fontWeight)) || 300;

    const lsPx = parseFloat(ov.letterSpacing || cs.letterSpacing) || 0;
    const lsEm = ov.letterSpacing ? parseFloat(ov.letterSpacing) : +(lsPx / fs).toFixed(3);
    setV('ep-ls-r', Math.max(0, lsEm)); setV('ep-ls-n', Math.max(0, lsEm));

    const op = parseFloat(ov.opacity ?? cs.opacity ?? 1);
    setV('ep-op-r', op); setV('ep-op-n', op);

    // shadow
    document.querySelectorAll('.ep-sh-btn').forEach(b => b.classList.remove('active'));
    const curSh = ov.textShadow || 'none';
    const match = Object.entries(SHADOWS).find(([, v]) => v === curSh);
    const shKey = match ? match[0] : (curSh === 'none' ? 'none' : null);
    if (shKey) { const b = document.querySelector(`.ep-sh-btn[data-sh="${shKey}"]`); if (b) b.classList.add('active'); }

    // position offset (static only)
    const posSec = document.getElementById('ep-pos-sec');
    const resetSec = document.getElementById('ep-reset-sec');
    if (isAdded) {
      posSec.style.display = 'none';
      resetSec.style.display = 'none';
    } else {
      posSec.style.display = '';
      resetSec.style.display = '';
      const m = (ov.transform || '').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      setV('ep-px', m ? m[1] : 0); setV('ep-py', m ? m[2] : 0);
    }

    // added element extras
    const addedSec = document.getElementById('ep-added-sec');
    const textCtrl = document.getElementById('ep-text-ctrl');
    const imgCtrl  = document.getElementById('ep-img-ctrl');
    const vidCtrl  = document.getElementById('ep-vid-ctrl');
    const sizeCtrl = document.getElementById('ep-size-ctrl');
    const styleSec = document.getElementById('ep-style-sec');

    textCtrl.style.display = 'none';
    imgCtrl.style.display  = 'none';
    vidCtrl.style.display  = 'none';
    sizeCtrl.style.display = 'none';

    if (isAdded) {
      addedSec.style.display = '';
      if (type === 'text') {
        textCtrl.style.display = '';
        document.getElementById('ep-text-val').value = el.innerText || '';
      } else if (type === 'image') {
        imgCtrl.style.display  = '';
        sizeCtrl.style.display = '';
        const item = getAddedItem(el.id);
        setV('ep-img-url', item?.src || '');
        setV('ep-sw', parseInt(el.style.width)  || 220);
        setV('ep-sh', parseInt(el.style.height) || 160);
        styleSec.style.display = 'none'; // images don't need text style controls
      } else if (type === 'video') {
        vidCtrl.style.display  = '';
        sizeCtrl.style.display = '';
        const item = getAddedItem(el.id);
        setV('ep-vid-url', item?.src || '');
        setV('ep-sw', parseInt(el.style.width)  || 400);
        setV('ep-sh', parseInt(el.style.height) || 225);
        styleSec.style.display = 'none';
      }
    } else {
      addedSec.style.display = 'none';
      styleSec.style.display = '';
    }
  }

  function placePanel(el) {
    const panel = document.getElementById('edit-panel');
    const rect  = el.getBoundingClientRect();
    const PW    = 272;
    let left    = rect.right + window.scrollX + 16;
    if (left + PW > window.innerWidth - 8) left = rect.left + window.scrollX - PW - 16;
    if (left < 8) left = 8;
    let top  = rect.top + window.scrollY;
    const maxT = window.scrollY + window.innerHeight - 560;
    top = Math.min(top, maxT);
    top = Math.max(top, window.scrollY + 54);
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
  }

  // ── UPDATE HANDLERS (exposed globally) ────────────────────────────────────
  window.__edUp = function (prop, val) {
    if (!selected) return;
    const isAdded = selected.classList.contains('edit-added');
    if (isAdded) {
      const item = getAddedItem(selected.id);
      if (item) { if (!item.styles) item.styles = {}; item.styles[prop] = val; }
    } else {
      const key = selected.dataset.edit;
      if (!overrides[key]) overrides[key] = {};
      overrides[key][prop] = val;
    }
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
    window.__edUp('transform', `translate(${x}px,${y}px)`);
  };

  window.__edTextContent = function (val) {
    if (!selected || selected.dataset.addedType !== 'text') return;
    selected.innerText = val;
    syncAddedItem(selected.id);
  };

  window.__edImgUrl = function (url) {
    if (!selected || selected.dataset.addedType !== 'image') return;
    const item = getAddedItem(selected.id);
    if (item) item.src = url;
    let img = selected.querySelector('img');
    if (!img) {
      selected.innerHTML = '';
      img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;';
      selected.appendChild(img);
    }
    img.src = url;
  };

  window.__edVidUrl = function (url) {
    if (!selected || selected.dataset.addedType !== 'video') return;
    const item = getAddedItem(selected.id);
    if (item) item.src = url;
    const ytId = extractYTId(url);
    if (!ytId) return;
    selected.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;pointer-events:none;';
    selected.appendChild(iframe);
  };

  window.__edSize = function () {
    if (!selected) return;
    const w = document.getElementById('ep-sw').value + 'px';
    const h = document.getElementById('ep-sh').value + 'px';
    selected.style.width  = w;
    selected.style.height = h;
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles = {}; item.styles.width = w; item.styles.height = h; }
  };

  window.__edUploadImg = async function (file) {
    if (!file?.type.startsWith('image/')) return;
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const name = `ed-img-${Date.now()}.${ext}`;
    try {
      const buf = await file.arrayBuffer();
      await fetch(`${SB_URL}/storage/v1/object/media/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${adminToken}`, 'Content-Type': file.type, 'x-upsert': 'true' },
        body: buf,
      });
      const url = `${SB_URL}/storage/v1/object/public/media/${encodeURIComponent(name)}`;
      document.getElementById('ep-img-url').value = url;
      window.__edImgUrl(url);
    } catch (e) { alert('Upload failed: ' + e.message); }
  };

  window.__edReset = function () {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    delete overrides[key];
    selected.removeAttribute('style');
    populatePanel(selected);
  };

  window.__edDeleteAdded = function () {
    if (!selected || !selected.classList.contains('edit-added')) return;
    const id = selected.id;
    if (overrides._added) overrides._added = overrides._added.filter(i => i.id !== id);
    selected.remove();
    deselect();
  };

  window.__edDeselect = deselect;

  // ── SAVE ──────────────────────────────────────────────────────────────────
  window.__edSave = async function () {
    const btn = document.getElementById('eb-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
      // Sync any text content for text blocks
      (overrides._added || []).forEach(item => {
        if (item.type === 'text') {
          const el = document.getElementById(item.id);
          if (el) item.content = el.innerHTML;
        }
      });

      const res = await fetch(OV_PUT, {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json', 'x-upsert': 'true' },
        body: JSON.stringify(overrides),
      });
      if (!res.ok) throw new Error(await res.text());
      if (btn) btn.textContent = '✓ Saved';
      setTimeout(() => { if (btn) { btn.textContent = 'Save'; btn.disabled = false; } }, 2200);
    } catch (e) {
      alert('Save failed: ' + e.message);
      if (btn) { btn.textContent = 'Save'; btn.disabled = false; }
    }
  };

  window.__edExit = function () {
    const url = new URL(location.href);
    url.searchParams.delete('edit');
    location.href = url.toString();
  };

  // ── UTILS ─────────────────────────────────────────────────────────────────
  function getAddedItem(id) {
    return (overrides._added || []).find(i => i.id === id);
  }

  function syncAddedItem(id) {
    const el   = document.getElementById(id);
    const item = getAddedItem(id);
    if (!el || !item) return;
    if (item.type === 'text') item.content = el.innerHTML;
  }

  function setV(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#ffffff';
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  function extractYTId(url) {
    const m = (url || '').match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // ── BOOT ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
