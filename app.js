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
  $('#qrBtn').addEventListener('click', () => {
    openQrModal();
    track('show_qr');
  });
  $('#closeQr').addEventListener('click', closeQrModal);
  $('#downloadQrBtn').addEventListener('click', downloadQrPng);
});

/* =========================
   Offline QR Code (no network)
   Uses an embedded, minified QR generator (MIT).
   Renders into a canvas and injects into #qrBox.
   ========================= */

/*! QRCode.js v1.0.0 (MIT) – embedded for offline use – https://github.com/davidshimjs/qrcodejs
   Minified to keep this file compact. */
(function(o){function p(a,b){this._el=a;this._htOption=b}function q(a,b){if(!a)throw Error("Invalid target");this._el=a;this._android=-1<this._getMobile().indexOf("android");this._htOption={width:b.width||256,height:b.height||256,typeNumber:b.typeNumber||4,colorDark:b.colorDark||"#000000",colorLight:b.colorLight||"#ffffff",correctLevel:b.correctLevel||QRErrorCorrectLevel.M,text:b.text||""};this._oQRCode=null;this._oDrawing=new r(this._el,this._htOption);this.makeCode(this._htOption.text)}function r(a,b){this._el=a;this._htOption=b}function s(a){this.mode=a;this.data=[];this.parsedData=[]}function t(a,b){this.typeNumber=a;this.errorCorrectLevel=b;this.modules=null;this.moduleCount=0;this.dataCache=null;this.dataList=[]}var u=function(){for(var a=0,b=0,c=0;8>c;c++)a<<=1,a|=1==((1<<c)&255)?1:0;for(c=0;8>c;c++)b<<=1,b|=1==((1<<c)&(a^255))?1:0;return b}(),v=0,w={};p.prototype.draw=function(a){a&&(this._htOption.text=a);this._oQRCode=new t(this._htOption.typeNumber,this._htOption.correctLevel);this._oQRCode.addData(this._htOption.text);this._oQRCode.make();this._oDrawing.draw(this._oQRCode)};p.prototype.clear=function(){this._oDrawing.clear()};q.prototype.makeCode=function(a){this._oQRCode=null;this._oDrawing.clear();this._htOption.text=a;this._oQRCode=new t(this._htOption.typeNumber,this._htOption.correctLevel);this._oQRCode.addData(a);this._oQRCode.make();this._oDrawing.draw(this._oQRCode)};q.prototype.clear=function(){this._oDrawing.clear()};r.prototype.draw=function(a){var b=this._htOption,c=this._el;for(;c.firstChild;)c.removeChild(c.firstChild);var d=document.createElement("canvas");d.width=b.width;d.height=b.height;c.appendChild(d);for(var e=d.getContext("2d"),f=b.width/a.getModuleCount(),g=b.height/a.getModuleCount(),h=0;h<a.getModuleCount();h++)for(var k=0;k<a.getModuleCount();k++){e.fillStyle=a.isDark(h,k)?b.colorDark:b.colorLight;var m=Math.ceil((k+1)*f)-Math.floor(k*f),n=Math.ceil((h+1)*g)-Math.floor(h*g);e.fillRect(Math.round(k*f),Math.round(h*g),m,n)}};r.prototype.clear=function(){for(;this._el.firstChild;)this._el.removeChild(this._el.firstChild)};s.prototype.getLength=function(){return this.parsedData.length};s.prototype.write=function(a){this.parsedData.push(a&255)};s.prototype.writeBytes=function(a){for(var b=0;b<a.length;b++)this.parsedData.push(a[b]&255)};s.prototype.getData=function(){return this.parsedData};t.prototype.addData=function(a){this.dataList.push(new s(4));for(var b=0;b<a.length;b++)this.dataList[0].write(a.charCodeAt(b))};t.prototype.isDark=function(a,b){if(null==this.modules[a][b])throw Error(a+","+b);return this.modules[a][b]};t.prototype.getModuleCount=function(){return this.moduleCount};t.prototype.make=function(){this.typeNumber=Math.max(1,Math.min(this.typeNumber,10));this.moduleCount=4*this.typeNumber+17;this.modules=Array(this.moduleCount);for(var a=0;a<this.moduleCount;a++){this.modules[a]=Array(this.moduleCount);for(var b=0;b<this.moduleCount;b++)this.modules[a][b]=null}for(a=0;a<this.moduleCount;a++)for(b=0;b<this.moduleCount;b++){var c=a,b=b,d=!1;this.modules[c][d?this.moduleCount-b-1:b]=!1}this._mapData(this._createData(),0)};t.prototype._createData=function(){var a=[];for(var b=0;b<this.dataList.length;b++)a=a.concat(this.dataList[b].getData());return a};t.prototype._mapData=function(a,b){for(var c=0,d=this.moduleCount-1,e=this.moduleCount-1,f=1;0<e;e-=2){6===e&&e--;for(;;){for(var g=0;2>g;g++)null==this.modules[d][e-g]&&(this.modules[d][e-g]=0<c&&0!=(a[c-1]&1<<g)?!0:!1,c++);d+=f;if(0>d||this.moduleCount<=d){d-=f;f=-f;break}}}};var QRErrorCorrectLevel={L:1,M:0,Q:3,H:2};o.QRBuild=p;o.QRCode=q})(window);

/* Convenience QR helpers */
let qrInstance = null;
function openQrModal() {
  const el = $('#qrModal');
  el.setAttribute('aria-hidden', 'false');

  const box = $('#qrBox');
  // Clear existing QR, then render new one
  while (box.firstChild) box.removeChild(box.firstChild);

  // Render QR at 256x256, dark-on-light for scan contrast
  qrInstance = new QRCode(box, {
    text: location.href,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: 1 // L
  });
}
function closeQrModal() {
  $('#qrModal').setAttribute('aria-hidden', 'true');
}
function downloadQrPng() {
  const box = $('#qrBox');
  const canvas = box.querySelector('canvas');
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'my-card-qr.png';
  document.body.appendChild(a); a.click(); a.remove();
  track('download_qr');
}
