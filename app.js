const KEY = "card:data:v2";
const $ = s => document.querySelector(s);

const defaults = {
  fullName: "Your Name",
  company: "Company Name",
  position: "Position / Title",
  avatar: "avatar.jpg",
  tags: ["Services", "Consulting"],
  email: "you@example.com",
  phone: "+1000000000",
  website: "https://example.com",
  instagram: "@yourhandle",
  facebook: "your.fb",
  linkedin: "your-linkedin",
  ctaLabel: "Get in touch here",
  ctaLink: "#"
};

function load() {
  try { return {...defaults, ...JSON.parse(localStorage.getItem(KEY)||"{}")} }
  catch { return {...defaults}; }
}
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

function render(d){
  $("#avatar").src = d.avatar;
  $("#fullName").textContent = d.fullName;
  $("#company").textContent = d.company;
  $("#position").textContent = d.position;

  const tags = $("#tags");
  tags.innerHTML = "";
  d.tags.forEach(t=>{
    const s=document.createElement("span");
    s.textContent=t; tags.appendChild(s);
  });

  $("#quickEmail").href = `mailto:${d.email}`;
  $("#quickCall").href = `tel:${d.phone}`;

  $("#emailLink").href = `mailto:${d.email}`;
  $("#emailLink span").textContent = d.email;

  $("#phoneLink").href = `tel:${d.phone}`;
  $("#phoneLink span").textContent = d.phone;

  $("#websiteLink").href = d.website;
  $("#websiteLink span").textContent = d.website;

  $("#instagramLink").href = "https://instagram.com/"+d.instagram.replace("@","");
  $("#instagramLink span").textContent = d.instagram;

  $("#facebookLink").href = "https://facebook.com/"+d.facebook;
  $("#facebookLink span").textContent = d.facebook;

  $("#linkedinLink").href = "https://linkedin.com/in/"+d.linkedin;
  $("#linkedinLink span").textContent = d.linkedin;

  $("#ctaBtn").textContent = d.ctaLabel;
  $("#ctaBtn").href = d.ctaLink;
}

function downloadVCF(d){
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${d.fullName}`,
    `ORG:${d.company}`,
    `TITLE:${d.position}`,
    d.phone?`TEL:${d.phone}`:"",
    d.email?`EMAIL:${d.email}`:"",
    d.website?`URL:${d.website}`:"",
    "END:VCARD"
  ].filter(Boolean).join("\r\n");

  const blob=new Blob([vcf],{type:"text/vcard"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="contact.vcf";
  a.click();
}

function openQrModal(){
  const modal=$("#qrModal"), box=$("#qrBox");
  modal.setAttribute("aria-hidden","false");
  box.innerHTML="";
  new QRCode(box,{text:location.href,width:220,height:220,colorDark:"#000",colorLight:"#fff",correctLevel:QRCode.CorrectLevel.M});
}
function closeQrModal(){ $("#qrModal").setAttribute("aria-hidden","true"); }
function downloadQrPng(){
  const c=$("#qrBox canvas"); if(!c) return;
  const a=document.createElement("a");
  a.href=c.toDataURL("image/png"); a.download="qr.png"; a.click();
}

window.addEventListener("DOMContentLoaded",()=>{
  const st=load(); render(st);

  $("#saveVcfBtn").onclick=()=>downloadVCF(load());
  $("#quickShare").onclick=async()=>{
    try { await navigator.share({title:st.fullName,text:st.company,url:location.href}); }
    catch{ await navigator.clipboard.writeText(location.href); alert("Link copied ✅"); }
  };
  $("#downloadQrBtn").onclick=downloadQrPng;
  $("#closeQr").onclick=closeQrModal;
});
