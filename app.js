/* App State & Utilities */
const KEY = 'card:data:v1';
const ANALYTICS_KEY = 'card:analytics:v1';
const $ = sel => document.querySelector(sel);

const defaultData = {
  fullName: 'Your Name',
  title: 'Your Role',
  bio: 'One-liner about what you do.',
  avatar: 'https://avatars.githubusercontent.com/u/583231?v=4',
  email: 'you@example.com',
  phone: '+10000000000',
  website: 'https://example.com',
  ctaLabel: 'Book a call',
  ctaLink: '#',
  analyticsEnabled: true,
  analyticsWebhook: ''
};

function loadData() {
  try { return { ...defaultData, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...defaultData }; }
}
function saveData(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

function setText(id, text) { const el = $(id); if (el) el.textContent = text || ''; }
function setAttr(id, attr, value) { const el = $(id); if (el) el.setAttribute(attr, value); }

/* Render Card */
function render(data) {
  setAttr('#avatar', 'src', data.avatar || '');
  setText('#fullName', data.fullName);
  setText('#title', data.title);
  setText('#bio', data.bio);
  setAttr('#emailLink', 'href', data.email ? `mailto:${data.email}` : '#');
  setAttr('#phoneLink', 'href', data.phone ? `tel:${data.phone}` : '#');
  setAttr('#siteLink', 'href', data.website || '#');
  const cta = $('[data-cta]');
  cta.textContent = data.ctaLabel || 'Learn more';
  cta.href = data.ctaLink || '#';
}

/* Populate form */
function fillForm(data) {
  const form = $('#settingsForm');
  Object.entries(data).forEach(([k, v]) => {
    if (form.elements[k] !== undefined) {
      if (form.elements[k].type === 'checkbox') {
        form.elements[k].checked = !!v;
      } else {
        form.elements[k].value = v ?? '';
      }
    }
  });
}

/* vCard generator (simple) */
function downloadVCF(data) {
  const lines = [
    'BEGIN:VCARD','VERSION:3.0',
    `FN:${data.fullName}`,
    data.title ? `TITLE:${data.title}` : '',
    data.email ? `EMAIL;TYPE=INTERNET:${data.email}` : '',
    data.phone ? `TEL;TYPE=CELL:${data.phone}` : '',
    data.website ? `URL:${data.website}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([lines], { type: 'text/vcard' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (data.fullName || 'contact').replace(/\s+/g, '_') + '.vcf';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

/* Web Share */
async function shareCard(data) {
  const shareData = {
    title: data.fullName || 'My Card',
    text: `${data.fullName} — ${data.title}\n${data.website || ''}`,
    url: location.href
  };
  try {
    if (navigator.share) { await navigator.share(shareData); }
    else {
      await navigator.clipboard.writeText(shareData.url);
      alert('Link copied to clipboard!');
    }
    track('share', { via: navigator.share ? 'web-share' : 'clipboard' });
  } catch (e) {
    console.warn('Share cancelled', e);
  }
}

/* Analytics (local, optional webhook) */
function storeEvent(evt) {
  const list = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  list.push(evt);
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(list));
  return list;
}
function track(type, data = {}) {
  const state = loadData();
  if (!state.analyticsEnabled) return;
  const evt = {
    type, data, ts: new Date().toISOString(),
    ua: navigator.userAgent, path: location.pathname
  };
  const list = storeEvent(evt);
  // Optional webhook
  if (state.analyticsWebhook) {
    try {
      const payload = JSON.stringify(evt);
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(state.analyticsWebhook, blob);
      } else {
        fetch(state.analyticsWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      }
    } catch(e) { /* noop */ }
  }
  return list;
}
function refreshAnalyticsView() {
  const list = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  const totals = list.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  $('#analyticsView').textContent =
    `Events: ${list.length}\nBreakdown: ${JSON.stringify(totals, null, 2)}\n\nRecent:\n` +
    list.slice(-10).map(e => `${e.ts}  ${e.type}  ${JSON.stringify(e.data)}`).join('\n');
}

/* Drawer toggling */
function openDrawer(open) {
  $('#drawer').setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) refreshAnalyticsView();
}

/* Bindings */
window.addEventListener('DOMContentLoaded', () => {
  const state = loadData();
  render(state);
  fillForm(state);
  track('view');

  // PWA registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.warn);
  }

  // UI handlers
  $('#editBtn').addEventListener('click', () => openDrawer(true));
  $('#closeDrawer').addEventListener('click', () => openDrawer(false));
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const updated = {
      ...loadData(),
      fullName: form.fullName.value.trim(),
      title: form.title.value.trim(),
      bio: form.bio.value.trim(),
      avatar: form.avatar.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      website: form.website.value.trim(),
      ctaLabel: form.ctaLabel.value.trim(),
      ctaLink: form.ctaLink.value.trim(),
      analyticsEnabled: form.analyticsEnabled.checked,
      analyticsWebhook: form.analyticsWebhook.value.trim()
    };
    saveData(updated);
    render(updated);
    openDrawer(false);
    track('save_settings');
  });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(loadData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'card-settings.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
    track('export_settings');
  });

  $('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      saveData({ ...defaultData, ...json });
      render(loadData()); fillForm(loadData());
      track('import_settings');
      alert('Imported! ✅');
    } catch {
      alert('Invalid JSON ❌');
    }
    e.target.value = '';
  });

  $('.import').addEventListener('click', () => $('#importInput').click());

  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset to defaults?')) return;
    localStorage.removeItem(KEY);
    render(loadData()); fillForm(loadData());
    track('reset');
  });

  $('#shareBtn').addEventListener('click', () => shareCard(loadData()));
  $('#saveVcfBtn').addEventListener('click', () => { downloadVCF(loadData()); track('download_vcf'); });

  // Link/CTA analytics
  $('#ctaBtn').addEventListener('click', () => track('cta_click', { href: $('#ctaBtn').href }));
  $('#emailLink').addEventListener('click', () => track('link_click', { link: 'email' }));
  $('#phoneLink').addEventListener('click', () => track('link_click', { link: 'phone' }));
  $('#siteLink').addEventListener('click', () => track('link_click', { link: 'website' }));
});
