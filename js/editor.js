/* ── VISUAL SITE EDITOR ─────────────────────────────────────────────────────
   ?edit=1 + adminToken in sessionStorage required.
   Saves to site-overrides.json in Supabase Storage (public).
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('edit') !== '1') return;
  const adminToken = sessionStorage.getItem('adminToken');
  if (!adminToken) return;

  const SB_URL = SUPABASE_URL;
  const SB_KEY = SUPABASE_KEY;
  const REST   = `${SB_URL}/rest/v1`;
  const OV_PUB = `${SB_URL}/storage/v1/object/public/media/site-overrides.json`;

  let overrides = {};
  let selected  = null;
  let bgPanelOpen = false;

  const FONTS = [
    { name:'Josefin Sans',    stack:"'Josefin Sans',sans-serif",      group:'clean' },
    { name:'Montserrat',      stack:"'Montserrat',sans-serif",         group:'clean' },
    { name:'Raleway',         stack:"'Raleway',sans-serif",            group:'clean' },
    { name:'Lato',            stack:"'Lato',sans-serif",               group:'clean' },
    { name:'Open Sans',       stack:"'Open Sans',sans-serif",          group:'clean' },
    { name:'Playfair Display',stack:"'Playfair Display',serif",        group:'elegant' },
    { name:'Cormorant Garamond',stack:"'Cormorant Garamond',serif",    group:'elegant' },
    { name:'EB Garamond',     stack:"'EB Garamond',serif",             group:'elegant' },
    { name:'Dancing Script',  stack:"'Dancing Script',cursive",        group:'handwriting' },
    { name:'Sacramento',      stack:"'Sacramento',cursive",            group:'handwriting' },
    { name:'Great Vibes',     stack:"'Great Vibes',cursive",           group:'handwriting' },
    { name:'Caveat',          stack:"'Caveat',cursive",                group:'handwriting' },
    { name:'Satisfy',         stack:"'Satisfy',cursive",               group:'handwriting' },
    { name:'Pacifico',        stack:"'Pacifico',cursive",              group:'handwriting' },
    { name:'Pinyon Script',   stack:"'Pinyon Script',cursive",         group:'handwriting' },
  ];

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
      // Load overrides from settings table (same as where we now save them)
      const r = await fetch(`${REST}/settings?key=eq.site_overrides&select=value`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${adminToken}` }
      });
      if (r.ok) {
        const rows = await r.json();
        if (rows && rows[0]?.value) overrides = JSON.parse(rows[0].value);
      }
    } catch (_) {
      // Fall back to old storage file if settings row doesn't exist yet
      try {
        const r2 = await fetch(OV_PUB + '?t=' + Date.now());
        if (r2.ok) overrides = await r2.json();
      } catch (_2) {}
    }

    applyStyleOverrides();
    renderAddedElements(true);

    loadEditorFonts();
    document.body.classList.add('edit-mode');
    buildBar();
    buildPanel();
    buildBgPanel();
    attachTargets();
    interceptNavClicks();
  }

  // ── FONT LOADER ───────────────────────────────────────────────────────────
  function loadEditorFonts() {
    const families = [
      'Montserrat:wght@300;400;700',
      'Raleway:wght@300;400;700',
      'Lato:wght@300;400;700',
      'Open+Sans:wght@300;400;700',
      'Playfair+Display:ital,wght@0,400;0,700;1,400',
      'Cormorant+Garamond:wght@300;400;600',
      'EB+Garamond:wght@400;500',
      'Dancing+Script:wght@400;700',
      'Sacramento',
      'Great+Vibes',
      'Caveat:wght@400;700',
      'Satisfy',
      'Pacifico',
      'Pinyon+Script',
    ].map(f => 'family=' + f).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }

  // ── APPLY OVERRIDES ───────────────────────────────────────────────────────
  function applyStyleOverrides() {
    Object.entries(overrides).forEach(([key, styles]) => {
      if (key === '_added') return;
      document.querySelectorAll(`[data-edit="${key}"]`).forEach(el => applyStyles(el, styles));
    });
  }

  function applyStyles(el, styles) {
    Object.entries(styles || {}).forEach(([p, v]) => {
      if (p === '_html') { el.innerHTML = v; return; }
      el.style[p] = v;
    });
  }

  // ── ADDED ELEMENTS ────────────────────────────────────────────────────────
  function renderAddedElements(editMode) {
    (overrides._added || []).forEach(item => {
      if (!document.getElementById(item.id)) buildAddedEl(item, editMode);
    });
  }

  function buildAddedEl(item, editMode) {
    const zone = document.querySelector('.hero');
    if (!zone) return null;

    const el = document.createElement('div');
    el.id = item.id;
    el.classList.add('site-added-el');
    if (editMode) el.classList.add('edit-target', 'edit-added');
    el.dataset.addedId   = item.id;
    el.dataset.addedType = item.type;
    el.dataset.edit      = item.id;
    el.dataset.editLabel = item.type === 'text' ? 'Text Block' : item.type === 'image' ? 'Image' : 'Video';
    el.style.cssText = `position:absolute;left:${item.x ?? 30}%;top:${item.y ?? 30}%;z-index:10;`;

    if (item.type === 'text') {
      el.innerHTML = item.content || 'Double-click to edit';
      Object.assign(el.style, { fontFamily:"'Josefin Sans',sans-serif", fontSize:'20px', color:'#fff', fontWeight:'300', letterSpacing:'0.12em', cursor:editMode?'move':'default', userSelect:editMode?'none':'' });
      if (editMode) {
        el.addEventListener('dblclick', e => { e.stopPropagation(); el.contentEditable='true'; el.style.cursor='text'; el.style.userSelect='text'; el.focus(); });
        el.addEventListener('blur', () => { el.contentEditable='false'; el.style.cursor='move'; el.style.userSelect='none'; syncAddedContent(item.id); });
      }
    } else if (item.type === 'image') {
      el.style.width = item.styles?.width || '220px';
      el.style.height = item.styles?.height || '160px';
      el.style.overflow = 'hidden';
      if (item.src) {
        const img = document.createElement('img');
        img.src = item.src;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;';
        el.appendChild(img);
      } else if (editMode) {
        el.style.background = 'rgba(255,255,255,0.08)';
        el.style.border = '1px dashed rgba(255,255,255,0.3)';
        el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;">Select → upload image</div>';
      }
    } else if (item.type === 'video') {
      el.style.width = item.styles?.width || '400px';
      el.style.height = item.styles?.height || '225px';
      el.style.overflow = 'hidden';
      const ytId = extractYTId(item.src || '');
      if (ytId) {
        const fr = document.createElement('iframe');
        fr.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
        fr.style.cssText = 'width:100%;height:100%;border:none;display:block;' + (editMode ? 'pointer-events:none;' : '');
        fr.allow = 'accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture';
        el.appendChild(fr);
      } else if (editMode) {
        el.style.background = 'rgba(0,0,0,0.4)';
        el.style.border = '1px dashed rgba(255,255,255,0.3)';
        el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;">Select → paste video URL</div>';
      }
    }

    applyStyles(el, item.styles);
    zone.appendChild(el);
    if (editMode) { makeDraggable(el, item); el.addEventListener('click', e => { if (el.contentEditable === 'true') return; e.stopPropagation(); selectEl(el); }); }
    return el;
  }

  function makeDraggable(el, item) {
    el.addEventListener('mousedown', e => {
      if (el.contentEditable === 'true') return;
      if (e.target.closest('#edit-panel,#edit-bar,#bg-panel')) return;
      let sx = e.clientX, sy = e.clientY, sl = el.offsetLeft, st = el.offsetTop;
      e.preventDefault(); e.stopPropagation();
      function mv(ev) {
        const zone = el.parentElement;
        el.style.left = (Math.max(0, sl + ev.clientX - sx) / zone.offsetWidth * 100).toFixed(2) + '%';
        el.style.top  = (Math.max(0, st + ev.clientY - sy) / zone.offsetHeight * 100).toFixed(2) + '%';
        item.x = parseFloat(el.style.left); item.y = parseFloat(el.style.top);
        if (selected === el) placePanel(el);
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }

  // ── NAV CLICK INTERCEPTION ────────────────────────────────────────────────
  function interceptNavClicks() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-edit-type="nav-item"],[data-edit-type="container"]');
      if (t) { e.stopImmediatePropagation(); e.preventDefault(); selectEl(t); }
    }, true);
  }

  // ── EDIT BAR ──────────────────────────────────────────────────────────────
  function buildBar() {
    const bar = document.createElement('div');
    bar.id = 'edit-bar';
    bar.innerHTML = `
      <div class="eb-left">
        <span class="eb-badge">✏ Edit Mode</span>
        <span class="eb-hint" id="eb-hint">Click any glowing element to edit</span>
      </div>
      <div class="eb-right">
        <button class="eb-btn eb-bg-btn" onclick="__edToggleBgPanel(event)">🖼 Background</button>
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
    document.addEventListener('click', e => { if (!e.target.closest('.eb-add-wrap')) hideAddMenu(); });
  }

  function hideAddMenu() { const m = document.getElementById('eb-add-menu'); if (m) m.style.display = 'none'; }
  window.__edToggleAdd = function(e) { e.stopPropagation(); const m = document.getElementById('eb-add-menu'); if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none'; };
  window.__edAddEl = function(type) {
    hideAddMenu();
    const id = 'ael-' + Date.now();
    const item = { id, type, x:25, y:30, src:'', content:'', styles:{} };
    if (!overrides._added) overrides._added = [];
    overrides._added.push(item);
    const el = buildAddedEl(item, true);
    if (el) selectEl(el);
  };

  // ── BACKGROUND PANEL ──────────────────────────────────────────────────────
  function buildBgPanel() {
    const p = document.createElement('div');
    p.id = 'bg-panel';
    p.style.display = 'none';
    p.innerHTML = `
      <div class="ep-head">
        <span class="ep-title">Background Images</span>
        <button class="ep-x" onclick="__edCloseBgPanel()">✕</button>
      </div>
      <div class="ep-sec">
        <div class="ep-sec-title">Desktop Image (landscape)</div>
        <button class="ep-upload-btn" onclick="document.getElementById('bg-file-dt').click()">↑ Upload Desktop BG</button>
        <input type="file" id="bg-file-dt" accept="image/*" style="display:none" onchange="__edBgUpload(this.files[0],'desktop')">
        <input type="text" id="bg-url-dt" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edBgUrl(this.value,'desktop')">
        <img id="bg-prev-dt" style="display:none;width:100%;margin-top:6px;border-radius:3px;max-height:80px;object-fit:cover;">
      </div>
      <div class="ep-sec">
        <div class="ep-sec-title">Mobile Image (portrait)</div>
        <button class="ep-upload-btn" onclick="document.getElementById('bg-file-mb').click()">↑ Upload Mobile BG</button>
        <input type="file" id="bg-file-mb" accept="image/*" style="display:none" onchange="__edBgUpload(this.files[0],'mobile')">
        <input type="text" id="bg-url-mb" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edBgUrl(this.value,'mobile')">
        <img id="bg-prev-mb" style="display:none;width:100%;margin-top:6px;border-radius:3px;max-height:80px;object-fit:cover;">
      </div>`;
    document.body.appendChild(p);

    // Pre-fill current src values
    const dtSrc = document.getElementById('hero-src-desktop')?.getAttribute('srcset') || '';
    const mbSrc = document.getElementById('hero-src-mobile')?.src || '';
    if (dtSrc) { setV('bg-url-dt', dtSrc); showBgPreview('bg-prev-dt', dtSrc); }
    if (mbSrc && !mbSrc.includes('hero-bg.png')) { setV('bg-url-mb', mbSrc); showBgPreview('bg-prev-mb', mbSrc); }
  }

  function showBgPreview(id, src) {
    const img = document.getElementById(id);
    if (!img) return;
    img.src = src; img.style.display = src ? 'block' : 'none';
  }

  window.__edToggleBgPanel = function(e) {
    e.stopPropagation();
    const p = document.getElementById('bg-panel');
    if (!p) return;
    bgPanelOpen = !bgPanelOpen;
    p.style.display = bgPanelOpen ? 'block' : 'none';
    if (bgPanelOpen) { p.style.right = '16px'; p.style.top = '54px'; }
  };
  window.__edCloseBgPanel = function() { const p = document.getElementById('bg-panel'); if (p) p.style.display = 'none'; bgPanelOpen = false; };

  window.__edBgUrl = function(url, target) {
    if (target === 'desktop') {
      const src = document.getElementById('hero-src-desktop');
      if (src) src.setAttribute('srcset', url);
      showBgPreview('bg-prev-dt', url);
      if (!overrides['_bg']) overrides['_bg'] = {};
      overrides['_bg'].desktop = url;
    } else {
      const img = document.getElementById('hero-src-mobile');
      if (img) img.src = url;
      showBgPreview('bg-prev-mb', url);
      if (!overrides['_bg']) overrides['_bg'] = {};
      overrides['_bg'].mobile = url;
    }
  };

  window.__edBgUpload = async function(file, target) {
    if (!file?.type.startsWith('image/')) return;
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const name = `hero-bg-${target}-${Date.now()}.${ext}`;
    try {
      const buf = await file.arrayBuffer();
      const res = await sbStorageUpload(`media/${encodeURIComponent(name)}`, buf, file.type);
      if (!res.ok) throw new Error(await res.text());
      const url = `${SB_URL}/storage/v1/object/public/media/${encodeURIComponent(name)}`;
      setV(target === 'desktop' ? 'bg-url-dt' : 'bg-url-mb', url);
      window.__edBgUrl(url, target);
    } catch (e) { alert('Upload failed: ' + e.message); }
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

      <!-- TEXT EDIT HINT (text elements + nav items) -->
      <div class="ep-sec" id="ep-content-sec" style="display:none">
        <div style="font-size:9px;letter-spacing:0.1em;color:rgba(255,255,255,0.35);line-height:1.7;text-align:center;padding:2px 0">
          ✦ Double-click the text on the page<br>to edit it directly.<br>
          <span style="opacity:0.6">Enter = new line &nbsp;·&nbsp; Esc = done</span>
        </div>
      </div>

      <!-- BACKGROUND COLOR (containers / nav-bar) -->
      <div class="ep-sec" id="ep-bgcol-sec" style="display:none">
        <div class="ep-row">
          <label>Background</label>
          <input type="color" id="ep-bgcol" style="flex:1;height:30px" oninput="__edUp('backgroundColor',this.value)">
        </div>
        <div class="ep-row">
          <label>Padding</label>
          <div class="ep-pair">
            <input type="range" id="ep-pad-r" min="0" max="60" step="1" oninput="document.getElementById('ep-pad-n').value=this.value;__edUp('padding',this.value+'px')">
            <input type="number" id="ep-pad-n" min="0" max="60" style="width:50px" oninput="document.getElementById('ep-pad-r').value=this.value;__edUp('padding',this.value+'px')">
          </div>
        </div>
      </div>

      <!-- STYLE CONTROLS -->
      <div class="ep-sec" id="ep-style-sec">
        <div class="ep-row">
          <label>Size</label>
          <div class="ep-pair">
            <input type="range" id="ep-sz-r" min="6" max="160" step="1" oninput="document.getElementById('ep-sz-n').value=this.value;__edUp('fontSize',this.value+'px')">
            <input type="number" id="ep-sz-n" min="6" max="160" style="width:50px" oninput="document.getElementById('ep-sz-r').value=this.value;__edUp('fontSize',this.value+'px')">
          </div>
        </div>
        <div class="ep-row">
          <label>Color</label>
          <input type="color" id="ep-color" style="flex:1;height:30px" oninput="__edUp('color',this.value)">
        </div>
        <div class="ep-row">
          <label>Weight</label>
          <select id="ep-wt" style="flex:1" onchange="__edUp('fontWeight',this.value)">
            <option value="100">100 — Thin</option><option value="200">200 — Extra Light</option>
            <option value="300">300 — Light</option><option value="400">400 — Regular</option>
            <option value="600">600 — Semi Bold</option><option value="700">700 — Bold</option>
          </select>
        </div>
        <div class="ep-row">
          <label>Spacing</label>
          <div class="ep-pair">
            <input type="range" id="ep-ls-r" min="0" max="1" step="0.01" oninput="document.getElementById('ep-ls-n').value=this.value;__edUp('letterSpacing',this.value+'em')">
            <input type="number" id="ep-ls-n" min="0" max="1" step="0.01" style="width:50px" oninput="document.getElementById('ep-ls-r').value=this.value;__edUp('letterSpacing',this.value+'em')">
          </div>
        </div>
        <div class="ep-row">
          <label>Opacity</label>
          <div class="ep-pair">
            <input type="range" id="ep-op-r" min="0" max="1" step="0.01" oninput="document.getElementById('ep-op-n').value=this.value;__edUp('opacity',this.value)">
            <input type="number" id="ep-op-n" min="0" max="1" step="0.01" style="width:50px" oninput="document.getElementById('ep-op-r').value=this.value;__edUp('opacity',this.value)">
          </div>
        </div>
      </div>

      <!-- FONT PICKER -->
      <div class="ep-sec" id="ep-font-sec" style="display:none">
        <div class="ep-sec-title">Font</div>
        <div class="ep-font-group-label">— Clean —</div>
        <div class="ep-font-grid" id="ep-font-grid-clean"></div>
        <div class="ep-font-group-label" style="margin-top:8px">— Elegant —</div>
        <div class="ep-font-grid" id="ep-font-grid-elegant"></div>
        <div class="ep-font-group-label" style="margin-top:8px">— Handwriting —</div>
        <div class="ep-font-grid" id="ep-font-grid-handwriting"></div>
      </div>

      <!-- SHADOW -->
      <div class="ep-sec" id="ep-shadow-sec">
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

      <!-- POSITION OFFSET (static non-nav elements) -->
      <div class="ep-sec" id="ep-pos-sec">
        <div class="ep-sec-title">Position Offset (px)</div>
        <div class="ep-pos-row">
          <label>X</label><input type="number" id="ep-px" step="1" value="0" style="width:60px" oninput="__edPos()">
          <label>Y</label><input type="number" id="ep-py" step="1" value="0" style="width:60px" oninput="__edPos()">
        </div>
      </div>

      <!-- ADDED ELEMENT EXTRAS -->
      <div class="ep-sec" id="ep-added-sec" style="display:none">
        <div id="ep-text-ctrl" style="display:none">
          <div class="ep-sec-title">Text Content</div>
          <textarea id="ep-text-val" rows="3" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:6px;font-family:inherit;font-size:11px;resize:vertical;" oninput="__edTextContent(this.value)"></textarea>
        </div>
        <div id="ep-img-ctrl" style="display:none">
          <div class="ep-sec-title">Image</div>
          <button class="ep-upload-btn" onclick="document.getElementById('ep-img-file').click()">↑ Upload Image</button>
          <input type="file" id="ep-img-file" accept="image/*" style="display:none" onchange="__edUploadImg(this.files[0])">
          <input type="text" id="ep-img-url" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edImgUrl(this.value)">
        </div>
        <div id="ep-vid-ctrl" style="display:none">
          <div class="ep-sec-title">Video URL (YouTube)</div>
          <input type="text" id="ep-vid-url" placeholder="https://youtube.com/watch?v=…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edVidUrl(this.value)">
        </div>
        <div id="ep-size-ctrl" style="display:none;margin-top:10px">
          <div class="ep-sec-title">Size (px)</div>
          <div class="ep-pos-row">
            <label>W</label><input type="number" id="ep-sw" step="1" min="40" style="width:60px" oninput="__edSize()">
            <label>H</label><input type="number" id="ep-sh" step="1" min="40" style="width:60px" oninput="__edSize()">
          </div>
        </div>
        <button class="ep-del" style="margin-top:10px" onclick="__edDeleteAdded()">🗑 Delete element</button>
      </div>

      <!-- RESET / HIDE -->
      <div class="ep-sec" id="ep-reset-sec">
        <button class="ep-reset" onclick="__edReset()">↺ Reset styles</button>
        <button class="ep-del" id="ep-hide-btn" style="margin-top:6px" onclick="__edHide()">🗑 Hide element</button>
      </div>`;
    document.body.appendChild(p);

    // Populate font grids
    FONTS.forEach(f => {
      const grid = document.getElementById('ep-font-grid-' + f.group);
      if (!grid) return;
      const btn = document.createElement('button');
      btn.className = 'ep-font-btn';
      btn.dataset.stack = f.stack;
      btn.title = f.name;
      btn.style.fontFamily = f.stack;
      btn.innerHTML = `<span class="ep-font-preview">Aa</span><span class="ep-font-name">${f.name}</span>`;
      btn.onclick = () => window.__edFont(f.stack);
      grid.appendChild(btn);
    });
  }

  // ── ELEMENT SELECTION ─────────────────────────────────────────────────────
  function attachTargets() {
    document.querySelectorAll('[data-edit]:not(.edit-added)').forEach(el => {
      el.classList.add('edit-target');
      const type = el.dataset.editType;
      if (!['nav-item','container'].includes(type)) {
        el.addEventListener('click', e => { e.stopPropagation(); selectEl(el); });
        if (type !== 'style') makeStaticDraggable(el);
        if (!type || type === 'text' || type === 'nav-item') makeStaticEditable(el);
      }
    });
    // Intercept project item clicks — redirect to selecting the list container
    document.addEventListener('click', e => {
      const item = e.target.closest('.wo-proj-item');
      if (item) { e.stopImmediatePropagation(); e.preventDefault(); const list = document.getElementById('wo-list'); if (list) selectEl(list); }
    }, true);
    document.addEventListener('click', e => {
      if (!selected) return;
      if (!e.target.closest('[data-edit]') && !e.target.closest('#edit-panel') && !e.target.closest('#edit-bar') && !e.target.closest('#bg-panel') && !e.target.closest('.wo-proj-item')) deselect();
    });
  }

  function makeStaticEditable(el) {
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      el.contentEditable = 'true';
      el.style.cursor = 'text';
      el.style.userSelect = 'text';
      el.focus();
      el._edKeyHandler = function(ke) {
        if (ke.key === 'Enter') { ke.preventDefault(); document.execCommand('insertHTML', false, '<br>'); }
        if (ke.key === 'Escape') { el.blur(); }
      };
      el.addEventListener('keydown', el._edKeyHandler);
    });
    el.addEventListener('blur', () => {
      if (el.contentEditable !== 'true') return;
      el.contentEditable = 'false';
      el.style.cursor = 'move';
      el.style.userSelect = '';
      if (el._edKeyHandler) { el.removeEventListener('keydown', el._edKeyHandler); el._edKeyHandler = null; }
      const key = el.dataset.edit;
      if (key) { if (!overrides[key]) overrides[key] = {}; overrides[key]._html = el.innerHTML; }
    });
  }

  function makeStaticDraggable(el) {
    el.style.cursor = 'move';
    el.addEventListener('mousedown', e => {
      if (el.contentEditable === 'true') return;
      if (e.target.closest('#edit-panel,#edit-bar,#bg-panel')) return;
      e.preventDefault(); e.stopPropagation();
      selectEl(el);
      const key = el.dataset.edit;
      const ov = overrides[key] || {};
      const m = (ov.transform || '').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      let tx = m ? parseFloat(m[1]) : 0;
      let ty = m ? parseFloat(m[2]) : 0;
      let sx = e.clientX, sy = e.clientY;
      function mv(ev) {
        tx += ev.clientX - sx; ty += ev.clientY - sy;
        sx = ev.clientX; sy = ev.clientY;
        el.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`;
        if (!overrides[key]) overrides[key] = {};
        overrides[key].transform = el.style.transform;
        setV('ep-px', tx.toFixed(1)); setV('ep-py', ty.toFixed(1));
        placePanel(el);
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
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
    document.getElementById('eb-hint').textContent = 'Click any glowing element to edit';
  }

  // ── PANEL POPULATE ────────────────────────────────────────────────────────
  function populatePanel(el) {
    const isAdded  = el.classList.contains('edit-added');
    const addType  = el.dataset.addedType;
    const editType = el.dataset.editType || 'text';
    const cs       = window.getComputedStyle(el);
    const ov       = isAdded ? (getAddedItem(el.id)?.styles || {}) : (overrides[el.dataset.edit] || {});

    // Which sections to show
    const showContent = !isAdded && ['text','nav-item',undefined,''].includes(editType) && !['container','style'].includes(editType);
    const showBgCol   = !isAdded && editType === 'container';
    const showStyle   = isAdded ? addType === 'text' : !['container'].includes(editType);
    const showFont    = showStyle;
    const showShadow  = showStyle;
    const showPos     = !isAdded && !['nav-item','container','style'].includes(editType);
    const showAdded   = isAdded;
    const showReset   = !isAdded;

    show('ep-content-sec', showContent);
    show('ep-bgcol-sec',   showBgCol);
    show('ep-style-sec',   showStyle);
    show('ep-font-sec',    showFont);
    show('ep-shadow-sec',  showShadow);
    show('ep-pos-sec',     showPos);
    show('ep-added-sec',   showAdded);
    show('ep-reset-sec',   showReset);

    // Background color
    if (showBgCol) {
      const bg = ov.backgroundColor || cs.backgroundColor;
      document.getElementById('ep-bgcol').value = rgbToHex(bg) || '#ffffff';
      const pad = parseInt(ov.padding || cs.padding) || 0;
      setV('ep-pad-r', pad); setV('ep-pad-n', pad);
    }

    // Style controls
    if (showStyle) {
      const fs = parseInt(ov.fontSize || cs.fontSize) || 16;
      setV('ep-sz-r', fs); setV('ep-sz-n', fs);
      document.getElementById('ep-color').value = rgbToHex(ov.color || cs.color) || '#ffffff';
      document.getElementById('ep-wt').value    = ov.fontWeight || Math.round(parseFloat(cs.fontWeight)) || 300;
      const lsPx  = parseFloat(ov.letterSpacing || cs.letterSpacing) || 0;
      const lsEm  = ov.letterSpacing ? parseFloat(ov.letterSpacing) : +(lsPx / fs).toFixed(3);
      setV('ep-ls-r', Math.max(0, lsEm)); setV('ep-ls-n', Math.max(0, lsEm));
      const op = parseFloat(ov.opacity ?? cs.opacity ?? 1);
      setV('ep-op-r', op); setV('ep-op-n', op);
    }

    // Font picker
    if (showFont) {
      document.querySelectorAll('.ep-font-btn').forEach(b => b.classList.remove('active'));
      const curFont = (ov.fontFamily || cs.fontFamily || '').replace(/['"]/g,'').split(',')[0].trim().toLowerCase();
      document.querySelectorAll('.ep-font-btn').forEach(b => {
        const btnFont = b.dataset.stack.replace(/['"]/g,'').split(',')[0].trim().toLowerCase();
        if (btnFont === curFont) b.classList.add('active');
      });
    }

    // Shadow
    if (showShadow) {
      document.querySelectorAll('.ep-sh-btn').forEach(b => b.classList.remove('active'));
      const curSh = ov.textShadow || 'none';
      const found = Object.entries(SHADOWS).find(([, v]) => v === curSh);
      const shKey = found ? found[0] : (!ov.textShadow ? 'none' : null);
      if (shKey) { const b = document.querySelector(`.ep-sh-btn[data-sh="${shKey}"]`); if (b) b.classList.add('active'); }
    }

    // Position offset
    if (showPos) {
      const m = (ov.transform || '').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      setV('ep-px', m ? m[1] : 0); setV('ep-py', m ? m[2] : 0);
    }

    // Hide button label reflects current state
    const hideBtn = document.getElementById('ep-hide-btn');
    if (hideBtn && showReset) {
      const isHidden = ov.display === 'none';
      hideBtn.textContent = isHidden ? '👁 Restore element' : '🗑 Hide element';
      hideBtn.onclick = isHidden ? () => { window.__edUp('display', ''); deselect(); } : window.__edHide;
    }

    // Added element extras
    if (showAdded) {
      show('ep-text-ctrl', addType === 'text');
      show('ep-img-ctrl',  addType === 'image');
      show('ep-vid-ctrl',  addType === 'video');
      show('ep-size-ctrl', addType === 'image' || addType === 'video');
      if (addType === 'text')  setV('ep-text-val', el.innerText || '');
      if (addType === 'image') { const item = getAddedItem(el.id); setV('ep-img-url', item?.src || ''); setV('ep-sw', parseInt(el.style.width)||220); setV('ep-sh', parseInt(el.style.height)||160); }
      if (addType === 'video') { const item = getAddedItem(el.id); setV('ep-vid-url', item?.src || ''); setV('ep-sw', parseInt(el.style.width)||400); setV('ep-sh', parseInt(el.style.height)||225); }
    }
  }

  function placePanel(el) {
    const panel = document.getElementById('edit-panel');
    const rect  = el.getBoundingClientRect();
    const PW = 272;
    // Full-width elements (nav bar etc.) — place panel below, left-aligned
    if (rect.width > window.innerWidth * 0.7) {
      panel.style.left = '8px';
      panel.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
      return;
    }
    let left = rect.right + window.scrollX + 16;
    if (left + PW > window.innerWidth - 8) left = rect.left + window.scrollX - PW - 16;
    if (left < 8) left = 8;
    let top = rect.top + window.scrollY;
    top = Math.min(top, window.scrollY + window.innerHeight - 560);
    top = Math.max(top, window.scrollY + 54);
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
  }

  // ── UPDATE HANDLERS ───────────────────────────────────────────────────────
  window.__edUp = function(prop, val) {
    if (!selected) return;
    const isAdded = selected.classList.contains('edit-added');
    if (isAdded) { const item = getAddedItem(selected.id); if (item) { if (!item.styles) item.styles={}; item.styles[prop]=val; } }
    else { const key = selected.dataset.edit; if (!overrides[key]) overrides[key]={}; overrides[key][prop]=val; }
    selected.style[prop] = val;
  };

  window.__edFont = function(stack) {
    document.querySelectorAll('.ep-font-btn').forEach(b => b.classList.remove('active'));
    const active = document.querySelector(`.ep-font-btn[data-stack="${stack}"]`);
    if (active) active.classList.add('active');
    window.__edUp('fontFamily', stack);
  };

  window.__edShadow = function(preset) {
    document.querySelectorAll('.ep-sh-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.ep-sh-btn[data-sh="${preset}"]`);
    if (btn) btn.classList.add('active');
    window.__edUp('textShadow', SHADOWS[preset] || 'none');
  };

  window.__edPos = function() {
    const x = parseFloat(document.getElementById('ep-px').value)||0;
    const y = parseFloat(document.getElementById('ep-py').value)||0;
    window.__edUp('transform', `translate(${x}px,${y}px)`);
  };

  window.__edTextContent = function(val) {
    if (!selected || selected.dataset.addedType !== 'text') return;
    selected.innerText = val;
    syncAddedContent(selected.id);
  };

  window.__edImgUrl = function(url) {
    if (!selected || selected.dataset.addedType !== 'image') return;
    const item = getAddedItem(selected.id); if (item) item.src = url;
    let img = selected.querySelector('img');
    if (!img) { selected.innerHTML=''; img = document.createElement('img'); img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;'; selected.appendChild(img); }
    img.src = url;
  };

  window.__edVidUrl = function(url) {
    if (!selected || selected.dataset.addedType !== 'video') return;
    const item = getAddedItem(selected.id); if (item) item.src = url;
    const ytId = extractYTId(url); if (!ytId) return;
    selected.innerHTML = '';
    const fr = document.createElement('iframe');
    fr.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
    fr.style.cssText = 'width:100%;height:100%;border:none;display:block;pointer-events:none;';
    selected.appendChild(fr);
  };

  window.__edSize = function() {
    if (!selected) return;
    const w = document.getElementById('ep-sw').value+'px', h = document.getElementById('ep-sh').value+'px';
    selected.style.width=w; selected.style.height=h;
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles={}; item.styles.width=w; item.styles.height=h; }
  };

  window.__edUploadImg = async function(file) {
    if (!file?.type.startsWith('image/')) return;
    const ext=file.name.split('.').pop().toLowerCase()||'jpg', name=`ed-img-${Date.now()}.${ext}`;
    try {
      const btn = document.querySelector('.ep-upload-btn');
      if (btn) { btn.textContent = 'Uploading…'; btn.disabled = true; }
      const buf = await file.arrayBuffer();
      const res = await sbStorageUpload(`media/${encodeURIComponent(name)}`, buf, file.type);
      if (!res.ok) throw new Error(await res.text());
      const url = `${SB_URL}/storage/v1/object/public/media/${encodeURIComponent(name)}`;
      setV('ep-img-url', url); window.__edImgUrl(url);
      if (btn) { btn.textContent = '✓ Uploaded'; setTimeout(()=>{ btn.textContent='↑ Upload Image'; btn.disabled=false; }, 2000); }
    } catch(e) {
      alert('Upload failed: ' + e.message);
      const btn = document.querySelector('.ep-upload-btn');
      if (btn) { btn.textContent = '↑ Upload Image'; btn.disabled = false; }
    }
  };

  window.__edReset = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    delete overrides[key];
    selected.removeAttribute('style');
    selected.style.cursor = 'move';
    populatePanel(selected);
  };

  window.__edHide = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    if (!confirm('Hide this element? You can restore it by clicking Reset styles.')) return;
    window.__edUp('display', 'none');
    deselect();
  };

  window.__edDeleteAdded = function() {
    if (!selected || !selected.classList.contains('edit-added')) return;
    const id = selected.id;
    if (overrides._added) overrides._added = overrides._added.filter(i => i.id !== id);
    selected.remove();
    deselect();
  };

  window.__edDeselect = deselect;

  // ── SAVE ──────────────────────────────────────────────────────────────────
  window.__edSave = async function() {
    const btn = document.getElementById('eb-save-btn');
    if (btn) { btn.textContent='Saving…'; btn.disabled=true; }
    // Sync text-block innerHTML
    (overrides._added||[]).forEach(item => { if (item.type==='text') { const el=document.getElementById(item.id); if (el) item.content=el.innerHTML; } });
    try {
      // Save to settings table using same upsert pattern as admin.js
      const res = await fetch(`${REST}/settings?on_conflict=key`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify([{ key: 'site_overrides', value: JSON.stringify(overrides) }])
      });
      if (!res.ok) throw new Error(await res.text());
      if (btn) btn.textContent='✓ Saved';
      setTimeout(()=>{ if(btn){btn.textContent='Save';btn.disabled=false;} },2200);
    } catch(e) { alert('Save failed: '+e.message); if(btn){btn.textContent='Save';btn.disabled=false;} }
  };

  window.__edExit = function() {
    const url = new URL(location.href); url.searchParams.delete('edit'); location.href=url.toString();
  };

  // ── UTILS ─────────────────────────────────────────────────────────────────
  function getAddedItem(id) { return (overrides._added||[]).find(i=>i.id===id); }
  function syncAddedContent(id) { const el=document.getElementById(id),item=getAddedItem(id); if(el&&item&&item.type==='text') item.content=el.innerHTML; }
  function show(id, visible) { const el=document.getElementById(id); if(el) el.style.display=visible?'':'none'; }
  function setV(id, val) { const el=document.getElementById(id); if(el) el.value=val; }

  // Upload to Supabase Storage: PUT first (overwrite existing), POST if new
  async function sbStorageUpload(fullPath, body, contentType) {
    const hdrs = {'apikey':SB_KEY,'Authorization':`Bearer ${adminToken}`,'Content-Type':contentType,'x-upsert':'true'};
    const url = `${SB_URL}/storage/v1/object/${fullPath}`;
    const res = await fetch(url, {method:'POST', headers:hdrs, body});
    if (!res.ok && res.status === 405) {
      return fetch(url, {method:'PUT', headers:hdrs, body});
    }
    return res;
  }
  function rgbToHex(rgb) {
    if (!rgb||rgb==='transparent') return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    const m=rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#ffffff';
    return '#'+[m[1],m[2],m[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
  }
  function extractYTId(url) { const m=(url||'').match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/); return m?m[1]:null; }

  // ── BOOT ──────────────────────────────────────────────────────────────────
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
