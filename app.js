const KEY = "card:data:dark-v1";
const $ = s => document.querySelector(s);

const defaults = {
  fullName: "Your Name",
  company: "Company Name",
  position: "Position / Title",
  avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop",
  tags: ["IT Services", "Consulting"],
  email: "you@example.com",
  phone: "+1000000000",
  website: "https://example.com",
  instagram: "@yourhandle",
  facebook: "your.fb",
  linkedin: "your-linkedin",
  ctaLabel: "Get in touch here",
  ctaLink: "https://cal.com/"
};

function load() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...defaults }; }
}
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

function setText(sel, t) { const el = $(sel); if (el) el.textContent = t || ""; }
function setAttr(sel, a, v) { const el = $(sel); if (el) el.setAttribute(a, v); }

function render(d) {
  setAttr("#avatar", "src", d.avatar || "");
  setText("#fullName", d.fullName);
  setText("#company", d.company);
  setText("#position", d.position);

  // tags
  const wrap = $("#tags"); wrap.innerHTML = "";
  (d.tags || []).filter(Boolean).forEach(tag => {
    const s = document.createElement("span"); s.textContent = tag.trim(); wrap.appendChild(s);
  });

  // quick actions
  setAttr("#quickEmail", "href", d.email ? `mailto:${d.email}` : "#");
  setAttr("#quickCall", "href", d.phone ? `tel:${d.phone}` : "#");

  // contact list
  const emailEl = $("#emailLink"); emailEl.href = d.email ? `mailto:${d.email}` : "#"; emailEl.querySelector("span").textContent = d.email || "—";
  const phoneEl = $("#phoneLink"); phoneEl.href = d.phone ? `tel:${d.phone}` : "#"; phoneEl.querySelector("span").textContent = d.phone || "—";
  const siteEl  = $("#websiteLink"); siteEl.href = d.website || "#"; siteEl.querySelector("span").textContent = d.website || "—";

  const ig = (d.instagram || "").replace(/^@/,"");
  const fb = d.facebook || "";
  const li = d.linkedin || "";

  const igEl = $("#instagramLink"); igEl.href = ig ? `https://instagram.com/${ig}` : "#"; igEl.querySelector("span").textContent = d.instagram || "—";
  const fbEl = $("#facebookLink"); fbEl.href = fb ? `https://facebook.com/${fb}` : "#"; fbEl.querySelector("span").textContent = fb || "—";
  const liEl = $("#linkedinLink"); liEl.href = li ? `https://linkedin.com/in/${li}` : "#"; liEl.querySelector("span").textContent = li || "—";

  const cta = $("#ctaBtn"); cta.textContent = d.ctaLabel || "Learn more"; cta.href = d.ctaLink || "#";
}

function fillForm(d) {
  const f = $("#settingsForm");
  const shape = {
    fullName: d.fullName, company: d.company, position: d.position, avatar: d.avatar,
    email: d.email, phone: d.phone, website: d.website,
    instagram: d.instagram, facebook: d.facebook, linkedin: d.linkedin,
    tags: (d.tags || []).join(", "),
    ctaLabel: d.ctaLabel, ctaLink: d.ctaLink
  };
  Object.entries(shape).forEach(([k,v]) => { if (f.elements[k]) f.elements[k].value = v ?? ""; });
}

function parseForm() {
  const f = $("#settingsForm");
  const tags = (f.tags.value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return {
    fullName: f.fullName.value.trim(),
    company: f.company.value.trim(),
    position: f.position.value.trim(),
    avatar: f.avatar.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    website: f.website.value.trim(),
    instagram: f.instagram.value.trim(),
    facebook: f.facebook.value.trim(),
    linkedin: f.linkedin.value.trim(),
    tags,
    ctaLabel: f.ctaLabel.value.trim(),
    ctaLink: f.ctaLink.value.trim()
  };
}

function downloadVCF(d) {
  const lines = [
    "BEGIN:VCARD","VERSION:3.0",
    `FN:${d.fullName}`,
    d.company ? `ORG:${d.company}` : "",
    d.position ? `TITLE:${d.position}` : "",
    d.phone ? `TEL:${d.phone}` : "",
    d.email ? `EMAIL:${d.email}` : "",
    d.website ? `URL:${d.website}` : "",
    "END:VCARD"
  ].filter(Boolean).join("\r\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines], { type: "text/vcard" }));
  a.download = (d.fullName || "contact").replace(/\s+/g, "_") + ".vcf";
  document.body.appendChild(a); a.click(); a.remove();
}

/* Drawer helpers */
function openDrawer(open) { $("#drawer").setAttribute("aria-hidden", open ? "false" : "true"); }

/* QR helpers */
function openQrModal() {
  const modal = $("#qrModal"), box = $("#qrBox");
  modal.setAttribute("aria-hidden", "false");
  box.innerHTML = "";
  new QRCode(box, {
    text: location.href,
    width: 240, height: 240,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}
function closeQrModal(){ $("#qrModal").setAttribute("aria-hidden","true"); }
function downloadQrPng(){
  const canvas = $("#qrBox canvas");
  if (!canvas) { alert("Generate the QR first."); return; }
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "my-card-qr.png";
  a.click();
}

/* Init */
window.addEventListener("DOMContentLoaded", () => {
  const state = load();
  render(state);
  fillForm(state);

  // Drawer events
  $("#openSettings").addEventListener("click", () => openDrawer(true));
  $("#closeSettings").addEventListener("click", () => openDrawer(false));
  $("#settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const next = { ...load(), ...parseForm() };
    save(next); render(next); openDrawer(false);
  });

  // Import / Export / Reset
  $("#exportBtn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(load(), null, 2)], { type: "application/json" }));
    a.download = "card-settings.json";
    document.body.appendChild(a); a.click(); a.remove();
  });
  $("#importInput").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try{
      const json = JSON.parse(await file.text());
      const merged = { ...defaults, ...json };
      save(merged); render(merged); fillForm(merged);
      alert("Imported ✅");
    }catch{ alert("Invalid JSON ❌"); }
    e.target.value = "";
  });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Reset to defaults?")) return;
    localStorage.removeItem(KEY);
    const fresh = load(); render(fresh); fillForm(fresh);
  });

  // Actions
  $("#saveVcfBtn").addEventListener("click", () => downloadVCF(load()));
  $("#quickShare").addEventListener("click", async () => {
    const d = load();
    const payload = {
      title: d.fullName || "My Card",
      text: `${d.fullName} — ${d.company}\n${d.website || ""}`,
      url: location.href
    };
    try { if (navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(payload.url); alert("Link copied ✅"); } }
    catch{} // ignore cancel
  });
  $("#quickQr").addEventListener("click", openQrModal);
  $("#closeQr").addEventListener("click", closeQrModal);
  $("#downloadQrBtn").addEventListener("click", downloadQrPng);
});
