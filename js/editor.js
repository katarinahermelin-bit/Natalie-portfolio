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
  let panelUserMoved = false;

  const FONTS = [
    { name:'Archimoto',       stack:"'Archimoto',sans-serif",              group:'clean' },
    { name:'Josefin Sans',    stack:"'Josefin Sans',sans-serif",           group:'clean' },
    { name:'Archivo',         stack:"'Archivo',sans-serif",                group:'clean' },
    { name:'Montserrat',      stack:"'Montserrat',sans-serif",             group:'clean' },
    { name:'Raleway',         stack:"'Raleway',sans-serif",                group:'clean' },
    { name:'Lato',            stack:"'Lato',sans-serif",                   group:'clean' },
    { name:'Open Sans',       stack:"'Open Sans',sans-serif",              group:'clean' },
    { name:'Arial',           stack:"'Arial',Helvetica,sans-serif",        group:'clean' },
    { name:'Helvetica',       stack:"'Helvetica Neue',Helvetica,sans-serif",group:'clean' },
    { name:'Verdana',         stack:"'Verdana',Geneva,sans-serif",         group:'clean' },
    { name:'Courier New',     stack:"'Courier New',Courier,monospace",     group:'clean' },
    { name:'Times New Roman', stack:"'Times New Roman',Times,serif",       group:'elegant' },
    { name:'Georgia',         stack:"'Georgia',serif",                     group:'elegant' },
    { name:'Playfair Display',stack:"'Playfair Display',serif",            group:'elegant' },
    { name:'Cormorant Garamond',stack:"'Cormorant Garamond',serif",        group:'elegant' },
    { name:'EB Garamond',     stack:"'EB Garamond',serif",                 group:'elegant' },
    { name:'Dancing Script',  stack:"'Dancing Script',cursive",            group:'handwriting' },
    { name:'Sacramento',      stack:"'Sacramento',cursive",                group:'handwriting' },
    { name:'Great Vibes',     stack:"'Great Vibes',cursive",               group:'handwriting' },
    { name:'Caveat',          stack:"'Caveat',cursive",                    group:'handwriting' },
    { name:'Satisfy',         stack:"'Satisfy',cursive",                   group:'handwriting' },
    { name:'Pacifico',        stack:"'Pacifico',cursive",                  group:'handwriting' },
    { name:'Pinyon Script',   stack:"'Pinyon Script',cursive",             group:'handwriting' },
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
      'Archivo:wght@300;400;700',
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
    el.dataset.editLabel = item.type === 'text' ? 'Text Block' : item.type === 'box' ? 'Box' : item.type === 'button' ? (item.label||'Button') : item.type === 'logo' ? 'Logo' : item.type === 'image' ? 'Image' : 'Video';
    el.style.cssText = `position:absolute;left:${item.x ?? 30}%;top:${item.y ?? 30}%;z-index:${editMode ? Math.max(item.styles?.zIndex||10, 110) : (item.styles?.zIndex||10)};`;

    if (item.type === 'text') {
      el.innerHTML = item.content || 'Double-click to edit';
      el.style.width = item.styles?.width || '280px';
      Object.assign(el.style, { fontFamily:"'Josefin Sans',sans-serif", fontSize:'20px', color:'#fff', fontWeight:'300', letterSpacing:'0.12em', cursor:editMode?'move':'default', userSelect:editMode?'none':'' });
      if (editMode) {
        el.addEventListener('dblclick', e => { e.stopPropagation(); el.contentEditable='true'; el.style.cursor='text'; el.style.userSelect='text'; el.focus(); });
        el.addEventListener('blur', () => { el.contentEditable='false'; el.style.cursor='move'; el.style.userSelect='none'; syncAddedContent(item.id); });
        addResizeHandle(el, item);
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
      if (editMode) addResizeHandle(el, item);
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
      if (editMode) addResizeHandle(el, item);
    } else if (item.type === 'box') {
      el.style.width = item.styles?.width || '220px';
      el.style.height = item.styles?.height || '160px';
      el.style.overflow = 'hidden';
      el.style.position = 'relative';
      el.style.backgroundColor = item.styles?.backgroundColor || 'rgba(30,30,30,0.55)';
      boxRebuildContent(el, item, editMode);
      if (editMode) addResizeHandle(el, item);
    } else if (item.type === 'button') {
      el.textContent = item.label || 'Button';
      Object.assign(el.style, {
        display:'inline-block', whiteSpace:'nowrap', userSelect:'none', textDecoration:'none',
        fontFamily: item.styles?.fontFamily || "'Josefin Sans',sans-serif",
        fontSize:   item.styles?.fontSize   || '10px',
        color:      item.styles?.color      || '#000000',
        backgroundColor: item.styles?.backgroundColor || 'transparent',
        padding:    item.styles?.padding    || '6px 16px',
        borderRadius: item.styles?.borderRadius || '0px',
        letterSpacing: item.styles?.letterSpacing || '0.22em',
        fontWeight: item.styles?.fontWeight || '300',
        textTransform: 'uppercase',
        border:     item.styles?.border     || 'none',
        cursor:     editMode ? 'move' : 'pointer',
      });
      if (!editMode) el.addEventListener('click', () => triggerButtonLink(item));
      if (editMode) addResizeHandle(el, item);
    } else if (item.type === 'logo') {
      if (item.srcType === 'image' && item.src) {
        const img = document.createElement('img');
        img.src = item.src;
        img.style.cssText = `display:block;max-width:${item.styles?.width||'120px'};height:auto;pointer-events:${editMode?'none':'auto'};`;
        el.appendChild(img);
      } else {
        el.textContent = item.content || 'Logo';
        Object.assign(el.style, {
          fontFamily: item.styles?.fontFamily || "'Josefin Sans',sans-serif",
          fontSize:   item.styles?.fontSize   || '13px',
          color:      item.styles?.color      || '#000000',
          fontWeight: item.styles?.fontWeight || '300',
          letterSpacing: item.styles?.letterSpacing || '0.18em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        });
      }
    }

    applyStyles(el, item.styles);
    if (editMode) el.style.zIndex = Math.max(parseInt(item.styles?.zIndex) || 10, 110);
    zone.appendChild(el);
    if (editMode) { makeDraggable(el, item); el.addEventListener('click', e => { if (el.contentEditable === 'true') return; e.stopPropagation(); selectEl(el); }); }
    return el;
  }

  function makeDraggable(el, item) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('mousedown', e => {
      if (el.contentEditable === 'true') return;
      if (e.target.closest('#edit-panel,#edit-bar,#bg-panel,.ed-resize-handle')) return;
      e.stopPropagation();
      let sx = e.clientX, sy = e.clientY, sl = el.offsetLeft, st = el.offsetTop;
      let dragging = false;
      function mv(ev) {
        if (!dragging) {
          if (Math.abs(ev.clientX-sx)<4 && Math.abs(ev.clientY-sy)<4) return;
          dragging = true; document.body.style.userSelect='none';
        }
        const zone = el.parentElement;
        el.style.left = (Math.max(0, sl + ev.clientX - sx) / zone.offsetWidth * 100).toFixed(2) + '%';
        el.style.top  = (Math.max(0, st + ev.clientY - sy) / zone.offsetHeight * 100).toFixed(2) + '%';
        item.x = parseFloat(el.style.left); item.y = parseFloat(el.style.top);
        if (selected === el) placePanel(el);
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect=''; }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }

  function addResizeHandle(el, item) {
    const h = document.createElement('div');
    h.className = 'ed-resize-handle';
    el.appendChild(h);
    h.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      if (!el.style.width)  el.style.width  = el.offsetWidth  + 'px';
      if (!el.style.height) el.style.height = el.offsetHeight + 'px';
      const sw = el.offsetWidth, sh = el.offsetHeight, sx = e.clientX, sy = e.clientY;
      const wId = item.type === 'box' ? 'ep-bw' : 'ep-sw';
      const hId = item.type === 'box' ? 'ep-bh' : 'ep-sh';
      function mv(ev) {
        const w = Math.max(40, sw + (ev.clientX - sx));
        const hh = Math.max(40, sh + (ev.clientY - sy));
        el.style.width = w + 'px'; el.style.height = hh + 'px';
        if (!item.styles) item.styles = {};
        item.styles.width = el.style.width; item.styles.height = el.style.height;
        setV(wId, w); setV(hId, hh);
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }

  function boxRebuildContent(el, item, editMode) {
    Array.from(el.children).forEach(c => { if (!c.classList.contains('ed-resize-handle')) c.remove(); });
    if (item.src && item.srcType === 'image') {
      const img = document.createElement('img');
      img.src = item.src;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;';
      el.insertBefore(img, el.querySelector('.ed-resize-handle'));
    } else if (item.src && item.srcType === 'video') {
      const ytId = extractYTId(item.src || '');
      if (ytId) {
        const fr = document.createElement('iframe');
        fr.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
        fr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block;' + (editMode ? 'pointer-events:none;' : '');
        el.insertBefore(fr, el.querySelector('.ed-resize-handle'));
      }
    }
  }

  function triggerButtonLink(item) {
    const v = item.linkValue || '';
    switch (item.linkType) {
      case 'nav-home':      if (window.scrollToHero) scrollToHero({preventDefault:()=>{}}); break;
      case 'nav-work':      if (window.scrollToProjects) scrollToProjects(); break;
      case 'popup-contact': if (window.openPopup) openPopup('contact-popup'); break;
      case 'popup-about':   if (window.openPopup) openPopup('about-popup'); break;
      case 'email':         window.location.href = 'mailto:' + v; break;
      case 'phone':         window.location.href = 'tel:' + v; break;
      case 'url': default:  if (v) window.open(v, '_blank', 'noopener'); break;
    }
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
            <div class="eb-add-group">Elements</div>
            <button onclick="__edAddEl('text')">✏ Text Block</button>
            <button onclick="__edAddEl('box')">▣ Box (color · image · video)</button>
            <button onclick="__edAddEl('button')">⬜ Button</button>
            <div class="eb-add-group">Presets</div>
            <button onclick="__edShowButtonsModal()">☰ Create / Manage Buttons</button>
            <button onclick="__edAddPreset('logo')">🅰 Logo (top left)</button>
            <button onclick="__edAddPreset('signature')">✍ Signature (bottom)</button>
            <button onclick="__edAddPreset('top-bar')">▬ Top Bar / Header</button>
            <button onclick="__edAddPreset('bottom-bar')">▬ Bottom Bar / Footer</button>
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
    let item;
    if (type === 'box') {
      item = { id, type:'box', x:25, y:30, src:'', srcType:'', styles:{ backgroundColor:'rgba(30,30,30,0.55)', width:'220px', height:'160px' } };
    } else if (type === 'button') {
      item = { id, type:'button', x:40, y:3, label:'Button', linkType:'url', linkValue:'', styles:{} };
    } else if (type === 'logo') {
      item = { id, type:'logo', x:1.5, y:1.5, content:'Natalie Hermelin', src:'', srcType:'text', styles:{ fontSize:'13px', color:'#000000', letterSpacing:'0.18em' } };
    } else {
      item = { id, type, x:25, y:30, src:'', content:'', styles:{} };
    }
    if (!overrides._added) overrides._added = [];
    overrides._added.push(item);
    const el = buildAddedEl(item, true);
    if (el) selectEl(el);
  };

  const NAV_DEFAULTS = [
    { label:'Home',      linkType:'nav-home',     linkValue:'', platform:'' },
    { label:'Work',      linkType:'nav-work',      linkValue:'', platform:'' },
    { label:'Contact',   linkType:'popup-contact', linkValue:'', platform:'' },
    { label:'Instagram', linkType:'url',           linkValue:'https://www.instagram.com/natalieeher', platform:'instagram' },
    { label:'LinkedIn',  linkType:'url',           linkValue:'https://www.linkedin.com/in/natalie-hermelin-56733a233', platform:'linkedin' },
  ];

  window.__edAddPreset = function(preset) {
    hideAddMenu();
    if (!overrides._added) overrides._added = [];
    if (preset === 'nav-buttons') {
      const total = NAV_DEFAULTS.length;
      NAV_DEFAULTS.forEach((def, i) => {
        const id = 'ael-nav-' + i + '-' + Date.now();
        const existing = overrides._added.find(it => it.type==='button' && it._navIndex===i);
        if (existing) return;
        const x = parseFloat(((i + 0.5) / total * 100).toFixed(1));
        const item = { id, type:'button', x, y:2, label:def.label, linkType:def.linkType, linkValue:def.linkValue, platform:def.platform, _navIndex:i, styles:{} };
        overrides._added.push(item);
        buildAddedEl(item, true);
      });
    } else if (preset === 'logo') {
      if (overrides._added.find(it=>it.type==='logo')) return alert('Logo already added. Select it to edit.');
      const id = 'ael-logo-' + Date.now();
      const item = { id, type:'logo', x:1.5, y:1.5, content:'Natalie Hermelin', src:'', srcType:'text', styles:{ fontSize:'13px', color:'#000000', letterSpacing:'0.18em' } };
      overrides._added.push(item);
      const el = buildAddedEl(item, true);
      if (el) selectEl(el);
    } else if (preset === 'signature') {
      const id = 'ael-sig-' + Date.now();
      const item = { id, type:'text', x:50, y:95, content:'© Natalie Hermelin 2026', styles:{ fontSize:'9px', color:'rgba(255,255,255,0.5)', letterSpacing:'0.22em', fontFamily:"'Josefin Sans',sans-serif", textAlign:'center', transform:'translateX(-50%)' } };
      overrides._added.push(item);
      const el = buildAddedEl(item, true);
      if (el) selectEl(el);
    } else if (preset === 'top-bar') {
      const id = 'ael-topbar-' + Date.now();
      const item = { id, type:'box', x:0, y:0, src:'', srcType:'', styles:{ backgroundColor:'rgba(255,255,255,1)', width:'100%', height:'64px', zIndex:5 } };
      overrides._added.push(item);
      const el = buildAddedEl(item, true);
      if (el) selectEl(el);
    } else if (preset === 'bottom-bar') {
      const id = 'ael-botbar-' + Date.now();
      const item = { id, type:'box', x:0, y:94, src:'', srcType:'', styles:{ backgroundColor:'rgba(0,0,0,0.6)', width:'100%', height:'60px', zIndex:5 } };
      overrides._added.push(item);
      const el = buildAddedEl(item, true);
      if (el) selectEl(el);
    }
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
      <div class="ep-head" id="ep-head">
        <span class="ep-title" id="ep-title">Element</span>
        <span class="ep-drag-dots" title="Drag to move panel">⠿</span>
        <button class="ep-x" onclick="__edDeselect()">✕</button>
      </div>

      <!-- TEXT EDIT HINT (text elements + nav items) -->
      <div class="ep-sec" id="ep-content-sec" style="display:none">
        <div style="font-size:13px;letter-spacing:0.06em;color:rgba(255,255,255,0.75);line-height:1.8;text-align:center;padding:4px 0;font-weight:300">
          ✦ Double-click the text<br>on the page to edit
        </div>
        <div style="font-size:9px;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-align:center;margin-top:4px">
          Enter = new line &nbsp;·&nbsp; Esc = done
        </div>
      </div>

      <!-- BACKGROUND COLOR (containers) -->
      <div class="ep-sec" id="ep-bgcol-sec" style="display:none">
        <div class="ep-row">
          <label>Background</label>
          <input type="color" id="ep-bgcol" style="flex:1;height:30px" oninput="__edUp('backgroundColor',this.value)">
        </div>
        <div class="ep-row" style="margin-top:2px">
          <label></label>
          <button onclick="__edUp('backgroundColor','transparent')" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);border-radius:3px;padding:4px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">Clear / Transparent</button>
        </div>
        <div class="ep-row">
          <label>Opacity</label>
          <div class="ep-pair">
            <input type="range" id="ep-bg-op-r" min="0" max="1" step="0.01" oninput="document.getElementById('ep-bg-op-n').value=this.value;__edUp('opacity',this.value)">
            <input type="number" id="ep-bg-op-n" min="0" max="1" step="0.01" style="width:50px" oninput="document.getElementById('ep-bg-op-r').value=this.value;__edUp('opacity',this.value)">
          </div>
        </div>
        <div class="ep-row" id="ep-pad-row">
          <label>Padding</label>
          <div class="ep-pair">
            <input type="range" id="ep-pad-r" min="0" max="60" step="1" oninput="document.getElementById('ep-pad-n').value=this.value;__edUp('padding',this.value+'px')">
            <input type="number" id="ep-pad-n" min="0" max="60" style="width:50px" oninput="document.getElementById('ep-pad-r').value=this.value;__edUp('padding',this.value+'px')">
          </div>
        </div>
      </div>

      <!-- NAV BUTTON BACKGROUND -->
      <div class="ep-sec" id="ep-navbtn-sec" style="display:none">
        <div class="ep-sec-title">Button Style</div>
        <div class="ep-row">
          <label>BG Color</label>
          <input type="color" id="ep-btn-col" style="flex:1;height:28px" oninput="__edUp('backgroundColor',this.value)">
        </div>
        <div class="ep-row" style="margin-top:2px">
          <label></label>
          <button onclick="__edUp('backgroundColor','transparent')" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);border-radius:3px;padding:4px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">Clear / Transparent</button>
        </div>
        <div class="ep-row">
          <label>Padding</label>
          <div class="ep-pair">
            <input type="range" id="ep-btn-pad-r" min="0" max="20" step="1" oninput="document.getElementById('ep-btn-pad-n').value=this.value;__edUp('padding',this.value+'px 14px')">
            <input type="number" id="ep-btn-pad-n" min="0" max="20" style="width:50px" oninput="document.getElementById('ep-btn-pad-r').value=this.value;__edUp('padding',this.value+'px 14px')">
          </div>
        </div>
        <div class="ep-row">
          <label>Radius</label>
          <div class="ep-pair">
            <input type="range" id="ep-btn-rad-r" min="0" max="30" step="1" oninput="document.getElementById('ep-btn-rad-n').value=this.value;__edUp('borderRadius',this.value+'px')">
            <input type="number" id="ep-btn-rad-n" min="0" max="30" style="width:50px" oninput="document.getElementById('ep-btn-rad-r').value=this.value;__edUp('borderRadius',this.value+'px')">
          </div>
        </div>
      </div>

      <!-- FONT PICKER (collapsible) — appears FIRST -->
      <div class="ep-sec" id="ep-font-sec" style="display:none">
        <div class="ep-font-toggle-row" onclick="__edToggleFonts()" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:2px 0">
          <span class="ep-sec-title" style="margin:0">Font</span>
          <span id="ep-font-arrow" style="font-size:10px;color:rgba(255,255,255,0.45);letter-spacing:0.1em">▾ open</span>
        </div>
        <div id="ep-font-body" style="display:none;max-height:130px;overflow-y:auto;margin-top:6px;padding-right:2px">
          <div class="ep-font-group-label">— Clean —</div>
          <div class="ep-font-grid" id="ep-font-grid-clean"></div>
          <div class="ep-font-group-label" style="margin-top:8px">— Elegant —</div>
          <div class="ep-font-grid" id="ep-font-grid-elegant"></div>
          <div class="ep-font-group-label" style="margin-top:8px">— Handwriting —</div>
          <div class="ep-font-grid" id="ep-font-grid-handwriting"></div>
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
          <label>Style</label>
          <div style="display:flex;gap:6px;flex:1">
            <button id="ep-bold-btn" class="ep-style-toggle" onclick="__edToggleBold()"><b>B</b></button>
            <button id="ep-italic-btn" class="ep-style-toggle" onclick="__edToggleItalic()"><i>I</i></button>
          </div>
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
          <div style="display:flex;gap:4px;margin-top:6px">
            <button onclick="__edUp('textAlign','left')"   class="ep-align-btn" data-align="left"   style="flex:1">⬅ Left</button>
            <button onclick="__edUp('textAlign','center')" class="ep-align-btn" data-align="center" style="flex:1">⬛ Center</button>
            <button onclick="__edUp('textAlign','right')"  class="ep-align-btn" data-align="right"  style="flex:1">➡ Right</button>
          </div>
        </div>
        <div id="ep-button-ctrl" style="display:none">
          <div class="ep-sec-title">Label</div>
          <input type="text" id="ep-btn-label" placeholder="Button text…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edBtnLabel(this.value)">
          <div class="ep-sec-title" style="margin-top:8px">Link To</div>
          <select id="ep-btn-link-type" onchange="__edBtnLinkType(this.value)" style="width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;">
            <optgroup label="— Navigation —">
              <option value="nav-home">Home (scroll to top)</option>
              <option value="nav-work">Work / Projects</option>
            </optgroup>
            <optgroup label="— Popups —">
              <option value="popup-contact">Contact popup</option>
              <option value="popup-about">About popup</option>
            </optgroup>
            <optgroup label="— Social —">
              <option value="url" data-platform="instagram">Instagram</option>
              <option value="url" data-platform="linkedin">LinkedIn</option>
              <option value="url" data-platform="facebook">Facebook</option>
              <option value="url" data-platform="tiktok">TikTok</option>
              <option value="url" data-platform="youtube">YouTube</option>
              <option value="url" data-platform="x">X / Twitter</option>
              <option value="url" data-platform="vimeo">Vimeo</option>
            </optgroup>
            <optgroup label="— Custom —">
              <option value="url">Custom URL</option>
              <option value="email">Email address</option>
              <option value="phone">Phone number</option>
            </optgroup>
          </select>
          <div id="ep-btn-val-row" style="margin-top:6px;display:none">
            <input type="text" id="ep-btn-link-val" placeholder="https:// or email or +34…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edBtnLinkVal(this.value)">
          </div>
          <!-- PADDING / BOX section -->
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
            <div class="ep-sec-title">Padding / Box</div>
            <div class="ep-row">
              <label>Fill</label>
              <input type="color" id="ep-btn-bcol" style="flex:1;height:28px" oninput="__edUp('backgroundColor',this.value)">
              <button onclick="__edUp('backgroundColor','transparent')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:3px;padding:3px 6px;cursor:pointer;font-size:9px;white-space:nowrap">None</button>
            </div>
            <div class="ep-row">
              <label>Pad V</label>
              <input type="number" id="ep-btn-pv" min="0" max="40" step="1" style="width:50px" placeholder="px" oninput="__edBtnPad()">
              <label style="margin-left:6px">H</label>
              <input type="number" id="ep-btn-ph" min="0" max="80" step="1" style="width:50px" placeholder="px" oninput="__edBtnPad()">
            </div>
            <div class="ep-row">
              <label>Radius</label>
              <div class="ep-pair">
                <input type="range" id="ep-btn-br-r" min="0" max="40" step="1" oninput="document.getElementById('ep-btn-br-n').value=this.value;__edUp('borderRadius',this.value+'px')">
                <input type="number" id="ep-btn-br-n" min="0" max="40" style="width:50px" oninput="document.getElementById('ep-btn-br-r').value=this.value;__edUp('borderRadius',this.value+'px')">
              </div>
            </div>
          </div>
          <button onclick="__edApplyToAllButtons()" style="width:100%;margin-top:10px;background:rgba(66,133,244,0.18);border:1px solid rgba(66,133,244,0.4);color:rgba(200,218,255,0.9);border-radius:3px;padding:6px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">✦ Apply style to all buttons</button>
          <button onclick="__edResetButtonRow()" style="width:100%;margin-top:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">≡ Reset all buttons to top row</button>
        </div>
        <div id="ep-logo-ctrl" style="display:none">
          <div class="ep-sec-title">Logo Type</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="ep-logo-text-btn" onclick="__edLogoType('text')" style="flex:1;background:rgba(66,133,244,0.25);border:1px solid #4285f4;color:#e8e8e8;border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">Text</button>
            <button id="ep-logo-img-btn"  onclick="__edLogoType('image')" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">Image</button>
          </div>
          <div id="ep-logo-text-ctrl">
            <input type="text" id="ep-logo-text" placeholder="Your name or brand…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edLogoText(this.value)">
          </div>
          <div id="ep-logo-img-ctrl" style="display:none">
            <button class="ep-upload-btn" onclick="document.getElementById('ep-logo-file').click()">↑ Upload Logo Image</button>
            <input type="file" id="ep-logo-file" accept="image/*" style="display:none" onchange="__edLogoUpload(this.files[0])">
            <input type="text" id="ep-logo-src" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edLogoImgUrl(this.value)">
            <div class="ep-row" style="margin-top:6px">
              <label>Width</label>
              <div class="ep-pair">
                <input type="range" id="ep-logo-w-r" min="40" max="300" step="1" oninput="document.getElementById('ep-logo-w-n').value=this.value;__edUp('width',this.value+'px')">
                <input type="number" id="ep-logo-w-n" min="40" max="300" style="width:55px" oninput="document.getElementById('ep-logo-w-r').value=this.value;__edUp('width',this.value+'px')">
              </div>
            </div>
          </div>
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
            <button onclick="__edClearSize()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);border-radius:3px;padding:3px 6px;cursor:pointer;font-size:9px;white-space:nowrap" title="Reset to auto size">✕ auto</button>
          </div>
        </div>
        <div id="ep-box-ctrl" style="display:none">
          <div class="ep-sec-title">Fill Color</div>
          <div class="ep-row">
            <label>Color</label>
            <input type="color" id="ep-box-col" value="#ffffff" style="flex:1;height:30px;cursor:pointer" oninput="__edBoxBg(this.value)">
            <button onclick="__edBoxNone()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:3px;padding:3px 6px;cursor:pointer;font-size:9px;white-space:nowrap">None</button>
          </div>
          <div class="ep-row">
            <label>Opacity</label>
            <div class="ep-pair">
              <input type="range" id="ep-box-op-r" min="0" max="1" step="0.01" oninput="document.getElementById('ep-box-op-n').value=this.value;__edBoxOp(this.value)">
              <input type="number" id="ep-box-op-n" min="0" max="1" step="0.01" style="width:50px" oninput="document.getElementById('ep-box-op-r').value=this.value;__edBoxOp(this.value)">
            </div>
          </div>
          <div class="ep-sec-title" style="margin-top:6px">Image / Video</div>
          <button class="ep-upload-btn" onclick="document.getElementById('ep-box-file').click()">↑ Upload Image</button>
          <input type="file" id="ep-box-file" accept="image/*" style="display:none" onchange="__edBoxUpload(this.files[0])">
          <input type="text" id="ep-box-img-url" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edBoxImgUrl(this.value)">
          <input type="text" id="ep-box-vid-url" placeholder="YouTube URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" oninput="__edBoxVidUrl(this.value)">
          <button class="ep-reset" style="margin-top:6px" onclick="__edBoxClear()">✕ Clear media</button>
          <div class="ep-sec-title" style="margin-top:10px">Size (px) — or drag corner</div>
          <div class="ep-pos-row">
            <label>W</label><input type="number" id="ep-bw" step="1" min="40" style="width:60px" oninput="__edBoxSize()">
            <label>H</label><input type="number" id="ep-bh" step="1" min="40" style="width:60px" oninput="__edBoxSize()">
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button onclick="__edToFront()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">↑ Front</button>
          <button onclick="__edToBack()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">↓ Back</button>
        </div>
        <button class="ep-del" style="margin-top:6px" onclick="__edDeleteAdded()">🗑 Delete element</button>
      </div>

      <!-- RESET / HIDE -->
      <div class="ep-sec" id="ep-reset-sec">
        <button class="ep-reset" onclick="__edReset()">↺ Reset styles</button>
        <button class="ep-del" id="ep-hide-btn" style="margin-top:6px" onclick="__edHide()">🗑 Hide element</button>
      </div>`;
    document.body.appendChild(p);

    // ── Buttons modal ──
    const modal = document.createElement('div');
    modal.id = 'ed-btn-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.72);align-items:center;justify-content:center;';
    const LINK_OPTS = `<option value="nav-home">Home</option><option value="nav-work">Work / Projects</option><option value="popup-contact">Contact popup</option><option value="popup-about">About popup</option><option value="url">URL / Social</option><option value="email">Email</option><option value="phone">Phone</option>`;
    modal.innerHTML = `
      <div style="background:#111118;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:24px;width:340px;max-height:85vh;overflow-y:auto;font-family:Josefin Sans,sans-serif;color:#e8e8e8;">
        <div style="font-size:9px;letter-spacing:0.26em;text-transform:uppercase;color:#4285f4;margin-bottom:10px">Create Buttons</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:12px;line-height:1.7">Add a row per button. They'll appear evenly spaced — movable afterwards.</div>
        <div id="ed-btn-rows"></div>
        <button onclick="__edAddBtnRow()" style="width:100%;margin-top:8px;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.2);color:rgba(255,255,255,0.5);border-radius:4px;padding:7px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.1em">+ Add button</button>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button onclick="__edCreateButtons()" style="flex:1;background:#4285f4;border:none;color:#fff;border-radius:4px;padding:9px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.12em;text-transform:uppercase">Create</button>
          <button onclick="document.getElementById('ed-btn-modal').style.display='none'" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:4px;padding:9px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.12em">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

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

    makePanelDraggable(p);
  }

  function makePanelDraggable(panel) {
    const head = panel.querySelector('#ep-head');
    head.addEventListener('mousedown', e => {
      if (e.target.closest('.ep-x')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      function mv(ev) {
        panelUserMoved = true;
        const pw = panel.offsetWidth;
        const ph = panel.offsetHeight;
        let nx = Math.max(0, Math.min(window.innerWidth - pw, ev.clientX - ox));
        let ny = Math.max(0, Math.min(window.innerHeight - ph, ev.clientY - oy));
        panel.style.left = nx + 'px';
        panel.style.top  = ny + 'px';
      }
      function up() {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
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
      e.stopPropagation();
      selectEl(el);
      const key = el.dataset.edit;
      const ov = overrides[key] || {};
      const m = (ov.transform || '').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      let tx = m ? parseFloat(m[1]) : 0;
      let ty = m ? parseFloat(m[2]) : 0;
      let sx = e.clientX, sy = e.clientY;
      let dragging = false;
      function mv(ev) {
        if (!dragging) {
          if (Math.abs(ev.clientX-sx)<4 && Math.abs(ev.clientY-sy)<4) return;
          dragging = true; document.body.style.userSelect='none';
        }
        tx += ev.clientX - sx; ty += ev.clientY - sy;
        sx = ev.clientX; sy = ev.clientY;
        el.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`;
        if (!overrides[key]) overrides[key] = {};
        overrides[key].transform = el.style.transform;
        setV('ep-px', tx.toFixed(1)); setV('ep-py', ty.toFixed(1));
        placePanel(el);
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect=''; }
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
    panelUserMoved = false;
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
    const showContent  = !isAdded && ['text','nav-item',undefined,''].includes(editType) && !['container','style'].includes(editType);
    const showBgCol    = !isAdded && editType === 'container';
    const showNavBtn   = !isAdded && editType === 'nav-item';
    const showStyle    = isAdded ? ['text','button','logo'].includes(addType) : !['container'].includes(editType);
    const showFont     = showStyle;
    const showShadow   = isAdded ? addType === 'text' : showStyle;
    const showPos      = !isAdded && !['nav-item','container','style'].includes(editType);
    const showAdded    = isAdded;
    const showReset    = !isAdded;

    show('ep-content-sec', showContent);
    show('ep-bgcol-sec',   showBgCol);
    show('ep-navbtn-sec',  showNavBtn);
    show('ep-style-sec',   showStyle);
    show('ep-font-sec',    showFont);
    show('ep-shadow-sec',  showShadow);
    show('ep-pos-sec',     showPos);
    show('ep-added-sec',   showAdded);
    show('ep-reset-sec',   showReset);

    // Background color (container)
    if (showBgCol) {
      const bg = ov.backgroundColor || cs.backgroundColor;
      document.getElementById('ep-bgcol').value = rgbToHex(bg) || '#ffffff';
      const op = parseFloat(ov.opacity ?? cs.opacity ?? 1);
      setV('ep-bg-op-r', op); setV('ep-bg-op-n', op);
      const pad = parseInt(ov.padding || cs.padding) || 0;
      setV('ep-pad-r', pad); setV('ep-pad-n', pad);
      // Hide padding row for the nav background (it positions absolutely)
      const padRow = document.getElementById('ep-pad-row');
      if (padRow) padRow.style.display = el.dataset.edit === 'nav-bar' ? 'none' : '';
    }

    // Nav button style
    if (showNavBtn) {
      const bg = ov.backgroundColor || cs.backgroundColor;
      const hex = rgbToHex(bg);
      if (hex) document.getElementById('ep-btn-col').value = hex;
      const pad = parseInt(ov.padding) || 0;
      setV('ep-btn-pad-r', pad); setV('ep-btn-pad-n', pad);
      const rad = parseInt(ov.borderRadius) || 0;
      setV('ep-btn-rad-r', rad); setV('ep-btn-rad-n', rad);
    }

    // Style controls
    if (showStyle) {
      const fs = parseInt(ov.fontSize || cs.fontSize) || 16;
      setV('ep-sz-r', fs); setV('ep-sz-n', fs);
      document.getElementById('ep-color').value = rgbToHex(ov.color || cs.color) || '#ffffff';
      const fw = ov.fontWeight || Math.round(parseFloat(cs.fontWeight)) || 300;
      document.getElementById('ep-wt').value = fw;
      const lsPx  = parseFloat(ov.letterSpacing || cs.letterSpacing) || 0;
      const lsEm  = ov.letterSpacing ? parseFloat(ov.letterSpacing) : +(lsPx / fs).toFixed(3);
      setV('ep-ls-r', Math.max(0, lsEm)); setV('ep-ls-n', Math.max(0, lsEm));
      const op = parseFloat(ov.opacity ?? cs.opacity ?? 1);
      setV('ep-op-r', op); setV('ep-op-n', op);
      // Bold / Italic toggle state
      const boldBtn   = document.getElementById('ep-bold-btn');
      const italicBtn = document.getElementById('ep-italic-btn');
      if (boldBtn)   boldBtn.classList.toggle('active',   parseInt(fw) >= 700);
      if (italicBtn) italicBtn.classList.toggle('active', (ov.fontStyle || cs.fontStyle) === 'italic');
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
      show('ep-text-ctrl',   addType === 'text');
      show('ep-img-ctrl',    addType === 'image');
      show('ep-vid-ctrl',    addType === 'video');
      show('ep-size-ctrl',   addType === 'image' || addType === 'video' || addType === 'text' || addType === 'button');
      show('ep-box-ctrl',    addType === 'box');
      show('ep-button-ctrl', addType === 'button');
      show('ep-logo-ctrl',   addType === 'logo');

      if (addType === 'text') {
        setV('ep-text-val', el.innerHTML.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'') || '');
        const item = getAddedItem(el.id);
        const align = item?.styles?.textAlign || 'left';
        document.querySelectorAll('.ep-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === align));
        setV('ep-sw', parseInt(el.style.width) || el.offsetWidth || 200);
        setV('ep-sh', parseInt(el.style.height) || el.offsetHeight || 40);
      }
      if (addType === 'image') { const item = getAddedItem(el.id); setV('ep-img-url', item?.src || ''); setV('ep-sw', parseInt(el.style.width)||220); setV('ep-sh', parseInt(el.style.height)||160); }
      if (addType === 'video') { const item = getAddedItem(el.id); setV('ep-vid-url', item?.src || ''); setV('ep-sw', parseInt(el.style.width)||400); setV('ep-sh', parseInt(el.style.height)||225); }
      if (addType === 'box') {
        const item = getAddedItem(el.id);
        const bg = item?.styles?.backgroundColor || 'rgba(30,30,30,0.55)';
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m) {
          const hex = '#' + [m[1],m[2],m[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
          document.getElementById('ep-box-col').value = hex;
          const op = m[4] !== undefined ? parseFloat(m[4]) : 1;
          setV('ep-box-op-r', op); setV('ep-box-op-n', op);
        }
        setV('ep-box-img-url', item?.srcType === 'image' ? (item?.src || '') : '');
        setV('ep-box-vid-url', item?.srcType === 'video' ? (item?.src || '') : '');
        setV('ep-bw', parseInt(el.style.width)||220); setV('ep-bh', parseInt(el.style.height)||160);
      }
      if (addType === 'button') {
        // Auto-open the font picker for buttons
        const fontBody = document.getElementById('ep-font-body');
        const fontArrow = document.getElementById('ep-font-arrow');
        if (fontBody && fontBody.style.display === 'none') {
          fontBody.style.display = '';
          if (fontArrow) fontArrow.textContent = '▴ close';
        }
        const item = getAddedItem(el.id);
        if (item) {
          setV('ep-btn-label', item.label || '');
          const sel = document.getElementById('ep-btn-link-type');
          if (sel) sel.value = item.linkType || 'url';
          setV('ep-btn-link-val', item.linkValue || '');
          const needsVal = ['url','email','phone'].includes(item.linkType || 'url');
          const valRow = document.getElementById('ep-btn-val-row');
          if (valRow) valRow.style.display = needsVal ? '' : 'none';
          const bhex = rgbToHex(item.styles?.backgroundColor);
          if (bhex) document.getElementById('ep-btn-bcol').value = bhex;
          setV('ep-btn-br-r', parseInt(item.styles?.borderRadius)||0);
          setV('ep-btn-br-n', parseInt(item.styles?.borderRadius)||0);
          const pads = (item.styles?.padding||'6px 16px').split(' ');
          setV('ep-btn-pv', parseInt(pads[0])||6);
          setV('ep-btn-ph', parseInt(pads[1]||pads[0])||16);
          setV('ep-sw', parseInt(el.style.width) || el.offsetWidth || 80);
          setV('ep-sh', parseInt(el.style.height) || el.offsetHeight || 30);
        }
      }
      if (addType === 'logo') {
        const item = getAddedItem(el.id);
        if (item) {
          const isImg = item.srcType === 'image';
          show('ep-logo-text-ctrl', !isImg); show('ep-logo-img-ctrl', isImg);
          document.getElementById('ep-logo-text-btn').style.background = isImg ? 'rgba(255,255,255,0.06)' : 'rgba(66,133,244,0.25)';
          document.getElementById('ep-logo-img-btn').style.background  = isImg ? 'rgba(66,133,244,0.25)' : 'rgba(255,255,255,0.06)';
          if (!isImg) setV('ep-logo-text', item.content || '');
          else { setV('ep-logo-src', item.src || ''); setV('ep-logo-w-r', parseInt(item.styles?.width)||120); setV('ep-logo-w-n', parseInt(item.styles?.width)||120); }
        }
      }
    }
  }

  function placePanel(el) {
    if (panelUserMoved) return;
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
    top = Math.min(top, window.scrollY + window.innerHeight - 530);
    top = Math.max(top, window.scrollY + 54);
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
  }

  // ── UPDATE HANDLERS ───────────────────────────────────────────────────────
  window.__edUp = function(prop, val) {
    if (!selected) return;
    // Text elements with no explicit width need one before alignment is applied
    if (prop === 'textAlign' && selected.dataset.addedType === 'text' && !selected.style.width) {
      selected.style.width = '280px';
      const _item = getAddedItem(selected.id);
      if (_item) { if (!_item.styles) _item.styles={}; _item.styles.width = '280px'; }
    }
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
    const val = SHADOWS[preset] || 'none';
    const addType = selected?.dataset.addedType;
    const prop = ['box','image','video'].includes(addType) ? 'boxShadow' : 'textShadow';
    window.__edUp(prop, val);
  };

  window.__edToggleBold = function() {
    if (!selected) return;
    const isAdded = selected.classList.contains('edit-added');
    const ov = isAdded ? (getAddedItem(selected.id)?.styles || {}) : (overrides[selected.dataset.edit] || {});
    const cur = parseInt(ov.fontWeight || window.getComputedStyle(selected).fontWeight) || 300;
    const next = cur >= 700 ? '300' : '700';
    window.__edUp('fontWeight', next);
    const btn = document.getElementById('ep-bold-btn');
    if (btn) btn.classList.toggle('active', next === '700');
    const wt = document.getElementById('ep-wt');
    if (wt) wt.value = next;
  };

  window.__edToggleItalic = function() {
    if (!selected) return;
    const isAdded = selected.classList.contains('edit-added');
    const ov = isAdded ? (getAddedItem(selected.id)?.styles || {}) : (overrides[selected.dataset.edit] || {});
    const isItalic = (ov.fontStyle || window.getComputedStyle(selected).fontStyle) === 'italic';
    window.__edUp('fontStyle', isItalic ? 'normal' : 'italic');
    const btn = document.getElementById('ep-italic-btn');
    if (btn) btn.classList.toggle('active', !isItalic);
  };

  window.__edPos = function() {
    const x = parseFloat(document.getElementById('ep-px').value)||0;
    const y = parseFloat(document.getElementById('ep-py').value)||0;
    window.__edUp('transform', `translate(${x}px,${y}px)`);
  };

  window.__edTextContent = function(val) {
    if (!selected || selected.dataset.addedType !== 'text') return;
    selected.innerHTML = val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
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

  window.__edClearSize = function() {
    if (!selected) return;
    selected.style.width = ''; selected.style.height = '';
    const item = getAddedItem(selected.id);
    if (item && item.styles) { delete item.styles.width; delete item.styles.height; }
    setV('ep-sw', ''); setV('ep-sh', '');
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

  // ── BUTTON HANDLERS ───────────────────────────────────────────────────────
  window.__edBtnLabel = function(val) {
    if (!selected || selected.dataset.addedType !== 'button') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.label = val; selected.textContent = val;
    selected.dataset.editLabel = val;
    document.getElementById('ep-title').textContent = val || 'Button';
  };

  window.__edBtnLinkType = function(val) {
    if (!selected || selected.dataset.addedType !== 'button') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.linkType = val;
    const needsVal = ['url','email','phone'].includes(val);
    const valRow = document.getElementById('ep-btn-val-row');
    if (valRow) valRow.style.display = needsVal ? '' : 'none';
  };

  window.__edBtnLinkVal = function(val) {
    if (!selected || selected.dataset.addedType !== 'button') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.linkValue = val;
  };

  window.__edBtnPad = function() {
    const v = parseFloat(document.getElementById('ep-btn-pv')?.value||6);
    const h = parseFloat(document.getElementById('ep-btn-ph')?.value||16);
    window.__edUp('padding', `${v}px ${h}px`);
  };

  // ── LOGO HANDLERS ─────────────────────────────────────────────────────────
  window.__edLogoType = function(type) {
    if (!selected || selected.dataset.addedType !== 'logo') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.srcType = type;
    if (type === 'text') { item.src = ''; selected.innerHTML = item.content || 'Logo'; }
    show('ep-logo-text-ctrl', type === 'text'); show('ep-logo-img-ctrl', type === 'image');
    document.getElementById('ep-logo-text-btn').style.background = type === 'text' ? 'rgba(66,133,244,0.25)' : 'rgba(255,255,255,0.06)';
    document.getElementById('ep-logo-img-btn').style.background  = type === 'image' ? 'rgba(66,133,244,0.25)' : 'rgba(255,255,255,0.06)';
    if (type === 'image') { const old = selected.querySelector('img'); if (!old) { const img = document.createElement('img'); img.style.cssText='display:block;max-width:120px;height:auto;'; selected.innerHTML=''; selected.appendChild(img); } }
  };

  window.__edLogoText = function(val) {
    if (!selected || selected.dataset.addedType !== 'logo') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.content = val; selected.textContent = val;
  };

  window.__edLogoImgUrl = function(url) {
    if (!selected || selected.dataset.addedType !== 'logo') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.src = url;
    let img = selected.querySelector('img');
    if (!img) { selected.innerHTML=''; img=document.createElement('img'); img.style.cssText='display:block;height:auto;pointer-events:none;'; selected.appendChild(img); }
    img.src = url;
    const w = item.styles?.width || '120px'; img.style.maxWidth = w;
  };

  window.__edLogoUpload = async function(file) {
    if (!file?.type.startsWith('image/')) return;
    const ext=file.name.split('.').pop().toLowerCase()||'png', name=`logo-${Date.now()}.${ext}`;
    const btn = document.querySelector('#ep-logo-ctrl .ep-upload-btn');
    try {
      if (btn) { btn.textContent='Uploading…'; btn.disabled=true; }
      const buf = await file.arrayBuffer();
      const res = await sbStorageUpload(`media/${encodeURIComponent(name)}`, buf, file.type);
      if (!res.ok) throw new Error(await res.text());
      const url = `${SB_URL}/storage/v1/object/public/media/${encodeURIComponent(name)}`;
      setV('ep-logo-src', url); window.__edLogoImgUrl(url);
      if (btn) { btn.textContent='✓ Uploaded'; setTimeout(()=>{ btn.textContent='↑ Upload Logo Image'; btn.disabled=false; }, 2000); }
    } catch(e) { alert('Upload failed: '+e.message); if(btn){btn.textContent='↑ Upload Logo Image';btn.disabled=false;} }
  };

  window.__edBoxSize = function() {
    if (!selected || selected.dataset.addedType !== 'box') return;
    const w = document.getElementById('ep-bw').value+'px', h = document.getElementById('ep-bh').value+'px';
    selected.style.width=w; selected.style.height=h;
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles={}; item.styles.width=w; item.styles.height=h; }
  };

  function hexToRgba(hex, a) {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function applyBoxBg() {
    if (!selected || selected.dataset.addedType !== 'box') return;
    const hex = document.getElementById('ep-box-col').value;
    const op  = parseFloat(document.getElementById('ep-box-op-n').value || document.getElementById('ep-box-op-r').value || 1);
    const col = hexToRgba(hex, isNaN(op) ? 1 : op);
    selected.style.backgroundColor = col;
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles={}; item.styles.backgroundColor=col; }
  }

  window.__edBoxBg  = function() { applyBoxBg(); };
  window.__edBoxOp  = function(v) { setV('ep-box-op-r', v); setV('ep-box-op-n', v); applyBoxBg(); };

  window.__edBoxImgUrl = function(url) {
    if (!selected || selected.dataset.addedType !== 'box') return;
    const item = getAddedItem(selected.id); if (!item) return;
    setV('ep-box-vid-url', '');
    item.src = url; item.srcType = url ? 'image' : '';
    boxRebuildContent(selected, item, true);
  };

  window.__edBoxVidUrl = function(url) {
    if (!selected || selected.dataset.addedType !== 'box') return;
    const item = getAddedItem(selected.id); if (!item) return;
    setV('ep-box-img-url', '');
    item.src = url; item.srcType = url ? 'video' : '';
    boxRebuildContent(selected, item, true);
  };

  window.__edBoxUpload = async function(file) {
    if (!file?.type.startsWith('image/')) return;
    const ext=file.name.split('.').pop().toLowerCase()||'jpg', name=`ed-box-${Date.now()}.${ext}`;
    const btns = document.querySelectorAll('#ep-box-ctrl .ep-upload-btn');
    const btn = btns[0];
    try {
      if (btn) { btn.textContent='Uploading…'; btn.disabled=true; }
      const buf = await file.arrayBuffer();
      const res = await sbStorageUpload(`media/${encodeURIComponent(name)}`, buf, file.type);
      if (!res.ok) throw new Error(await res.text());
      const url = `${SB_URL}/storage/v1/object/public/media/${encodeURIComponent(name)}`;
      setV('ep-box-img-url', url); window.__edBoxImgUrl(url);
      if (btn) { btn.textContent='✓ Uploaded'; setTimeout(()=>{ btn.textContent='↑ Upload Image'; btn.disabled=false; }, 2000); }
    } catch(e) {
      alert('Upload failed: '+e.message);
      if (btn) { btn.textContent='↑ Upload Image'; btn.disabled=false; }
    }
  };

  window.__edBoxClear = function() {
    if (!selected || selected.dataset.addedType !== 'box') return;
    const item = getAddedItem(selected.id); if (!item) return;
    item.src=''; item.srcType='';
    setV('ep-box-img-url',''); setV('ep-box-vid-url','');
    boxRebuildContent(selected, item, true);
  };

  window.__edBoxNone = function() {
    if (!selected) return;
    selected.style.backgroundColor = 'transparent';
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles={}; item.styles.backgroundColor='transparent'; }
  };

  const BTN_LINK_OPTS = [
    {v:'nav-home',label:'Home (scroll top)'},{v:'nav-work',label:'Work / Projects'},
    {v:'popup-contact',label:'Contact popup'},{v:'popup-about',label:'About popup'},
    {v:'url',label:'URL / Social'},{v:'email',label:'Email'},{v:'phone',label:'Phone'},
  ];

  window.__edAddBtnRow = function() {
    const cont = document.getElementById('ed-btn-rows'); if (!cont) return;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = 'Label…';
    inp.style.cssText = 'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#e8e8e8;border-radius:4px;padding:5px 7px;font-family:inherit;font-size:11px;';
    const sel = document.createElement('select');
    sel.style.cssText = 'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#e8e8e8;border-radius:4px;padding:4px 5px;font-family:inherit;font-size:10px;';
    BTN_LINK_OPTS.forEach(o => { const op = document.createElement('option'); op.value=o.v; op.textContent=o.label; sel.appendChild(op); });
    const del = document.createElement('button');
    del.textContent = '✕'; del.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:13px;padding:2px 4px;';
    del.onclick = () => row.remove();
    row.appendChild(inp); row.appendChild(sel); row.appendChild(del);
    cont.appendChild(row);
    inp.focus();
  };

  window.__edShowButtonsModal = function() {
    hideAddMenu();
    const modal = document.getElementById('ed-btn-modal');
    if (!modal) return;
    const cont = document.getElementById('ed-btn-rows');
    if (cont) cont.innerHTML = '';
    // Seed with default rows
    const defaults = [
      {label:'Home',       link:'nav-home'},
      {label:'Work',       link:'nav-work'},
      {label:'Contact',    link:'popup-contact'},
      {label:'Instagram',  link:'url'},
      {label:'LinkedIn',   link:'url'},
    ];
    defaults.forEach(({label, link}) => {
      window.__edAddBtnRow();
      const last = cont.lastElementChild;
      if (last) {
        last.querySelector('input').value = label;
        last.querySelector('select').value = link;
      }
    });
    modal.style.display = 'flex';
  };

  window.__edCreateButtons = function() {
    const rows = document.querySelectorAll('#ed-btn-rows > div');
    const entries = [];
    rows.forEach(row => {
      const label = (row.querySelector('input')?.value || '').trim();
      const linkType = row.querySelector('select')?.value || 'url';
      if (label) entries.push({ label, linkType });
    });
    if (!entries.length) return;
    if (!overrides._added) overrides._added = [];
    const total = entries.length;
    entries.forEach(({ label, linkType }, i) => {
      const id = 'ael-btn-' + Date.now() + '-' + i;
      const x = parseFloat(((i + 0.5) / total * 100).toFixed(1));
      const item = { id, type:'button', x, y:9, label, linkType, linkValue:'', platform:'', styles:{} };
      overrides._added.push(item);
      buildAddedEl(item, true);
    });
    document.getElementById('ed-btn-modal').style.display = 'none';
  };

  window.__edResetButtonRow = function() {
    if (!overrides._added) return;
    const buttons = overrides._added.filter(it => it.type === 'button');
    if (!buttons.length) return;
    const total = buttons.length;
    buttons.forEach((item, i) => {
      const x = parseFloat(((i + 0.5) / total * 100).toFixed(1));
      item.x = x; item.y = 9;
      const el = document.getElementById(item.id);
      if (el) { el.style.left = x + '%'; el.style.top = '9%'; }
    });
  };

  window.__edApplyToAllButtons = function() {
    if (!selected || selected.dataset.addedType !== 'button') return;
    if (!overrides._added) return;
    const srcItem = getAddedItem(selected.id);
    if (!srcItem) return;
    const styleKeys = ['fontFamily','fontSize','color','fontWeight','fontStyle','letterSpacing','opacity','backgroundColor','padding','borderRadius','border','textTransform','boxShadow'];
    overrides._added.forEach(item => {
      if (item.type !== 'button' || item.id === selected.id) return;
      if (!item.styles) item.styles = {};
      styleKeys.forEach(k => { if (srcItem.styles?.[k] !== undefined) item.styles[k] = srcItem.styles[k]; });
      const el = document.getElementById(item.id);
      if (el) styleKeys.forEach(k => { if (srcItem.styles?.[k] !== undefined) el.style[k] = srcItem.styles[k]; });
    });
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

  window.__edToggleFonts = function() {
    const body  = document.getElementById('ep-font-body');
    const arrow = document.getElementById('ep-font-arrow');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display  = open ? 'none' : 'block';
    arrow.textContent   = open ? '▾ open' : '▴ close';
  };

  window.__edToFront = function() {
    if (!selected || !selected.classList.contains('edit-added')) return;
    const item = getAddedItem(selected.id);
    const z = (parseInt(selected.style.zIndex) || 10) + 10;
    selected.style.zIndex = z;
    if (item) { if (!item.styles) item.styles={}; item.styles.zIndex=z; }
  };

  window.__edToBack = function() {
    if (!selected || !selected.classList.contains('edit-added')) return;
    const item = getAddedItem(selected.id);
    const z = Math.max(1, (parseInt(selected.style.zIndex) || 10) - 10);
    selected.style.zIndex = z;
    if (item) { if (!item.styles) item.styles={}; item.styles.zIndex=z; }
  };

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
