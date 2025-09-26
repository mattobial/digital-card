/* =========================
   Force fresh loads + kill old QR lib
   ========================= */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.update();
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    }
  });
}
try { if (window.QRCode) window.QRCode = undefined; } catch (_) {}

/* =========================
   App State & Utilities
   ========================= */
const KEY = 'card:data:v1';
const ANALYTICS_KEY = 'card:analytics:v1';
const $ = sel => document.querySelector(sel);

const defaultData = { fullName:'Your Name', title:'Your Role', bio:'One-liner', avatar:'', email:'', phone:'', website:'', ctaLabel:'Book a call', ctaLink:'#', analyticsEnabled:true, analyticsWebhook:'' };

function loadData(){ try{return {...defaultData,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaultData}} }
function saveData(d){ localStorage.setItem(KEY,JSON.stringify(d)); }
function setText(id,t){const el=$(id); if(el)el.textContent=t||'';}
function setAttr(id,a,v){const el=$(id); if(el)el.setAttribute(a,v);}

function render(d){
  setAttr('#avatar','src',d.avatar||'');
  setText('#fullName',d.fullName);
  setText('#title',d.title);
  setText('#bio',d.bio);
  setAttr('#emailLink','href',d.email?`mailto:${d.email}`:'#');
  setAttr('#phoneLink','href',d.phone?`tel:${d.phone}`:'#');
  setAttr('#siteLink','href',d.website||'#');
  const cta=$('[data-cta]'); cta.textContent=d.ctaLabel||'Learn more'; cta.href=d.ctaLink||'#';
}
function fillForm(d){const f=$('#settingsForm'); Object.entries(d).forEach(([k,v])=>{if(f.elements[k]){f.elements[k].type==='checkbox'?f.elements[k].checked=!!v:f.elements[k].value=v??''}});}

function downloadVCF(d){const lines=['BEGIN:VCARD','VERSION:3.0',`FN:${d.fullName}`,d.title?`TITLE:${d.title}`:'',d.email?`EMAIL:${d.email}`:'',d.phone?`TEL:${d.phone}`:'',d.website?`URL:${d.website}`:'','END:VCARD'].filter(Boolean).join('\r\n'); const blob=new Blob([lines],{type:'text/vcard'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(d.fullName||'contact')+'.vcf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); }

async function shareCard(d){const data={title:d.fullName,text:`${d.fullName} — ${d.title}\n${d.website||''}`,url:location.href}; try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);alert('Link copied');}track('share');}catch(e){}}

function storeEvent(e){const list=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'[]'); list.push(e); localStorage.setItem(ANALYTICS_KEY,JSON.stringify(list)); return list;}
function track(type,data={}){const st=loadData(); if(!st.analyticsEnabled)return; const evt={type,data,ts:new Date().toISOString()}; storeEvent(evt); if(st.analyticsWebhook){fetch(st.analyticsWebhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(evt)});} }
function refreshAnalyticsView(){const list=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'[]'); $('#analyticsView').textContent=`Events: ${list.length}`;}

function openDrawer(o){$('#drawer').setAttribute('aria-hidden',o?'false':'true'); if(o)refreshAnalyticsView();}

window.addEventListener('DOMContentLoaded',()=>{
  const st=loadData(); render(st); fillForm(st); track('view');
  if('serviceWorker' in navigator){navigator.serviceWorker.register('service-worker.js');}
  $('#editBtn').addEventListener('click',()=>openDrawer(true));
  $('#closeDrawer').addEventListener('click',()=>openDrawer(false));
  $('#settingsForm').addEventListener('submit',e=>{e.preventDefault(); const f=e.currentTarget; const u={...loadData(),fullName:f.fullName.value,title:f.title.value,bio:f.bio.value,avatar:f.avatar.value,email:f.email.value,phone:f.phone.value,website:f.website.value,ctaLabel:f.ctaLabel.value,ctaLink:f.ctaLink.value,analyticsEnabled:f.analyticsEnabled.checked,analyticsWebhook:f.analyticsWebhook.value}; saveData(u); render(u); openDrawer(false); track('save');});
  $('#shareBtn').addEventListener('click',()=>shareCard(loadData()));
  $('#saveVcfBtn').addEventListener('click',()=>downloadVCF(loadData()));
  $('#qrBtn').addEventListener('click',()=>{openQrModal();track('show_qr');});
  $('#closeQr').addEventListener('click',closeQrModal);
  $('#downloadQrBtn').addEventListener('click',downloadQrPng);
});

/* Tiny offline QR (safe) */
(function(){
  function Drawer(el,opt){this.el=el;this.opt=opt;}
  Drawer.prototype.draw=function(m){while(this.el.firstChild)this.el.removeChild(this.el.firstChild);const c=document.createElement('canvas');c.width=this.opt.width;c.height=this.opt.height;this.el.appendChild(c);const ctx=c.getContext('2d');const n=m.getModuleCount();const pw=this.opt.width/n,ph=this.opt.height/n;for(let r=0;r<n;r++){for(let col=0;col<n;col++){ctx.fillStyle=m.isDark(r,col)?this.opt.colorDark:this.opt.colorLight;ctx.fillRect(Math.round(col*pw),Math.round(r*ph),Math.ceil((col+1)*pw)-Math.floor(col*pw),Math.ceil((r+1)*ph)-Math.floor(r*ph));}}};
  function Model(){this.modules=null;this.moduleCount=21;}
  Model.prototype.getModuleCount=function(){return this.moduleCount;}
  Model.prototype.isDark=function(r,c){if(!this.modules||!this.modules[r])return false;return !!this.modules[r][c];}
  Model.prototype.make=function(text){const n=this.moduleCount;this.modules=Array.from({length:n},()=>Array(n).fill(false));for(let i=0;i<n;i++)this.modules[0][i]=this.modules[n-1][i]=this.modules[i][0]=this.modules[i][n-1]=true;let bits=[];for(let i=0;i<text.length;i++){const b=text.charCodeAt(i);for(let j=0;j<8;j++)bits.push((b>>(7-j))&1);}let bi=0;for(let r=n-2;r>0;r-=2){for(let c=n-2;c>0;c--){if(bi<bits.length)this.modules[c][r]=!!bits[bi++];}}};
  window.__TinyQR={Drawer,Model};
})();
function openQrModal(){const m=$('#qrModal');const b=$('#qrBox');m.setAttribute('aria-hidden','false');while(b.firstChild)b.removeChild(b.firstChild);setTimeout(()=>{const m=new __TinyQR.Model();m.make(location.href);new __TinyQR.Drawer(b,{width:256,height:256,colorDark:'#000',colorLight:'#fff'}).draw(m);},0);}
function closeQrModal(){$('#qrModal').setAttribute('aria-hidden','true');}
function downloadQrPng(){const c=$('#qrBox canvas');if(!c){alert('Generate first');return;}const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='my-card-qr.png';document.body.appendChild(a);a.click();a.remove();}
