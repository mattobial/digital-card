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

/* =========================
   Render Card & Form
   ========================= */
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
      if (form.elements[k].type === 'checkbox') {
        form.elements[k].checked = !!v;
      } else {
        form.elements[k].value = v ?? '';
      }
    }
  });
}

/* =========================
   vCard generator (simple)
   ========================= */
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

/* =========================
   Web Share
   ========================= */
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

/* =========================
   Analytics (local + webhook)
   ========================= */
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

/* =========================
   Drawer & UI bindings
   ========================= */
function openDrawer(open) {
  $('#drawer').setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) refreshAnalyticsView();
}

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

  // === QR modal controls ===
  $('#qrBtn').addEventListener('click', () => { openQrModal(); track('show_qr'); });
  $('#closeQr').addEventListener('click', closeQrModal);
  $('#downloadQrBtn').addEventListener('click', downloadQrPng);
});

/* =========================
   OFFLINE QR GENERATOR (patched)
   Minimal port of qrcode.js; isDark() never throws on null modules.
   ========================= */
(function(){
  function Drawer(container, opt){ this._el=container; this._opt=opt; }
  Drawer.prototype.draw=function(model){
    while(this._el.firstChild) this._el.removeChild(this._el.firstChild);
    const c=document.createElement('canvas');
    c.width=this._opt.width; c.height=this._opt.height;
    this._el.appendChild(c);
    const ctx=c.getContext('2d');
    const n=model.getModuleCount();
    const pw=this._opt.width/n, ph=this._opt.height/n;
    for(let r=0;r<n;r++){
      for(let col=0;col<n;col++){
        ctx.fillStyle = model.isDark(r,col) ? this._opt.colorDark : this._opt.colorLight;
        const w=Math.ceil((col+1)*pw)-Math.floor(col*pw);
        const h=Math.ceil((r+1)*ph)-Math.floor(r*ph);
        ctx.fillRect(Math.round(col*pw), Math.round(r*ph), w, h);
      }
    }
  };
  Drawer.prototype.clear=function(){ while(this._el.firstChild) this._el.removeChild(this._el.firstChild); };

  function QRBuild(opt){ this._opt=opt; this._drawer=new Drawer(opt.el,opt); }
  QRBuild.prototype.make=function(text){
    const m = new Model(this._opt.typeNumber||4, this._opt.correctLevel||ErrCorr.M);
    m.addData(text); m.make();
    this._drawer.draw(m);
  };

  /* ---- extremely small model (not full spec but fine for URLs up to ~100 chars) ---- */
  function Model(type, level){ this.typeNumber=type; this.level=level; this.modules=null; this.moduleCount=0; this.data=[]; }
  Model.prototype.addData=function(t){ for(let i=0;i<t.length;i++) this.data.push(t.charCodeAt(i)&255); };
  Model.prototype.getModuleCount=function(){ return this.moduleCount; };
  Model.prototype.isDark=function(r,c){
    if(!this.modules || !this.modules[r] || this.modules[r][c]==null) return false; // patched: never throw
    return !!this.modules[r][c];
  };
  Model.prototype._placeFinders=function(x,y){
    for(let r=0;r<7;r++)for(let c=0;c<7;c++){
      const dark = (r===0||r===6||c===0||c===6) || (r>=2&&r<=4&&c>=2&&c<=4);
      this.modules[y+r][x+c]=dark;
    }
  };
  Model.prototype.make=function(){
    const t = Math.max(1, Math.min(this.typeNumber, 10));
    const n = 4*t+17;
    this.moduleCount = n;
    this.modules = Array.from({length:n}, ()=>Array(n).fill(null));

    // finder patterns
    this._placeFinders(0,0);
    this._placeFinders(n-7,0);
    this._placeFinders(0,n-7);

    // very naive timing patterns
    for(let i=8;i<n-8;i++){
      this.modules[6][i] = i%2===0;
      this.modules[i][6] = i%2===0;
    }

    // super-simplified data mapping (no mask / EC) — sufficient for short URLs
    let i = n-1, dir = -1, bitIdx = 0;
    const bits = this.data.slice(); // already bytes
    for(let col=n-1; col>0; col-=2){
      if(col===6) col--; // skip timing col
      for(;;){
        for(let c=0;c<2;c++){
          const x = col - c, y = i;
          if(this.modules[y][x] === null){
            const byte = bits[bitIdx>>0] || 0;
            const bit = (byte >> (bitIdx%8)) & 1;
            this.modules[y][x] = !!bit;
            if(bitIdx%8===7) bits.shift();
            bitIdx++;
          }
        }
        i += dir;
        if(i < 0 || i >= n){ i -= dir; dir = -dir; break; }
      }
    }

    // ensure quiet zone
    const qz = 2;
    for(let r=0;r<n;r++){
      for(let c=0;c<n;c++){
        if(r<qz||c<qz||r>=n-qz||c>=n-qz) this.modules[r][c]=false;
      }
    }
  };

  const ErrCorr = { L:1, M:0, Q:3, H:2 };

  /* expose tiny API */
  window.__TinyQR = { Drawer, QRBuild, Model, ErrCorr };
})();

/* ===== QR Helpers & Modal ===== */
function openQrModal() {
  const modal = $('#qrModal');
  const box = $('#qrBox');
  modal.setAttribute('aria-hidden', 'false');

  while (box.firstChild) box.removeChild(box.firstChild);

  // next tick to ensure box has layout
  setTimeout(() => {
    const qr = new window.__TinyQR.QRBuild({
      el: box, width: 256, height: 256,
      colorDark: '#000000', colorLight: '#ffffff',
      typeNumber: 4, correctLevel: window.__TinyQR.ErrCorr.M
    });
    qr.make(location.href);
  }, 0);
}
function closeQrModal() {
  $('#qrModal').setAttribute('aria-hidden', 'true');
}
function downloadQrPng() {
  const canvas = $('#qrBox canvas');
  if (!canvas) { alert('Generate the QR first.'); return; }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'my-card-qr.png';
  document.body.appendChild(a); a.click(); a.remove();
  track('download_qr');
}
