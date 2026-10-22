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
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeOcrCode(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[O]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^A-Z0-9]/g, "");
}

function stripOcrNoise(text) {
  return String(text || "")
    .replace(/\b\d{6}\b/g, " ")
    .replace(/PRINTED\s+IN\s+[A-Z]+/gi, " ")
    .replace(/VIETNAM/gi, " ")
    .replace(/CHINA/gi, " ")
    .replace(/MADE\s+IN\s+[A-Z]+/gi, " ");
}

function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function findRecordInOcr(ocrText) {
  const cleaned = stripOcrNoise(ocrText);
  const normalizedText = normalizeOcrCode(cleaned);

  let bestMatch = null;
  let bestDistance = 999;

  for (const record of records) {
    const target = normalizeOcrCode(record.code);

    if (!target) continue;

    if (normalizedText.includes(target)) {
      return record;
    }

    for (let i = 0; i <= normalizedText.length - target.length; i++) {
      const candidate = normalizedText.substring(
        i,
        i + target.length
      );

      const distance = levenshtein(candidate, target);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = record;
      }
    }
  }

  return bestDistance <= 2 ? bestMatch : null;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function posterArt(record, compact=false) {
 if (record.image) return `<img class="${compact ? "poster-art" : "result-art"}" src="${escapeHtml(record.image)}" onerror="this.style.display='none'">`;
 return `<div class="${compact ? "poster-art" : "poster-art result-placeholder"}"><span class="poster-symbol">▧</span><span>${Poster}</span><small>Replace with your poster image</small></div>`;
   
}
function showResult(record) {
  if (!record) return showNotFound("");
  $("resultContent").innerHTML = `<div class="result-card">${posterArt(record)}<div class="result-details">
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
function rotateCanvas(sourceCanvas, degrees) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (Math.abs(degrees) === 90) {
    canvas.width = sourceCanvas.height;
    canvas.height = sourceCanvas.width;
  } else {
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(degrees * Math.PI / 180);

  ctx.drawImage(
    sourceCanvas,
    -sourceCanvas.width / 2,
    -sourceCanvas.height / 2
  );

  return canvas;
}
async function captureAndRead() {
  const video = $("cameraVideo");

  if (!video.videoWidth) {
    $("scanStatus").textContent =
      "Camera isn't ready yet. Try manual entry below.";
    return;
  }

  if (!window.Tesseract) {
    $("scanStatus").textContent =
      "Text recognition library didn't load. Enter the code manually.";
    return;
  }

  $("captureButton").disabled = true;
  $("scanStatus").textContent =
    "Scanning poster code...";

  try {
    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    //
    // Center crop to eliminate wall/background noise
    //

    const cropCanvas = document.createElement("canvas");

    cropCanvas.width = canvas.width * 0.6;
    cropCanvas.height = canvas.height * 0.6;

    const cropCtx = cropCanvas.getContext("2d");

    cropCtx.drawImage(
      canvas,
      canvas.width * 0.2,
      canvas.height * 0.2,
      canvas.width * 0.6,
      canvas.height * 0.6,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    const variants = [
      cropCanvas,
      rotateCanvas(cropCanvas, 90),
      rotateCanvas(cropCanvas, -90)
    ];

    let combinedText = "";

    for (const variant of variants) {
      const result = await Tesseract.recognize(
        variant,
        "eng",
        {
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-"
        }
      );

      combinedText += "\n" + (result.data.text || "");
    }

    console.log("OCR TEXT:", combinedText);

    const match = findRecordInOcr(combinedText);

    if (match) {
      showResult(match);
    } else {
      showNotFound("");
    }

  } catch (e) {
    console.error(e);

    $("scanStatus").textContent =
      "Couldn't read the image. Try moving closer to the mnemonic code.";
  } finally {
    $("captureButton").disabled = false;
  }
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
