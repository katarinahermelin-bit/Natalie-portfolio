  // SUPABASE_URL and SUPABASE_KEY are loaded from js/config.js

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
                <label>Video Link <span class="hint-inline">only for YouTube or Instagram</span></label>
                <p class="field-hint">Copy the full link from YouTube or Instagram and paste it here — the site extracts what it needs automatically.</p>
                <input type="text" id="p-media_id-${p.id}" value="${p.media_id || ''}" placeholder="e.g. https://www.youtube.com/watch?v=... or https://www.instagram.com/reel/..." />
              </div>
              <div class="form-group">
                <label>Button Text</label>
                <input type="text" id="p-cta_label-${p.id}" value="${p.cta_label || ''}" placeholder="e.g. Watch Video, View Project" />
              </div>
              <div class="form-group form-full">
                <label>Preview Image <span class="hint-inline">shown on the card — YouTube fills this automatically</span></label>
                <p class="field-hint">Upload your image to Google Drive → Share → Anyone with the link → paste link here. For Instagram reels, take a screenshot and upload that.</p>
                <input type="text" id="p-thumbnail_url-${p.id}" value="${p.thumbnail_url || ''}" placeholder="Paste image link here..." oninput="previewThumb('prev-${p.id}', this.value)" />
                <img id="prev-${p.id}" class="thumb-preview ${p.thumbnail_url ? 'visible' : ''}" src="${p.thumbnail_url || ''}" />
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
                  <input type="checkbox" id="p-active-${p.id}" ${p.active ? 'checked' : ''} />
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
    media_id: extractMediaId(v('new-media-id')),
    cta_label: v('new-cta-label'),
    thumbnail_url: v('new-thumbnail'),
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
      media_id: extractMediaId(v(`p-media_id-${id}`)),
      cta_label: v(`p-cta_label-${id}`),
      thumbnail_url: v(`p-thumbnail_url-${id}`),
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