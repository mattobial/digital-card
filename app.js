/* Ensure SW updates */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.update();
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    }
  });
}

/* ===== App state ===== */
const KEY='card:data:v1', ANALYTICS_KEY='card:analytics:v1';
const $=s=>document.querySelector(s);
const defaultData={fullName:'Your Name',title:'Your Role',bio:'One-liner about what you do.',avatar:'',email:'',phone:'',website:'',ctaLabel:'Book a call',ctaLink:'#',analyticsEnabled:true,analyticsWebhook:''};
const load=()=>{try{return {...defaultData,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaultData}}};
const save=d=>localStorage.setItem(KEY,JSON.stringify(d));
const setText=(sel,t)=>{const el=$(sel); if(el) el.textContent=t||''};
const setAttr=(sel,a,v)=>{const el=$(sel); if(el) el.setAttribute(a,v)};

/* Render */
function render(d){
  setAttr('#avatar','src',d.avatar||'');
  setText('#fullName',d.fullName); setText('#title',d.title); setText('#bio',d.bio);
  setAttr('#emailLink','href',d.email?`mailto:${d.email}`:'#');
  setAttr('#phoneLink','href',d.phone?`tel:${d.phone}`:'#');
  setAttr('#siteLink','href',d.website||'#');
  const c=$('[data-cta]'); c.textContent=d.ctaLabel||'Learn more'; c.href=d.ctaLink||'#';
}
function fillForm(d){
  const f=$('#settingsForm'); Object.entries(d).forEach(([k,v])=>{
    if (f.elements[k]) f.elements[k].type==='checkbox' ? f.elements[k].checked=!!v : f.elements[k].value=v??'';
  });
}

/* vCard */
function downloadVCF(d){
  const txt=['BEGIN:VCARD','VERSION:3.0',`FN:${d.fullName}`,d.title?`TITLE:${d.title}`:'',d.email?`EMAIL:${d.email}`:'',d.phone?`TEL:${d.phone}`:'',d.website?`URL:${d.website}`:'','END:VCARD'].filter(Boolean).join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/vcard'})); a.download=(d.fullName||'contact').replace(/\s+/g,'_')+'.vcf'; document.body.appendChild(a); a.click(); a.remove();
}

/* Analytics (local + webhook) */
const storeEvt=e=>{const L=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'[]'); L.push(e); localStorage.setItem(ANALYTICS_KEY',JSON.stringify(L)); return L};
function track(type,data={}){
  const st=load(); if(!st.analyticsEnabled) return;
  const evt={type,data,ts:new Date().toISOString()};
  const L=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'[]'); L.push(evt); localStorage.setItem(ANALYTICS_KEY,JSON.stringify(L));
  if(st.analyticsWebhook){try{navigator.sendBeacon?.(st.analyticsWebhook,new Blob([JSON.stringify(evt)],{type:'application/json'}))}catch{fetch(st.analyticsWebhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evt)})}}
}
function refreshAnalyticsView(){
  const L=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'[]');
  const totals=L.reduce((a,e)=>(a[e.type]=(a[e.type]||0)+1,a),{});
  setText('#analyticsView',`Events: ${L.length}\nBreakdown: ${JSON.stringify(totals,null,2)}`);
}

/* Drawer */
function openDrawer(open){ $('#drawer').setAttribute('aria-hidden',open?'false':'true'); if(open) refreshAnalyticsView(); }

/* Init */
window.addEventListener('DOMContentLoaded',()=>{
  const st=load(); render(st); fillForm(st); track('view');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');

  $('#editBtn').addEventListener('click',()=>openDrawer(true));
  $('#closeDrawer').addEventListener('click',()=>openDrawer(false));
  $('#settingsForm').addEventListener('submit',e=>{
    e.preventDefault(); const f=e.currentTarget;
    const u={...load(),fullName:f.fullName.value.trim(),title:f.title.value.trim(),bio:f.bio.value.trim(),avatar:f.avatar.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),website:f.website.value.trim(),ctaLabel:f.ctaLabel.value.trim(),ctaLink:f.ctaLink.value.trim(),analyticsEnabled:f.analyticsEnabled.checked,analyticsWebhook:f.analyticsWebhook.value.trim()};
    save(u); render(u); openDrawer(false); track('save_settings');
  });

  $('#exportBtn').addEventListener('click',()=>{
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(load(),null,2)],{type:'application/json'})); a.download='card-settings.json'; document.body.appendChild(a); a.click(); a.remove(); track('export_settings');
  });
  $('.import').addEventListener('click',()=>$('#importInput').click());
  $('#importInput').addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file) return;
    try{const json=JSON.parse(await file.text()); save({...defaultData,...json}); render(load()); fillForm(load()); alert('Imported ✅'); track('import_settings');}
    catch{alert('Invalid JSON ❌');}
    e.target.value='';
  });
  $('#resetBtn').addEventListener('click',()=>{ if(!confirm('Reset to defaults?')) return; localStorage.removeItem(KEY); render(load()); fillForm(load()); track('reset'); });

  $('#shareBtn').addEventListener('click',async ()=>{
    const d=load(); const payload={title:d.fullName||'My Card',text:`${d.fullName} — ${d.title}\n${d.website||''}`,url:location.href};
    try{ if(navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(payload.url); alert('Link copied'); } track('share'); } catch {}
  });
  $('#saveVcfBtn').addEventListener('click',()=>{ downloadVCF(load()); track('download_vcf'); });

  $('#ctaBtn').addEventListener('click',()=>track('cta_click'));
  $('#emailLink').addEventListener('click',()=>track('link_email'));
  $('#phoneLink').addEventListener('click',()=>track('link_phone'));
  $('#siteLink').addEventListener('click',()=>track('link_website'));

  // QR
  $('#qrBtn').addEventListener('click',()=>{ openQrModal(); track('show_qr'); });
  $('#closeQr').addEventListener('click',closeQrModal);
  $('#downloadQrBtn').addEventListener('click',downloadQrPng);
});

/* Proper QR via qrcode.min.js */
let qrInstance=null;
function openQrModal(){
  const modal=$('#qrModal'), box=$('#qrBox');
  modal.setAttribute('aria-hidden','false');
  while (box.firstChild) box.removeChild(box.firstChild);
  setTimeout(()=>{ // render after layout
    qrInstance=new QRCode(box,{text:location.href,width:256,height:256,colorDark:"#000",colorLight:"#fff",correctLevel:QRCode.CorrectLevel.M});
  },0);
}
function closeQrModal(){ $('#qrModal').setAttribute('aria-hidden','true'); }
function downloadQrPng(){
  const canvas=$('#qrBox canvas'), img=$('#qrBox img');
  const src=canvas?canvas.toDataURL('image/png'):img?.src;
  if(!src) return alert('Generate the QR first.');
  const a=document.createElement('a'); a.href=src; a.download='my-card-qr.png'; document.body.appendChild(a); a.click(); a.remove();
}
