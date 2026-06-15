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
  let _snapshot = null;
  const _history = [];
  const _HISTORY_MAX = 30;
  let _histDebounceTimer = null;

  function _updateUndoBtn() {
    const btn = document.getElementById('ed-undo-btn');
    if (!btn) return;
    const n = _history.length;
    btn.textContent = n > 0 ? `↩ Undo (${n})` : '↩ Undo';
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? '0.35' : '1';
  }

  function _pushHistory() {
    _history.push(JSON.parse(JSON.stringify(overrides)));
    if (_history.length > _HISTORY_MAX) _history.shift();
    _updateUndoBtn();
  }

  // Call before any user-initiated change. Debounced so rapid slider drags = 1 entry.
  function _maybePushHistory() {
    if (_histDebounceTimer) return;
    _pushHistory();
    _histDebounceTimer = setTimeout(() => { _histDebounceTimer = null; }, 600);
  }

  window.__edBack = function() {
    if (!_history.length) return;
    const prev = _history.pop();
    (overrides._added || []).forEach(it => { const el = document.getElementById(it.id); if (el) el.remove(); });
    document.querySelectorAll('.edit-added,.site-added-el').forEach(el => el.remove());
    overrides = prev;
    applyStyleOverrides();
    renderAddedElements(true);
    deselect();
    _updateUndoBtn();
  };

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
    // Keep floating panel on-screen after resize
    window.addEventListener('resize', () => {
      const p = document.getElementById('edit-panel');
      if (p && p.style.display !== 'none') _clampPanel(p);
    });
    // Ctrl+Z / Cmd+Z undo
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
        e.preventDefault();
        window.__edBack();
      }
    });
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
      if (key.startsWith('_')) return; // skip all private keys
      document.querySelectorAll(`[data-edit="${key}"]`).forEach(el => applyStyles(el, styles));
    });
    // Nav height stored on 'nav-bar' override — apply to <nav> itself
    if (overrides['nav-bar']?.minHeight) {
      const navEl = document.querySelector('nav');
      if (navEl) navEl.style.minHeight = overrides['nav-bar'].minHeight + 'px';
    }
    // Sandwich mode: hide non-admin nav items but keep Admin link accessible
    document.querySelectorAll('.nav-links .nav-item:not(.nav-item-admin)').forEach(el => {
      el.style.display = overrides._navLinksHidden ? 'none' : '';
    });
    if (overrides._about?.html) {
      const el = document.querySelector('.about-content');
      if (el) el.innerHTML = overrides._about.html;
    }
    if (overrides._contact) {
      if (overrides._contact.email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
          a.href = 'mailto:' + overrides._contact.email;
          if (a.closest('#contact-popup')) a.textContent = overrides._contact.email;
        });
      }
      if (overrides._contact.phone) {
        const ph = document.querySelector('#contact-popup a[href^="tel:"]');
        if (ph) { ph.href = 'tel:' + overrides._contact.phone.replace(/\s/g,''); ph.textContent = overrides._contact.phone; }
      }
    }
    // Canvas extra height
    const spacer = document.getElementById('canvas-spacer');
    if (spacer) spacer.style.height = (overrides._canvasH || 0) + 'px';
    // Show/hide "shorter" option in Add menu
    const shorterBtn = document.getElementById('eb-shorter-btn');
    if (shorterBtn) shorterBtn.style.display = (overrides._canvasH || 0) > 0 ? '' : 'none';
  }

  function applyStyles(el, styles) {
    Object.entries(styles || {}).forEach(([p, v]) => {
      if (p === '_html') { el.innerHTML = v; return; }
      if (p === 'position') return; // preserve absolute positioning set by buildAddedEl
      el.style[p] = v;
    });
  }

  // ── ADDED ELEMENTS ────────────────────────────────────────────────────────

  // One-time migration: convert old %-based x/y to absolute pixels so layout
  // is stable regardless of browser window width.
  function _migrateItemPos(item) {
    if (item.xPx != null) return;
    const canvas = document.getElementById('page-canvas');
    const cw = canvas?.offsetWidth || window.innerWidth;
    const ch = canvas?.offsetHeight || window.innerHeight;
    if (item.x != null) item.xPx = Math.round(parseFloat(item.x) / 100 * cw);
    if (item.y != null) item.yPx = Math.round(parseFloat(item.y) / 100 * ch);
    if (item.dropX != null && item.dropXPx == null)
      item.dropXPx = Math.round(parseFloat(item.dropX) / 100 * cw);
    if (item.dropY != null && item.dropYPx == null)
      item.dropYPx = Math.round(parseFloat(item.dropY) / 100 * ch);
  }

  function renderAddedElements(editMode) {
    (overrides._added || []).forEach(item => {
      _migrateItemPos(item);
      // In edit mode, always replace any element built by app.js (which lacks edit handlers)
      if (editMode) {
        const existing = document.getElementById(item.id);
        if (existing) existing.remove();
      }
      if (!document.getElementById(item.id)) buildAddedEl(item, editMode);
    });
  }

  function _buildHamLines(el, item) {
    el.innerHTML = '';
    const w     = parseInt(item.styles?._hamW) || 28;
    const thick = parseInt(item.styles?._hamH) || 2;
    const gap   = Math.max(thick + 3, 7);
    el.style.width = w + 'px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = gap + 'px';
    el.style.color = item.styles?.color || '#ffffff';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.style.cssText = `background:currentColor;height:${thick}px;width:100%;border-radius:1px;pointer-events:none;`;
      el.appendChild(line);
    }
  }

  function buildAddedEl(item, editMode) {
    const zone = document.getElementById('page-canvas') || document.querySelector('.hero');
    if (!zone) return null;

    const el = document.createElement('div');
    el.id = item.id;
    el.classList.add('site-added-el');
    if (editMode) el.classList.add('edit-target', 'edit-added');
    el.dataset.addedId   = item.id;
    el.dataset.addedType = item.type;
    el.dataset.edit      = item.id;
    el.dataset.editLabel = item.type === 'text' ? 'Text Block' : item.type === 'box' ? 'Box' : item.type === 'button' ? (item.label||'Button') : item.type === 'logo' ? 'Logo' : item.type === 'hamburger' ? 'Sandwich Menu' : item.type === 'image' ? 'Image' : item.type === 'section-list' ? (item.title||'Section List') : 'Video';
    const _navEl = (item.type === 'logo' || item.type === 'hamburger');
    const _defZ  = _navEl ? 110 : 10;
    const _xPx = item.xPx ?? (item.x != null ? Math.round(parseFloat(item.x) / 100 * (zone.offsetWidth || window.innerWidth)) : 400);
    const _yPx = item.yPx ?? (item.y != null ? Math.round(parseFloat(item.y) / 100 * (zone.offsetHeight || window.innerHeight)) : 300);
    // Hamburger/logo stay fixed in the viewport (match the fixed <nav>)
    const _pos = _navEl ? 'fixed' : 'absolute';
    el.style.cssText = `position:${_pos};left:${_xPx}px;top:${_yPx}px;z-index:${item.styles?.zIndex||_defZ};`;

    if (item.type === 'text') {
      el.innerHTML = item.content || 'Double-click to edit';
      el.style.width = item.styles?.width || '280px';
      Object.assign(el.style, { fontFamily:"'Josefin Sans',sans-serif", fontSize:'20px', color:'#fff', fontWeight:'300', letterSpacing:'0.12em', cursor:editMode?'move':'default', userSelect:editMode?'none':'' });
      if (item.styles?.backgroundColor) el.style.backgroundColor = item.styles.backgroundColor;
      if (item.styles?.padding)         el.style.padding         = item.styles.padding;
      if (item.styles?.boxShadow)       el.style.boxShadow       = item.styles.boxShadow;
      if (editMode) {
        el.addEventListener('dblclick', e => {
          e.stopPropagation();
          el.contentEditable = 'true';
          el.style.cursor = 'text';
          el.style.userSelect = 'text';
          if (el.innerHTML === 'Double-click to edit') { el.innerHTML = ''; }
          el.focus();
        });
        el.addEventListener('blur', () => {
          if (!el.textContent.trim()) el.innerHTML = 'Double-click to edit';
          el.contentEditable = 'false';
          el.style.cursor = 'move';
          el.style.userSelect = 'none';
          syncAddedContent(item.id);
        });
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
      // NOTE: position:absolute already set via cssText — do NOT set relative here
      el.style.backgroundColor = item.styles?.backgroundColor || 'rgba(30,30,30,0.55)';
      boxRebuildContent(el, item, editMode);
      if (editMode) addResizeHandle(el, item);
    } else if (item.type === 'button') {
      el.textContent = item.label || 'Button';
      Object.assign(el.style, {
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        whiteSpace:'nowrap', userSelect:'none', textDecoration:'none', textAlign:'center',
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
      if (editMode) {
        addResizeHandle(el, item);
        el.addEventListener('dblclick', e => {
          e.stopPropagation();
          el.contentEditable = 'true';
          el.style.cursor = 'text';
          el.style.userSelect = 'text';
          const range = document.createRange();
          const textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
          if (textNode) { range.selectNodeContents(textNode); window.getSelection().removeAllRanges(); window.getSelection().addRange(range); }
          el.focus();
        });
        el.addEventListener('keydown', e => {
          if (el.contentEditable !== 'true') return;
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
          if (e.key === 'Escape') { el.textContent = item.label || 'Button'; el.contentEditable = 'false'; el.style.cursor = 'move'; el.style.userSelect = 'none'; addResizeHandle(el, item); }
        });
        el.addEventListener('blur', () => {
          if (el.contentEditable !== 'true') return;
          const textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
          const newLabel = (textNode?.textContent || el.innerText || '').trim() || 'Button';
          item.label = newLabel;
          el.dataset.editLabel = newLabel;
          el.textContent = newLabel;
          addResizeHandle(el, item);
          el.contentEditable = 'false';
          el.style.cursor = 'move';
          el.style.userSelect = 'none';
          const inp = document.getElementById('ep-btn-label');
          if (inp) inp.value = newLabel;
          if (selected === el) { const t = document.getElementById('ep-title'); if (t) t.textContent = newLabel || 'Button'; }
        });
      }
    } else if (item.type === 'logo') {
      if (item.srcType === 'image' && item.src) {
        const img = document.createElement('img');
        img.src = item.src;
        img.style.cssText = `display:block;width:100%;height:100%;object-fit:contain;pointer-events:${editMode?'none':'auto'};`;
        // Default container size if none saved
        if (!item.styles?.width)  el.style.width  = '120px';
        if (!item.styles?.height) el.style.height = '120px';
        el.style.overflow = 'hidden';
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
      if (editMode) addResizeHandle(el, item);
    } else if (item.type === 'hamburger') {
      _buildHamLines(el, item);
      el.style.cursor    = editMode ? 'move' : 'pointer';
      el.style.userSelect = 'none';
      if (!editMode) {
        let _menuOpen = false;
        let _menuDrop = null;
        el.addEventListener('click', e => {
          e.stopPropagation();
          _menuOpen = !_menuOpen;
          if (_menuDrop) { _menuDrop.remove(); _menuDrop = null; }
          if (!_menuOpen) return;
          const drop = document.createElement('div');
          _menuDrop = drop;
          const canvas = document.getElementById('page-canvas') || document.querySelector('.hero');
          const canvasRect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0};
          let dLeft, dTop;
          if (item.dropXPx != null && canvas) {
            dLeft = (item.dropXPx + canvasRect.left) + 'px';
            dTop  = (item.dropYPx + canvasRect.top  - window.scrollY) + 'px';
          } else if (item.dropX != null && item.dropY != null && canvas) {
            dLeft = (item.dropX / 100 * canvas.offsetWidth  + canvasRect.left) + 'px';
            dTop  = (item.dropY / 100 * canvas.offsetHeight + canvasRect.top  - window.scrollY) + 'px';
          } else {
            const rect = el.getBoundingClientRect();
            dLeft = rect.left + 'px'; dTop = (rect.bottom + 6) + 'px';
          }
          drop.style.cssText = `position:fixed;left:${dLeft};top:${dTop};z-index:9000;background:${item.styles?.dropBg||'rgba(10,10,10,0.92)'};border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 0;min-width:160px;backdrop-filter:blur(8px);`;
          (item.links || []).forEach(link => {
            const row = document.createElement('div');
            row.textContent = link.label;
            row.style.cssText = `padding:10px 18px;font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.85);cursor:pointer;transition:color 0.15s;`;
            row.addEventListener('mouseenter', () => row.style.color = '#fff');
            row.addEventListener('mouseleave', () => row.style.color = 'rgba(255,255,255,0.85)');
            row.addEventListener('click', e2 => {
              e2.stopPropagation();
              drop.remove(); _menuDrop = null; _menuOpen = false;
              const v = link.linkValue || '';
              switch (link.linkType) {
                case 'nav-home':      if(window.scrollToHero) scrollToHero({preventDefault:()=>{}}); break;
                case 'nav-work':      if(window.scrollToProjects) scrollToProjects(); break;
                case 'popup-contact': if(window.openPopup) openPopup('contact-popup'); break;
                case 'popup-about':   if(window.openPopup) openPopup('about-popup'); break;
                case 'email':         window.location.href='mailto:'+v; break;
                case 'phone':         window.location.href='tel:'+v; break;
                default:              if(v) window.open(v,'_blank','noopener'); break;
              }
            });
            drop.appendChild(row);
          });
          document.body.appendChild(drop);
          const close = () => { drop.remove(); _menuDrop=null; _menuOpen=false; document.removeEventListener('click', close); };
          setTimeout(() => document.addEventListener('click', close, {once:true}), 0);
        });
      }
    }

    if (item.type === 'section-list') {
      el.style.minWidth = item.styles?.width || '180px';
      el.style.cursor = editMode ? 'move' : 'default';
      el.style.userSelect = 'none';
      _buildSectionList(el, item, editMode);
      if (editMode) addResizeHandle(el, item);
    }

    applyStyles(el, item.styles);
    el.style.position = 'absolute'; // applyStyles must not override this
    zone.appendChild(el);
    if (editMode) { makeDraggable(el, item); el.addEventListener('click', e => { if (el.contentEditable === 'true') return; e.stopPropagation(); selectEl(el); }); }
    return el;
  }

  function _buildSectionList(el, item, editMode) {
    // Clear and re-render the section-list element content
    el.querySelectorAll('.sl-head,.sl-body').forEach(n => n.remove());
    const color = item.styles?.color || '#111111';

    const head = document.createElement('div');
    head.className = 'sl-head';
    head.textContent = item.title || 'SECTION TITLE';
    head.style.cssText = `font-family:'Josefin Sans',sans-serif;font-size:7px;letter-spacing:0.35em;text-transform:uppercase;color:${color};opacity:0.45;padding-bottom:9px;border-bottom:1px solid ${color};margin-bottom:10px;font-weight:300;user-select:none;`;
    el.insertBefore(head, el.querySelector('.ed-resize-handle'));

    const body = document.createElement('div');
    body.className = 'sl-body';
    (item.items || []).forEach((text, idx) => {
      const row = document.createElement('div');
      row.className = 'sl-row';
      row.dataset.slIdx = idx;
      row.textContent = text;
      row.style.cssText = `font-family:'Josefin Sans',sans-serif;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${color};padding:7px 0;cursor:${editMode?'text':'pointer'};opacity:0.75;font-weight:300;user-select:none;`;
      if (editMode) {
        row.addEventListener('dblclick', e => {
          e.stopPropagation();
          row.contentEditable = 'true';
          row.style.opacity = '1';
          row.style.outline = '1px dashed rgba(120,180,255,0.5)';
          row.focus();
          row.onblur = () => {
            row.contentEditable = 'false';
            row.style.opacity = '0.75';
            row.style.outline = '';
            item.items[idx] = row.textContent.trim() || text;
            const inp = document.getElementById(`ep-sli-${el.id}-${idx}`);
            if (inp) inp.value = item.items[idx];
          };
          row.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); row.blur(); } };
        });
      }
      body.appendChild(row);
    });
    el.insertBefore(body, el.querySelector('.ed-resize-handle'));

    if (editMode) {
      head.addEventListener('dblclick', e => {
        e.stopPropagation();
        head.contentEditable = 'true';
        head.style.opacity = '1';
        head.focus();
        head.onblur = () => {
          head.contentEditable = 'false';
          head.style.opacity = '0.45';
          item.title = head.textContent.trim() || 'SECTION TITLE';
          el.dataset.editLabel = item.title;
          const inp = document.getElementById(`ep-slist-title-${el.id}`);
          if (inp) inp.value = item.title;
          const titleEl = document.getElementById('ep-title');
          if (titleEl && selected === el) titleEl.textContent = item.title;
        };
        head.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); head.blur(); } };
      });
    }
  }

  function makeDraggable(el, item) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('mousedown', e => {
      if (el.contentEditable === 'true') return;
      if (e.target.closest('#edit-panel,#edit-bar,#bg-panel,.ed-resize-handle')) return;
      e.stopPropagation();
      _pushHistory(); // capture position before drag
      // position:fixed elements have no offsetParent so offsetTop/Left return 0 — use CSS values instead
      const _isFixed = getComputedStyle(el).position === 'fixed';
      let sx = e.clientX, sy = e.clientY;
      let sl = _isFixed ? (parseFloat(el.style.left) || 0) : el.offsetLeft;
      let st = _isFixed ? (parseFloat(el.style.top)  || 0) : el.offsetTop;
      let dragging = false;
      function mv(ev) {
        if (!dragging) {
          if (Math.abs(ev.clientX-sx)<4 && Math.abs(ev.clientY-sy)<4) return;
          dragging = true; document.body.style.userSelect='none';
        }
        el.style.left = Math.max(0, sl + ev.clientX - sx) + 'px';
        el.style.top  = Math.max(0, st + ev.clientY - sy) + 'px';
        item.xPx = parseFloat(el.style.left); item.yPx = parseFloat(el.style.top);
        if (selected === el) placePanel();
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
      _pushHistory(); // capture size before resize
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
      const embed = extractVideoEmbed(item.src);
      if (embed) {
        const fr = document.createElement('iframe');
        const autoplayParam = (!editMode && item.styles?._videoAutoplay && embed.type === 'youtube') ? '&mute=1&enablejsapi=1' : '';
        fr.src = embed.embedUrl + autoplayParam;
        fr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block;' + (editMode ? 'pointer-events:none;' : '');
        fr.allow = 'accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture';
        fr.allowFullscreen = true;
        el.insertBefore(fr, el.querySelector('.ed-resize-handle'));
        // Scroll-triggered autoplay (YouTube only)
        if (!editMode && item.styles?._videoAutoplay && embed.type === 'youtube') {
          const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
              const cmd = e.isIntersecting ? 'playVideo' : 'pauseVideo';
              fr.contentWindow?.postMessage(JSON.stringify({event:'command',func:cmd}), '*');
            });
          }, {threshold: 0.25});
          setTimeout(() => obs.observe(el), 300);
        }
      }
    }
    // Hover scale effect (view mode only)
    if (!editMode && item.styles?._hoverScale && item.type === 'box') {
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)';
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.04)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
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
        <button id="ed-undo-btn" class="eb-btn" onclick="__edBack()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);opacity:0.35;" title="Undo last change (Ctrl+Z)">↩ Undo</button>
        <button class="eb-btn eb-bg-btn" onclick="__edShowElementsPanel(event)">☰ Elements</button>
        <button class="eb-btn eb-bg-btn" onclick="__edShowMenuManager()">⬜ Menu Buttons</button>
        <button class="eb-btn eb-bg-btn" onclick="__edShowProjects()">📂 Projects</button>
        <button class="eb-btn eb-bg-btn" onclick="__edToggleBgPanel(event)">🖼 Background</button>
        <div class="eb-add-wrap">
          <button class="eb-btn eb-add" id="eb-add-btn" onclick="__edToggleAdd(event)">+ Add ▾</button>
          <div class="eb-add-menu" id="eb-add-menu" style="display:none">
            <div class="eb-add-group">Elements</div>
            <button onclick="__edAddEl('text')">✏ Text Block</button>
            <button onclick="__edAddEl('box')">▣ Box (color · image · video)</button>
            <button onclick="__edAddEl('button')">⬜ Button</button>
            <button onclick="__edAddEl('section-list')">📋 Section / Title List</button>
            <div class="eb-add-group">Presets</div>
            <button onclick="__edShowMenuManager()">☰ Create / Manage Menu</button>
            <button onclick="__edAddPreset('logo')">🅰 Logo (top left)</button>
            <button onclick="__edAddPreset('signature')">✍ Signature (bottom)</button>
            <button onclick="__edAddPreset('top-bar')">▬ Top Bar / Header</button>
            <button onclick="__edAddPreset('bottom-bar')">▬ Bottom Bar / Footer</button>
            <div class="eb-add-group">Page</div>
            <button onclick="__edPageTaller()">↕ Make page taller</button>
            <button onclick="__edPageShorter()" id="eb-shorter-btn" style="display:none">↕ Make page shorter</button>
          </div>
        </div>
        <button class="eb-btn eb-save" id="eb-save-btn" onclick="__edSave()">Save</button>
        <button class="eb-btn eb-exit" onclick="__edExit()">Exit</button>
      </div>`;
    document.body.appendChild(bar);
    document.addEventListener('click', e => { if (!e.target.closest('.eb-add-wrap')) hideAddMenu(); });
  }

  // ── ELEMENTS PANEL ───────────────────────────────────────────────────────
  function buildElementsPanel() {
    if (document.getElementById('ed-elements-panel')) return;
    const p = document.createElement('div');
    p.id = 'ed-elements-panel';
    p.style.cssText = 'display:none;position:fixed;top:46px;right:16px;z-index:9998;width:260px;max-height:80vh;overflow-y:auto;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-family:\'Josefin Sans\',sans-serif;color:#e8e8e8;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
    document.body.appendChild(p);
    document.addEventListener('click', e => {
      if (!e.target.closest('#ed-elements-panel') && !e.target.closest('.eb-btn')) {
        p.style.display = 'none';
      }
    });
  }

  function fillElementsPanel(p) {
    const groups = [
      { title: 'Navigation', keys: ['nav-home','nav-about','nav-projects','nav-instagram','nav-linkedin','nav-contact','nav-admin'] },
      { title: 'Hero Content', keys: ['hero-content','hero-eyebrow','hero-name','hero-rule','hero-tagline'] },
      { title: 'Other', keys: ['nav-bar','projects-section','projects-canvas','projects-list','footer-text'] },
    ];

    let html = `<div style="padding:12px 14px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#fff;font-weight:500;">Page Elements</span>
      <button onclick="document.getElementById('ed-elements-panel').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:15px;cursor:pointer;line-height:1;padding:0 2px;">✕</button>
    </div>`;

    groups.forEach(g => {
      const rows = g.keys.map(key => {
        const el = document.querySelector(`[data-edit="${key}"]`);
        if (!el) return '';
        const label = el.dataset.editLabel || key;
        const isHidden = (overrides[key]?.display === 'none') || el.style.display === 'none';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:10px;letter-spacing:0.06em;color:${isHidden ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'};">${label}</span>
          <button onclick="__edToggleElementVis('${key}',this)" style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 9px;border-radius:3px;cursor:pointer;border:1px solid ${isHidden ? 'rgba(100,200,100,0.5)' : 'rgba(255,255,255,0.15)'};background:${isHidden ? 'rgba(60,140,60,0.2)' : 'rgba(255,255,255,0.05)'};color:${isHidden ? '#7cde7c' : 'rgba(255,255,255,0.55)'};">${isHidden ? '↩ Restore' : 'Hide'}</button>
        </div>`;
      }).join('');
      if (!rows.replace(/<div[^>]*><\/div>/g,'').trim()) return;
      html += `<div style="padding:8px 14px 4px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.35);">${g.title}</div>${rows}`;
    });

    if (overrides._added?.length) {
      html += `<div style="padding:8px 14px 4px;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Added Elements</div>`;
      overrides._added.forEach(item => {
        const typeLabel = item.type === 'hamburger' ? 'Sandwich Menu' : item.type === 'box' ? 'Box' : item.type === 'logo' ? 'Logo' : item.type === 'text' ? 'Text' : item.type === 'image' ? 'Image' : item.type === 'video' ? 'Video' : item.type;
        const label = item.label || typeLabel;
        html += `<div style="display:flex;align-items:center;gap:5px;padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="flex:1;font-size:10px;letter-spacing:0.06em;color:rgba(255,255,255,0.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${label}">${label}</span>
          <button onclick="__edSelectAddedFromPanel('${item.id}')" style="font-size:9px;letter-spacing:0.08em;padding:3px 8px;border-radius:3px;cursor:pointer;border:1px solid rgba(66,133,244,0.5);background:rgba(66,133,244,0.15);color:rgba(140,180,255,0.9);white-space:nowrap;">✎ Edit</button>
          <button onclick="__edDeleteAdded('${item.id}')" style="font-size:9px;padding:3px 8px;border-radius:3px;cursor:pointer;border:1px solid rgba(200,80,80,0.4);background:rgba(200,80,80,0.1);color:rgba(255,140,140,0.8);">🗑</button>
        </div>`;
      });
    }

    p.innerHTML = html;
    p.style.display = 'block';
  }

  window.__edShowElementsPanel = function(e) {
    e.stopPropagation();
    buildElementsPanel();
    const p = document.getElementById('ed-elements-panel');
    if (p.style.display !== 'none') { p.style.display = 'none'; return; }
    closeOtherPanels('elements');
    fillElementsPanel(p);
  };

  window.__edToggleElementVis = function(key, btn) {
    const el = document.querySelector(`[data-edit="${key}"]`);
    if (!el) return;
    const isHidden = (overrides[key]?.display === 'none') || el.style.display === 'none';
    if (isHidden) {
      // Restore
      el.style.display = '';
      if (overrides[key]) delete overrides[key].display;
      btn.textContent = 'Hide';
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.background  = 'rgba(255,255,255,0.05)';
      btn.style.color = 'rgba(255,255,255,0.55)';
      btn.closest('div').querySelector('span').style.color = 'rgba(255,255,255,0.85)';
    } else {
      // Hide
      el.style.display = 'none';
      if (!overrides[key]) overrides[key] = {};
      overrides[key].display = 'none';
      btn.textContent = '↩ Restore';
      btn.style.borderColor = 'rgba(100,200,100,0.5)';
      btn.style.background  = 'rgba(60,140,60,0.2)';
      btn.style.color = '#7cde7c';
      btn.closest('div').querySelector('span').style.color = 'rgba(255,255,255,0.3)';
    }
  };

  function hideAddMenu() { const m = document.getElementById('eb-add-menu'); if (m) m.style.display = 'none'; }
  window.__edToggleAdd = function(e) { e.stopPropagation(); const m = document.getElementById('eb-add-menu'); if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none'; };
  function getSpawnPos(elW, elH) {
    // Returns top-left xPx,yPx in absolute pixels relative to #page-canvas
    // so the element appears centred in the current viewport at any scroll depth.
    const canvas = document.getElementById('page-canvas') || document.querySelector('.hero');
    if (!canvas) return { xPx: 400, yPx: 300 };
    const w = elW || 220;
    const h = elH || 120;
    const canvasRect = canvas.getBoundingClientRect();
    // viewport centre → canvas-relative pixels
    const xPx = Math.max(0, window.innerWidth  / 2 - canvasRect.left - w / 2);
    const yPx = Math.max(0, window.innerHeight / 2 - canvasRect.top  - h / 2);
    return { xPx: Math.round(xPx), yPx: Math.round(yPx) };
  }

  window.__edAddEl = function(type) {
    _pushHistory();
    hideAddMenu();
    const id = 'ael-' + Date.now();
    let item;
    if (type === 'box') {
      const sp = getSpawnPos(220, 160);
      item = { id, type:'box', xPx:sp.xPx, yPx:sp.yPx, src:'', srcType:'', styles:{ backgroundColor:'rgba(30,30,30,0.55)', width:'220px', height:'160px' } };
    } else if (type === 'button') {
      const sp = getSpawnPos(120, 36);
      item = { id, type:'button', xPx:sp.xPx, yPx:sp.yPx, label:'Button', linkType:'url', linkValue:'', styles:{} };
    } else if (type === 'logo') {
      const canvas = document.getElementById('page-canvas');
      const cw = canvas?.offsetWidth || window.innerWidth;
      item = { id, type:'logo', xPx:Math.round(0.015*cw), yPx:16, content:'Natalie Hermelin', src:'', srcType:'text', styles:{ fontSize:'13px', color:'#000000', letterSpacing:'0.18em', zIndex:110 } };
    } else if (type === 'section-list') {
      const sp = getSpawnPos(200, 160);
      item = { id, type:'section-list', xPx:sp.xPx, yPx:sp.yPx, title:'SECTION TITLE', items:['First Title','Second Title','Third Title'], styles:{ color:'#111111', zIndex:5 } };
    } else {
      // text / image / video
      const sp = getSpawnPos(280, 60);
      item = { id, type, xPx:sp.xPx, yPx:sp.yPx, src:'', content:'', styles:{} };
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
    _pushHistory();
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
      const item = { id, type:'logo', x:1.5, y:1.5, content:'Natalie Hermelin', src:'', srcType:'text', styles:{ fontSize:'13px', color:'#000000', letterSpacing:'0.18em', zIndex:110 } };
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

  const BG_ORIG_DESKTOP = 'img/hero-bg-desktop.png';
  const BG_ORIG_MOBILE  = 'img/hero-bg.png';

  // ── BACKGROUND PANEL ──────────────────────────────────────────────────────
  function buildBgPanel() {
    const p = document.createElement('div');
    p.id = 'bg-panel';
    p.style.display = 'none';
    p.innerHTML = `
      <div class="ep-head">
        <span class="ep-title">Background</span>
        <button class="ep-x" onclick="__edCloseBgPanel()">✕</button>
      </div>

      <div class="ep-sec" style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:14px;margin-bottom:4px;">
        <div class="ep-sec-title" style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:10px;">Templates</div>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <button id="tpl-save-btn" onclick="__edSaveTemplate(1)" style="flex:1;padding:7px 0;border-radius:3px;cursor:pointer;border:1px solid rgba(66,133,244,0.45);background:rgba(66,133,244,0.12);color:rgba(140,190,255,0.9);font-family:inherit;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;">💾 Save as Template 1</button>
          <button id="tpl-load-btn" onclick="__edLoadTemplate(1)" style="flex:1;padding:7px 0;border-radius:3px;cursor:pointer;border:1px solid rgba(100,200,100,0.45);background:rgba(60,140,60,0.12);color:rgba(140,220,140,0.9);font-family:inherit;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;">↩ Load Template 1</button>
        </div>
        <div style="font-size:8px;color:rgba(255,255,255,0.28);letter-spacing:0.08em;">Save the current layout to restore it any time</div>
      </div>

      <div class="ep-sec">
        <div class="ep-sec-title" style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:8px;">Desktop Layout</div>
        <button class="ep-upload-btn" onclick="document.getElementById('bg-file-dt').click()">↑ Upload Image</button>
        <input type="file" id="bg-file-dt" accept="image/*" style="display:none" onchange="__edBgUpload(this.files[0],'desktop')">
        <input type="text" id="bg-url-dt" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edBgUrl(this.value,'desktop')">
        <img id="bg-prev-dt" style="display:none;width:100%;margin-top:6px;border-radius:3px;max-height:80px;object-fit:cover;">
      </div>

      <div class="ep-sec">
        <div class="ep-sec-title" style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:8px;">Mobile Layout</div>
        <button class="ep-upload-btn" onclick="document.getElementById('bg-file-mb').click()">↑ Upload Image</button>
        <input type="file" id="bg-file-mb" accept="image/*" style="display:none" onchange="__edBgUpload(this.files[0],'mobile')">
        <input type="text" id="bg-url-mb" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edBgUrl(this.value,'mobile')">
        <img id="bg-prev-mb" style="display:none;width:100%;margin-top:6px;border-radius:3px;max-height:80px;object-fit:cover;">
      </div>

      <div class="ep-sec" style="padding-top:4px;">
        <button id="bg-reset-btn" onclick="__edResetSite()" style="width:100%;padding:9px 0;border-radius:4px;cursor:pointer;border:1px solid rgba(255,120,60,0.5);background:rgba(255,80,30,0.12);color:rgba(255,170,120,0.95);font-family:inherit;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;">↺ Reset Entire Site to Natalie's Original</button>
      </div>`;
    document.body.appendChild(p);

    // Pre-fill current src values
    const dtSrc = document.getElementById('hero-src-desktop')?.getAttribute('srcset') || '';
    const mbSrc = document.getElementById('hero-src-mobile')?.src || '';
    if (dtSrc && dtSrc !== BG_ORIG_DESKTOP) { setV('bg-url-dt', dtSrc); showBgPreview('bg-prev-dt', dtSrc); }
    if (mbSrc && mbSrc !== BG_ORIG_MOBILE && !mbSrc.endsWith('hero-bg.png')) { setV('bg-url-mb', mbSrc); showBgPreview('bg-prev-mb', mbSrc); }
  }

  function showBgPreview(id, src) {
    const img = document.getElementById(id);
    if (!img) return;
    img.src = src; img.style.display = src ? 'block' : 'none';
  }

  function closeOtherPanels(keep) {
    if (keep !== 'bg')       { const p = document.getElementById('bg-panel');          if (p) p.style.display = 'none'; bgPanelOpen = false; }
    if (keep !== 'elements') { const p = document.getElementById('ed-elements-panel'); if (p) p.style.display = 'none'; }
    if (keep !== 'edit')     { deselect(); }
  }

  window.__edToggleBgPanel = function(e) {
    e.stopPropagation();
    const p = document.getElementById('bg-panel');
    if (!p) return;
    if (bgPanelOpen) { p.style.display = 'none'; bgPanelOpen = false; return; }
    closeOtherPanels('bg');
    bgPanelOpen = true;
    p.style.display = 'block';
    p.style.right = '16px'; p.style.top = '54px';
  };
  window.__edCloseBgPanel = function() { const p = document.getElementById('bg-panel'); if (p) p.style.display = 'none'; bgPanelOpen = false; };

  window.__edSaveTemplate = async function(n) {
    if (!confirm(`Save the current site layout as Template ${n}?\n\nThis will snapshot everything — elements, styles, and backgrounds.`)) return;
    const btn = document.getElementById('tpl-save-btn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    // Sync any open text blocks before snapshotting
    (overrides._added||[]).forEach(item => { if (item.type==='text') { const el=document.getElementById(item.id); if (el) item.content=el.innerHTML; } });
    try {
      const res = await fetch(`${REST}/settings?on_conflict=key`, {
        method: 'POST',
        headers: { 'apikey':SB_KEY, 'Authorization':`Bearer ${adminToken}`, 'Content-Type':'application/json', 'Prefer':'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: `template_${n}`, value: JSON.stringify(overrides) }])
      });
      if (!res.ok) throw new Error(await res.text());
      if (btn) { btn.textContent = `✓ Saved as Template ${n}`; btn.disabled = false; }
      setTimeout(() => { if (btn) btn.textContent = `💾 Save as Template ${n}`; }, 2500);
    } catch(e) {
      alert('Save failed: ' + e.message);
      if (btn) { btn.textContent = `💾 Save as Template ${n}`; btn.disabled = false; }
    }
  };

  window.__edLoadTemplate = async function(n) {
    if (!confirm(`Load Template ${n}?\n\nThis replaces the current site with the saved template layout.`)) return;
    const btn = document.getElementById('tpl-load-btn');
    if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }
    try {
      const res = await fetch(`${REST}/settings?key=eq.template_${n}&select=value`, {
        headers: { 'apikey':SB_KEY, 'Authorization':`Bearer ${adminToken}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data?.[0]?.value) { alert(`Template ${n} not found. Save it first.`); if (btn) { btn.textContent=`↩ Load Template ${n}`; btn.disabled=false; } return; }
      // Write template as the active site_overrides
      const res2 = await fetch(`${REST}/settings?on_conflict=key`, {
        method: 'POST',
        headers: { 'apikey':SB_KEY, 'Authorization':`Bearer ${adminToken}`, 'Content-Type':'application/json', 'Prefer':'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: 'site_overrides', value: data[0].value }])
      });
      if (!res2.ok) throw new Error(await res2.text());
      location.reload();
    } catch(e) {
      alert('Load failed: ' + e.message);
      if (btn) { btn.textContent = `↩ Load Template ${n}`; btn.disabled = false; }
    }
  };

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

  window.__edBgReset = window.__edResetSite = async function() {
    if (!confirm('Reset the ENTIRE SITE back to Natalie\'s original design?\n\nThis removes ALL added elements, style changes, and custom backgrounds. It cannot be undone.')) return;
    const btn = document.getElementById('bg-reset-btn');
    if (btn) { btn.textContent = 'Resetting…'; btn.disabled = true; }
    try {
      const res = await fetch(`${REST}/settings?on_conflict=key`, {
        method: 'POST',
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify([{ key: 'site_overrides', value: '{}' }])
      });
      if (!res.ok) throw new Error(await res.text());
      // Reload so all original styles and images are restored from scratch
      location.reload();
    } catch(e) {
      alert('Reset failed: ' + e.message);
      if (btn) { btn.textContent = '↺ Reset to Natalie\'s original site'; btn.disabled = false; }
    }
  };

  // __edShowContentModal defined later as alias to __edShowMenuManager('text')

  window.__edSaveContent = function() {
    _pushHistory();
    const aboutDiv = document.getElementById('ed-about-html');
    const rawHtml = aboutDiv ? aboutDiv.innerHTML : '';
    const email = (document.getElementById('ed-contact-email')?.value || '').trim();
    const phone = (document.getElementById('ed-contact-phone')?.value || '').trim();

    // Apply About content live
    const aboutEl = document.querySelector('.about-content');
    if (aboutEl) aboutEl.innerHTML = rawHtml;
    if (!overrides._about) overrides._about = {};
    overrides._about.html = rawHtml;

    // Apply Contact details live
    if (!overrides._contact) overrides._contact = {};
    if (email) {
      overrides._contact.email = email;
      document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
        a.href = 'mailto:' + email;
        if (a.closest('#contact-popup')) a.textContent = email;
      });
    }
    if (phone) {
      overrides._contact.phone = phone;
      const ph = document.querySelector('#contact-popup a[href^="tel:"]');
      if (ph) { ph.href = 'tel:' + phone.replace(/\s/g,''); ph.textContent = phone; }
    }

    document.getElementById('ed-btn-modal').style.display = 'none';
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
        <button onclick="__edRevertEl()" title="Undo changes since panel opened" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:0.05em;padding:2px 7px;border-radius:3px;cursor:pointer;line-height:1.6;">↩ Back</button>
        <button class="ep-x" onclick="__edDeselect()">✕</button>
      </div>

      <!-- TEXT EDIT HINT (text elements + nav items) -->
      <div class="ep-sec" id="ep-content-sec" style="display:none">
        <button onclick="__edStartTextEdit()" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);color:rgba(255,255,255,0.85);border-radius:4px;padding:8px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">✦ Click to edit text</button>
        <div style="font-size:9px;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-align:center;margin-top:6px">
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
          <label>Inner spacing</label>
          <div class="ep-pair">
            <input type="range" id="ep-pad-r" min="0" max="60" step="1" oninput="document.getElementById('ep-pad-n').value=this.value;__edUp('padding',this.value+'px')">
            <input type="number" id="ep-pad-n" min="0" max="60" style="width:50px" oninput="document.getElementById('ep-pad-r').value=this.value;__edUp('padding',this.value+'px')">
          </div>
        </div>
        <div id="ep-navheight-row" style="display:none;margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">
          <div class="ep-sec-title">Nav Bar Height (px)</div>
          <div class="ep-pair">
            <input type="range" id="ep-navh-r" min="32" max="120" step="2" value="64" oninput="document.getElementById('ep-navh-n').value=this.value;__edNavHeight(this.value)">
            <input type="number" id="ep-navh-n" min="32" max="120" step="2" value="64" style="width:50px" oninput="document.getElementById('ep-navh-r').value=this.value;__edNavHeight(this.value)">
          </div>
          <div class="ep-sec-title" style="margin-top:10px">Background Image</div>
          <button class="ep-upload-btn" onclick="document.getElementById('ep-nav-img-file').click()">↑ Upload Image</button>
          <input type="file" id="ep-nav-img-file" accept="image/*" style="display:none" onchange="__edNavBgUpload(this.files[0])">
          <input type="text" id="ep-nav-img-url" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edNavBgUrl(this.value)">
          <div class="ep-row" style="margin-top:6px">
            <label>Fit</label>
            <select id="ep-nav-img-fit" onchange="__edNavBgFit(this.value)" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.11);color:#e8e8e8;border-radius:3px;padding:4px 6px;font-family:inherit;font-size:11px;appearance:auto;">
              <option value="cover">Cover (fill)</option>
              <option value="contain">Contain (fit)</option>
              <option value="auto">Natural size</option>
            </select>
          </div>
          <button class="ep-reset" style="margin-top:6px" onclick="__edNavBgUrl('')">✕ Remove image</button>
        </div>
        <div id="ep-pageheight-row" style="display:none;margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">
          <div class="ep-sec-title">Page / Canvas Height</div>
          <div style="display:flex;gap:6px">
            <button onclick="__edPageTaller()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:6px 0;cursor:pointer;font-size:9px;letter-spacing:0.08em">↕ Make taller</button>
            <button onclick="__edPageShorter()" id="ep-shorter-inline-btn" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:6px 0;cursor:pointer;font-size:9px;letter-spacing:0.08em;display:none">↕ Make shorter</button>
          </div>
        </div>
      </div>

      <!-- Z-INDEX (containers + projects-list) -->
      <div class="ep-sec" id="ep-elz-sec" style="display:none">
        <div class="ep-sec-title">Layer Order (vs added boxes)</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="__edElToFront()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">↑ Front</button>
          <span id="ep-elzval" style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:0.05em;white-space:nowrap;min-width:34px;text-align:center">z:2</span>
          <button onclick="__edElToBack()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">↓ Back</button>
        </div>
      </div>

      <!-- WIDTH + BG (projects-list) -->
      <div class="ep-sec" id="ep-elwidth-sec" style="display:none">
        <div class="ep-sec-title">Width (px) — or drag corner ↘</div>
        <div class="ep-pair">
          <input type="range" id="ep-elw-r" min="100" max="900" step="10" oninput="document.getElementById('ep-elw-n').value=this.value;__edElWidth(this.value)">
          <input type="number" id="ep-elw-n" min="100" max="900" step="10" style="width:54px" oninput="document.getElementById('ep-elw-r').value=this.value;__edElWidth(this.value)">
        </div>
        <div class="ep-row" style="margin-top:10px">
          <label>Background</label>
          <div style="display:flex;gap:6px;flex:1;align-items:center">
            <input type="color" id="ep-elw-bg" value="#ffffff" style="height:28px;flex:1;cursor:pointer" oninput="__edElBg(this.value)">
            <button onclick="__edElBg('transparent')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:3px;padding:3px 7px;cursor:pointer;font-size:9px;white-space:nowrap">None</button>
          </div>
        </div>
        <div class="ep-row" style="margin-top:6px">
          <label>Opacity</label>
          <div class="ep-pair">
            <input type="range" id="ep-elw-op-r" min="0" max="1" step="0.05" value="1" oninput="document.getElementById('ep-elw-op-n').value=this.value;__edElBgOp(this.value)">
            <input type="number" id="ep-elw-op-n" min="0" max="1" step="0.05" value="1" style="width:46px" oninput="document.getElementById('ep-elw-op-r').value=this.value;__edElBgOp(this.value)">
          </div>
        </div>
      </div>

      <!-- SECTION HEADER: FONT (shown for buttons & text) -->
      <div class="ep-section-header" id="ep-font-header" style="display:none">Font Style</div>

      <!-- FONT PICKER (collapsible) -->
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
        <div class="ep-row">
          <label>Align</label>
          <div style="display:flex;gap:4px;flex:1">
            <button onclick="__edUp('textAlign','left')"   class="ep-st-align" data-align="left"   style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);border-radius:3px;padding:4px 0;cursor:pointer;font-size:13px">≡</button>
            <button onclick="__edUp('textAlign','center')" class="ep-st-align" data-align="center" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);border-radius:3px;padding:4px 0;cursor:pointer;font-size:13px">☰</button>
            <button onclick="__edUp('textAlign','right')"  class="ep-st-align" data-align="right"  style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);border-radius:3px;padding:4px 0;cursor:pointer;font-size:13px">≡</button>
          </div>
        </div>
      </div>

      <!-- NAV BUTTON BACKGROUND (preset nav items) — shown AFTER font controls -->
      <div class="ep-section-header" id="ep-navbtn-header" style="display:none">Button Style</div>
      <div class="ep-sec" id="ep-navbtn-sec" style="display:none">
        <div class="ep-row">
          <label>Fill color</label>
          <div style="display:flex;align-items:center;gap:6px;flex:1">
            <input type="color" id="ep-btn-col" style="flex:1;height:28px" oninput="this.style.opacity='1';var n=document.getElementById('ep-nav-none-btn');if(n){n.style.background='rgba(255,255,255,0.06)';n.style.borderColor='rgba(255,255,255,0.12)';n.style.color='rgba(255,255,255,0.55)';}__edUp('backgroundColor',this.value)">
            <button id="ep-nav-none-btn" onclick="__edUp('backgroundColor','transparent');document.getElementById('ep-btn-col').style.opacity='0.2';this.style.background='rgba(255,80,80,0.25)';this.style.borderColor='rgba(255,80,80,0.5)';this.style.color='#ffaaaa'" style="height:28px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.55);border-radius:3px;padding:0 8px;cursor:pointer;font-size:9px;white-space:nowrap">None</button>
          </div>
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
        <button onclick="__edApplyNavStyleToAll()" style="width:100%;margin-top:8px;background:rgba(66,133,244,0.18);border:1px solid rgba(66,133,244,0.4);color:rgba(200,218,255,0.9);border-radius:3px;padding:7px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">✦ Apply style to all buttons</button>
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
          <div class="ep-sec-title" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">Background</div>
          <div class="ep-row">
            <label>Color</label>
            <div style="display:flex;gap:6px;flex:1;align-items:center">
              <input type="color" id="ep-text-bg-col" value="#000000" style="height:28px;flex:1;cursor:pointer" oninput="__edTextBg(this.value)">
              <button onclick="__edTextBg('transparent')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:3px;padding:3px 7px;cursor:pointer;font-size:9px;white-space:nowrap">None</button>
            </div>
          </div>
          <div class="ep-row" style="margin-top:4px">
            <label>Padding</label>
            <div class="ep-pair">
              <input type="range" id="ep-text-pad-r" min="0" max="60" step="2" value="0" oninput="document.getElementById('ep-text-pad-n').value=this.value;__edTextPad(this.value)">
              <input type="number" id="ep-text-pad-n" min="0" max="60" step="2" value="0" style="width:44px" oninput="document.getElementById('ep-text-pad-r').value=this.value;__edTextPad(this.value)">
            </div>
          </div>
          <div class="ep-sec-title" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">Shadow</div>
          <div class="ep-shadow-grid" id="ep-text-shadow-grid">
            <button class="ep-sh-btn active" data-tshadow="none"   onclick="__edTextShadow('none')">None</button>
            <button class="ep-sh-btn"        data-tshadow="soft"   onclick="__edTextShadow('soft')">Soft</button>
            <button class="ep-sh-btn"        data-tshadow="medium" onclick="__edTextShadow('medium')">Medium</button>
            <button class="ep-sh-btn"        data-tshadow="strong" onclick="__edTextShadow('strong')">Strong</button>
            <button class="ep-sh-btn"        data-tshadow="deep"   onclick="__edTextShadow('deep')">Deep</button>
            <button class="ep-sh-btn"        data-tshadow="glow"   onclick="__edTextShadow('glow')">Glow</button>
          </div>
        </div>
        <div id="ep-button-ctrl" style="display:none">
          <div style="margin:-10px -14px 10px;padding:11px 14px 10px;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#fff;font-weight:700;background:rgba(255,255,255,0.05);border-bottom:2px solid rgba(255,255,255,0.12);border-top:1px solid rgba(255,255,255,0.08);">Button Style</div>
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
            <input type="text" id="ep-btn-link-val" placeholder="https:// or email or +34…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edBtnLinkVal(this.value)">
          </div>
          <!-- PADDING / BOX section -->
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
            <div class="ep-sec-title">Padding / Box</div>
            <div class="ep-row">
              <label>Fill</label>
              <input type="color" id="ep-btn-bcol" style="flex:1;height:28px" oninput="this.style.opacity='1';var n=document.getElementById('ep-btn-none-btn');if(n){n.style.background='rgba(255,255,255,0.06)';n.style.borderColor='rgba(255,255,255,0.1)';n.style.color='rgba(255,255,255,0.5)';}__edUp('backgroundColor',this.value)">
              <button id="ep-btn-none-btn" onclick="__edUp('backgroundColor','transparent');document.getElementById('ep-btn-bcol').style.opacity='0.2';this.style.background='rgba(255,80,80,0.25)';this.style.borderColor='rgba(255,80,80,0.5)';this.style.color='#ffaaaa'" style="height:28px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);border-radius:3px;padding:0 8px;cursor:pointer;font-size:9px;white-space:nowrap">None</button>
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
          <div style="margin:10px -14px 0;border-top:1px solid rgba(255,255,255,0.08);padding:10px 14px 0">
            <button onclick="__edShowMenuManager()" style="width:100%;background:rgba(66,133,244,0.15);border:1px solid rgba(66,133,244,0.35);color:rgba(200,218,255,0.9);border-radius:3px;padding:6px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">⬜ Manage Menu (switch / edit links)</button>
          </div>
        </div>
        <div id="ep-hamburger-ctrl" style="display:none">
          <div style="margin:-10px -14px 10px;padding:11px 14px 10px;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#fff;font-weight:700;background:rgba(255,255,255,0.05);border-bottom:2px solid rgba(255,255,255,0.12);border-top:1px solid rgba(255,255,255,0.08);">Sandwich Menu</div>
          <div class="ep-row">
            <label>Color</label>
            <input type="color" id="ep-ham-color" style="flex:1;height:28px" oninput="__edUp('color',this.value)">
          </div>
          <div class="ep-row">
            <label>Width</label>
            <div class="ep-pair">
              <input type="range" id="ep-ham-sz-r" min="16" max="80" step="1" oninput="document.getElementById('ep-ham-sz-n').value=this.value;__edHamSize(this.value)">
              <input type="number" id="ep-ham-sz-n" min="16" max="80" style="width:50px" oninput="document.getElementById('ep-ham-sz-r').value=this.value;__edHamSize(this.value)">
            </div>
          </div>
          <div class="ep-row">
            <label>Thickness</label>
            <div class="ep-pair">
              <input type="range" id="ep-ham-th-r" min="1" max="10" step="1" oninput="document.getElementById('ep-ham-th-n').value=this.value;__edHamThick(this.value)">
              <input type="number" id="ep-ham-th-n" min="1" max="10" style="width:50px" oninput="document.getElementById('ep-ham-th-r').value=this.value;__edHamThick(this.value)">
            </div>
          </div>
          <div style="margin:10px -14px 0;border-top:1px solid rgba(255,255,255,0.08);padding:10px 14px 0">
            <button onclick="__edShowMenuManager()" style="width:100%;background:rgba(66,133,244,0.15);border:1px solid rgba(66,133,244,0.35);color:rgba(200,218,255,0.9);border-radius:3px;padding:6px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">⬜ Manage Menu (switch / edit links)</button>
          </div>
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
            <input type="text" id="ep-logo-src" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edLogoImgUrl(this.value)">
            <p style="font-size:9px;color:rgba(255,255,255,0.3);margin:6px 0 0;letter-spacing:0.06em">Drag the corner handle to resize</p>
          </div>
        </div>
        <div id="ep-slist-ctrl" style="display:none">
          <div class="ep-sec-title">Section Label</div>
          <input type="text" id="ep-slist-title" placeholder="VIDEOS, SHORT FILMS…" oninput="__edSlistTitle(this.value)" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
          <div class="ep-sec-title" style="margin-top:10px">Title Items <span style="opacity:0.4;font-weight:300">(or double-click on page)</span></div>
          <div id="ep-slist-items" style="margin-bottom:4px"></div>
          <button onclick="__edSlistAddItem()" style="width:100%;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.2);color:rgba(255,255,255,0.5);border-radius:3px;padding:6px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">+ Add item</button>
        </div>
        <div id="ep-img-ctrl" style="display:none">
          <div class="ep-sec-title">Image</div>
          <button class="ep-upload-btn" onclick="document.getElementById('ep-img-file').click()">↑ Upload Image</button>
          <input type="file" id="ep-img-file" accept="image/*" style="display:none" onchange="__edUploadImg(this.files[0])">
          <input type="text" id="ep-img-url" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edImgUrl(this.value)">
        </div>
        <div id="ep-vid-ctrl" style="display:none">
          <div class="ep-sec-title">Video URL (YouTube)</div>
          <input type="text" id="ep-vid-url" placeholder="YouTube, Vimeo, or Google Drive link…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edVidUrl(this.value)">
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
          <div class="ep-row" style="margin-top:6px">
            <label>Hover zoom</label>
            <input type="checkbox" id="ep-box-hover" onchange="__edBoxHover(this.checked)" style="cursor:pointer;width:16px;height:16px;accent-color:#4affce">
          </div>
          <div class="ep-row" id="ep-box-autoplay-row" style="display:none">
            <label>Play on scroll</label>
            <input type="checkbox" id="ep-box-autoplay" onchange="__edBoxAutoplay(this.checked)" style="cursor:pointer;width:16px;height:16px;accent-color:#4affce">
          </div>
          <div class="ep-sec-title" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">Border</div>
          <div class="ep-row">
            <label>Color</label>
            <input type="color" id="ep-box-bdr-col" value="#ffffff" style="flex:1;height:28px;cursor:pointer" oninput="__edBoxBorder()">
          </div>
          <div class="ep-row">
            <label>Width</label>
            <div class="ep-pair">
              <input type="range" id="ep-box-bdr-w" min="0" max="16" step="1" value="0" oninput="document.getElementById('ep-box-bdr-wn').value=this.value;__edBoxBorder()">
              <input type="number" id="ep-box-bdr-wn" min="0" max="16" step="1" value="0" style="width:44px" oninput="document.getElementById('ep-box-bdr-w').value=this.value;__edBoxBorder()">
            </div>
          </div>
          <div class="ep-row">
            <label>Style</label>
            <select id="ep-box-bdr-style" onchange="__edBoxBorder()" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.11);color:#e8e8e8;border-radius:3px;padding:4px 6px;font-family:inherit;font-size:11px;appearance:auto;">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
          </div>
          <div class="ep-sec-title" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">Shadow</div>
          <div class="ep-shadow-grid" id="ep-box-shadow-grid">
            <button class="ep-sh-btn" data-bshadow="none"   onclick="__edBoxShadow('none')">None</button>
            <button class="ep-sh-btn" data-bshadow="soft"   onclick="__edBoxShadow('soft')">Soft</button>
            <button class="ep-sh-btn" data-bshadow="medium" onclick="__edBoxShadow('medium')">Medium</button>
            <button class="ep-sh-btn" data-bshadow="strong" onclick="__edBoxShadow('strong')">Strong</button>
            <button class="ep-sh-btn" data-bshadow="deep"   onclick="__edBoxShadow('deep')">Deep</button>
            <button class="ep-sh-btn" data-bshadow="glow"   onclick="__edBoxShadow('glow')">Glow</button>
          </div>
          <div class="ep-sec-title" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">Image / Video</div>
          <button class="ep-upload-btn" onclick="document.getElementById('ep-box-file').click()">↑ Upload Image</button>
          <input type="file" id="ep-box-file" accept="image/*" style="display:none" onchange="__edBoxUpload(this.files[0])">
          <input type="text" id="ep-box-img-url" placeholder="or paste image URL…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edBoxImgUrl(this.value)">
          <input type="text" id="ep-box-vid-url" placeholder="YouTube, Vimeo, or Google Drive link…" style="width:100%;box-sizing:border-box;margin-top:6px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:5px 7px;font-family:inherit;font-size:11px;" onfocus="this.select()" oninput="__edBoxVidUrl(this.value)">
          <button class="ep-reset" style="margin-top:6px" onclick="__edBoxClear()">✕ Clear media</button>
          <div class="ep-sec-title" style="margin-top:10px">Size (px) — or drag corner</div>
          <div class="ep-pos-row">
            <label>W</label><input type="number" id="ep-bw" step="1" min="40" style="width:60px" oninput="__edBoxSize()">
            <label>H</label><input type="number" id="ep-bh" step="1" min="40" style="width:60px" oninput="__edBoxSize()">
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;align-items:center">
          <button onclick="__edToFront()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">↑ Front</button>
          <span id="ep-zval" style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:0.05em;white-space:nowrap;min-width:34px;text-align:center">z:10</span>
          <button onclick="__edToBack()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);border-radius:3px;padding:5px 0;cursor:pointer;font-size:9px;letter-spacing:0.1em">↓ Back</button>
        </div>
        <button class="ep-del" style="margin-top:6px" onclick="__edDeleteAdded()">🗑 Delete element</button>
      </div>

      <!-- RESET / HIDE -->
      <div class="ep-sec" id="ep-reset-sec">
        <button class="ep-reset" onclick="__edResetPos()" style="margin-bottom:6px">⌖ Reset position only</button>
        <button class="ep-reset" onclick="__edReset()">↺ Reset styles</button>
        <button class="ep-del" id="ep-hide-btn" style="margin-top:6px" onclick="__edHide()">🗑 Hide element</button>
      </div>`;
    document.body.appendChild(p);

    // ── Menu modal (Navigation + Page Text tabs) ──
    const modal = document.createElement('div');
    modal.id = 'ed-btn-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.72);align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#111118;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:24px;width:400px;max-height:88vh;overflow-y:auto;font-family:Josefin Sans,sans-serif;color:#e8e8e8;">

        <!-- Top tab bar -->
        <div style="display:flex;gap:0;margin-bottom:18px;border:1px solid rgba(255,255,255,0.12);border-radius:5px;overflow:hidden;">
          <button id="ed-tab-nav" onclick="__edMenuTab('nav')"
            style="flex:1;padding:9px 0;border:none;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;background:#4285f4;color:#fff;transition:background 0.15s;">
            ⬜ Navigation
          </button>
          <button id="ed-tab-text" onclick="__edMenuTab('text')"
            style="flex:1;padding:9px 0;border:none;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);transition:background 0.15s;">
            ✍ Page Text
          </button>
        </div>

        <!-- NAV TAB -->
        <div id="ed-menu-nav">
          <div style="font-size:9px;letter-spacing:0.26em;text-transform:uppercase;color:#4285f4;margin-bottom:12px">Menu Type</div>
          <div style="display:flex;gap:0;margin-bottom:14px;border:1px solid rgba(255,255,255,0.12);border-radius:5px;overflow:hidden;">
            <button id="ed-type-btn-buttons" onclick="__edSetMenuType('buttons')"
              style="flex:1;padding:8px 0;border:none;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;background:#4285f4;color:#fff;transition:background 0.15s;">
              ⬜ Buttons
            </button>
            <button id="ed-type-btn-sandwich" onclick="__edSetMenuType('sandwich')"
              style="flex:1;padding:8px 0;border:none;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);transition:background 0.15s;">
              ☰ Sandwich
            </button>
          </div>
          <div id="ed-btn-type-hint" style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:12px;line-height:1.7">Add a row per link. Drag to reorder after applying.</div>
          <div id="ed-btn-rows"></div>
          <button onclick="__edAddBtnRow()" style="width:100%;margin-top:8px;background:rgba(255,255,255,0.06);border:1px dashed rgba(255,255,255,0.2);color:rgba(255,255,255,0.5);border-radius:4px;padding:7px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.1em">+ Add link</button>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button onclick="__edCreateButtons()" style="flex:1;background:#4285f4;border:none;color:#fff;border-radius:4px;padding:9px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.12em;text-transform:uppercase">Apply</button>
            <button onclick="document.getElementById('ed-btn-modal').style.display='none'" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:4px;padding:9px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.12em">Cancel</button>
          </div>
        </div>

        <!-- PAGE TEXT TAB -->
        <div id="ed-menu-text" style="display:none">
          <p style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#888;margin-bottom:8px;">About — body text</p>
          <div id="ed-about-html" contenteditable="true"
            style="width:100%;min-height:180px;max-height:280px;overflow-y:auto;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#e0e0e0;border-radius:5px;padding:10px;font-family:'Josefin Sans',sans-serif;font-size:12px;line-height:1.8;outline:none;"></div>
          <p style="font-size:9px;color:rgba(255,255,255,0.2);margin:4px 0 18px;">Type and format directly. Enter for new paragraph.</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
            <div>
              <p style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#888;margin-bottom:6px;">Contact email</p>
              <input id="ed-contact-email" type="email" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#e0e0e0;border-radius:5px;padding:8px 10px;font-family:inherit;font-size:11px;">
            </div>
            <div>
              <p style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#888;margin-bottom:6px;">Contact phone</p>
              <input id="ed-contact-phone" type="text" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#e0e0e0;border-radius:5px;padding:8px 10px;font-family:inherit;font-size:11px;">
            </div>
          </div>

          <div style="display:flex;gap:8px;">
            <button onclick="__edSaveContent()" style="flex:1;background:#4285f4;border:none;color:#fff;border-radius:4px;padding:9px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.12em;text-transform:uppercase">Apply</button>
            <button onclick="document.getElementById('ed-btn-modal').style.display='none'" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:4px;padding:9px 0;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:0.12em">Cancel</button>
          </div>
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
  // Corner drag-to-resize handle for static elements (projects-list / #wo-list)
  function _addStaticResizeHandle(el) {
    const rh = document.createElement('div');
    rh.id = 'ed-static-resize-handle';
    rh.title = 'Drag to resize';
    rh.style.cssText = 'position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;background:rgba(255,255,255,0.85);border-radius:2px;cursor:se-resize;z-index:99999;pointer-events:all;box-shadow:0 1px 4px rgba(0,0,0,0.4);';
    // The wo-list needs position:relative so the handle positions correctly
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(rh);
    rh.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      _pushHistory();
      const startX = e.clientX;
      const startW = el.offsetWidth;
      const key = el.dataset.edit;
      document.body.style.cursor = 'se-resize';
      document.body.style.userSelect = 'none';
      function mv(ev) {
        const newW = Math.max(100, Math.min(900, startW + (ev.clientX - startX)));
        el.style.width = newW + 'px';
        if (!overrides[key]) overrides[key] = {};
        overrides[key].width = newW + 'px';
        setV('ep-elw-r', newW); setV('ep-elw-n', newW);
      }
      function up() {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  function attachTargets() {
    document.querySelectorAll('[data-edit]:not(.edit-added)').forEach(el => {
      el.classList.add('edit-target');
      const type = el.dataset.editType;
      if (!['nav-item','container'].includes(type)) {
        el.addEventListener('click', e => { e.stopPropagation(); selectEl(el); });
        makeStaticDraggable(el); // includes 'style' type (projects-list, etc.)
        if (!type || type === 'text' || type === 'nav-item') makeStaticEditable(el);
        // Corner resize for projects-list
        if (el.dataset.edit === 'projects-list') _addStaticResizeHandle(el);
      } else if (type === 'nav-item') {
        makeStaticDraggable(el);
        makeStaticEditable(el);
      } else if (type === 'container') {
        el.addEventListener('click', e => { e.stopPropagation(); selectEl(el); });
        makeStaticDraggable(el); // containers are now draggable via transform
      }
    });
    // Intercept project item clicks — redirect to selecting the list container
    document.addEventListener('click', e => {
      const item = e.target.closest('.wo-proj-item');
      if (item && item.contentEditable !== 'true') { e.stopImmediatePropagation(); e.preventDefault(); const list = document.getElementById('wo-list'); if (list) selectEl(list); }
    }, true);
    // Double-click a project title → inline rename
    document.addEventListener('dblclick', e => {
      const item = e.target.closest('.wo-proj-item');
      if (!item) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const prjId = item.dataset.prjId;
      if (!prjId) return;
      item.contentEditable = 'true';
      item.style.cursor = 'text';
      item.style.userSelect = 'text';
      item.focus();
      try { const r = document.createRange(); r.selectNodeContents(item); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch(e){}
      item.onblur = async function() {
        if (item.contentEditable !== 'true') return;
        item.contentEditable = 'false';
        item.style.cursor = '';
        item.style.userSelect = '';
        const newTitle = item.textContent.trim();
        if (!newTitle) return;
        try {
          await _prjFetch(`/rest/v1/projects?id=eq.${prjId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ title: newTitle })
          });
          if (window.__appReloadProjects) window.__appReloadProjects();
        } catch(err) { console.error('Title save failed', err); }
      };
      item.onkeydown = function(ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); item.blur(); }
        if (ev.key === 'Escape') { item.contentEditable = 'false'; item.style.cursor = ''; item.style.userSelect = ''; item.onblur = null; }
      };
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
      _pushHistory();
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
        placePanel();
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.style.userSelect=''; }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }

  // Floating drag handle for static containers / style elements
  function _showDragHandle(el) {
    _hideDragHandle();
    if (!el || el.classList.contains('edit-added')) return;
    const type = el.dataset.editType;
    if (!['container','style'].includes(type)) return;
    const key = el.dataset.edit;
    const handle = document.createElement('div');
    handle.id = 'ed-drag-handle';
    handle.innerHTML = '⠿ drag to move';
    handle.style.cssText = 'position:fixed;background:rgba(20,20,20,0.88);color:rgba(255,255,255,0.92);padding:4px 10px;border-radius:4px;font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.1em;cursor:move;z-index:999999;pointer-events:all;user-select:none;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.35);';
    document.body.appendChild(handle);
    function _placeHandle() {
      const rect = el.getBoundingClientRect();
      const hw = handle.offsetWidth || 110;
      handle.style.left = Math.max(4, rect.left + rect.width/2 - hw/2) + 'px';
      handle.style.top  = Math.max(50, rect.top + 6) + 'px';
    }
    _placeHandle();
    handle.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      _pushHistory();
      const ov = overrides[key] || {};
      const m = (ov.transform||'').match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      let tx = m ? parseFloat(m[1]) : 0, ty = m ? parseFloat(m[2]) : 0;
      let sx = e.clientX, sy = e.clientY;
      document.body.style.userSelect = 'none';
      function mv(ev) {
        tx += ev.clientX - sx; ty += ev.clientY - sy;
        sx = ev.clientX; sy = ev.clientY;
        el.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`;
        if (!overrides[key]) overrides[key] = {};
        overrides[key].transform = el.style.transform;
        setV('ep-px', tx.toFixed(1)); setV('ep-py', ty.toFixed(1));
        _placeHandle(); placePanel();
      }
      function up() { document.body.style.userSelect=''; document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }
  function _hideDragHandle() {
    const h = document.getElementById('ed-drag-handle');
    if (h) h.remove();
  }

  function selectEl(el) {
    closeOtherPanels('edit');
    if (selected) {
      selected.classList.remove('edit-selected');
      // Restore z-index of previously selected added element
      if (selected.classList.contains('edit-added') && selected.dataset.storedZ !== undefined) {
        selected.style.zIndex = selected.dataset.storedZ;
        delete selected.dataset.storedZ;
      }
    }
    selected = el;
    el.classList.add('edit-selected');
    // Lift added elements to front while selected so they're always clickable/visible
    if (el.classList.contains('edit-added')) {
      el.dataset.storedZ = el.style.zIndex || '10';
      el.style.zIndex = '9000';
    }
    // snapshot current state so user can revert
    const _isAdded = el.classList.contains('edit-added');
    if (_isAdded) {
      const _item = getAddedItem(el.id);
      _snapshot = { isAdded: true, id: el.id, styles: JSON.parse(JSON.stringify(_item?.styles || {})), label: _item?.label, content: _item?.content };
    } else {
      _snapshot = { isAdded: false, key: el.dataset.edit, styles: JSON.parse(JSON.stringify(overrides[el.dataset.edit] || {})) };
    }
    const label = el.dataset.editLabel || el.dataset.edit;
    document.getElementById('ep-title').textContent = label;
    document.getElementById('eb-hint').textContent  = 'Editing: ' + label;
    populatePanel(el);
    placePanel();
    _showDragHandle(el);
    document.getElementById('edit-panel').style.display = 'block';
  }

  window.__edRevertEl = function() {
    if (!_snapshot || !selected) return;
    if (_snapshot.isAdded) {
      const item = getAddedItem(selected.id);
      if (item) {
        // clear props added since snapshot so DOM doesn't retain them
        Object.keys(item.styles || {}).forEach(p => {
          if (!_snapshot.styles.hasOwnProperty(p)) selected.style[p] = '';
        });
        item.styles = JSON.parse(JSON.stringify(_snapshot.styles));
        if (_snapshot.label !== undefined) item.label = _snapshot.label;
        if (_snapshot.content !== undefined) item.content = _snapshot.content;
        applyStyles(selected, item.styles);
      }
    } else {
      Object.keys(overrides[_snapshot.key] || {}).forEach(p => {
        if (!_snapshot.styles.hasOwnProperty(p)) selected.style[p] = '';
      });
      overrides[_snapshot.key] = JSON.parse(JSON.stringify(_snapshot.styles));
      applyStyles(selected, overrides[_snapshot.key]);
    }
    populatePanel(selected);
  };

  function _removeHamDropPreview() {
    const old = document.getElementById('ham-drop-preview');
    if (old) old.remove();
  }

  function _showHamDropPreview(item) {
    _removeHamDropPreview();
    if (!item?.links?.length) return;
    const canvas = document.getElementById('page-canvas') || document.querySelector('.hero');
    if (!canvas) return;

    const drop = document.createElement('div');
    drop.id = 'ham-drop-preview';
    const col = item.styles?.color || '#ffffff';
    const dropBg = item.styles?.dropBg || 'rgba(10,10,10,0.92)';
    drop.style.cssText = `position:absolute;z-index:9100;background:${dropBg};border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:8px 0;min-width:160px;backdrop-filter:blur(8px);cursor:move;box-shadow:0 8px 24px rgba(0,0,0,0.5);`;

    // Position: use saved drop coords or default near hamburger
    if (item.dropXPx != null) {
      drop.style.left = item.dropXPx + 'px';
      drop.style.top  = item.dropYPx + 'px';
    } else if (item.dropX != null && item.dropY != null) {
      const canvasRect = canvas.getBoundingClientRect();
      const cw = canvas.offsetWidth || window.innerWidth;
      const ch = canvas.offsetHeight || window.innerHeight;
      item.dropXPx = Math.round(parseFloat(item.dropX) / 100 * cw);
      item.dropYPx = Math.round(parseFloat(item.dropY) / 100 * ch);
      drop.style.left = item.dropXPx + 'px';
      drop.style.top  = item.dropYPx + 'px';
    } else {
      const hamEl = document.getElementById(item.id);
      if (hamEl) {
        const canvasRect = canvas.getBoundingClientRect();
        const hamRect = hamEl.getBoundingClientRect();
        item.dropXPx = Math.round(hamRect.left - canvasRect.left);
        item.dropYPx = Math.round(window.scrollY + hamRect.bottom + 8 - (window.scrollY + canvasRect.top));
        drop.style.left = item.dropXPx + 'px';
        drop.style.top  = item.dropYPx + 'px';
      } else {
        item.dropXPx = 200; item.dropYPx = 80;
        drop.style.left = '200px'; drop.style.top = '80px';
      }
    }

    // Build link rows with inline edit
    item.links.forEach((link, i) => {
      const row = document.createElement('div');
      row.contentEditable = 'true';
      row.textContent = link.label;
      row.style.cssText = `padding:10px 18px;font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${col};cursor:text;outline:none;`;
      row.addEventListener('mousedown', e => e.stopPropagation()); // don't start drag when editing text
      row.addEventListener('blur', () => {
        const newLabel = row.textContent.trim();
        if (newLabel) { link.label = newLabel; row.textContent = newLabel; }
      });
      drop.appendChild(row);

      // Up/Down arrows
      const arrows = document.createElement('div');
      arrows.style.cssText = 'display:flex;gap:3px;padding:0 10px 6px;';
      const arrowBtn = (txt, fn) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.style.cssText = 'background:rgba(255,255,255,0.1);border:none;color:rgba(255,255,255,0.6);cursor:pointer;border-radius:3px;padding:2px 6px;font-size:10px;';
        b.onmousedown = e => e.stopPropagation();
        b.onclick = () => { fn(); _showHamDropPreview(item); };
        return b;
      };
      if (i > 0) arrows.appendChild(arrowBtn('↑', () => { const tmp=item.links[i-1]; item.links[i-1]=item.links[i]; item.links[i]=tmp; }));
      if (i < item.links.length - 1) arrows.appendChild(arrowBtn('↓', () => { const tmp=item.links[i+1]; item.links[i+1]=item.links[i]; item.links[i]=tmp; }));
      const del = arrowBtn('✕', () => { item.links.splice(i,1); _showHamDropPreview(item); });
      del.style.marginLeft = 'auto';
      arrows.appendChild(del);
      drop.appendChild(arrows);
    });

    // "Edit Links" hint at bottom
    const hint = document.createElement('div');
    hint.style.cssText = 'padding:6px 14px;font-size:8px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.25);border-top:1px solid rgba(255,255,255,0.08);margin-top:4px;cursor:pointer;';
    hint.textContent = '+ Edit in Menu → Page Text';
    hint.onclick = () => window.__edShowMenuManager();
    hint.onmousedown = e => e.stopPropagation();
    drop.appendChild(hint);

    canvas.appendChild(drop);

    // Make preview draggable (saves position into item.dropXPx/dropYPx)
    drop.addEventListener('mousedown', e => {
      if (e.target.contentEditable === 'true' || e.target.tagName === 'BUTTON') return;
      e.stopPropagation();
      _pushHistory();
      const sl = drop.offsetLeft, st = drop.offsetTop, sx = e.clientX, sy = e.clientY;
      function mv(ev) {
        const nx = Math.max(0, sl + ev.clientX - sx);
        const ny = Math.max(0, st + ev.clientY - sy);
        drop.style.left = nx + 'px';
        drop.style.top  = ny + 'px';
        item.dropXPx = nx; item.dropYPx = ny;
      }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  function deselect() {
    if (selected) {
      selected.classList.remove('edit-selected');
      // Restore z-index for added elements (was lifted to 9000 while selected)
      if (selected.classList.contains('edit-added') && selected.dataset.storedZ !== undefined) {
        selected.style.zIndex = selected.dataset.storedZ;
        delete selected.dataset.storedZ;
      }
    }
    selected = null;
    _hideDragHandle();
    // panelUserMoved intentionally NOT reset — panel stays where user put it
    _removeHamDropPreview();
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
    const showPos      = !isAdded && editType !== 'nav-item';
    const showAdded    = isAdded;
    const showReset    = !isAdded;
    const showElZ      = !isAdded && (editType === 'container' || el.dataset.edit === 'projects-list');
    const showElWidth  = !isAdded && el.dataset.edit === 'projects-list';

    show('ep-content-sec',   showContent);
    show('ep-bgcol-sec',     showBgCol);
    show('ep-elz-sec',       showElZ);
    show('ep-elwidth-sec',   showElWidth);
    show('ep-font-header',   showFont);
    show('ep-font-sec',      showFont);
    show('ep-style-sec',     showStyle);
    show('ep-navbtn-header', showNavBtn);
    show('ep-navbtn-sec',    showNavBtn);
    show('ep-shadow-sec',    showShadow);
    show('ep-pos-sec',       showPos);
    show('ep-added-sec',     showAdded);
    show('ep-reset-sec',     showReset);
    // Page height controls — only for projects-section container
    const phRow = document.getElementById('ep-pageheight-row');
    if (phRow) phRow.style.display = (!isAdded && el.dataset.edit === 'projects-section') ? '' : 'none';
    const phShort = document.getElementById('ep-shorter-inline-btn');
    if (phShort) phShort.style.display = (overrides._canvasH || 0) > 0 ? '' : 'none';
    // Nav height control — only when nav-bar is selected
    const nhRow = document.getElementById('ep-navheight-row');
    if (nhRow) nhRow.style.display = (!isAdded && el.dataset.edit === 'nav-bar') ? '' : 'none';
    if (!isAdded && el.dataset.edit === 'nav-bar') {
      const navEl = document.querySelector('nav');
      const curH = parseInt(overrides['nav-bar']?.minHeight || navEl?.style.minHeight || 64);
      setV('ep-navh-r', curH); setV('ep-navh-n', curH);
      // Populate nav bg image URL
      const navBgOv = overrides['nav-bar'] || {};
      const existingBgImg = navBgOv.backgroundImage || '';
      const existingUrl = existingBgImg.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
      const navImgInp = document.getElementById('ep-nav-img-url');
      if (navImgInp) navImgInp.value = existingUrl;
      const fitSel = document.getElementById('ep-nav-img-fit');
      if (fitSel && navBgOv.backgroundSize) fitSel.value = navBgOv.backgroundSize;
    }

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

    // Layer z-index (containers + projects-list)
    if (showElZ) {
      const elzEl = document.getElementById('ep-elzval');
      if (elzEl) {
        // For projects-list, z-index that matters is on projects-section (the stacking context)
        const zOv = el.dataset.edit === 'projects-list'
          ? (overrides['projects-section'] || {})
          : ov;
        const zEl = el.dataset.edit === 'projects-list'
          ? document.getElementById('projects-flow')
          : el;
        const curZ = parseInt(zOv.zIndex || zEl?.style.zIndex) || 2;
        elzEl.textContent = 'z:' + curZ;
      }
    }

    // Width + Background (projects-list)
    if (showElWidth) {
      const w = parseInt(ov.width || el.style.width) || 220;
      setV('ep-elw-r', w); setV('ep-elw-n', w);
      // Background color
      const bg = ov.backgroundColor || el.style.backgroundColor || 'transparent';
      const bgHex = rgbToHex(bg);
      const bgEl = document.getElementById('ep-elw-bg');
      if (bgEl) bgEl.value = bgHex || '#ffffff';
      // Opacity
      const op = parseFloat(ov.opacity ?? el.style.opacity ?? 1);
      setV('ep-elw-op-r', op); setV('ep-elw-op-n', op);
    }

    // Nav button style
    if (showNavBtn) {
      const bg = ov.backgroundColor || cs.backgroundColor;
      const hex = rgbToHex(bg);
      const isClear = !hex || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
      const colEl = document.getElementById('ep-btn-col');
      const noneEl = document.getElementById('ep-nav-none-btn');
      if (colEl) { if (hex) colEl.value = hex; colEl.style.opacity = isClear ? '0.2' : '1'; }
      if (noneEl) { noneEl.style.background = isClear ? 'rgba(255,80,80,0.25)' : 'rgba(255,255,255,0.06)'; noneEl.style.borderColor = isClear ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.12)'; noneEl.style.color = isClear ? '#ffaaaa' : 'rgba(255,255,255,0.55)'; }
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
      // Alignment button state
      const curAlign = ov.textAlign || cs.textAlign || 'left';
      document.querySelectorAll('.ep-st-align').forEach(b => {
        b.style.background = b.dataset.align === curAlign ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
        b.style.borderColor = b.dataset.align === curAlign ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
      });
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

    // Always reset font picker state: closed for text/other, open for buttons
    const _fb = document.getElementById('ep-font-body');
    const _fa = document.getElementById('ep-font-arrow');
    if (_fb && addType !== 'button') { _fb.style.display = 'none'; if (_fa) _fa.textContent = '▾ open'; }

    // Scroll panel to top so the hint / first section is visible
    const _panel = document.getElementById('edit-panel');
    if (_panel) _panel.scrollTop = 0;

    // Added element extras
    if (showAdded) {
      // Show current z-index value
      const _zEl = document.getElementById('ep-zval');
      if (_zEl) {
        const _zi = parseInt(el.dataset.storedZ) ?? parseInt(ov.zIndex) ?? 10;
        _zEl.textContent = 'z:' + _zi;
      }

      show('ep-text-ctrl',      addType === 'text');
      show('ep-img-ctrl',       addType === 'image');
      show('ep-vid-ctrl',       addType === 'video');
      show('ep-size-ctrl',      addType === 'image' || addType === 'video' || addType === 'text' || addType === 'button');
      show('ep-box-ctrl',       addType === 'box');
      show('ep-button-ctrl',    addType === 'button');
      show('ep-hamburger-ctrl', addType === 'hamburger');
      show('ep-logo-ctrl',      addType === 'logo');
      show('ep-slist-ctrl',     addType === 'section-list');

      if (addType === 'section-list') {
        const item = getAddedItem(el.id);
        setV('ep-slist-title', item?.title || '');
        _slistRenderItems(el.id);
      }

      if (addType === 'text') {
        const item = getAddedItem(el.id);
        setV('ep-text-val', el.innerHTML.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'') || '');
        const align = item?.styles?.textAlign || 'left';
        document.querySelectorAll('.ep-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === align));
        setV('ep-sw', parseInt(el.style.width) || el.offsetWidth || 200);
        setV('ep-sh', parseInt(el.style.height) || el.offsetHeight || 40);
        // Background
        const tbg = item?.styles?.backgroundColor || 'transparent';
        const tbgHex = rgbToHex(tbg);
        const tbgEl = document.getElementById('ep-text-bg-col');
        if (tbgEl && tbgHex) tbgEl.value = tbgHex;
        const tpad = parseInt(item?.styles?.padding) || 0;
        setV('ep-text-pad-r', tpad); setV('ep-text-pad-n', tpad);
        // Shadow
        const curShadow = item?.styles?.boxShadow || 'none';
        document.querySelectorAll('#ep-text-shadow-grid .ep-sh-btn').forEach(b => {
          const k = b.dataset.tshadow;
          b.classList.toggle('active', _BOX_SHADOWS[k] === curShadow || (k === 'none' && (!curShadow || curShadow === 'none')));
        });
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
        const hoverEl = document.getElementById('ep-box-hover');
        if (hoverEl) hoverEl.checked = !!item?.styles?._hoverScale;
        const autoplayRow = document.getElementById('ep-box-autoplay-row');
        const autoplayEl = document.getElementById('ep-box-autoplay');
        if (autoplayRow) autoplayRow.style.display = item?.srcType === 'video' ? '' : 'none';
        if (autoplayEl) autoplayEl.checked = !!item?.styles?._videoAutoplay;
        // Border
        const bdr = item?.styles?.border || 'none';
        if (bdr !== 'none') {
          const bm = bdr.match(/^(\d+)px\s+(\w+)\s+(.+)$/);
          if (bm) {
            setV('ep-box-bdr-w', bm[1]); setV('ep-box-bdr-wn', bm[1]);
            const bdStyle = document.getElementById('ep-box-bdr-style');
            if (bdStyle) bdStyle.value = bm[2];
            const bdCol = document.getElementById('ep-box-bdr-col');
            if (bdCol) { const hx = _colorToHex(bm[3].trim()); if (hx) bdCol.value = hx; }
          }
        } else { setV('ep-box-bdr-w', 0); setV('ep-box-bdr-wn', 0); }
        // Shadow
        const curShadow = item?.styles?.boxShadow || 'none';
        document.querySelectorAll('#ep-box-shadow-grid .ep-sh-btn').forEach(b => {
          const key = b.dataset.bshadow;
          b.classList.toggle('active', _BOX_SHADOWS[key] === curShadow || (key === 'none' && curShadow === 'none'));
        });
      }
      if (addType === 'button') {
        // Auto-open the font picker for buttons
        const fontBody = document.getElementById('ep-font-body');
        const fontArrow = document.getElementById('ep-font-arrow');
        if (fontBody) { fontBody.style.display = ''; if (fontArrow) fontArrow.textContent = '▴ close'; }
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
          const bClear = !bhex || item.styles?.backgroundColor === 'transparent' || item.styles?.backgroundColor === 'rgba(0, 0, 0, 0)';
          const bColEl = document.getElementById('ep-btn-bcol'); const bNoneEl = document.getElementById('ep-btn-none-btn');
          if (bColEl) { if (bhex) bColEl.value = bhex; bColEl.style.opacity = bClear ? '0.2' : '1'; }
          if (bNoneEl) { bNoneEl.style.background = bClear ? 'rgba(255,80,80,0.25)' : 'rgba(255,255,255,0.06)'; bNoneEl.style.borderColor = bClear ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.1)'; bNoneEl.style.color = bClear ? '#ffaaaa' : 'rgba(255,255,255,0.5)'; }
          setV('ep-btn-br-r', parseInt(item.styles?.borderRadius)||0);
          setV('ep-btn-br-n', parseInt(item.styles?.borderRadius)||0);
          const pads = (item.styles?.padding||'6px 16px').split(' ');
          setV('ep-btn-pv', parseInt(pads[0])||6);
          setV('ep-btn-ph', parseInt(pads[1]||pads[0])||16);
          setV('ep-sw', parseInt(el.style.width) || el.offsetWidth || 80);
          setV('ep-sh', parseInt(el.style.height) || el.offsetHeight || 30);
        }
      }
      if (addType === 'hamburger') {
        const item = getAddedItem(el.id);
        if (item) {
          const hHex = rgbToHex(item.styles?.color || '#ffffff') || '#ffffff';
          document.getElementById('ep-ham-color').value = hHex;
          const hW = parseInt(item.styles?._hamW) || 28;
          setV('ep-ham-sz-r', hW); setV('ep-ham-sz-n', hW);
          const hH = parseInt(item.styles?._hamH) || 2;
          setV('ep-ham-th-r', hH); setV('ep-ham-th-n', hH);
          _showHamDropPreview(item);
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
          else { setV('ep-logo-src', item.src || ''); }
        }
      }
    }
  }

  function _clampPanel(panel) {
    // Keep the panel fully within the visible viewport at all times
    const PW = panel.offsetWidth  || 272;
    const PH = panel.offsetHeight || 420;
    let l = parseInt(panel.style.left) || 8;
    let t = parseInt(panel.style.top)  || 54;
    l = Math.max(8, Math.min(window.innerWidth  - PW - 8, l));
    t = Math.max(54, Math.min(window.innerHeight - PH - 8, t));
    panel.style.left = l + 'px';
    panel.style.top  = t + 'px';
  }

  function placePanel() {
    if (panelUserMoved) return;
    // Fixed position: bottom-left corner, just above the bottom edge
    const panel = document.getElementById('edit-panel');
    panel.style.left = '8px';
    panel.style.top  = '54px';
  }

  // ── UPDATE HANDLERS ───────────────────────────────────────────────────────
  window.__edUp = function(prop, val) {
    if (!selected) return;
    _maybePushHistory();
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
    // For projects-list, text styles need to cascade to child items (CSS specificity)
    if (!isAdded && selected.dataset.edit === 'projects-list') {
      const _textProps = ['fontSize','color','fontWeight','fontFamily','letterSpacing','fontStyle','textTransform','textAlign'];
      if (_textProps.includes(prop)) {
        selected.querySelectorAll('.wo-proj-item').forEach(item => { item.style[prop] = val; });
      }
    }
    // Highlight active alignment button in static style panel
    if (prop === 'textAlign') {
      document.querySelectorAll('.ep-st-align').forEach(b => {
        b.style.background = b.dataset.align === val ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
        b.style.borderColor = b.dataset.align === val ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
      });
    }
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

  window.__edTextBg = function(val) {
    if (!selected || selected.dataset.addedType !== 'text') return;
    _maybePushHistory();
    const item = getAddedItem(selected.id); if (!item) return;
    if (!item.styles) item.styles = {};
    item.styles.backgroundColor = val;
    selected.style.backgroundColor = val;
  };

  window.__edTextPad = function(val) {
    if (!selected || selected.dataset.addedType !== 'text') return;
    _maybePushHistory();
    const item = getAddedItem(selected.id); if (!item) return;
    if (!item.styles) item.styles = {};
    const v = val + 'px';
    item.styles.padding = v;
    selected.style.padding = v;
  };

  window.__edTextShadow = function(key) {
    if (!selected || selected.dataset.addedType !== 'text') return;
    _maybePushHistory();
    const item = getAddedItem(selected.id); if (!item) return;
    if (!item.styles) item.styles = {};
    const val = _BOX_SHADOWS[key] || 'none';
    item.styles.boxShadow = val;
    selected.style.boxShadow = val;
    document.querySelectorAll('#ep-text-shadow-grid .ep-sh-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tshadow === key);
    });
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
    const embed = extractVideoEmbed(url); if (!embed) return;
    selected.innerHTML = '';
    const fr = document.createElement('iframe');
    fr.src = embed.embedUrl;
    fr.style.cssText = 'width:100%;height:100%;border:none;display:block;pointer-events:none;';
    fr.allow = 'accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture';
    fr.allowFullscreen = true;
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
  window.__edHamSize = function(val) {
    if (!selected || selected.dataset.addedType !== 'hamburger') return;
    const item = getAddedItem(selected.id); if (!item) return;
    if (!item.styles) item.styles = {};
    item.styles._hamW = parseInt(val);
    selected.style.width = val + 'px';
  };

  window.__edHamThick = function(val) {
    if (!selected || selected.dataset.addedType !== 'hamburger') return;
    const item = getAddedItem(selected.id); if (!item) return;
    if (!item.styles) item.styles = {};
    item.styles._hamH = parseInt(val);
    _buildHamLines(selected, item);
  };

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

  const _BOX_SHADOWS = {
    none:   'none',
    soft:   '0 2px 14px rgba(0,0,0,0.20)',
    medium: '0 5px 28px rgba(0,0,0,0.38)',
    strong: '0 8px 44px rgba(0,0,0,0.58)',
    deep:   '0 16px 64px rgba(0,0,0,0.78)',
    glow:   '0 0 24px rgba(255,255,255,0.65), 0 0 52px rgba(255,255,255,0.28)',
  };

  function _colorToHex(col) {
    const m = col.match(/^#[0-9a-fA-F]{6}$/);
    if (m) return col;
    const m2 = col.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m2) return '#' + [m2[1],m2[2],m2[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
    return null;
  }

  window.__edBoxBorder = function() {
    if (!selected || selected.dataset.addedType !== 'box') return;
    _maybePushHistory();
    const col   = document.getElementById('ep-box-bdr-col')?.value || '#ffffff';
    const w     = parseInt(document.getElementById('ep-box-bdr-wn')?.value) || 0;
    const style = document.getElementById('ep-box-bdr-style')?.value || 'solid';
    const val   = w === 0 ? 'none' : `${w}px ${style} ${col}`;
    selected.style.border = val;
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles={}; item.styles.border = val; }
  };

  window.__edBoxShadow = function(key) {
    if (!selected || selected.dataset.addedType !== 'box') return;
    _maybePushHistory();
    const val = _BOX_SHADOWS[key] || 'none';
    selected.style.boxShadow = val;
    const item = getAddedItem(selected.id);
    if (item) { if (!item.styles) item.styles={}; item.styles.boxShadow = val; }
    document.querySelectorAll('#ep-box-shadow-grid .ep-sh-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bshadow === key);
    });
  };

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

  // ── SECTION LIST ─────────────────────────────────────────────────────────
  function _slistRenderItems(elId) {
    const cont = document.getElementById('ep-slist-items');
    if (!cont) return;
    const item = getAddedItem(elId || selected?.id);
    if (!item) return;
    cont.innerHTML = '';
    (item.items || []).forEach((text, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.id = `ep-sli-${elId}-${idx}`; inp.value = text;
      inp.style.cssText = 'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#e8e8e8;border-radius:3px;padding:4px 7px;font-family:inherit;font-size:10px;letter-spacing:0.06em;';
      inp.oninput = () => __edSlistItem(idx, inp.value);
      const del = document.createElement('button');
      del.textContent = '✕'; del.style.cssText = 'background:rgba(200,60,60,0.15);border:1px solid rgba(200,60,60,0.3);color:rgba(255,140,140,0.8);border-radius:3px;padding:0 7px;cursor:pointer;font-size:11px;flex-shrink:0;';
      del.onclick = () => __edSlistDelItem(idx);
      row.appendChild(inp); row.appendChild(del);
      cont.appendChild(row);
    });
  }
  window.__edSlistTitle = function(val) {
    if (!selected) return;
    const item = getAddedItem(selected.id);
    if (!item) return;
    item.title = val;
    selected.dataset.editLabel = val;
    const h = selected.querySelector('.sl-head');
    if (h) h.textContent = val;
  };
  window.__edSlistItem = function(idx, val) {
    if (!selected) return;
    const item = getAddedItem(selected.id);
    if (!item || !item.items) return;
    item.items[idx] = val;
    const row = selected.querySelector(`.sl-row[data-sl-idx="${idx}"]`);
    if (row && row.contentEditable !== 'true') row.textContent = val;
  };
  window.__edSlistAddItem = function() {
    if (!selected) return;
    const item = getAddedItem(selected.id);
    if (!item) return;
    if (!item.items) item.items = [];
    item.items.push('New Title');
    _buildSectionList(selected, item, true);
    _slistRenderItems(selected.id);
  };
  window.__edSlistDelItem = function(idx) {
    if (!selected) return;
    const item = getAddedItem(selected.id);
    if (!item || !item.items) return;
    item.items.splice(idx, 1);
    _buildSectionList(selected, item, true);
    _slistRenderItems(selected.id);
  };

  window.__edBoxHover = function(on) {
    if (!selected) return;
    const item = getAddedItem(selected.id);
    if (!item) return;
    if (!item.styles) item.styles = {};
    item.styles._hoverScale = on ? true : undefined;
    if (!on) delete item.styles._hoverScale;
  };
  window.__edBoxAutoplay = function(on) {
    if (!selected) return;
    const item = getAddedItem(selected.id);
    if (!item) return;
    if (!item.styles) item.styles = {};
    item.styles._videoAutoplay = on ? true : undefined;
    if (!on) delete item.styles._videoAutoplay;
  };

  const BTN_LINK_OPTS = [
    {v:'nav-home',label:'Home (scroll top)'},{v:'nav-work',label:'Work / Projects'},
    {v:'popup-contact',label:'Contact popup'},{v:'popup-about',label:'About popup'},
    {v:'url',label:'URL / Social'},{v:'email',label:'Email'},{v:'phone',label:'Phone'},
  ];

  window.__edAddBtnRow = function() {
    const cont = document.getElementById('ed-btn-rows'); if (!cont) return;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:5px;align-items:center;margin-bottom:6px;';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = 'Label…';
    inp.style.cssText = 'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#e8e8e8;border-radius:4px;padding:5px 7px;font-family:inherit;font-size:11px;';
    const sel = document.createElement('select');
    sel.style.cssText = 'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#e8e8e8;border-radius:4px;padding:4px 5px;font-family:inherit;font-size:10px;';
    BTN_LINK_OPTS.forEach(o => { const op = document.createElement('option'); op.value=o.v; op.textContent=o.label; sel.appendChild(op); });
    const arrowStyle = 'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);cursor:pointer;font-size:11px;padding:3px 5px;border-radius:3px;line-height:1;';
    const up = document.createElement('button'); up.textContent = '↑'; up.style.cssText = arrowStyle;
    up.onclick = () => { const prev = row.previousElementSibling; if (prev) cont.insertBefore(row, prev); };
    const dn = document.createElement('button'); dn.textContent = '↓'; dn.style.cssText = arrowStyle;
    dn.onclick = () => { const next = row.nextElementSibling; if (next) cont.insertBefore(next, row); };
    const del = document.createElement('button');
    del.textContent = '✕'; del.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:13px;padding:2px 4px;';
    del.onclick = () => row.remove();
    row.appendChild(inp); row.appendChild(sel); row.appendChild(up); row.appendChild(dn); row.appendChild(del);
    cont.appendChild(row);
    inp.focus();
  };

  let _menuType = 'buttons'; // 'buttons' | 'sandwich'

  window.__edSetMenuType = function(type) {
    _menuType = type;
    const btnB = document.getElementById('ed-type-btn-buttons');
    const btnS = document.getElementById('ed-type-btn-sandwich');
    const hint = document.getElementById('ed-btn-type-hint');
    if (btnB) { btnB.style.background = type === 'buttons' ? '#4285f4' : 'rgba(255,255,255,0.06)'; btnB.style.color = type === 'buttons' ? '#fff' : 'rgba(255,255,255,0.5)'; }
    if (btnS) { btnS.style.background = type === 'sandwich' ? '#4285f4' : 'rgba(255,255,255,0.06)'; btnS.style.color = type === 'sandwich' ? '#fff' : 'rgba(255,255,255,0.5)'; }
    if (hint) hint.textContent = type === 'buttons'
      ? "Add a row per button. They'll appear evenly spaced — movable afterwards."
      : 'Add one row per link. A single ☰ icon will open a dropdown with all links.';
  };

  window.__edMenuTab = function(tab) {
    const navDiv  = document.getElementById('ed-menu-nav');
    const textDiv = document.getElementById('ed-menu-text');
    const tabNav  = document.getElementById('ed-tab-nav');
    const tabText = document.getElementById('ed-tab-text');
    if (!navDiv || !textDiv) return;
    const isNav = tab === 'nav';
    navDiv.style.display  = isNav ? '' : 'none';
    textDiv.style.display = isNav ? 'none' : '';
    if (tabNav)  { tabNav.style.background  = isNav ? '#4285f4' : 'rgba(255,255,255,0.06)'; tabNav.style.color  = isNav ? '#fff' : 'rgba(255,255,255,0.5)'; }
    if (tabText) { tabText.style.background = isNav ? 'rgba(255,255,255,0.06)' : '#4285f4'; tabText.style.color = isNav ? 'rgba(255,255,255,0.5)' : '#fff'; }
    if (!isNav) {
      // Populate Page Text fields
      const aboutDiv = document.getElementById('ed-about-html');
      if (aboutDiv) aboutDiv.innerHTML = document.querySelector('.about-content')?.innerHTML || '';
      const emailEl = document.querySelector('#contact-popup a[href^="mailto:"]');
      const phoneEl = document.querySelector('#contact-popup a[href^="tel:"]');
      const em = document.getElementById('ed-contact-email');
      const ph = document.getElementById('ed-contact-phone');
      if (em) em.value = emailEl?.textContent || '';
      if (ph) ph.value = phoneEl?.textContent || '';
    }
  };

  function _navItemsFromDOM() {
    const items = [];
    document.querySelectorAll('.nav-links .nav-item:not(.nav-item-admin)').forEach(el => {
      const label = el.textContent.trim();
      let linkType = 'url';
      if (el.dataset.edit === 'nav-home')     linkType = 'nav-home';
      else if (el.dataset.edit === 'nav-projects') linkType = 'nav-work';
      else if (el.classList.contains('about-trigger'))   linkType = 'popup-about';
      else if (el.classList.contains('contact-trigger')) linkType = 'popup-contact';
      items.push({ label, linkType });
    });
    return items.length ? items : [
      {label:'Home', linkType:'nav-home'}, {label:'About', linkType:'popup-about'},
      {label:'Projects', linkType:'nav-work'}, {label:'Contact', linkType:'popup-contact'},
    ];
  }

  window.__edShowButtonsModal = window.__edShowMenuManager = function(initialTab) {
    hideAddMenu();
    deselect();
    const modal = document.getElementById('ed-btn-modal');
    if (!modal) return;

    // Populate nav tab
    const existingHam = (overrides._added || []).find(it => it.type === 'hamburger');
    const isSandwich  = !!(existingHam || overrides._navLinksHidden);
    let entries;
    if (isSandwich && existingHam?.links?.length) {
      entries = existingHam.links.map(l => ({ label: l.label, linkType: l.linkType || 'url' }));
    } else {
      entries = _navItemsFromDOM();
    }
    _menuType = isSandwich ? 'sandwich' : 'buttons';
    window.__edSetMenuType(_menuType);
    const cont = document.getElementById('ed-btn-rows');
    if (cont) {
      cont.innerHTML = '';
      entries.forEach(({ label, linkType }) => {
        window.__edAddBtnRow();
        const last = cont.lastElementChild;
        if (last) { last.querySelector('input').value = label || ''; last.querySelector('select').value = linkType || 'url'; }
      });
    }

    // Switch to requested tab (default: nav)
    window.__edMenuTab(initialTab || 'nav');
    modal.style.display = 'flex';
  };

  // Keep Edit Text shortcut working — opens Menu modal on the text tab
  window.__edShowContentModal = function() { window.__edShowMenuManager('text'); };

  window.__edCreateButtons = function() {
    _pushHistory();
    const rows = document.querySelectorAll('#ed-btn-rows > div');
    const entries = [];
    rows.forEach(row => {
      const label = (row.querySelector('input')?.value || '').trim();
      const linkType = row.querySelector('select')?.value || 'url';
      if (label) entries.push({ label, linkType, linkValue: '' });
    });
    if (!entries.length) return;
    if (!overrides._added) overrides._added = [];

    // Always sweep existing hamburger elements
    (overrides._added || []).filter(it => it.type === 'hamburger')
      .forEach(it => { const el = document.getElementById(it.id); if (el) el.remove(); });
    document.querySelectorAll('[data-added-type="hamburger"]').forEach(el => el.remove());
    overrides._added = (overrides._added || []).filter(it => it.type !== 'hamburger');

    if (_menuType === 'sandwich') {
      // Hide non-admin nav items; keep Admin link accessible
      document.querySelectorAll('.nav-links .nav-item:not(.nav-item-admin)').forEach(el => el.style.display = 'none');
      overrides._navLinksHidden = true;
      // Spawn hamburger at viewport centre so user can grab it
      const id = 'ael-menu-' + Date.now();
      const sp = getSpawnPos(40, 40);
      const item = { id, type:'hamburger', xPx:sp.xPx, yPx:sp.yPx, links: entries, styles:{ color:'#ffffff', fontSize:'28px', zIndex:110 } };
      overrides._added.push(item);
      buildAddedEl(item, true);
    } else {
      // Restore non-admin nav items
      document.querySelectorAll('.nav-links .nav-item:not(.nav-item-admin)').forEach(el => el.style.display = '');
      delete overrides._navLinksHidden;
    }
    document.getElementById('ed-btn-modal').style.display = 'none';
  };

  window.__edResetButtonRow = function() {
    if (!overrides._added) return;
    const buttons = overrides._added.filter(it => it.type === 'button');
    if (!buttons.length) return;
    const total = buttons.length;
    buttons.forEach((item, i) => {
      const canvas = document.getElementById('page-canvas');
      const cw = canvas?.offsetWidth || window.innerWidth;
      const xPx = Math.round((i + 0.5) / total * cw);
      const yPx = item.yPx ?? Math.round(0.09 * (canvas?.offsetHeight || window.innerHeight));
      item.xPx = xPx; item.yPx = yPx;
      const el = document.getElementById(item.id);
      if (el) { el.style.left = xPx + 'px'; el.style.top = yPx + 'px'; }
    });
  };

  window.__edApplyToAllButtons = function() {
    if (!selected || selected.dataset.addedType !== 'button') return;
    if (!overrides._added) return;
    const srcItem = getAddedItem(selected.id);
    if (!srcItem) return;
    const styleKeys = ['fontFamily','fontSize','color','fontWeight','fontStyle','letterSpacing','opacity','backgroundColor','padding','borderRadius','border','textTransform','boxShadow'];
    // Also normalise the source button: clear any fixed width/height so it sizes by content
    delete srcItem.styles.width; delete srcItem.styles.height;
    selected.style.width = ''; selected.style.height = '';
    overrides._added.forEach(item => {
      if (item.type !== 'button' || item.id === selected.id) return;
      if (!item.styles) item.styles = {};
      styleKeys.forEach(k => { if (srcItem.styles?.[k] !== undefined) item.styles[k] = srcItem.styles[k]; });
      // Clear fixed size on every target button so padding drives the height uniformly
      delete item.styles.width; delete item.styles.height;
      const el = document.getElementById(item.id);
      if (el) {
        styleKeys.forEach(k => { if (srcItem.styles?.[k] !== undefined) el.style[k] = srcItem.styles[k]; });
        el.style.width = ''; el.style.height = '';
      }
    });
    // Refresh SIZE inputs so they show empty
    setV('ep-sw', ''); setV('ep-sh', '');
  };

  window.__edResetPos = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    selected.style.transform = '';
    if (overrides[key]) { delete overrides[key].transform; }
    setV('ep-px', 0); setV('ep-py', 0);
  };

  window.__edReset = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    delete overrides[key];
    selected.removeAttribute('style');
    selected.style.cursor = 'move';
    populatePanel(selected);
  };

  window.__edApplyNavStyleToAll = function() {
    if (!selected) return;
    const key = selected.dataset.edit;
    const srcStyles = overrides[key] || {};
    const styleKeys = ['fontFamily','fontSize','color','fontWeight','fontStyle','letterSpacing','opacity','backgroundColor','padding','borderRadius','border','textTransform'];
    document.querySelectorAll('[data-edit-type="nav-item"]').forEach(el => {
      if (el === selected) return;
      const k = el.dataset.edit;
      if (!overrides[k]) overrides[k] = {};
      styleKeys.forEach(p => { if (srcStyles[p] !== undefined) { overrides[k][p] = srcStyles[p]; el.style[p] = srcStyles[p]; } });
    });
  };

  window.__edHide = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    window.__edUp('display', 'none');
    deselect();
  };

  window.__edDeleteAdded = function(forceId) {
    _pushHistory();
    const id = forceId || selected?.id;
    if (!id) return;
    if (!forceId && (!selected || !selected.classList.contains('edit-added'))) return;
    // No confirm needed — Back button undoes this
    if (overrides._added) overrides._added = overrides._added.filter(i => i.id !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    if (!forceId) deselect();
    // Refresh elements panel in-place if it's open (don't toggle/close it)
    const ep = document.getElementById('ed-elements-panel');
    if (ep && ep.style.display !== 'none') fillElementsPanel(ep);
  };

  window.__edSelectAddedFromPanel = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // If hidden, make temporarily visible so it can be selected
    const wasHidden = el.style.display === 'none';
    if (wasHidden) {
      el.style.display = '';
      const item = (overrides._added || []).find(i => i.id === id);
      if (item?.styles) delete item.styles.display;
    }
    // Close elements panel
    const ep = document.getElementById('ed-elements-panel');
    if (ep) ep.style.display = 'none';
    // Select the element and open edit panel
    selectEl(el);
    const panel = document.getElementById('edit-panel');
    if (panel) panel.style.display = 'block';
  };

  window.__edDeselect = deselect;

  window.__edStartTextEdit = function() {
    if (!selected) return;
    selected.contentEditable = 'true';
    selected.style.cursor = 'text';
    selected.style.userSelect = 'text';
    // Clear placeholder if present
    if (selected.innerHTML === 'Double-click to edit') selected.innerHTML = '';
    selected.focus();
    // Select all so user can immediately start typing
    try { const r = document.createRange(); r.selectNodeContents(selected); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch(e) {}
  };

  window.__edToggleFonts = function() {
    const body  = document.getElementById('ep-font-body');
    const arrow = document.getElementById('ep-font-arrow');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display  = open ? 'none' : 'block';
    arrow.textContent   = open ? '▾ open' : '▴ close';
  };

  function _updateZDisplay(z) {
    const el = document.getElementById('ep-zval');
    if (el) el.textContent = 'z:' + z;
  }

  window.__edToFront = function() {
    if (!selected || !selected.classList.contains('edit-added')) return;
    const item = getAddedItem(selected.id);
    // Use stored z-index (element is lifted to 9000 while selected; don't use style.zIndex)
    const storedZ = selected.dataset.storedZ !== undefined ? parseInt(selected.dataset.storedZ) : (parseInt(item?.styles?.zIndex) ?? 10);
    const newZ = storedZ + 5;
    selected.dataset.storedZ = String(newZ);
    if (item) { if (!item.styles) item.styles={}; item.styles.zIndex=newZ; }
    _updateZDisplay(newZ);
  };

  window.__edToBack = function() {
    if (!selected || !selected.classList.contains('edit-added')) return;
    const item = getAddedItem(selected.id);
    // Use stored z-index (element is lifted to 9000 while selected; don't use style.zIndex)
    const storedZ = selected.dataset.storedZ !== undefined ? parseInt(selected.dataset.storedZ) : (parseInt(item?.styles?.zIndex) ?? 10);
    const newZ = Math.max(0, storedZ - 5);
    selected.dataset.storedZ = String(newZ);
    if (item) { if (!item.styles) item.styles={}; item.styles.zIndex=newZ; }
    _updateZDisplay(newZ);
  };

  // ── LAYER ORDER FOR NON-ADDED ELEMENTS (containers, etc.) ─────────────────
  window.__edElToFront = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    let key = selected.dataset.edit;
    let targetEl = selected;
    // For projects-list, the stacking context is the parent projects-section
    if (key === 'projects-list') { targetEl = document.getElementById('projects-flow'); key = 'projects-section'; }
    if (!key || !targetEl) return;
    _pushHistory();
    if (!overrides[key]) overrides[key] = {};
    const curZ = parseInt(overrides[key].zIndex || targetEl.style.zIndex) || 2;
    const newZ = curZ + 1;
    overrides[key].zIndex = newZ;
    targetEl.style.zIndex = newZ;
    const el = document.getElementById('ep-elzval');
    if (el) el.textContent = 'z:' + newZ;
  };
  window.__edElToBack = function() {
    if (!selected || selected.classList.contains('edit-added')) return;
    let key = selected.dataset.edit;
    let targetEl = selected;
    // For projects-list, the stacking context is the parent projects-section
    if (key === 'projects-list') { targetEl = document.getElementById('projects-flow'); key = 'projects-section'; }
    if (!key || !targetEl) return;
    _pushHistory();
    if (!overrides[key]) overrides[key] = {};
    const curZ = parseInt(overrides[key].zIndex || targetEl.style.zIndex) || 2;
    const newZ = Math.max(0, curZ - 1);
    overrides[key].zIndex = newZ;
    targetEl.style.zIndex = newZ;
    const el = document.getElementById('ep-elzval');
    if (el) el.textContent = 'z:' + newZ;
  };
  window.__edElWidth = function(val) {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    if (!key) return;
    _pushHistory();
    if (!overrides[key]) overrides[key] = {};
    overrides[key].width = val + 'px';
    selected.style.width = val + 'px';
    // keep resize handle synced
    const rh = document.getElementById('ed-static-resize-handle');
    if (rh) { /* handle re-positions via getBoundingClientRect automatically */ }
  };

  window.__edElBg = function(val) {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    if (!key) return;
    _maybePushHistory();
    if (!overrides[key]) overrides[key] = {};
    if (val === 'transparent') {
      overrides[key].backgroundColor = 'transparent';
      overrides[key].opacity = 1;
      selected.style.backgroundColor = 'transparent';
      // reset opacity picker
      const or = document.getElementById('ep-elw-op-r'); const on = document.getElementById('ep-elw-op-n');
      if (or) or.value = 1; if (on) on.value = 1;
    } else {
      overrides[key].backgroundColor = val;
      selected.style.backgroundColor = val;
    }
  };

  window.__edElBgOp = function(val) {
    if (!selected || selected.classList.contains('edit-added')) return;
    const key = selected.dataset.edit;
    if (!key) return;
    _maybePushHistory();
    if (!overrides[key]) overrides[key] = {};
    overrides[key].opacity = parseFloat(val);
    selected.style.opacity = val;
  };

  // Re-apply projects-list text styles to child items (called after sidebar is rebuilt)
  window.__edApplyProjListStyles = function() {
    const ov = overrides['projects-list'];
    if (!ov) return;
    const textProps = ['fontSize','color','fontWeight','fontFamily','letterSpacing','fontStyle','textTransform','textAlign'];
    document.querySelectorAll('.wo-proj-item').forEach(item => {
      Object.entries(ov).forEach(([p, v]) => { if (textProps.includes(p)) item.style[p] = v; });
    });
  };

  // ── PAGE HEIGHT ───────────────────────────────────────────────────────────
  const _EDIT_BAR_H = 44; // height of the fixed editor toolbar in edit mode

  function _applyNavBgImage(url, fit) {
    const navBg = document.querySelector('.nav-bar-bg');
    if (!navBg) return;
    if (!overrides['nav-bar']) overrides['nav-bar'] = {};
    if (url) {
      navBg.style.backgroundImage = `url('${url}')`;
      navBg.style.backgroundSize = fit || 'cover';
      navBg.style.backgroundPosition = 'center';
      navBg.style.backgroundRepeat = 'no-repeat';
      overrides['nav-bar'].backgroundImage = `url('${url}')`;
      overrides['nav-bar'].backgroundSize = fit || 'cover';
      overrides['nav-bar'].backgroundPosition = 'center';
      overrides['nav-bar'].backgroundRepeat = 'no-repeat';
    } else {
      navBg.style.backgroundImage = '';
      navBg.style.backgroundSize = '';
      navBg.style.backgroundPosition = '';
      navBg.style.backgroundRepeat = '';
      delete overrides['nav-bar'].backgroundImage;
      delete overrides['nav-bar'].backgroundSize;
      delete overrides['nav-bar'].backgroundPosition;
      delete overrides['nav-bar'].backgroundRepeat;
    }
  }

  window.__edNavBgUrl = function(url) {
    _maybePushHistory();
    const fit = document.getElementById('ep-nav-img-fit')?.value || 'cover';
    _applyNavBgImage(url.trim(), url.trim() ? fit : '');
  };

  window.__edNavBgFit = function(fit) {
    _maybePushHistory();
    const navBg = document.querySelector('.nav-bar-bg');
    if (navBg && navBg.style.backgroundImage) {
      navBg.style.backgroundSize = fit;
      if (overrides['nav-bar']) overrides['nav-bar'].backgroundSize = fit;
    }
  };

  window.__edNavBgUpload = async function(file) {
    if (!file?.type.startsWith('image/')) return;
    const btn = document.querySelector('#ep-nav-img-file')?.previousElementSibling;
    try {
      if (btn) { btn.textContent = 'Uploading…'; btn.disabled = true; }
      const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
      const name = `nav-bg-${Date.now()}.${ext}`;
      const buf = await file.arrayBuffer();
      const res = await sbStorageUpload(`media/${encodeURIComponent(name)}`, buf, file.type);
      if (!res.ok) throw new Error(await res.text());
      const url = `${SB_URL}/storage/v1/object/public/media/${encodeURIComponent(name)}`;
      const inp = document.getElementById('ep-nav-img-url');
      if (inp) inp.value = url;
      window.__edNavBgUrl(url);
      if (btn) { btn.textContent = '✓ Uploaded'; setTimeout(() => { btn.textContent = '↑ Upload Image'; btn.disabled = false; }, 2000); }
    } catch(e) {
      if (btn) { btn.textContent = '✕ Failed'; btn.disabled = false; }
    }
  };

  window.__edNavHeight = function(val) {
    _maybePushHistory();
    const h = Math.max(32, Math.min(120, parseInt(val)));
    if (!overrides['nav-bar']) overrides['nav-bar'] = {};
    overrides['nav-bar'].minHeight = h;
    const navEl = document.querySelector('nav');
    if (navEl) navEl.style.minHeight = h + 'px';
  };

  window.__edPageTaller = function() {
    _pushHistory();
    overrides._canvasH = (overrides._canvasH || 0) + 300;
    applyStyleOverrides();
  };

  window.__edPageShorter = function() {
    _pushHistory();
    overrides._canvasH = Math.max(0, (overrides._canvasH || 0) - 300);
    applyStyleOverrides();
  };

  // ── SAVE ──────────────────────────────────────────────────────────────────
  window.__edRevertAll = async function() {
    if (!confirm('Revert all unsaved changes back to the last saved version?')) return;
    // Re-fetch from Supabase
    let saved = {};
    try {
      const r = await fetch(`${REST}/settings?key=eq.site_overrides&select=value`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${adminToken}` } });
      if (r.ok) { const rows = await r.json(); if (rows?.[0]?.value) saved = JSON.parse(rows[0].value); }
    } catch (_) {}
    // Remove all current added elements from DOM
    (overrides._added || []).forEach(it => { const el = document.getElementById(it.id); if (el) el.remove(); });
    document.querySelectorAll('.edit-added,.site-added-el').forEach(el => el.remove());
    // Restore overrides and re-apply
    overrides = saved;
    applyStyleOverrides();
    renderAddedElements(true);
    deselect();
  };

  window.__edSave = async function() {
    const btn = document.getElementById('eb-save-btn');
    if (btn) { btn.textContent='Saving…'; btn.disabled=true; }
    // Sync text-block innerHTML
    (overrides._added||[]).forEach(item => { if (item.type==='text') { const el=document.getElementById(item.id); if (el) item.content=el.innerHTML; } });
    // Record design width so public view can zoom to match this exact layout
    overrides._designW = Math.round(window.innerWidth);
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
  function extractYTId(url) {
    // Covers watch?v=, youtu.be/, embed/, and /shorts/
    const m = (url||'').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // Returns { embedUrl, type } for YouTube, Vimeo, and Google Drive share links
  function extractVideoEmbed(url) {
    if (!url) return null;
    // YouTube
    const ytId = extractYTId(url);
    if (ytId) return { embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`, type: 'youtube' };
    // Vimeo: vimeo.com/123456789 or vimeo.com/channels/xxx/123456789
    const vmM = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
    if (vmM) return { embedUrl: `https://player.vimeo.com/video/${vmM[1]}?dnt=1`, type: 'vimeo' };
    // Google Drive: /file/d/FILE_ID/view  →  /file/d/FILE_ID/preview
    const gdM = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdM) return { embedUrl: `https://drive.google.com/file/d/${gdM[1]}/preview`, type: 'gdrive' };
    return null;
  }

  // ── PROJECTS PANEL ────────────────────────────────────────────────────────
  let _prjData = [];

  async function _prjFetch(path, opts = {}) {
    const headers = { 'apikey': SB_KEY, 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const r = await fetch(SB_URL + path, { ...opts, headers });
    if (r.status === 204 || r.status === 201) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  async function _prjLoad() {
    try {
      _prjData = await _prjFetch('/rest/v1/projects?order=sort_order.asc,id.asc&select=*') || [];
      _prjRender();
    } catch(e) { _prjMsg('Error loading projects', true); }
  }

  function _prjRender() {
    const list = document.getElementById('prj-list');
    if (!list) return;
    if (!_prjData.length) {
      list.innerHTML = `<div style="text-align:center;padding:48px;color:rgba(255,255,255,0.35);font-size:11px;letter-spacing:0.2em;">No projects yet — click + Add Project</div>`;
      return;
    }
    list.innerHTML = _prjData.map((p, i) => `
      <div style="border-bottom:1px solid #eee">
        <div style="display:flex;align-items:center;gap:10px;padding:11px 0;cursor:pointer" onclick="__prjToggle(${p.id})">
          <span style="color:#ccc;font-size:18px;padding:0 2px">⠿</span>
          <span style="width:18px;text-align:center;color:#aaa;font-size:10px;flex-shrink:0">${i+1}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:#111;letter-spacing:0.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.title||'Untitled'}</div>
            <div style="font-size:9px;color:#aaa;letter-spacing:0.15em;text-transform:uppercase;margin-top:2px">${[p.subtitle,p.card_type].filter(Boolean).join(' · ')}</div>
          </div>
          <span style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;padding:3px 9px;border-radius:3px;flex-shrink:0;background:${p.active?'rgba(40,160,40,0.1)':'rgba(0,0,0,0.04)'};color:${p.active?'#2a9a2a':'#aaa'};border:1px solid ${p.active?'rgba(40,160,40,0.3)':'#ddd'}">${p.active?'Visible':'Hidden'}</span>
          <span id="prj-arr-${p.id}" style="color:#bbb;font-size:11px;transition:transform 0.18s;flex-shrink:0">▼</span>
        </div>
        <div id="prj-body-${p.id}" style="display:none;padding-bottom:16px">${_prjForm(p)}</div>
      </div>`).join('');
  }

  function _prjInputSt() {
    return 'width:100%;box-sizing:border-box;background:#fff;border:1px solid #ddd;color:#111;border-radius:4px;padding:7px 10px;font-family:Josefin Sans,sans-serif;font-size:11px;letter-spacing:0.04em;';
  }

  function _prjForm(p) {
    const pid = p.id || 'new';
    let extraRows = '';
    let extras = [];
    if (p.extra_media) {
      try { extras = JSON.parse(p.extra_media); } catch(e) { extras = []; }
    }
    if (!extras.length) extras = [{ url: '' }];
    extras.forEach((item, idx) => {
      extraRows += `<div style="display:flex;gap:6px;margin-bottom:6px">
        <input id="prj-em-${pid}-${idx}" value="${item.url||''}" placeholder="YouTube / Instagram URL or image URL…" style="${_prjInputSt()}flex:1">
        <button onclick="this.closest('[data-em]').remove()" style="background:rgba(200,60,60,0.1);border:1px solid rgba(200,60,60,0.3);color:rgba(255,140,140,0.8);border-radius:3px;padding:0 8px;cursor:pointer;font-size:13px;flex-shrink:0">−</button>
      </div>`;
    });
    const lbl = 'font-size:9px;color:#999;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px';
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div style="${lbl}">Project Name *</div>
          <input id="prj-title-${pid}" value="${p.title||''}" style="${_prjInputSt()}">
        </div>
        <div>
          <div style="${lbl}">Category</div>
          <input id="prj-sub-${pid}" value="${p.subtitle||''}" placeholder="Short Film, Visuals…" style="${_prjInputSt()}">
        </div>
        <div style="grid-column:span 2">
          <div style="${lbl}">Short Description</div>
          <input id="prj-desc-${pid}" value="${p.description||''}" placeholder="One line shown on the card" style="${_prjInputSt()}">
        </div>
        <div>
          <div style="${lbl}">Content Type</div>
          <select id="prj-type-${pid}" style="${_prjInputSt()}">
            <option value="visuals" ${(p.card_type||'')==='visuals'?'selected':''}>Images / Visuals</option>
            <option value="youtube" ${(p.card_type||'')==='youtube'?'selected':''}>YouTube Video</option>
            <option value="instagram" ${(p.card_type||'')==='instagram'?'selected':''}>Instagram Reel</option>
          </select>
        </div>
        <div>
          <div style="${lbl}">Page Layout</div>
          <select id="prj-tpl-${pid}" style="${_prjInputSt()}">
            <option value="slideshow" ${(!p.page_template||p.page_template==='slideshow')?'selected':''}>Slideshow</option>
            <option value="editorial" ${p.page_template==='editorial'?'selected':''}>Editorial</option>
            <option value="collage" ${p.page_template==='collage'?'selected':''}>Collage</option>
          </select>
        </div>
        <div style="grid-column:span 2">
          <div style="${lbl}">Main Video Link <span style="color:#bbb;font-weight:300">(YouTube or Instagram URL)</span></div>
          <input id="prj-media-${pid}" value="${p.media_id||''}" placeholder="Paste full YouTube or Instagram URL…" style="${_prjInputSt()}">
        </div>
        <div style="grid-column:span 2">
          <div style="${lbl};margin-bottom:6px">Slideshow Media <span style="color:#bbb;font-weight:300">(all videos &amp; images in the carousel)</span></div>
          <div id="prj-em-list-${pid}">${extras.map((item,idx)=>`<div data-em style="display:flex;gap:6px;margin-bottom:6px"><input id="prj-em-${pid}-${idx}" value="${item.url||''}" placeholder="YouTube / Instagram / image URL…" style="${_prjInputSt()}flex:1"><button onclick="this.closest('[data-em]').remove()" style="background:#fff0f0;border:1px solid #fcc;color:#c44;border-radius:3px;padding:0 8px;cursor:pointer;font-size:13px;flex-shrink:0">−</button></div>`).join('')}</div>
          <button onclick="__prjAddEmRow('${pid}')" style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;padding:5px 12px;border-radius:3px;cursor:pointer;background:#f5f5f5;border:1px solid #ddd;color:#666">+ Add Media</button>
        </div>
        <div style="grid-column:span 2">
          <div style="${lbl}">Preview Image</div>
          <input id="prj-thumb-${pid}" value="${p.thumbnail_url||''}" placeholder="Paste image URL…" oninput="__prjThumbPrev('${pid}')" style="${_prjInputSt()}margin-bottom:6px">
          <div id="prj-drop-${pid}" ondragover="event.preventDefault();this.style.borderColor='#4285f4'" ondragleave="this.style.borderColor='#ddd'" ondrop="__prjThumbDrop(event,'${pid}')" style="border:2px dashed #ddd;border-radius:6px;padding:14px;text-align:center;font-size:9px;letter-spacing:0.15em;color:#bbb;cursor:pointer;transition:border-color 0.15s;position:relative" onclick="document.getElementById('prj-drop-file-${pid}').click()">
            Drop image here or click to browse
            <input type="file" id="prj-drop-file-${pid}" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer" onchange="__prjThumbDrop({dataTransfer:{files:this.files}},'${pid}')">
          </div>
          <img id="prj-prev-${pid}" src="${p.thumbnail_url||''}" style="margin-top:8px;max-height:90px;max-width:180px;object-fit:cover;border-radius:4px;display:${p.thumbnail_url?'block':'none'}">
        </div>
        <div>
          <div style="${lbl}">Sort Order</div>
          <input type="number" id="prj-sort-${pid}" value="${p.sort_order??0}" style="${_prjInputSt()}width:80px">
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding-top:18px">
          <input type="checkbox" id="prj-active-${pid}" ${p.active!==false?'checked':''} style="width:15px;height:15px;cursor:pointer;accent-color:#4285f4">
          <span style="font-size:11px;color:#555">Show on site</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        ${p.id?`<button onclick="__prjDelete(${p.id})" style="padding:8px 18px;border-radius:4px;cursor:pointer;border:1px solid #fcc;background:#fff0f0;color:#c44;font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.12em;text-transform:uppercase">Delete</button>`:''}
        <button onclick="${p.id?`__prjSave(${p.id})`:'__prjCreate()'}" style="padding:8px 22px;border-radius:4px;cursor:pointer;border:none;background:#4285f4;color:#fff;font-family:Josefin Sans,sans-serif;font-size:9px;letter-spacing:0.12em;text-transform:uppercase">${p.id?'Save Project':'Add Project'}</button>
      </div>`;
  }

  function _prjCollect(pid) {
    const v = id => (document.getElementById(id)?.value || '').trim();
    const emList = document.getElementById('prj-em-list-' + pid);
    const extraUrls = emList ? [...emList.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean) : [];
    return {
      title:          v('prj-title-' + pid),
      subtitle:       v('prj-sub-' + pid),
      description:    v('prj-desc-' + pid),
      card_type:      v('prj-type-' + pid),
      page_template:  v('prj-tpl-' + pid) || 'slideshow',
      media_id:       v('prj-media-' + pid),
      extra_media:    extraUrls.length ? JSON.stringify(extraUrls.map(url => ({ url }))) : null,
      thumbnail_url:  v('prj-thumb-' + pid),
      sort_order:     parseInt(v('prj-sort-' + pid)) || 0,
      active:         document.getElementById('prj-active-' + pid)?.checked ?? true,
    };
  }

  function _prjMsg(text, isErr) {
    const el = document.getElementById('prj-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = isErr ? '#c00' : '#2a9a2a';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  window.__prjToggle = function(id) {
    const body = document.getElementById('prj-body-' + id);
    const arr  = document.getElementById('prj-arr-' + id);
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (arr) arr.style.transform = open ? '' : 'rotate(180deg)';
  };

  window.__prjThumbPrev = function(pid) {
    const url  = document.getElementById('prj-thumb-' + pid)?.value || '';
    const prev = document.getElementById('prj-prev-' + pid);
    if (prev) { prev.src = url; prev.style.display = url ? 'block' : 'none'; }
  };

  window.__prjThumbDrop = function(e, pid) {
    e.preventDefault?.();
    const file = (e.dataTransfer || e).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const dropEl = document.getElementById('prj-drop-' + pid);
    if (dropEl) { dropEl.style.borderColor = '#ddd'; dropEl.textContent = 'Resizing…'; }
    // Resize to max 800px and convert to base64
    const reader = new FileReader();
    reader.onload = function(ev) {
      const img = new Image();
      img.onload = function() {
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.85);
        const inp = document.getElementById('prj-thumb-' + pid);
        const prev = document.getElementById('prj-prev-' + pid);
        if (inp) inp.value = b64;
        if (prev) { prev.src = b64; prev.style.display = 'block'; }
        if (dropEl) dropEl.textContent = 'Drop image here or click to browse';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  window.__prjAddEmRow = function(pid) {
    const list = document.getElementById('prj-em-list-' + pid);
    if (!list) return;
    const st = _prjInputSt();
    const row = document.createElement('div');
    row.setAttribute('data-em', '');
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
    row.innerHTML = `<input placeholder="YouTube / Instagram / image URL…" style="${st}flex:1"><button onclick="this.closest('[data-em]').remove()" style="background:rgba(200,60,60,0.1);border:1px solid rgba(200,60,60,0.3);color:rgba(255,140,140,0.8);border-radius:3px;padding:0 8px;cursor:pointer;font-size:13px;flex-shrink:0">−</button>`;
    list.appendChild(row);
  };

  window.__prjSave = async function(id) {
    const body = _prjCollect(id);
    if (!body.title) { _prjMsg('Project needs a name', true); return; }
    try {
      await _prjFetch(`/rest/v1/projects?id=eq.${id}`, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(body) });
      await _prjLoad();
      _prjReloadSite();
      _prjMsg('Saved!');
      setTimeout(() => window.__prjToggle(id), 100); // reopen after re-render
    } catch(e) { _prjMsg('Error saving', true); }
  };

  window.__prjCreate = async function() {
    const body = { ..._prjCollect('new'), sort_order: _prjData.length };
    if (!body.title) { _prjMsg('Project needs a name', true); return; }
    try {
      await _prjFetch('/rest/v1/projects', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(body) });
      document.getElementById('prj-new-wrap').style.display = 'none';
      await _prjLoad();
      _prjReloadSite();
      _prjMsg('Project added!');
    } catch(e) { _prjMsg('Error adding project', true); }
  };

  window.__prjDelete = async function(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await _prjFetch(`/rest/v1/projects?id=eq.${id}`, { method: 'DELETE' });
      await _prjLoad();
      _prjReloadSite();
      _prjMsg('Project deleted');
    } catch(e) { _prjMsg('Error deleting', true); }
  };

  function _prjReloadSite() {
    if (typeof window.__appReloadProjects === 'function') window.__appReloadProjects();
  }

  window.__edShowProjects = async function() {
    let modal = document.getElementById('prj-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'prj-modal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:999997;background:rgba(240,240,238,0.97);overflow-y:auto;';
      modal.innerHTML = `
        <div style="max-width:700px;margin:0 auto;padding:28px 20px 80px;font-family:Josefin Sans,sans-serif;color:#111;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid #ddd">
            <span style="font-size:11px;letter-spacing:0.35em;text-transform:uppercase;color:#111">Projects</span>
            <div style="display:flex;align-items:center;gap:14px">
              <span id="prj-msg" style="display:none;font-size:10px;letter-spacing:0.08em"></span>
              <button onclick="document.getElementById('prj-new-wrap').style.display=document.getElementById('prj-new-wrap').style.display==='none'?'block':'none'" style="padding:7px 18px;border-radius:4px;cursor:pointer;border:1px solid #4285f4;background:#4285f4;color:#fff;font-family:inherit;font-size:9px;letter-spacing:0.15em;text-transform:uppercase">+ Add Project</button>
              <button onclick="document.getElementById('prj-modal').style.display='none'" style="background:none;border:none;color:#999;font-size:22px;cursor:pointer;line-height:1;padding:0 4px">✕</button>
            </div>
          </div>
          <div id="prj-new-wrap" style="display:none;background:#fff;border:1px solid #d0e0ff;border-radius:6px;padding:18px;margin-bottom:22px">
            <div style="font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:#4285f4;margin-bottom:14px">New Project</div>
            ${_prjForm({})}
          </div>
          <div id="prj-list"></div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    await _prjLoad();
  };

  // ── BOOT ──────────────────────────────────────────────────────────────────
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
