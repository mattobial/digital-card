/* Force fresh SW / assets on deploy */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.update();
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    }
  });
}

/* =========================
   App State & Utilities
   ========================= */
const KEY = 'card:data:v1';
const ANALYTICS_KEY = 'card:analytics:v1';
const $ = sel => document.querySelector(sel);

const defaultData = {
  fullName: 'Your Name',
  title: 'Your Role',
  bio: 'One-liner about what you do.',
  avatar: '',
  email: '',
  phone: '',
  website: '',
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

/* Render Card + Form */
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
function fillForm(data) {
  const form = $('#settingsForm');
  Object.entries(data).forEach(([k, v]) => {
    if (form.elements[k] !== undefined) {
      if (form.elements[k].type === 'checkbox') form.elements[k].checked = !!v;
      else form.elements[k].value = v ?? '';
    }
  });
}

/* vCard */
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

/* Share */
async function shareCard(data) {
  const payload = { title: data.fullName || 'My Card', text: `${data.fullName} — ${data.title}\n${data.website || ''}`, url: location.href };
  try {
    if (navigator.share) await navigator.share(payload);
    else { await navigator.clipboard.writeText(payload.url); alert('Link copied to clipboard!'); }
    track('share', { via: navigator.share ? 'web-share' : 'clipboard' });
  } catch {}
}

/* Analytics (local + optional webhook) */
function storeEvent(evt) {
  const list = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  list.push(evt);
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(list));
  return list;
}
function track(type, data = {}) {
  const st = loadData();
  if (!st.analyticsEnabled) return;
  const evt = { type, data, ts: new Date().toISOString(), path: location.pathname };
  storeEvent(evt);
  if (st.analyticsWebhook) {
    try { navigator.sendBeacon?.(st.analyticsWebhook, new Blob([JSON.stringify(evt)], { type: 'application/json' })); }
    catch { fetch(st.analyticsWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evt) }); }
  }
}
function refreshAnalyticsView() {
  const list = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  const totals = list.reduce((acc, e) => (acc[e.type] = (acc[e.type] || 0) + 1, acc), {});
  $('#analyticsView').textContent = `Events: ${list.length}\nBreakdown: ${JSON.stringify(totals, null, 2)}`;
}

/* Drawer */
function openDrawer(open){ $('#drawer').setAttribute('aria-hidden', open ? 'false' : 'true'); if (open) refreshAnalyticsView(); }

/* Init */
window.addEventListener('DOMContentLoaded', () => {
  const st = loadData(); render(st); fillForm(st); track('view');

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');

  $('#editBtn').addEventListener('click', () => openDrawer(true));
  $('#closeDrawer').addEventListener('click', () => openDrawer(false));

  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const u = {
      ...loadData(),
      fullName: f.fullName.value.trim(),
      title: f.title.value.trim(),
      bio: f.bio.value.trim(),
      avatar: f.avatar.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      website: f.website.value.trim(),
      ctaLabel: f.ctaLabel.value.trim(),
      ctaLink: f.ctaLink.value.trim(),
      analyticsEnabled: f.analyticsEnabled.checked,
      analyticsWebhook: f.analyticsWebhook.value.trim()
    };
    saveData(u); render(u); openDrawer(false); track('save_settings');
  });

  $('#exportBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(loadData(), null, 2)], { type: 'application/json' }));
    a.download = 'card-settings.json'; document.body.appendChild(a); a.click(); a.remove();
    track('export_settings');
  });
  $('.import').addEventListener('click', () => $('#importInput').click());
  $('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const json = JSON.parse(await file.text()); saveData({ ...defaultData, ...json }); render(loadData()); fillForm(loadData()); alert('Imported ✅'); track('import_settings'); }
    catch { alert('Invalid JSON ❌'); }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset to defaults?')) return;
    localStorage.removeItem(KEY); render(loadData()); fillForm(loadData()); track('reset');
  });

  $('#shareBtn').addEventListener('click', () => shareCard(loadData()));
  $('#saveVcfBtn').addEventListener('click', () => { downloadVCF(loadData()); track('download_vcf'); });

  $('#ctaBtn').addEventListener('click', () => track('cta_click', { href: $('#ctaBtn').href }));
  $('#emailLink').addEventListener('click', () => track('link_click', { link: 'email' }));
  $('#phoneLink').addEventListener('click', () => track('link_click', { link: 'phone' }));
  $('#siteLink').addEventListener('click', () => track('link_click', { link: 'website' }));

  // QR controls
  $('#qrBtn').addEventListener('click', () => { openQrModal(); track('show_qr'); });
  $('#closeQr').addEventListener('click', closeQrModal);
  $('#downloadQrBtn').addEventListener('click', downloadQrPng);
});

/* ===== Proper QR (qrcode.min.js) ===== */
let qrInstance = null;

function openQrModal() {
  const modal = $('#qrModal');
  const box = $('#qrBox');
  modal.setAttribute('aria-hidden', 'false');

  // Clear old canvas/img
  while (box.firstChild) box.removeChild(box.firstChild);

  // Render after layout to avoid race
  setTimeout(() => {
    const opts = {
      text: location.href,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    };
    qrInstance = new QRCode(box, opts);
  }, 0);
}

function closeQrModal() {
  $('#qrModal').setAttribute('aria-hidden', 'true');
}

function downloadQrPng() {
  const canvas = $('#qrBox canvas');
  const img = $('#qrBox img');
  const src = canvas ? canvas.toDataURL('image/png') : img?.src;
  if (!src) return alert('Generate the QR first.');
  const a = document.createElement('a');
  a.href = src; a.download = 'my-card-qr.png';
  document.body.appendChild(a); a.click(); a.remove();
  track('download_qr');
}
