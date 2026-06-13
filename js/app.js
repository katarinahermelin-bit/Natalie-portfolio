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
  if (!currentProject.items.length) return;
  currentIndex = 0;
  document.getElementById('lb-title').textContent = currentProject.name;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  buildThumbs();
  renderItem(0);
}

function buildSupabaseItems(p) {
  if (p.card_type === 'youtube' && p.media_id) {
    const thumb = p.thumbnail_url || `https://img.youtube.com/vi/${p.media_id}/maxresdefault.jpg`;
    return [{ type: 'youtube', id: p.media_id, title: p.title || '', sub: p.subtitle || '', thumbnail: thumb }];
  } else if (p.card_type === 'instagram' && p.media_id) {
    return [{ type: 'instagram', id: p.media_id, title: p.title || '', sub: p.subtitle || '', thumbnail: p.thumbnail_url || '' }];
  } else if (p.thumbnail_url) {
    return [{ type: 'image', id: p.thumbnail_url, title: p.title || '', sub: p.subtitle || '', thumbnail: p.thumbnail_url }];
  }
  return [];
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
    div.innerHTML = `
      <div style="position:relative; width:min(340px, 80vw); aspect-ratio:9/16; max-height:75vh;
                  background:#0a0a0a; border-radius:8px; overflow:hidden;">
        ${thumb ? `<img src="${thumb}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" />` : ''}
        <div style="position:absolute; inset:0; background:rgba(0,0,0,${thumb ? '0.38' : '0.6'});
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
    wrap.appendChild(div);

  } else if (item.type === 'image') {
    const div = document.createElement('div');
    div.className = 'lb-image-wrap';
    div.innerHTML = `<img src="${item.id}" alt="${item.title}" />`;
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
  if (s.about_text) {
    const el = document.querySelector('#about-popup .about-content');
    if (el) el.innerHTML = s.about_text.split('\n\n').map(p => `<p style="margin-bottom:16px;">${p}</p>`).join('');
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

function renderProjectCards(projects) {
  _dynamicProjects = projects;
  const projectsDiv = document.querySelector('#cards .projects');
  if (!projectsDiv) return;

  const colorClasses = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  projectsDiv.innerHTML = projects.map((p, i) => {
    // Auto-use YouTube thumbnail if no custom thumbnail set
    const autoThumb = p.thumbnail_url ||
      (p.card_type === 'youtube' && p.media_id
        ? `https://img.youtube.com/vi/${p.media_id}/maxresdefault.jpg`
        : '');
    const thumbHtml = autoThumb
      ? `<img class="card-thumb" src="${autoThumb}" alt="${p.title || ''}" />`
      : `<div class="card-thumb-placeholder ${colorClasses[i % 6]}"></div>`;
    return `
      <div class="card reveal" onclick="openLightbox(_dynamicProjects[${i}])">
        ${thumbHtml}
        <div class="card-overlay"></div>
        <div class="card-body">
          <h2 class="card-title">${p.title || ''}</h2>
          <p class="card-type">${p.subtitle || ''}${p.description ? '<br>' + p.description : ''}</p>
          <div class="card-rule"></div>
          <span class="card-link">${p.cta_label || 'View Project'}</span>
        </div>
      </div>
    `;
  }).join('');

  // Wire up scroll reveal on the newly injected cards
  document.querySelectorAll('#cards .reveal:not(.visible)').forEach(el => revealObserver.observe(el));
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
function toggleNavMenu(e) {
  e.stopPropagation();
  document.getElementById('nav-hamburger').classList.toggle('open');
  document.getElementById('nav-dropdown').classList.toggle('open');
}

function closeNavMenu() {
  document.getElementById('nav-hamburger').classList.remove('open');
  document.getElementById('nav-dropdown').classList.remove('open');
}

// ─────────────────────────────────────────────────────────────────────────────
// POPUPS (About & Contact)
// ─────────────────────────────────────────────────────────────────────────────
function initPopups() {
  const aboutPopup = document.getElementById('about-popup');
  const contactPopup = document.getElementById('contact-popup');

  document.querySelectorAll('.about-trigger').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeNavMenu(); if (aboutPopup) aboutPopup.style.display = 'flex'; });
  });
  document.querySelectorAll('.contact-trigger').forEach(t => {
    t.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeNavMenu(); if (contactPopup) contactPopup.style.display = 'flex'; });
  });

  const aboutClose = document.querySelector('.about-close');
  if (aboutClose) aboutClose.addEventListener('click', e => { e.stopPropagation(); aboutPopup.style.display = 'none'; });

  if (aboutPopup) aboutPopup.addEventListener('click', e => { if (e.target === aboutPopup) aboutPopup.style.display = 'none'; });
  if (contactPopup) contactPopup.addEventListener('click', e => { if (e.target === contactPopup) contactPopup.style.display = 'none'; });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (aboutPopup) aboutPopup.style.display = 'none';
      if (contactPopup) contactPopup.style.display = 'none';
      if (document.getElementById('lightbox').classList.contains('open')) closeLightbox();
    }
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'ArrowLeft') navigate(-1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Static reveal
  document.querySelectorAll('.reveal').forEach(r => revealObserver.observe(r));

  // Lightbox backdrop click
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
  });

  // Close nav dropdown when clicking anywhere outside it
  document.addEventListener('click', e => {
    if (!e.target.closest('#nav-hamburger') && !e.target.closest('#nav-dropdown')) {
      closeNavMenu();
    }
  });

  initGrain();
  initPopups();
  loadFromSupabase();
});
