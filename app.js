/* Make sure SW refreshes on new deploys (optional) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.update();
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    }
  });
}

/* ===== State & helpers ===== */
const KEY='card:data:v1', ANALYTICS_KEY='card:analytics:v1';
const $=s=>document.querySelector(s);
const defaults={fullName:'Your Name',title:'Your Role',bio:'One-liner about what you do.',avatar:'',email:'you@example.com',phone:'+10000000000',website:'https://example.com',ctaLabel:'Book a call',ctaLink:'#',analyticsEnabled:true,analyticsWebhook:''};
const load=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
const save=d=>localStorage.setItem(KEY,JSON.stringify(d));
const setText=(sel,t)=>{const el=$(sel); if(el) el.textContent=t||''};
const setAttr=(sel,a,v)=>{const el=$(sel); if(el) el.setAttribute(a,v)};

/* Render & form */
function render(d){
  setAttr('#avatar','src',d.avatar||'');
  setText('#fullName',d.fullName); setText('#title',d.title); setText('#bio',d.bio);
  setAttr('#emailLink','href',d.email?`mailto:${d.email}`:'#');
  setAttr('#phoneLink','href',d.phone?`tel:${d.phone}`:'#');
  setAttr('#siteLink','href',d.website||'#');
  const c=$('[data-cta]'); if(c){ c.textContent=d.ctaLabel||'Learn more'; c.href=d.ctaLink||'#'; }
}
function fillForm(d){
  const f=$('#settingsForm'); if(!f) return;
  Object.entries(d).forEach(([k,v])=>{const el=f.elements[k]; if(!el) return; el.type==='checkbox'?el.checked=!!v:el.value=v??'';});
}

/* vCard */
function downloadVCF(d){
  const lines=['BEGIN:VCARD','VERSION:3.0',`FN:${d.fullName}`,d.title?`TITLE:${d.title}`:'',d.email?`EMAIL:${d.email}`:'',d.phone?`TEL:${d.phone}`:'',d.website?`URL:${d.website}`:'','END:VCARD'].filter(Boolean).join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([lines],{type:'text/vcard'})); a.download=(d.fullName||'contact').replace(/\s+/g,'_')+'.vcf'; document.body.appendChild(a); a.click(); a.remove();
}

/* Drawer (exists in this build) */
function openDrawer(open){ $('#drawer').setAttribute('aria-hidden',open?'false':'true'); }

/* Init */
window.addEventListener('DOMContentLoaded',()=>{
  const st=load(); render(st); fillForm(st);

  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');

  $('#editBtn').addEventListener('click',()=>openDrawer(true));
  $('#closeDrawer').addEventListener('click',()=>openDrawer(false));

  $('#settingsForm').addEventListener('submit',e=>{
    e.preventDefault(); const f=e.currentTarget;
    const u={...load(),
      fullName:f.fullName.value.trim(), title:f.title.value.trim(), bio:f.bio.value.trim(),
      avatar:f.avatar.value.trim(), email:f.email.value.trim(), phone:f.phone.value.trim(),
      website:f.website.value.trim(), ctaLabel:f.ctaLabel.value.trim(), ctaLink:f.ctaLink.value.trim(),
      analyticsEnabled:f.analyticsEnabled.checked, analyticsWebhook:f.analyticsWebhook.value.trim()
    };
    save(u); render(u); openDrawer(false);
  });

  $('#exportBtn').addEventListener('click',()=>{const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(load(),null,2)],{type:'application/json'})); a.download='card-settings.json'; document.body.appendChild(a); a.click(); a.remove();});
  $('.import').addEventListener('click',()=>$('#importInput').click());
  $('#importInput').addEventListener('change',async e=>{const file=e.target.files[0]; if(!file) return; try{const json=JSON.parse(await file.text()); save({...defaults,...json}); render(load()); fillForm(load()); alert('Imported ✅');}catch{alert('Invalid JSON ❌');} e.target.value=''; });
  $('#resetBtn').addEventListener('click',()=>{ if(!confirm('Reset to defaults?')) return; localStorage.removeItem(KEY); render(load()); fillForm(load()); });

  $('#shareBtn').addEventListener('click',async()=>{const d=load(); const payload={title:d.fullName||'My Card',text:`${d.fullName} — ${d.title}\n${d.website||''}`,url:location.href}; try{ if(navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(payload.url); alert('Link copied'); } }catch{} });
  $('#saveVcfBtn').addEventListener('click',()=>downloadVCF(load()));

  $('#qrBtn').addEventListener('click',()=>openQrModal());
  $('#closeQr').addEventListener('click',closeQrModal);
  $('#downloadQrBtn').addEventListener('click',downloadQrPng);
});

/* QR (uses qrcode.min.js) */
function openQrModal(){
  const modal=$('#qrModal'), box=$('#qrBox'); modal.setAttribute('aria-hidden','false');
  while (box.firstChild) box.removeChild(box.firstChild);

  // If QRCode not yet defined (fallback script still loading), wait a tick
  const ensure = () => {
    if (window.QRCode && QRCode.CorrectLevel) {
      new QRCode(box,{text:location.href,width:256,height:256,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    } else {
      setTimeout(ensure, 50);
    }
  };
  ensure();
}
function closeQrModal(){ $('#qrModal').setAttribute('aria-hidden','true'); }
function downloadQrPng(){ const c=$('#qrBox canvas'), img=$('#qrBox img'); const src=c?c.toDataURL('image/png'):img?.src; if(!src){alert('Generate the QR first.');return;} const a=document.createElement('a'); a.href=src; a.download='my-card-qr.png'; document.body.appendChild(a); a.click(); a.remove(); }
