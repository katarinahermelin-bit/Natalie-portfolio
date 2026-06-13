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

  function extractInstagramCode(url) {
  if (!url) return '';

  const match = url.match(/(?:reel|p)\/([^/?]+)/);

  return match ? match[1] : url;
}
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
                <label>Title</label>
                <input type="text" id="p-title-${p.id}" value="${p.title || ''}" />
              </div>
              <div class="form-group">
                <label>Subtitle / Category</label>
                <input type="text" id="p-subtitle-${p.id}" value="${p.subtitle || ''}" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <input type="text" id="p-description-${p.id}" value="${p.description || ''}" />
              </div>
              <div class="form-group">
                <label>Card Type</label>
                <select id="p-card_type-${p.id}">
                  <option value="visuals" ${p.card_type === 'visuals' ? 'selected' : ''}>Visuals</option>
                  <option value="youtube" ${p.card_type === 'youtube' ? 'selected' : ''}>YouTube</option>
                  <option value="instagram" ${p.card_type === 'instagram' ? 'selected' : ''}>Instagram</option>
                </select>
              </div>
              <div class="form-group">
                <label>Media ID (YouTube ID or Instagram shortcode)</label>
                <input type="text" id="p-media_id-${p.id}" value="${p.media_id || ''}" placeholder="e.g. dQw4w9WgXcQ" />
              </div>
              <div class="form-group">
                <label>CTA Label</label>
                <input type="text" id="p-cta_label-${p.id}" value="${p.cta_label || ''}" placeholder="Watch Video" />
              </div>
              <div class="form-group form-full">
                <label>Thumbnail URL</label>
                <input type="text" id="p-thumbnail_url-${p.id}" value="${p.thumbnail_url || ''}" placeholder="https://..." oninput="previewThumb('prev-${p.id}', this.value)" />
                <img id="prev-${p.id}" class="thumb-preview ${p.thumbnail_url ? 'visible' : ''}" src="${p.thumbnail_url || ''}" />
              </div>
              <div class="form-group">
                <label>Sort Order</label>
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
    media_id: extractInstagramCode(v('new-media-id')),
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
      media_id: extractInstagramCode(v(`p-media_id-${id}`)),
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
    await upsertSettings(keys);
    showToast('Settings saved!');
  }

  async function saveAppearance() {
    const keys = ['font_family','font_size_name','font_size_body',
                  'color_background','color_nav_bar','color_text_dark','color_text_light','color_card_bg'];
    await upsertSettings(keys);
    showToast('Appearance saved!');
  }

  async function upsertSettings(keys) {
    const rows = keys.map(k => ({ key: k, value: document.getElementById('s-' + k)?.value || '' }));
    try {
      await supabase('/rest/v1/settings', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
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