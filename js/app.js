// ─────────────────────────────────────────────────────────────────────────────
// STATIC PROJECT DATA (fallback when Supabase is unavailable)
// Replace placeholder IDs with real YouTube video IDs or Instagram shortcodes.
// YouTube ID  = the part after ?v= in the video URL
// Instagram   = the shortcode after /p/ or /reel/ in the post URL
// ─────────────────────────────────────────────────────────────────────────────
const staticProjects = {
  aetherbound: {
    name: 'The Aetherbound',
    items: [
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'The Aetherbound', sub: 'Key Visuals — Main Trailer' },
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'The Aetherbound', sub: 'Key Visuals — Behind the Scenes' },
    ]
  },
  xavier: {
    name: 'Xavier Mayne',
    items: [
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'Xavier Mayne', sub: 'Selling Posters on Tour' },
      { type: 'instagram', id: 'ABC123shortcode', title: 'Xavier Mayne', sub: 'Instagram Reel' },
    ]
  },
  loba: {
    name: 'Loba',
    items: [
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'Loba', sub: 'Short Film Trailer' },
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: "I'll Fight Till I'm Nothing", sub: 'Full Film' },
      { type: 'instagram', id: 'ABC123shortcode', title: 'Loba', sub: 'Behind the Scenes' },
    ]
  },
  keanler: {
    name: 'Keanler',
    items: [
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'Keanler — At Night They Hunt', sub: 'Music Video' },
      { type: 'instagram', id: 'ABC123shortcode', title: 'Keanler', sub: 'Visuals Reel' },
    ]
  },
  aether1: {
    name: 'Aether.1',
    items: [
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'Aether.1', sub: 'Visuals' },
      { type: 'instagram', id: 'ABC123shortcode', title: 'Aether.1', sub: 'Reel' },
    ]
  },
  benchiki: {
    name: 'Benchiki',
    items: [
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'Benchiki', sub: 'Visual Project 1' },
      { type: 'youtube', id: 'dQw4w9WgXcQ', title: 'Benchiki', sub: 'Visual Project 2' },
      { type: 'instagram', id: 'ABC123shortcode', title: 'Benchiki', sub: 'Instagram Reel' },
    ]
  }
};

// Holds the Supabase projects so onclick handlers can reference by index
let _dynamicProjects = [];

// ── Static thumbnail map (for sidebar preview before Supabase loads) ──
const staticThumbs = {
  xavier: 'img/xavier-thumb.png',
  loba: 'img/loba-thumb.png',
  benchiki: 'img/benchiki-thumb.png',
};

// ── Sidebar state ──
let _sidebarProjects = [];
let _activeCanvasIdx = -1;
let _canvasHoverTimer = null;
let _tplActiveSidebarIdx = -1;

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTBOX
// ─────────────────────────────────────────────────────────────────────────────
let currentProject = null;
let currentIndex = 0;

// Accepts either a string key ('aetherbound') for static cards,
// or a Supabase project object for dynamically loaded cards.
function openLightbox(input) {
  if (typeof input === 'string') {
    const proj = staticProjects[input];
    if (!proj) return;
    currentProject = { name: proj.name, items: proj.items };
  } else {
    currentProject = { name: input.title || '', items: buildSupabaseItems(input) };
  }
  if (!currentProject.items.length) {
    currentProject.items = [{ type: 'empty', title: currentProject.name }];
  }
  currentIndex = 0;
  document.getElementById('lb-title').textContent = currentProject.name;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  buildThumbs();
  renderItem(0);
}

function extractMediaId(url) {
  if (!url) return '';
  url = url.trim();
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return url;
}

function detectMediaType(url) {
  if (!url) return 'image';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  return 'image';
}

function buildSupabaseItems(p) {
  const items = [];
  const seen = new Set(); // deduplicate across primary + extra_media
  const title = p.title || '';
  const sub = p.subtitle || '';

  if (p.card_type === 'youtube' && p.media_id) {
    const id = extractMediaId(p.media_id);
    const thumb = p.thumbnail_url || `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    items.push({ type: 'youtube', id, title, sub, thumbnail: thumb });
    seen.add(id);
  } else if (p.card_type === 'instagram' && p.media_id) {
    const id = extractMediaId(p.media_id);
    items.push({ type: 'instagram', id, title, sub, thumbnail: p.thumbnail_url || '' });
    seen.add(id);
  } else if (p.thumbnail_url) {
    items.push({ type: 'image', id: p.thumbnail_url, title, sub, thumbnail: p.thumbnail_url });
    seen.add(p.thumbnail_url);
  }

  // Parse extra_media — JSON array [{url, thumb}] or legacy newline text
  if (p.extra_media) {
    let extraItems = [];
    try {
      extraItems = JSON.parse(p.extra_media);
    } catch(e) {
      extraItems = p.extra_media.split('\n').filter(Boolean).map(u => ({ url: u.trim(), thumb: '' }));
    }
    extraItems.forEach(item => {
      const url = item.url || '';
      if (!url) return;
      const type = detectMediaType(url);
      const id = (type === 'youtube' || type === 'instagram') ? extractMediaId(url) : url;
      if (seen.has(id)) return; // skip duplicate
      seen.add(id);
      const thumbnail = item.thumb || (type === 'image' ? url : '');
      items.push({ type, id, title, sub: '', thumbnail });
    });
  }

  return items;
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('lb-media-wrap').innerHTML = '';
}

function navigate(dir) {
  const newIndex = currentIndex + dir;
  if (newIndex < 0 || newIndex >= currentProject.items.length) return;
  currentIndex = newIndex;
  renderItem(currentIndex);
}

function buildThumbs() {
  const strip = document.getElementById('lb-thumbstrip');
  strip.innerHTML = '';
  currentProject.items.forEach((item, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'lb-thumb';
    thumb.dataset.index = i;
    if (item.type === 'youtube') {
      thumb.innerHTML = '<svg width="14" height="10" viewBox="0 0 14 10" fill="rgba(255,255,255,0.5)"><polygon points="5,0 14,5 5,10"/></svg>';
    } else if (item.type === 'instagram') {
      thumb.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="rgba(255,255,255,0.5)" stroke="none"/></svg>';
    } else if (item.type === 'image' && item.id) {
      thumb.innerHTML = `<img src="${item.id}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    } else {
      thumb.innerHTML = '&#9635;';
    }
    thumb.onclick = () => { currentIndex = i; renderItem(i); };
    strip.appendChild(thumb);
  });
  updateThumbs();
}

function updateThumbs() {
  document.querySelectorAll('.lb-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === currentIndex);
  });
}

function renderItem(index) {
  const item = currentProject.items[index];
  const wrap = document.getElementById('lb-media-wrap');
  wrap.innerHTML = '';

  document.getElementById('lb-counter').textContent = (index + 1) + ' / ' + currentProject.items.length;
  document.getElementById('lb-cap-title').textContent = item.title || '';
  document.getElementById('lb-cap-sub').textContent = item.sub || '';
  document.getElementById('lb-prev').classList.toggle('hidden', index === 0);
  document.getElementById('lb-next').classList.toggle('hidden', index === currentProject.items.length - 1);
  updateThumbs();

  if (item.type === 'youtube') {
    const div = document.createElement('div');
    div.className = 'lb-iframe-wrap';
    div.innerHTML = `<iframe src="https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    wrap.appendChild(div);

  } else if (item.type === 'instagram') {
    const igUrl = `https://www.instagram.com/reel/${item.id}/`;
    const thumb = item.thumbnail || '';
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; align-items:center; justify-content:center; width:100%; height:100%;';
    if (thumb) {
      div.innerHTML = `
        <div style="position:relative; width:min(340px, 80vw); aspect-ratio:9/16; max-height:75vh;
                    background:#0a0a0a; border-radius:8px; overflow:hidden;">
          <img src="${thumb}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" />
          <div style="position:absolute; inset:0; background:rgba(0,0,0,0.35);
                      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px;">
            <div onclick="window.open('${igUrl}','_blank','noopener noreferrer')"
                 style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:14px;">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <circle cx="30" cy="30" r="29" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>
                <polygon points="24,18 44,30 24,42" fill="rgba(255,255,255,0.95)"/>
              </svg>
              <span style="font-family:'Josefin Sans',sans-serif; font-size:9px; letter-spacing:0.28em;
                           text-transform:uppercase; color:rgba(255,255,255,0.8);">Watch on Instagram</span>
            </div>
          </div>
        </div>`;
    } else {
      div.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px;
                    padding:40px 32px; background:rgba(255,255,255,0.06); border-radius:12px;
                    border:1px solid rgba(255,255,255,0.12); max-width:300px; text-align:center;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="20" rx="5"/>
            <circle cx="12" cy="12" r="5"/>
            <circle cx="17.5" cy="6.5" r="1" fill="rgba(255,255,255,0.7)" stroke="none"/>
          </svg>
          <div>
            <p style="font-family:'Josefin Sans',sans-serif; font-size:10px; letter-spacing:0.25em;
                      text-transform:uppercase; color:rgba(255,255,255,0.5); margin-bottom:8px;">Instagram Reel</p>
            <p style="font-family:'Josefin Sans',sans-serif; font-size:9px; letter-spacing:0.15em;
                      text-transform:uppercase; color:rgba(255,255,255,0.3);">No preview image set</p>
          </div>
          <button onclick="window.open('${igUrl}','_blank','noopener noreferrer')"
                  style="font-family:'Josefin Sans',sans-serif; font-size:9px; letter-spacing:0.25em;
                         text-transform:uppercase; color:#fff; background:none;
                         border:1px solid rgba(255,255,255,0.5); padding:12px 28px;
                         border-radius:4px; cursor:pointer;">
            Open on Instagram
          </button>
        </div>`;
    }
    wrap.appendChild(div);

  } else if (item.type === 'image') {
    const div = document.createElement('div');
    div.className = 'lb-image-wrap';
    div.innerHTML = `<img src="${item.id}" alt="${item.title}" />`;
    wrap.appendChild(div);
  } else if (item.type === 'empty') {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;';
    div.innerHTML = `<p style="font-family:'Josefin Sans',sans-serif;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,255,255,0.35);">No media added yet</p>`;
    wrap.appendChild(div);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────
async function sbFetch(path) {
  const res = await fetch(SUPABASE_URL + path, {
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) return null;
  return res.json();
}

async function loadFromSupabase() {
  try {
    // Load and apply settings
    const settingsRows = await sbFetch('/rest/v1/settings?select=*');
    if (settingsRows && settingsRows.length > 0) {
      const s = {};
      settingsRows.forEach(r => s[r.key] = r.value);
      applySettings(s);
    }

    // Load and render active projects
    const projects = await sbFetch('/rest/v1/projects?active=eq.true&order=sort_order.asc,id.asc&select=*');
    if (projects && projects.length > 0) {
      renderProjectCards(projects);
    }
  } catch (e) {
    console.log('Supabase load error — using static content:', e);
  }
}

function applySettings(s) {
  if (s.tagline) {
    const el = document.querySelector('.hero-tagline');
    if (el) el.innerHTML = s.tagline.replace(/\n/g, '<br>');
  }
  if (s.email) {
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      a.href = 'mailto:' + s.email;
      if (a.closest('#contact-popup')) a.textContent = s.email;
    });
  }
  if (s.phone) {
    const el = document.querySelector('#contact-popup a[href^="tel:"]');
    if (el) { el.href = 'tel:' + s.phone.replace(/\s/g, ''); el.textContent = s.phone; }
  }
  if (s.instagram) {
    document.querySelectorAll('a[href*="instagram.com"]').forEach(a => a.href = s.instagram);
  }
  if (s.linkedin) {
    document.querySelectorAll('a[href*="linkedin.com"]').forEach(a => a.href = s.linkedin);
  }
  if (s.background_image_url) {
    const el = document.querySelector('.hero-bg');
    if (el) el.src = s.background_image_url;
  }
  if (s.color_background) {
    document.documentElement.style.setProperty('--bg', s.color_background);
    document.body.style.background = s.color_background;
  }
  if (s.color_nav_bar) {
    document.querySelectorAll('nav').forEach(el => el.style.background = s.color_nav_bar);
  }
  if (s.color_text_dark) {
    document.documentElement.style.setProperty('--dark', s.color_text_dark);
  }
  if (s.color_card_bg) {
    document.querySelectorAll('.card').forEach(el => el.style.background = s.color_card_bg);
  }
  if (s.font_family) {
    document.body.style.fontFamily = s.font_family + ', sans-serif';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORK OVERLAY — sidebar + canvas
// ─────────────────────────────────────────────────────────────────────────────
function renderProjectCards(projects) {
  renderWorkOverlay(projects);
}

function renderWorkOverlay(projects) {
  _dynamicProjects = projects;
  _sidebarProjects = projects.map(p => ({ name: p.title || 'Untitled', data: p, key: null }));
  _buildWorkSidebar();
  if (_sidebarProjects.length > 0) _showCanvas(0, true);
}

function _buildStaticWorkSidebar() {
  if (_sidebarProjects.length > 0) return;
  _sidebarProjects = Object.keys(staticProjects).map(key => ({
    name: staticProjects[key].name, data: null, key
  }));
  _buildWorkSidebar();
  if (_sidebarProjects.length > 0) _showCanvas(0, true);
}

function _buildWorkSidebar() {
  const list = document.getElementById('wo-list');
  if (!list) return;
  list.innerHTML = _sidebarProjects.map((proj, i) => `
    <div class="wo-proj-item${i === 0 ? ' active' : ''}"
         onmouseenter="_scheduleCanvas(${i})"
         onclick="openProjectByTemplate(${i})">
      ${proj.name}
    </div>
  `).join('');
}

function _scheduleCanvas(i) {
  clearTimeout(_canvasHoverTimer);
  _canvasHoverTimer = setTimeout(() => _showCanvas(i, false), 90);
}

function _showCanvas(i, immediate) {
  if (i === _activeCanvasIdx && !immediate) return;
  _activeCanvasIdx = i;

  document.querySelectorAll('.wo-proj-item').forEach((el, idx) =>
    el.classList.toggle('active', idx === i));

  const canvas = document.getElementById('wo-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';

  const proj = _sidebarProjects[i];
  if (!proj) return;

  const ytId = proj.data?.card_type === 'youtube' && proj.data?.media_id
    ? extractMediaId(proj.data.media_id) : '';
  const thumb = proj.data?.thumbnail_url ||
    (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : '') ||
    (proj.key ? (staticThumbs[proj.key] || '') : '');

  if (thumb) {
    const img = document.createElement('img');
    img.className = 'wo-canvas-img';
    img.src = thumb;
    const pos = proj.data?.object_position || 'center';
    img.style.objectPosition = pos;
    img.onload = function() {
      if (this.naturalWidth && this.naturalHeight) {
        canvas.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
      }
    };
    canvas.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'wo-canvas-placeholder';
    ph.textContent = proj.name;
    canvas.appendChild(ph);
  }
}

function openProjectByTemplate(i) {
  _tplActiveSidebarIdx = i;
  const proj = _sidebarProjects[i];
  if (!proj) return;

  if (!proj.data) {
    openLightbox(proj.key);
    return;
  }

  const tpl = proj.data.page_template || 'slideshow';
  if (tpl === 'editorial') _openEditorialTemplate(proj.data);
  else if (tpl === 'collage') _openCollageTemplate(proj.data);
  else openLightbox(proj.data);
}

function openLightboxFromActiveTpl() {
  closeTplOverlay();
  const proj = _sidebarProjects[_tplActiveSidebarIdx];
  if (!proj) return;
  if (proj.key) openLightbox(proj.key);
  else openLightbox(proj.data);
}

function closeTplOverlay() {
  const ov = document.getElementById('tpl-overlay');
  if (!ov) return;
  ov.classList.remove('open');
  ov.innerHTML = '';
  document.body.style.overflow = '';
}

function _openEditorialTemplate(p) {
  const items = buildSupabaseItems(p);
  const ov = document.getElementById('tpl-overlay');
  const mainImg = p.thumbnail_url || items[0]?.thumbnail || '';
  const hasAction = items.some(it => it.type === 'youtube' || it.type === 'instagram') || items.length > 1;

  ov.innerHTML = `
    <div class="tpl-editorial">
      <button class="tpl-close" onclick="closeTplOverlay()" style="color:rgba(255,255,255,0.5)">✕</button>
      ${mainImg ? `<div class="tpl-ed-image"><img src="${mainImg}" /></div>` : ''}
      <div class="tpl-ed-text">
        ${p.subtitle ? `<p class="tpl-ed-eyebrow">${p.subtitle}</p>` : ''}
        <h2 class="tpl-ed-title">${p.title || ''}</h2>
        ${p.description ? `<p class="tpl-ed-desc">${p.description}</p>` : ''}
        ${hasAction ? `<button class="tpl-ed-action" onclick="openLightboxFromActiveTpl()">Open Project →</button>` : ''}
      </div>
    </div>`;

  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _openCollageTemplate(p) {
  const ov = document.getElementById('tpl-overlay');

  // Read items directly from extra_media so we get saved x/y/w/h positions
  let collageItems = [];
  if (p.extra_media) {
    try { collageItems = JSON.parse(p.extra_media); } catch(e) {}
  }

  // Fallback positions (straight, no rotation) if no saved layout
  const scatter = [
    {x:6,  y:12, w:34, h:44},
    {x:45, y:5,  w:30, h:42},
    {x:64, y:38, w:28, h:40},
    {x:10, y:54, w:32, h:42},
    {x:46, y:54, w:26, h:38},
    {x:72, y:20, w:22, h:34},
  ];

  const blocks = collageItems.filter(it => it.url || it.thumb).map((it, i) => {
    const thumb = it.thumb || it.url;
    if (!thumb) return '';
    const pos = scatter[i] || {x:5+(i*12)%60, y:5+(i*10)%50, w:28, h:36};
    const x = it.x ?? pos.x, y = it.y ?? pos.y, w = it.w ?? pos.w, h = it.h ?? pos.h;
    return `<div class="tpl-collage-item"
         style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"
         onclick="openLightboxFromActiveTpl()">
        <img src="${thumb}" alt="" />
      </div>`;
  }).join('');

  ov.innerHTML = `
    <div class="tpl-collage">
      <button class="tpl-close" onclick="closeTplOverlay()" style="color:rgba(0,0,0,0.38)">✕</button>
      <div class="tpl-collage-bg-title">${p.title || ''}</div>
      ${blocks}
    </div>`;

  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL REVEAL
// ─────────────────────────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 70);
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

// ─────────────────────────────────────────────────────────────────────────────
// GRAIN CANVAS
// ─────────────────────────────────────────────────────────────────────────────
function initGrain() {
  const canvas = document.getElementById('grain-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function drawGrain() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 255;
      data[i] = noise; data[i + 1] = noise; data[i + 2] = noise; data[i + 3] = 18;
    }
    ctx.putImageData(imageData, 0, 0);
    setTimeout(() => requestAnimationFrame(drawGrain), 80);
  }
  drawGrain();
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
function scrollToProjects() {
  document.getElementById('projects-flow').scrollIntoView({ behavior: 'smooth' });
}

function scrollToHero(e) {
  if (e) e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeNavMenu() {
  const btn = document.getElementById('nav-hamburger');
  const dd  = document.getElementById('nav-dropdown');
  if (btn) btn.classList.remove('open');
  if (dd)  dd.classList.remove('open');
}

function toggleNavMenu(e) {
  if (e) e.stopPropagation();
  const btn = document.getElementById('nav-hamburger');
  const dd  = document.getElementById('nav-dropdown');
  if (!btn || !dd) return;
  const opening = !dd.classList.contains('open');
  btn.classList.toggle('open', opening);
  dd.classList.toggle('open', opening);
  if (opening) {
    setTimeout(() => document.addEventListener('click', _navOutsideClick, { once: true }), 0);
  }
}

function _navOutsideClick(e) {
  const dd = document.getElementById('nav-dropdown');
  const btn = document.getElementById('nav-hamburger');
  if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) closeNavMenu();
}

// kept as no-ops so any lingering references don't throw
function openWorkOverlay() { scrollToProjects(); }
function closeWorkOverlay() {}
function toggleWorkOverlay() { scrollToProjects(); }

// ─────────────────────────────────────────────────────────────────────────────
// POPUPS (About & Contact)
// ─────────────────────────────────────────────────────────────────────────────
function openPopup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('popup-closing');
  el.style.display = 'flex';
  void el.offsetHeight; // force reflow so animation triggers
  el.classList.add('popup-opening');
}

function closePopup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('popup-opening');
  el.classList.add('popup-closing');
  setTimeout(() => {
    el.classList.remove('popup-closing');
    el.style.display = 'none';
  }, 220);
}

function initPopups() {
  document.querySelectorAll('.about-trigger').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeNavMenu(); openPopup('about-popup'); });
  });
  document.querySelectorAll('.contact-trigger').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeNavMenu(); openPopup('contact-popup'); });
  });

  const aboutClose = document.querySelector('.about-close');
  if (aboutClose) aboutClose.addEventListener('click', e => { e.stopPropagation(); closePopup('about-popup'); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePopup('about-popup');
      closePopup('contact-popup');
      if (document.getElementById('lightbox').classList.contains('open')) closeLightbox();
      if (document.getElementById('tpl-overlay')?.classList.contains('open')) closeTplOverlay();
    }
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'ArrowLeft') navigate(-1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
async function loadSiteOverrides() {
  try {
    // Primary: load from settings table (where editor now saves)
    let ov = null;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.site_overrides&select=value`, {
      headers: { 'apikey': SUPABASE_KEY }
    });
    if (r.ok) {
      const rows = await r.json();
      if (rows && rows[0]?.value) ov = JSON.parse(rows[0].value);
    }
    // Fallback: old storage file
    if (!ov) {
      const r2 = await fetch(`${SUPABASE_URL}/storage/v1/object/public/media/site-overrides.json?t=${Date.now()}`);
      if (r2.ok) ov = await r2.json();
    }
    if (!ov) return;

    // Apply style overrides to existing elements
    Object.entries(ov).forEach(([key, styles]) => {
      if (key === '_added') return;
      if (key === '_bg') {
        if (styles.desktop) {
          const src = document.getElementById('hero-src-desktop');
          if (src) src.setAttribute('srcset', styles.desktop);
        }
        if (styles.mobile) {
          const img = document.getElementById('hero-src-mobile');
          if (img) img.src = styles.mobile;
        }
        return;
      }
      document.querySelectorAll(`[data-edit="${key}"]`).forEach(el => {
        Object.entries(styles).forEach(([p, v]) => {
          if (p === '_html') { el.innerHTML = v; return; }
          el.style[p] = v;
        });
      });
    });

    // Apply About popup content
    if (ov._about?.html) {
      const el = document.querySelector('.about-content');
      if (el) el.innerHTML = ov._about.html;
    }

    // Apply Contact popup details
    if (ov._contact) {
      if (ov._contact.email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
          a.href = 'mailto:' + ov._contact.email;
          if (a.closest('#contact-popup')) a.textContent = ov._contact.email;
        });
      }
      if (ov._contact.phone) {
        const ph = document.querySelector('#contact-popup a[href^="tel:"]');
        if (ph) { ph.href = 'tel:' + ov._contact.phone.replace(/\s/g,''); ph.textContent = ov._contact.phone; }
      }
    }

    // Render added elements (text/image/video blocks)
    const added = ov._added || [];
    added.forEach(renderAddedBlock);
    syncNavFromAddedButtons(added);
  } catch (_) {}
}

function syncNavFromAddedButtons(added) {
  const buttons = (added || []).filter(it => it.type === 'button');
  if (!buttons.length) return;
  const dd = document.getElementById('nav-dropdown');
  if (!dd) return;

  // Keep only the admin item from static HTML, replace everything else
  const adminItem = dd.querySelector('.nav-drop-admin');
  dd.innerHTML = '';

  buttons.forEach(item => {
    const span = document.createElement('span');
    span.className = 'nav-drop-item';
    span.textContent = item.label || '';

    const lt = item.linkType || '';
    const lv = item.linkValue || '';

    if (lt === 'nav-home') {
      span.addEventListener('click', () => { closeNavMenu(); scrollToHero({preventDefault:()=>{}}); });
    } else if (lt === 'nav-work') {
      span.addEventListener('click', () => { closeNavMenu(); scrollToProjects(); });
    } else if (lt === 'popup-contact') {
      span.classList.add('contact-trigger');
    } else if (lt === 'popup-about') {
      span.classList.add('about-trigger');
    } else if (lt === 'email') {
      span.addEventListener('click', () => { closeNavMenu(); window.location.href = 'mailto:' + lv; });
    } else if (lt === 'phone') {
      span.addEventListener('click', () => { closeNavMenu(); window.location.href = 'tel:' + lv; });
    } else if (lv) {
      span.addEventListener('click', () => { closeNavMenu(); window.open(lv, '_blank', 'noopener'); });
    }

    dd.appendChild(span);
  });

  // Re-attach admin item
  if (adminItem) dd.appendChild(adminItem);

  // Re-init popup triggers so newly added about/contact spans work
  document.querySelectorAll('#nav-dropdown .about-trigger').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeNavMenu(); openPopup('about-popup'); });
  });
  document.querySelectorAll('#nav-dropdown .contact-trigger').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeNavMenu(); openPopup('contact-popup'); });
  });
}

function renderAddedBlock(item) {
  if (!item?.id || document.getElementById(item.id)) return;
  const zone = document.querySelector('.hero');
  if (!zone) return;

  const el = document.createElement('div');
  el.id = item.id;
  el.classList.add('site-added-el');
  el.dataset.addedType = item.type;
  el.style.cssText = `position:absolute;left:${item.x ?? 25}%;top:${item.y ?? 30}%;z-index:${item.styles?.zIndex||10};`;

  if (item.type === 'text') {
    el.innerHTML = item.content || '';
    Object.assign(el.style, { fontFamily: "'Josefin Sans',sans-serif", fontSize: '20px', color: '#fff', fontWeight: '300', letterSpacing: '0.12em' });
  } else if (item.type === 'image' && item.src) {
    el.style.width  = item.styles?.width  || '220px';
    el.style.height = item.styles?.height || '160px';
    el.style.overflow = 'hidden';
    const img = document.createElement('img');
    img.src = item.src;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    el.appendChild(img);
  } else if (item.type === 'video' && item.src) {
    el.style.width  = item.styles?.width  || '400px';
    el.style.height = item.styles?.height || '225px';
    el.style.overflow = 'hidden';
    const ytId = (item.src.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/) || [])[1];
    if (ytId) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      el.appendChild(iframe);
    }
  } else if (item.type === 'box') {
    el.style.width  = item.styles?.width  || '220px';
    el.style.height = item.styles?.height || '160px';
    el.style.overflow = 'hidden';
    el.style.position = 'relative';
    el.style.backgroundColor = item.styles?.backgroundColor || 'rgba(30,30,30,0.55)';
    if (item.src && item.srcType === 'image') {
      const img = document.createElement('img');
      img.src = item.src;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;';
      el.appendChild(img);
    } else if (item.src && item.srcType === 'video') {
      const ytId = (item.src.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/) || [])[1];
      if (ytId) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${ytId}?rel=0`;
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;display:block;';
        el.appendChild(iframe);
      }
    }
  }

  if (item.type === 'button') {
    el.textContent = item.label || 'Button';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.style.display = 'inline-block';
    el.style.whiteSpace = 'nowrap';
    el.style.textTransform = 'uppercase';
    el.style.textDecoration = 'none';
    Object.assign(el.style, {
      fontFamily: item.styles?.fontFamily || "'Josefin Sans',sans-serif",
      fontSize:   item.styles?.fontSize   || '10px',
      color:      item.styles?.color      || '#000000',
      backgroundColor: item.styles?.backgroundColor || 'transparent',
      padding:    item.styles?.padding    || '6px 16px',
      borderRadius: item.styles?.borderRadius || '0px',
      letterSpacing: item.styles?.letterSpacing || '0.22em',
      fontWeight: item.styles?.fontWeight || '300',
      border:     item.styles?.border     || 'none',
    });
    el.addEventListener('click', () => {
      const v = item.linkValue || '';
      switch (item.linkType) {
        case 'nav-home':      scrollToHero && scrollToHero({preventDefault:()=>{}}); break;
        case 'nav-work':      scrollToProjects && scrollToProjects(); break;
        case 'popup-contact': openPopup && openPopup('contact-popup'); break;
        case 'popup-about':   openPopup && openPopup('about-popup'); break;
        case 'email':         window.location.href='mailto:'+v; break;
        case 'phone':         window.location.href='tel:'+v; break;
        default:              if(v) window.open(v,'_blank','noopener'); break;
      }
    });
  } else if (item.type === 'logo') {
    if (item.srcType === 'image' && item.src) {
      const img = document.createElement('img');
      img.src = item.src;
      img.style.cssText = `display:block;max-width:${item.styles?.width||'120px'};height:auto;`;
      el.appendChild(img);
    } else {
      el.textContent = item.content || 'Logo';
      el.style.textTransform = 'uppercase';
      el.style.userSelect = 'none';
      Object.assign(el.style, {
        fontFamily: item.styles?.fontFamily || "'Josefin Sans',sans-serif",
        fontSize:   item.styles?.fontSize   || '13px',
        color:      item.styles?.color      || '#000000',
        fontWeight: item.styles?.fontWeight || '300',
        letterSpacing: item.styles?.letterSpacing || '0.18em',
        whiteSpace: 'nowrap',
      });
    }
  }

  // Apply saved styles
  Object.entries(item.styles || {}).forEach(([p, v]) => { el.style[p] = v; });
  zone.appendChild(el);
}

document.addEventListener('DOMContentLoaded', () => {
  loadSiteOverrides();

  // Static reveal
  document.querySelectorAll('.reveal').forEach(r => revealObserver.observe(r));

  // Lightbox backdrop click
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
  });

  // Show static project titles immediately; Supabase will replace when loaded
  _buildStaticWorkSidebar();

  initGrain();
  initPopups();
  loadFromSupabase();
});
