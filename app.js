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
   OFFLINE QR GENERATOR (embedded, MIT)
   Source: davidshimjs/qrcodejs (minified)
   ========================= */
/*! qrcode.js v1.0.0 | MIT | https://github.com/davidshimjs/qrcodejs */
(function(){function p(a,b){this._el=a;this._htOption=b}function z(a,b){if(!a)throw Error("Invalid target");this._el=a;this._htOption={width:b.width||256,height:b.height||256,typeNumber:b.typeNumber||4,colorDark:b.colorDark||"#000000",colorLight:b.colorLight||"#ffffff",correctLevel:b.correctLevel||QRErrorCorrectLevel.M,text:b.text||""};this._oQRCode=null;this._oDrawing=new p(this._el,this._htOption);this.makeCode(this._htOption.text)}function A(a,b){this.typeNumber=a;this.errorCorrectLevel=b;this.modules=null;this.moduleCount=0;this.dataCache=null;this.dataList=[]}function B(a,b){if(null==a.length)throw Error(a.length+"/"+b);for(var c=0;c<a.length&&0==a[c];)c++;this.num=Array(a.length-c+b);for(var d=0;d<a.length-c;d++)this.num[d]=a[d+c]}function C(a,b){this.totalCount=a;this.dataCount=b}var F={L:1,M:0,Q:3,H:2};z.prototype.makeCode=function(a){this._oQRCode=new A(this._htOption.typeNumber,this._htOption.correctLevel);this._oQRCode.addData(a);this._oQRCode.make();this._oDrawing.draw(this._oQRCode)};z.prototype.clear=function(){this._oDrawing.clear()};p.prototype.draw=function(a){var b=this._htOption,c=this._el;for(;c.hasChildNodes();)c.removeChild(c.lastChild);var d=document.createElement("canvas");d.width=b.width;d.height=b.height;c.appendChild(d);for(var e=d.getContext("2d"),f=b.width/a.getModuleCount(),g=b.height/a.getModuleCount(),h=0;h<a.getModuleCount();h++)for(var k=0;k<a.getModuleCount();k++){e.fillStyle=a.isDark(h,k)?b.colorDark:b.colorLight;var m=Math.ceil((k+1)*f)-Math.floor(k*f),n=Math.ceil((h+1)*g)-Math.floor(h*g);e.fillRect(Math.round(k*f),Math.round(h*g),m,n)}};p.prototype.clear=function(){for(;this._el.firstChild;)this._el.removeChild(this._el.firstChild)};var G=function(){var a=function(a){this.buffer=[];this.length=0;void 0!==a&&(this.buffer=a,this.length=8*a.length)};a.prototype.get=function(a){return 1==(this.buffer[Math.floor(a/8)]>>>7-a%8&1)};a.prototype.put=function(a,b){for(var c=0;c<b;c++)this.putBit(1==(a>>>b-c-1&1))};a.prototype.putBit=function(a){this.buffer[Math.floor(this.length/8)]|=a?128>>>this.length%8:0;this.length++};return a}();A.prototype.addData=function(a){this.dataList.push({data:a,mode:4})};A.prototype.isDark=function(a,b){if(null==this.modules[a][b])throw Error(a+","+b);return this.modules[a][b]};A.prototype.getModuleCount=function(){return this.moduleCount};A.prototype.make=function(){this.typeNumber=Math.max(1,Math.min(this.typeNumber,10));this.moduleCount=4*this.typeNumber+17;this.modules=Array(this.moduleCount);for(var a=0;a<this.moduleCount;a++){this.modules[a]=Array(this.moduleCount);for(var b=0;b<this.moduleCount;b++)this.modules[a][b]=null}this._setupPositionProbePattern(0,0);this._setupPositionProbePattern(this.moduleCount-7,0);this._setupPositionProbePattern(0,this.moduleCount-7);this._mapData(this._createData(),0)};A.prototype._setupPositionProbePattern=function(a,b){for(var c=0;7>c;c++)for(var d=0;7>d;d++){var e=a+d,f=b+c;0<=e&&e<this.moduleCount&&0<=f&&f<this.moduleCount&&(this.modules[e][f]=0<=d&&6>=d&&(0==c||6==c)||0<=c&&6>=c&&(0==d||6==d)||2<=d&&4>=d&&2<=c&&4>=c)}};
A.prototype._createData=function(){for(var a=new G,b=0;b<this.dataList.length;b++){var c=this.dataList[b];for(var d=0;d<c.data.length;d++)a.put(c.data.charCodeAt(d),8)}return D(this.typeNumber,F.M,a)};A.prototype._mapData=function(a){for(var b=0,c=this.moduleCount-1,d=this.moduleCount-1,e=1;0<d;d-=2){6==d&&d--;for(;;){for(var f=0;2>f;f++)null==this.modules[c][d-f]&&(this.modules[c][d-f]=0<b&&0!=(a[b-1]&1<<f)?!0:!1,b++);c+=e;if(0>c||this.moduleCount<=c){c-=e;e=-e;break}}}};B.prototype={get:function(a){return this.num[a]},getLength:function(){return this.num.length}};C.RS_BLOCK_TABLE=[[1,26,19],[1,44,34],[1,70,55],[1,100,80],[2,134,108],[2,172,139],[2,196,154],[2,242,202],[2,292,235],[2,346,271]];C.getRSBlocks=function(a,b){return[C.RS_BLOCK_TABLE[a-1]]};function D(a,b,c){for(var d=C.getRSBlocks(a,b),e=new G,f=0;f<d.length;f++){var g=d[f];for(var h=0;h<g[2];h++)e.put(c.get(h),8)}for(;e.length%8!=0;)e.putBit(!1);return function(a){for(var b=[],c=0;c<a.buffer.length;c++)b.push(a.buffer[c]);return b}(e)};window.QRCode=z;window.QRErrorCorrectLevel=F;})();

/* ===== QR Helpers & Modal ===== */
let qrRendered = false;

function openQrModal() {
  const modal = $('#qrModal');
  const box = $('#qrBox');

  // show modal first (ensures measurable size)
  modal.setAttribute('aria-hidden', 'false');

  // clear old content
  while (box.firstChild) box.removeChild(box.firstChild);
  qrRendered = false;

  // render in next tick to avoid layout race
  setTimeout(() => {
    const level = (window.QRCode && window.QRErrorCorrectLevel && QRErrorCorrectLevel.M) || 0; // M or fallback
    new QRCode(box, {
      text: location.href,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: level
    });
    qrRendered = true;
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
