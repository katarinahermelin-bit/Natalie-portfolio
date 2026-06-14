  // SUPABASE_URL and SUPABASE_KEY are loaded from js/config.js

  // ── IMAGE PAN CONTROL ──
  const panState = { active: false, containerId: null, inputId: null, lastX: 0, lastY: 0, posX: 50, posY: 50 };

  function startPan(e, containerId, inputId) {
    e.preventDefault();
    const input = document.getElementById(inputId);
    let posX = 50, posY = 50;
    if (input) {
      const m = input.value.match(/([\d.]+)%\s+([\d.]+)%/);
      if (m) { posX = parseFloat(m[1]); posY = parseFloat(m[2]); }
    }
    const touch = e.touches ? e.touches[0] : e;
    panState.active = true;
    panState.containerId = containerId;
    panState.inputId = inputId;
    panState.lastX = touch.clientX;
    panState.lastY = touch.clientY;
    panState.posX = posX;
    panState.posY = posY;
    const c = document.getElementById(containerId);
    if (c) c.style.cursor = 'grabbing';
  }

  function updatePanImage(containerId, imgId, url) {
    const c = document.getElementById(containerId);
    const img = document.getElementById(imgId);
    if (!c || !img) return;
    if (url) { img.src = url; c.style.display = 'block'; }
    else { c.style.display = 'none'; }
  }

  document.addEventListener('mousemove', (e) => {
    if (!panState.active) return;
    _doPan(e.clientX, e.clientY);
  });
  document.addEventListener('touchmove', (e) => {
    if (!panState.active) return;
    e.preventDefault();
    _doPan(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('mouseup', _endPan);
  document.addEventListener('touchend', _endPan);

  function _doPan(cx, cy) {
    const c = document.getElementById(panState.containerId);
    const input = document.getElementById(panState.inputId);
    if (!c) return;
    const img = c.querySelector('img');
    const dx = cx - panState.lastX;
    const dy = cy - panState.lastY;
    panState.lastX = cx;
    panState.lastY = cy;
    panState.posX = Math.max(0, Math.min(100, panState.posX - dx / c.offsetWidth * 120));
    panState.posY = Math.max(0, Math.min(100, panState.posY - dy / c.offsetHeight * 120));
    if (img) img.style.objectPosition = `${panState.posX}% ${panState.posY}%`;
    if (input) input.value = `${Math.round(panState.posX)}% ${Math.round(panState.posY)}%`;
  }

  function _endPan() {
    if (!panState.active) return;
    panState.active = false;
    const c = document.getElementById(panState.containerId);
    if (c) c.style.cursor = 'grab';
  }

  let currentUser = null;
  let projects = [];
  let settings = {};
  let authToken = null;

  // ── API HELPERS ──
  async function supabase(path, options = {}) {
    const headers = {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(SUPABASE_URL + path, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || res.statusText);
    }
    if (res.status === 204 || res.status === 201) return null;

const text = await res.text();
return text ? JSON.parse(text) : null;
  }

  async function supabaseAuth(path, body) {
    const res = await fetch(SUPABASE_URL + '/auth/v1' + path, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  function extractMediaId(url) {
    if (!url) return '';
    url = url.trim();
    // YouTube: youtube.com/watch?v=ID or youtu.be/ID or youtube.com/embed/ID
    let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    // Instagram: /reel/ID or /p/ID
    m = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    // Already just an ID — return as-is
    return url;
  }

  // ── FORGOT PASSWORD SCREENS ──
  function showForgotPassword(e) {
    e.preventDefault();
    document.getElementById('signin-box').style.display = 'none';
    document.getElementById('forgot-box').style.display = 'block';
    document.getElementById('forgot-email').focus();
  }

  function showSignIn(e) {
    e.preventDefault();
    document.getElementById('forgot-box').style.display = 'none';
    document.getElementById('reset-box').style.display = 'none';
    document.getElementById('signin-box').style.display = 'block';
  }

  async function sendResetEmail() {
    const email = document.getElementById('forgot-email').value.trim();
    const errEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    errEl.style.display = 'none';
    successEl.style.display = 'none';
    if (!email) return;
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      await supabaseAuth('/recover', { email, gotrue_meta_security: {}, redirectTo });
      successEl.style.display = 'block';
    } catch (e) {
      errEl.style.display = 'block';
    }
  }

  async function updatePassword() {
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    const errEl = document.getElementById('reset-error');
    errEl.style.display = 'none';
    if (password !== confirm || password.length < 6) {
      errEl.textContent = password !== confirm ? "Passwords don't match" : 'Password must be at least 6 characters';
      errEl.style.display = 'block';
      return;
    }
    try {
      const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        showToast('Password updated! Please log in.');
        setTimeout(() => {
          authToken = null;
          window.location.hash = '';
          document.getElementById('reset-box').style.display = 'none';
          document.getElementById('signin-box').style.display = 'block';
        }, 2000);
      } else {
        errEl.textContent = 'Update failed — try again';
        errEl.style.display = 'block';
      }
    } catch(e) {
      errEl.textContent = 'Update failed — try again';
      errEl.style.display = 'block';
    }
  }

  // ── CHECK FOR RECOVERY TOKEN ON PAGE LOAD ──
  window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        authToken = token;
        document.getElementById('signin-box').style.display = 'none';
        document.getElementById('reset-box').style.display = 'block';
      }
    }
  });

  // ── LOGIN ──
  async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    try {
      const data = await supabaseAuth('/token?grant_type=password', { email, password });
      if (data.error || !data.access_token) {
        errEl.style.display = 'block';
        return;
      }
      authToken = data.access_token;
      currentUser = data.user;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('admin-screen').style.display = 'block';
      await loadAll();
    } catch (e) {
      errEl.style.display = 'block';
    }
  }

  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  async function signOut() {
    authToken = null;
    currentUser = null;
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-screen').style.display = 'none';
  }

  // ── LOAD DATA ──
  async function loadAll() {
    await Promise.all([loadProjects(), loadSettings()]);
  }

  async function loadProjects() {
    try {
      const data = await supabase('/rest/v1/projects?order=sort_order.asc,id.asc&select=*');
      projects = data || [];
      renderProjects();
    } catch (e) {
      showToast('Error loading projects', true);
    }
  }

  async function loadSettings() {
    try {
      const data = await supabase('/rest/v1/settings?select=*');
      settings = {};
      (data || []).forEach(s => settings[s.key] = s.value);
      populateSettings();
    } catch (e) {
      showToast('Error loading settings', true);
    }
  }

  // ── RENDER PROJECTS ──
  function renderProjects() {
    const list = document.getElementById('project-list');
    if (projects.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No projects yet</p><button class="btn btn-primary" onclick="openNewProject()">+ Add First Project</button></div>';
      return;
    }
    list.innerHTML = ''; // clear first
    list.innerHTML = projects.map((p, i) => `
      <div class="project-card" id="pc-${p.id}">
        <div class="project-card-header" onclick="toggleProject(${p.id})">
          <span class="project-drag">⠿</span>
          <span class="project-number">${i + 1}</span>
          <div class="project-info">
            <div class="project-name">${p.title || 'Untitled'}</div>
            <div class="project-type">${p.subtitle || ''} ${p.card_type ? '· ' + p.card_type : ''}</div>
          </div>
          <span class="project-active-badge ${p.active ? '' : 'inactive'}">${p.active ? 'Visible' : 'Hidden'}</span>
          <span class="project-toggle" id="toggle-${p.id}">▼</span>
        </div>
        <div class="project-card-body" id="pb-${p.id}">
          <div class="project-body-inner">
            <div class="form-grid">
              <div class="form-group">
                <label>Project Name</label>
                <input type="text" id="p-title-${p.id}" value="${p.title || ''}" />
              </div>
              <div class="form-group">
                <label>Category</label>
                <input type="text" id="p-subtitle-${p.id}" value="${p.subtitle || ''}" placeholder="e.g. Short Film, Key Visuals" />
              </div>
              <div class="form-group">
                <label>Short Description <span class="hint-inline">one line shown on the card</span></label>
                <input type="text" id="p-description-${p.id}" value="${p.description || ''}" placeholder="e.g. Video for Ben's music" />
              </div>
              <div class="form-group">
                <label>Content Type</label>
                <select id="p-card_type-${p.id}">
                  <option value="visuals" ${p.card_type === 'visuals' ? 'selected' : ''}>Images / Visuals only</option>
                  <option value="youtube" ${p.card_type === 'youtube' ? 'selected' : ''}>YouTube Video</option>
                  <option value="instagram" ${p.card_type === 'instagram' ? 'selected' : ''}>Instagram Reel</option>
                </select>
              </div>
              <div class="form-group">
                <label>Page Layout <span class="hint-inline">how the project opens when clicked</span></label>
                <select id="p-page_template-${p.id}" onchange="switchTemplateFields(${p.id}, this.value)">
                  <option value="slideshow" ${(!p.page_template || p.page_template === 'slideshow') ? 'selected' : ''}>Slideshow — images &amp; videos carousel</option>
                  <option value="editorial" ${p.page_template === 'editorial' ? 'selected' : ''}>Editorial — image left, text right</option>
                  <option value="collage" ${p.page_template === 'collage' ? 'selected' : ''}>Collage — scattered images (Benchiki style)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Video Link <span class="hint-inline">only for YouTube or Instagram</span></label>
                <p class="field-hint">Copy the full link from YouTube or Instagram and paste it here — the site extracts what it needs automatically.</p>
                <input type="text" id="p-media_id-${p.id}" value="${p.media_id || ''}" placeholder="e.g. https://www.youtube.com/watch?v=... or https://www.instagram.com/reel/..." />
              </div>

              <!-- ── SLIDESHOW media rows ── -->
              <div id="tpl-slideshow-${p.id}" class="form-group form-full">
                <label>Media <span class="hint-inline">YouTube, Instagram or images — shown as a carousel</span></label>
                <div id="em-${p.id}" class="em-list"></div>
                <button type="button" class="btn btn-outline" style="width:100%;margin-top:6px;" onclick="addExtraRow(${p.id})">+ Add Media</button>
              </div>

              <!-- ── EDITORIAL hint ── -->
              <div id="tpl-editorial-${p.id}" class="form-group form-full tpl-admin-section" style="display:none">
                <div class="tpl-admin-hint">
                  <div class="tpl-admin-hint-title">Editorial layout — how each field maps</div>
                  <div class="tpl-admin-hint-row"><span class="tpl-hint-field">Preview Image</span><span class="tpl-hint-arrow">→</span><span class="tpl-hint-desc">fills the left half of the screen</span></div>
                  <div class="tpl-admin-hint-row"><span class="tpl-hint-field">Category</span><span class="tpl-hint-arrow">→</span><span class="tpl-hint-desc">small eyebrow text on the right</span></div>
                  <div class="tpl-admin-hint-row"><span class="tpl-hint-field">Project Name</span><span class="tpl-hint-arrow">→</span><span class="tpl-hint-desc">large title on the right</span></div>
                  <div class="tpl-admin-hint-row"><span class="tpl-hint-field">Short Description</span><span class="tpl-hint-arrow">→</span><span class="tpl-hint-desc">body text on the right</span></div>
                  <div class="tpl-admin-hint-row"><span class="tpl-hint-field">Video Link</span><span class="tpl-hint-arrow">→</span><span class="tpl-hint-desc">adds an "Open Project" button</span></div>
                </div>
              </div>

              <!-- ── COLLAGE image zones ── -->
              <div id="tpl-collage-${p.id}" class="form-group form-full tpl-admin-section" style="display:none">
                <label>Collage Images <span class="hint-inline">drag an image into each position — they scatter on screen</span></label>
                <div class="collage-grid" id="collage-grid-${p.id}">
                  ${renderCollageZones(p.id, null)}
                </div>
              </div>
              <div class="form-group">
                <label>Button Text</label>
                <input type="text" id="p-cta_label-${p.id}" value="${p.cta_label || ''}" placeholder="e.g. Watch Video, View Project" />
              </div>
              <div class="form-group form-full">
                <label>Preview Image <span class="hint-inline">shown on the card</span></label>
                <div class="drop-zone ${p.thumbnail_url ? 'has-image' : ''}" id="dz-p-${p.id}"
                     onclick="event.stopPropagation(); document.getElementById('file-${p.id}').click()"
                     ondragover="event.preventDefault(); event.stopPropagation(); this.classList.add('drag-over')"
                     ondragleave="event.stopPropagation(); this.classList.remove('drag-over')"
                     ondrop="event.preventDefault(); event.stopPropagation(); this.classList.remove('drag-over'); uploadThumbnail(event.dataTransfer.files[0],'p-thumbnail_url-${p.id}','prev-${p.id}','pan-${p.id}','pan-img-${p.id}','dz-p-${p.id}')">
                  <img class="dz-image" src="${p.thumbnail_url || ''}" />
                  <span class="dz-hint">Drop image here or click to upload</span>
                  <div class="dz-replace-hint">Drop to replace</div>
                  <input type="file" id="file-${p.id}" accept="image/*" style="display:none"
                         onchange="uploadThumbnail(this.files[0],'p-thumbnail_url-${p.id}','prev-${p.id}','pan-${p.id}','pan-img-${p.id}','dz-p-${p.id}')">
                </div>
                <input type="text" id="p-thumbnail_url-${p.id}" value="${p.thumbnail_url || ''}" placeholder="Or paste an image URL here..." oninput="setDropZoneImage('dz-p-${p.id}',this.value); previewThumb('prev-${p.id}', this.value); updatePanImage('pan-${p.id}','pan-img-${p.id}',this.value)" />
                <img id="prev-${p.id}" class="thumb-preview ${p.thumbnail_url ? 'visible' : ''}" src="${p.thumbnail_url || ''}" />
              </div>
              <div class="form-group form-full">
                <label>Image Position <span class="hint-inline">drag the preview below to reposition</span></label>
                <div class="thumb-pan-wrap" id="pan-${p.id}"
                     onmousedown="startPan(event,'pan-${p.id}','p-object_position-${p.id}')"
                     ontouchstart="startPan(event,'pan-${p.id}','p-object_position-${p.id}')"
                     style="${p.thumbnail_url ? '' : 'display:none'}">
                  <img id="pan-img-${p.id}" src="${p.thumbnail_url || ''}" style="width:100%;height:100%;object-fit:cover;object-position:${p.object_position||'50% 50%'};pointer-events:none;display:block;" />
                  <span class="thumb-pan-hint">Drag to reposition</span>
                </div>
                <input type="hidden" id="p-object_position-${p.id}" value="${p.object_position||'50% 50%'}" />
              </div>
              <div class="form-group">
                <label>Position on site <span class="hint-inline">1 = first, 2 = second…</span></label>
                <input type="number" id="p-sort_order-${p.id}" value="${p.sort_order || 0}" />
              </div>
            </div>
            <div class="project-card-actions">
              <label class="toggle-wrap">
                <span class="toggle-label">Show on site</span>
                <label class="toggle">
                  <input type="checkbox" id="p-active-${p.id}" ${p.active ? 'checked' : ''} onchange="saveProject(${p.id})" />
                  <span class="toggle-slider"></span>
                </label>
              </label>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-danger" onclick="deleteProject(${p.id})">Delete</button>
                <button class="btn btn-success" onclick="saveProject(${p.id})">Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    projects.forEach(p => {
      const tpl = p.page_template || 'slideshow';
      if (tpl === 'collage') {
        initCollageZones(p.id);
      } else {
        initExtraMedia(p.id, p.extra_media || null);
      }
      switchTemplateFields(p.id, tpl);
    });
  }

  function toggleProject(id) {
    const body = document.getElementById(`pb-${id}`);
    const toggle = document.getElementById(`toggle-${id}`);
    body.classList.toggle('open');
    toggle.classList.toggle('open');
  }

  // ── NEW PROJECT ──
  function openNewProject() {
    document.getElementById('new-project-form').style.display = 'block';
    document.getElementById('new-title').focus();
    initExtraMedia('new', null);
  }

  function closeNewProject() {
    document.getElementById('new-project-form').style.display = 'none';
  }

  async function saveNewProject() {
  const body = {
    title: v('new-title'),
    subtitle: v('new-subtitle'),
    description: v('new-description'),
    card_type: v('new-card-type'),
    page_template: v('new-page-template') || 'slideshow',
    media_id: v('new-media-id'),
    extra_media: getExtraMediaJSON('new'),
    cta_label: v('new-cta-label'),
    thumbnail_url: v('new-thumbnail'),
    object_position: v('new-object-position') || 'center',
    sort_order: projects.length,
    active: true
  };

  try {
    await supabase('/rest/v1/projects', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    });

    closeNewProject();
    await loadProjects();
    showToast('Project added!');
  } catch (e) {
    showToast('Error saving project', true);
  }
}

  // ── SAVE PROJECT ──
  async function saveProject(id) {
    const body = {
      title: v(`p-title-${id}`),
      subtitle: v(`p-subtitle-${id}`),
      description: v(`p-description-${id}`),
      card_type: v(`p-card_type-${id}`),
      page_template: v(`p-page_template-${id}`) || 'slideshow',
      media_id: v(`p-media_id-${id}`),
      extra_media: (v(`p-page_template-${id}`) === 'collage') ? getCollageJSON(id) : getExtraMediaJSON(id),
      cta_label: v(`p-cta_label-${id}`),
      thumbnail_url: v(`p-thumbnail_url-${id}`),
      object_position: v(`p-object_position-${id}`) || 'center',
      sort_order: parseInt(v(`p-sort_order-${id}`)) || 0,
      active: document.getElementById(`p-active-${id}`).checked
    };
    try {
      await supabase(`/rest/v1/projects?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(body)
      });
      await loadProjects();
      showToast('Project saved!');
    } catch (e) {
      showToast('Error saving', true);
    }
  }

  // ── DELETE PROJECT ──
  async function deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await supabase(`/rest/v1/projects?id=eq.${id}`, { method: 'DELETE' });
      await loadProjects();
      showToast('Project deleted');
    } catch (e) {
      showToast('Error deleting', true);
    }
  }

  // ── SETTINGS ──
  function populateSettings() {
    const keys = ['tagline','about_text','email','phone','instagram','linkedin',
                  'background_image_url','font_family','font_size_name','font_size_body',
                  'color_background','color_nav_bar','color_text_dark','color_text_light','color_card_bg'];
    keys.forEach(k => {
      const el = document.getElementById('s-' + k);
      if (el && settings[k] !== undefined) {
        el.value = settings[k];
        // Sync colour pickers
        const cp = document.getElementById('cp-' + k);
        if (cp) {
          try { cp.value = settings[k]; } catch(e) {}
        }
        // Preview background image
        if (k === 'background_image_url' && settings[k]) {
          previewThumb('bg-preview', settings[k]);
        }
      }
    });
  }

  async function saveSettings() {
    const keys = ['tagline','about_text','email','phone','instagram','linkedin','background_image_url'];
    try {
      await upsertSettings(keys);
      showToast('Settings saved!');
    } catch(e) {}
  }

  async function saveAppearance() {
    const keys = ['font_family','font_size_name','font_size_body',
                  'color_background','color_nav_bar','color_text_dark','color_text_light','color_card_bg'];
    try {
      await upsertSettings(keys);
      showToast('Appearance saved!');
    } catch(e) {}
  }

  async function upsertSettings(keys) {
    const rows = keys.map(k => ({ key: k, value: document.getElementById('s-' + k)?.value || '' }));
    try {
      await supabase('/rest/v1/settings?on_conflict=key', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows)
      });
    } catch (e) {
      showToast('Error saving', true);
      throw e;
    }
  }

  // ── COLOUR SYNC ──
  function syncColor(key, val) {
    const el = document.getElementById('s-' + key);
    if (el) el.value = val;
  }

  function syncColorPicker(key, val) {
    const cp = document.getElementById('cp-' + key);
    if (cp) { try { cp.value = val; } catch(e) {} }
  }

  // ── TAB SWITCHING ──
  function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    event.target.classList.add('active');
  }

  // ── EXTRA MEDIA ROWS ──
  let emRowCounter = 0;

  function initExtraMedia(containerId, json) {
    let items = [];
    if (json) {
      try { items = JSON.parse(json); }
      catch(e) { items = json.split('\n').filter(Boolean).map(u => ({ url: u.trim(), thumb: '' })); }
    }
    const c = document.getElementById('em-' + containerId);
    if (!c) return;
    c.innerHTML = '';
    if (items.length === 0) {
      addExtraRowWithData(containerId, '', '');
    } else {
      items.forEach(item => addExtraRowWithData(containerId, item.url || '', item.thumb || ''));
    }
    refreshRowNumbers(containerId);
  }

  function addExtraRow(containerId) {
    addExtraRowWithData(containerId, '', '');
    refreshRowNumbers(containerId);
  }

  function removeExtraRow(btn, containerId) {
    const row = btn.closest('.em-row');
    const rId = row?.dataset.rid;
    // delete old thumb from storage if present
    const thumbInput = rId ? document.getElementById('em-thumb-' + rId) : null;
    if (thumbInput?.value) deleteFromStorage(thumbInput.value);
    row?.remove();
    refreshRowNumbers(containerId);
  }

  function refreshRowNumbers(containerId) {
    const c = document.getElementById('em-' + containerId);
    if (!c) return;
    c.querySelectorAll('.em-row-num').forEach((el, i) => { el.textContent = (i + 1) + ')'; });
  }

  function addExtraRowWithData(containerId, url, thumb) {
    const rId = ++emRowCounter;
    const c = document.getElementById('em-' + containerId);
    if (!c) return;
    const hasThumb = !!thumb;
    const row = document.createElement('div');
    row.className = 'em-row';
    row.dataset.rid = rId;
    row.innerHTML = `
      <div class="em-row-main">
        <span class="em-row-num">—</span>
        <input type="text" id="em-url-${rId}" value="${url}" placeholder="YouTube or Instagram URL" class="em-url-input" />
        <button type="button" class="em-remove" onclick="removeExtraRow(this,'${containerId}')">✕</button>
      </div>
      <div class="drop-zone em-drop ${hasThumb ? 'has-image' : ''}" id="dz-em-${rId}"
           onclick="event.stopPropagation(); document.getElementById('em-file-${rId}').click()"
           ondragover="event.preventDefault(); event.stopPropagation(); this.classList.add('drag-over')"
           ondragleave="event.stopPropagation(); this.classList.remove('drag-over')"
           ondrop="event.preventDefault(); event.stopPropagation(); this.classList.remove('drag-over'); uploadExtraThumb(event.dataTransfer.files[0],${rId})">
        <img class="dz-image" src="${thumb || ''}" />
        <span class="dz-hint">Drop thumbnail or click to upload</span>
        <div class="dz-replace-hint">Drop to replace</div>
        <input type="file" id="em-file-${rId}" accept="image/*" style="display:none"
               onchange="uploadExtraThumb(this.files[0],${rId})">
      </div>
      <input type="text" id="em-thumb-${rId}" value="${thumb}" placeholder="Or paste thumbnail URL..."
             oninput="setDropZoneImage('dz-em-${rId}',this.value)" style="margin-top:4px;" />
    `;
    c.appendChild(row);
  }

  async function uploadExtraThumb(file, rId) {
    if (!file || !file.type.startsWith('image/')) { showToast('Please drop an image file', true); return; }
    const dz = document.getElementById('dz-em-' + rId);
    if (dz) dz.classList.add('uploading');
    // delete old image from storage
    const oldInput = document.getElementById('em-thumb-' + rId);
    if (oldInput?.value) deleteFromStorage(oldInput.value);
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const filename = `thumb-${Date.now()}.${ext}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${filename}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${authToken}`, 'Content-Type': file.type },
        body: file
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
      const url = `${SUPABASE_URL}/storage/v1/object/public/media/${filename}`;
      const input = document.getElementById('em-thumb-' + rId);
      if (input) input.value = url;
      setDropZoneImage('dz-em-' + rId, url);
      showToast('Thumbnail uploaded!');
    } catch(e) {
      showToast('Upload failed — ' + e.message, true);
    } finally {
      if (dz) dz.classList.remove('uploading');
    }
  }

  function getExtraMediaJSON(containerId) {
    const c = document.getElementById('em-' + containerId);
    if (!c) return null;
    const items = [];
    c.querySelectorAll('.em-row').forEach(row => {
      const rId = row.dataset.rid;
      const url = (document.getElementById('em-url-' + rId)?.value || '').trim();
      const thumb = (document.getElementById('em-thumb-' + rId)?.value || '').trim();
      if (url || thumb) items.push({ url, thumb });
    });
    return items.length > 0 ? JSON.stringify(items) : null;
  }

  // ── TEMPLATE FIELD SWITCHING ──
  function switchTemplateFields(id, tpl) {
    ['slideshow', 'editorial', 'collage'].forEach(t => {
      const el = document.getElementById(`tpl-${t}-${id}`);
      if (el) el.style.display = (t === tpl) ? '' : 'none';
    });
  }

  // ── COLLAGE VISUAL CANVAS ──

  function renderCollageZones(id, extraMedia) {
    let items = [];
    if (extraMedia) { try { items = JSON.parse(extraMedia); } catch(e) {} }

    const scatter = [
      {x:6,  y:12, w:34, h:44}, {x:45, y:5,  w:30, h:42},
      {x:64, y:38, w:28, h:40}, {x:10, y:54, w:32, h:42},
      {x:46, y:54, w:26, h:38}, {x:72, y:20, w:22, h:34},
    ];

    const existing = items.filter(it => it.url).map((it, i) => {
      const pos = scatter[i] || {x:5+(i*12)%60, y:5+(i*10)%50, w:30, h:35};
      const x = it.x ?? pos.x, y = it.y ?? pos.y, w = it.w ?? pos.w, h = it.h ?? pos.h;
      return `<div class="cc-item" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%" data-url="${it.url}" data-thumb="${it.thumb || it.url}">
        <img src="${it.thumb || it.url}" alt="" draggable="false" />
        <button type="button" class="cc-del" onclick="removeCollageCsItem(this)">✕</button>
        <div class="cc-resize"></div>
      </div>`;
    }).join('');

    const showHint = !items.filter(it => it.url).length;
    return `
      <div class="collage-canvas" id="cc-${id}"
           ondragover="event.preventDefault()" ondrop="handleCollageDrop(event,'${id}')">
        ${existing}
        ${showHint ? `<div class="cc-add-hint"><span>Drop images here or click below to add</span></div>` : ''}
      </div>
      <input type="file" id="ccf-${id}" accept="image/*" multiple style="display:none"
             onchange="handleCollageFiles(this.files,'${id}'); this.value=''">
      <button type="button" class="btn btn-outline" style="width:100%;margin-top:8px"
              onclick="document.getElementById('ccf-${id}').click()">+ Add Image</button>`;
  }

  function initCollageZones(id) {
    initCollageDragCanvas(`cc-${id}`);
  }

  function initCollageDragCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas._ccInit) return;
    canvas._ccInit = true;

    canvas.addEventListener('mousedown', e => {
      const item = e.target.closest('.cc-item');
      if (!item || !canvas.contains(item)) return;
      if (e.target.classList.contains('cc-del')) return;
      e.preventDefault();

      const isResize = e.target.classList.contains('cc-resize');
      const startMX = e.clientX, startMY = e.clientY;
      const startL = item.offsetLeft, startT = item.offsetTop;
      const startW = item.offsetWidth, startH = item.offsetHeight;

      canvas.querySelectorAll('.cc-item').forEach(i => i.style.zIndex = 1);
      item.style.zIndex = 20;

      function onMove(ev) {
        const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
        const dx = ev.clientX - startMX, dy = ev.clientY - startMY;
        if (isResize) {
          item.style.width  = (Math.max(60, startW + dx) / cw * 100).toFixed(2) + '%';
          item.style.height = (Math.max(60, startH + dy) / ch * 100).toFixed(2) + '%';
        } else {
          item.style.left = (Math.max(0, Math.min(cw - item.offsetWidth,  startL + dx)) / cw * 100).toFixed(2) + '%';
          item.style.top  = (Math.max(0, Math.min(ch - item.offsetHeight, startT + dy)) / ch * 100).toFixed(2) + '%';
        }
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function handleCollageDrop(event, id) {
    [...event.dataTransfer.files].filter(f => f.type.startsWith('image/'))
      .forEach(f => _uploadAndAddCC(f, id));
  }

  function handleCollageFiles(files, id) {
    [...files].forEach(f => _uploadAndAddCC(f, id));
  }

  async function _uploadAndAddCC(file, id) {
    if (!file?.type.startsWith('image/')) return;
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const filename = `collage-${id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
    try {
      const buf = await file.arrayBuffer();
      await fetch(`${SUPABASE_URL}/storage/v1/object/media/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': file.type,
          'x-upsert': 'true'
        },
        body: buf
      });
      const url = `${SUPABASE_URL}/storage/v1/object/public/media/${encodeURIComponent(filename)}`;
      _addCcItem(id, url, url);
      showToast('Image added!');
    } catch(e) {
      showToast('Upload failed: ' + e.message, true);
    }
  }

  function _addCcItem(canvasId, url, thumb) {
    const canvas = document.getElementById(`cc-${canvasId}`);
    if (!canvas) return;
    const n = canvas.querySelectorAll('.cc-item').length;
    const x = 5 + (n * 12) % 55, y = 5 + (n * 10) % 50;
    const el = document.createElement('div');
    el.className = 'cc-item';
    el.style.cssText = `left:${x}%;top:${y}%;width:30%;height:35%`;
    el.dataset.url = url;
    el.dataset.thumb = thumb;
    el.innerHTML = `<img src="${thumb}" alt="" draggable="false" />
      <button type="button" class="cc-del" onclick="removeCollageCsItem(this)">✕</button>
      <div class="cc-resize"></div>`;
    canvas.appendChild(el);
    const hint = canvas.querySelector('.cc-add-hint');
    if (hint) hint.remove();
  }

  function removeCollageCsItem(btn) {
    const item = btn.closest('.cc-item');
    if (!item) return;
    const url = item.dataset.url;
    if (url) deleteFromStorage(url);
    item.remove();
  }

  function getCollageJSON(id) {
    const canvas = document.getElementById(`cc-${id}`);
    if (!canvas) return null;
    const items = [...canvas.querySelectorAll('.cc-item')].map(el => ({
      url:   el.dataset.url   || '',
      thumb: el.dataset.thumb || el.dataset.url || '',
      x: parseFloat(el.style.left)   || 0,
      y: parseFloat(el.style.top)    || 0,
      w: parseFloat(el.style.width)  || 30,
      h: parseFloat(el.style.height) || 35,
    })).filter(it => it.url);
    return items.length > 0 ? JSON.stringify(items) : null;
  }

  // ── IMAGE UPLOAD ──
  function deleteFromStorage(url) {
    if (!url || !url.includes('/storage/v1/object/public/media/')) return;
    const filename = url.split('/storage/v1/object/public/media/')[1];
    if (!filename) return;
    fetch(`${SUPABASE_URL}/storage/v1/object/media/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${authToken}` }
    }).catch(() => {});
  }

  function setDropZoneImage(dzId, url) {
    const dz = document.getElementById(dzId);
    if (!dz) return;
    const img = dz.querySelector('.dz-image');
    if (url) {
      if (img) img.src = url;
      dz.classList.add('has-image');
    } else {
      if (img) img.src = '';
      dz.classList.remove('has-image');
    }
  }

  async function uploadThumbnail(file, thumbInputId, previewId, panContainerId, panImgId, dzId) {
    if (!file || !file.type.startsWith('image/')) { showToast('Please drop an image file', true); return; }
    const dz = dzId ? document.getElementById(dzId) : null;
    if (dz) dz.classList.add('uploading');
    // delete old image from storage before uploading new one
    const oldInput = document.getElementById(thumbInputId);
    if (oldInput?.value) deleteFromStorage(oldInput.value);
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const filename = `thumb-${Date.now()}.${ext}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${filename}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': file.type,
        },
        body: file
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const url = `${SUPABASE_URL}/storage/v1/object/public/media/${filename}`;
      const input = document.getElementById(thumbInputId);
      if (input) { input.value = url; input.dispatchEvent(new Event('input')); }
      previewThumb(previewId, url);
      if (panContainerId && panImgId) updatePanImage(panContainerId, panImgId, url);
      if (dzId) setDropZoneImage(dzId, url);
      showToast('Image uploaded!');
    } catch(e) {
      showToast('Upload failed — ' + e.message, true);
    } finally {
      if (dz) dz.classList.remove('uploading');
    }
  }

  // ── HELPERS ──
  function v(id) { return document.getElementById(id)?.value?.trim() || ''; }

  function previewThumb(previewId, url) {
    const img = document.getElementById(previewId);
    if (!img) return;
    if (url) {
      img.src = url;
      img.classList.add('visible');
    } else {
      img.classList.remove('visible');
    }
  }

  function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => t.classList.remove('show'), 3000);
  }