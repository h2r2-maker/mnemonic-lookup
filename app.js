const $ = (id) => document.getElementById(id);
const screens = ["homeScreen","scanScreen","galleryScreen","resultScreen","notFoundScreen"];
let records = [];
let cameraStream = null;
let previousScreen = "homeScreen";

function showScreen(id) {
  screens.forEach(s => $(s).hidden = s !== id);
  $("homeButton").hidden = id === "homeScreen";
  if (id !== "scanScreen") stopCamera();
  window.scrollTo({top:0,behavior:"smooth"});
}
function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  cameraStream = null;
  if ($("cameraVideo").srcObject) $("cameraVideo").srcObject = null;
}
function normalizeCode(s) {
  return String(s || "").toUpperCase().replace(/[–—]/g,"-").replace(/\s+/g,"").trim();
}
function compactCode(s) {
  // OCR can insert spaces or miss punctuation, so compare only letters and digits.
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function findRecord(code) {
  const normalized = normalizeCode(code);
  return records.find(r => normalizeCode(r.code) === normalized);
}
function findRecordInOcr(ocrText) {
  // Match known lookup codes as separate text strings, allowing OCR to insert
  // spaces or punctuation between code characters, but not embedded in words.
  const text = String(ocrText || "").toUpperCase().replace(/[–—]/g, "-");
  const candidates = records.map(record => {
    const compact = compactCode(record.code);
    const pattern = compact.split("").join("[\\s\\W_]*");
    return { record, compact, regex: new RegExp(`(?:^|[^A-Z0-9])${pattern}(?=$|[^A-Z0-9])`, "i") };
  }).filter(item => item.compact);
  const matches = candidates.filter(item => item.regex.test(text))
    .sort((a, b) => b.compact.length - a.compact.length);
  return matches.length ? matches[0].record : null;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function posterArt(record, compact=false) {
 if (record.image) return `<img class="${compact ? "poster-art" : "result-art"}" src="${escapeHtml(record.image)}" alt="${escapeHtml(record.title || record.code)}" onerror="this.style.display='none'">`;
 return `<div class="${compact ? "poster-art" : "poster-art result-placeholder"}"><span class="poster-symbol">▧</span><span>${Poster}</span><small>Replace with your poster image</small></div>`;
   
}
function showResult(record) {
  if (!record) return showNotFound("");
  $("resultContent").innerHTML = `<h1>Poster Found</h1>
    <div class="result-card">${posterArt(record)}<div class="result-details">
      <div class="eyebrow">Mnemonic code</div>
      <div class="code-value">${escapeHtml(record.code)}</div>
      
      <div class="eyebrow">Quantity</div>
      <div class="quantity">${escapeHtml(record.quantity)}</div>
    </div></div>`;
  previousScreen = "homeScreen";
  showScreen("resultScreen");
}
function showNotFound(text) {
  $("notFoundMessage").textContent = text ? `Recognized text: “${text}”. Check the code or enter it below.` : "We couldn't match that text to a code in the lookup table.";
  $("retryCode").value = text;
  showScreen("notFoundScreen");
}
function lookup(code) {
  const r = findRecord(code);
  r ? showResult(r) : showNotFound(code);
}
function renderGallery(filter="") {
  const f = filter.toLowerCase().trim();
  const found = records.filter(r => `${r.code} ${r.title || ""}`.toLowerCase().includes(f));
  $("galleryGrid").innerHTML = found.map((r,i) => `<button class="poster-card" data-code="${escapeHtml(r.code)}">
    ${posterArt(r,true)}</div></button>`).join("");
    if (!found.length) $("galleryGrid").innerHTML = `<p class="muted">No posters match your search.</p>`;
  $("galleryGrid").querySelectorAll("button[data-code]").forEach(b => b.addEventListener("click", () => lookup(b.dataset.code)));
}
async function startCamera() {
  showScreen("scanScreen");
  $("scanStatus").textContent = "Requesting camera access…";
  if (!navigator.mediaDevices?.getUserMedia) {
    $("scanStatus").textContent = "Camera access isn't available in this browser. Use manual entry below.";
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    $("cameraVideo").srcObject = cameraStream;
    await $("cameraVideo").play();
    $("scanStatus").textContent = "Camera ready. Position the mnemonic inside the frame and capture.";
  } catch (e) {
    $("scanStatus").textContent = "Camera permission was denied or unavailable. You can enter the code manually below.";
  }
}
async function captureAndRead() {
  const video = $("cameraVideo");
  if (!video.videoWidth) { $("scanStatus").textContent = "Camera isn't ready yet. Try manual entry below."; return; }
  if (!window.Tesseract) { $("scanStatus").textContent = "Text recognition library didn't load. Enter the code manually."; return; }
  $("captureButton").disabled = true;
  $("scanStatus").textContent = "Reading text… this can take a few seconds.";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video,0,0);
    const result = await Tesseract.recognize(canvas, "eng");
    const text = result.data.text || "";
    // Search only for lookup-table codes. Any unrelated text in the photo is ignored.
    // Compact alphanumeric matching tolerates OCR-added spaces or missed punctuation.
    const match = findRecordInOcr(text);
    if (match) showResult(match);
    else showNotFound("");
  } catch (e) {
    $("scanStatus").textContent = "Couldn't read the image. Try better lighting or enter the code manually.";
  } finally { $("captureButton").disabled = false; }
}
$("scanChoice").addEventListener("click", startCamera);
$("browseChoice").addEventListener("click", () => { renderGallery(); showScreen("galleryScreen"); });
$("homeButton").addEventListener("click", () => showScreen("homeScreen"));
$("backButton").addEventListener("click", () => showScreen(previousScreen));
$("anotherScanButton").addEventListener("click", startCamera);
$("browseAgainButton").addEventListener("click", () => { renderGallery(); showScreen("galleryScreen"); });
$("returnHome").addEventListener("click", () => showScreen("homeScreen"));
$("captureButton").addEventListener("click", captureAndRead);
$("manualLookup").addEventListener("click", () => lookup($("manualCode").value));
$("manualCode").addEventListener("keydown", e => { if(e.key==="Enter") lookup($("manualCode").value); });
$("retryLookup").addEventListener("click", () => lookup($("retryCode").value));
$("retryCode").addEventListener("keydown", e => { if(e.key==="Enter") lookup($("retryCode").value); });
$("gallerySearch").addEventListener("input", e => renderGallery(e.target.value));

async function loadData() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error("Could not load data.json");
    records = await response.json();
    $("dataStatus").textContent = `${records.length} lookup records`;
    renderGallery();
  } catch (e) {
    $("dataStatus").textContent = "Lookup data unavailable";
    $("galleryGrid").innerHTML = "<p>Could not load lookup data. Check that data.json is included with the app.</p>";
  }
}
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
loadData();
