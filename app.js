const KEY = "card:data:v1";
const $ = s => document.querySelector(s);

const defaults = {
  fullName: "Your Name",
  title: "Your Role",
  bio: "One-liner about you.",
  avatar: "",
  email: "",
  phone: "",
  website: "",
  ctaLabel: "Book a call",
  ctaLink: "#"
};

function load() {
  try { return {...defaults, ...JSON.parse(localStorage.getItem(KEY)||"{}")} }
  catch { return {...defaults}; }
}
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

function render(d){
  $("#avatar").src = d.avatar || "";
  $("#fullName").textContent = d.fullName;
  $("#title").textContent = d.title;
  $("#bio").textContent = d.bio;
  $("#emailLink").href = d.email ? `mailto:${d.email}` : "#";
  $("#phoneLink").href = d.phone ? `tel:${d.phone}` : "#";
  $("#siteLink").href = d.website || "#";
  $("#ctaBtn").textContent = d.ctaLabel;
  $("#ctaBtn").href = d.ctaLink || "#";
}

function fillForm(d){
  const f = $("#settingsForm"); if(!f) return;
  for (let k in d) if(f.elements[k]) f.elements[k].value = d[k];
}

// Drawer
function openDrawer(open) { $("#drawer").setAttribute("aria-hidden", open?"false":"true"); }

// QR
function openQrModal(){
  const modal=$("#qrModal"), box=$("#qrBox");
  modal.setAttribute("aria-hidden","false");
  while(box.firstChild) box.removeChild(box.firstChild);
  new QRCode(box,{
    text: location.href,
    width: 256, height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}
function closeQrModal(){ $("#qrModal").setAttribute("aria-hidden","true"); }
function downloadQrPng(){
  const c=$("#qrBox canvas");
  if(!c){alert("Generate QR first"); return;}
  const a=document.createElement("a");
  a.href=c.toDataURL("image/png");
  a.download="my-card-qr.png";
  a.click();
}

// Init
window.addEventListener("DOMContentLoaded",()=>{
  const st=load(); render(st); fillForm(st);

  $("#editBtn").onclick = ()=>openDrawer(true);
  $("#closeDrawer").onclick = ()=>openDrawer(false);

  $("#settingsForm").onsubmit = e=>{
    e.preventDefault();
    const f=e.target;
    const u={
      fullName:f.fullName.value,
      title:f.title.value,
      bio:f.bio.value,
      avatar:f.avatar.value,
      email:f.email.value,
      phone:f.phone.value,
      website:f.website.value,
      ctaLabel:f.ctaLabel.value,
      ctaLink:f.ctaLink.value
    };
    save(u); render(u); openDrawer(false);
  };

  $("#shareBtn").onclick = async()=>{
    try {
      await navigator.share({title:st.fullName,text:st.title,url:location.href});
    } catch {
      await navigator.clipboard.writeText(location.href);
      alert("Link copied ✅");
    }
  };

  $("#qrBtn").onclick = openQrModal;
  $("#closeQr").onclick = closeQrModal;
  $("#downloadQrBtn").onclick = downloadQrPng;
});
