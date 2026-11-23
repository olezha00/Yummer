import { tText } from "../i18n.js";
import { $ } from "../util.js";

/* ---------- Barcode geometry and checks (pure, tested) ---------- */
/** ZXing reads 1D barcodes along rows, and TRY_HARDER also tries the image turned 90°. Each reads bars tilted
 *  up to about ±15°, so trying 0°, +30° and -30° (each also turned 90° by ZXing) covers every angle. */
export const SCAN_ANGLES = [0, 30, -30];
/** Photos are decoded once, so they also try the angles in between. */
export const PHOTO_ANGLES = [0, 30, -30, 15, -15, 45, -45];

/** Size of the canvas that holds a w×h image turned by `deg` degrees without cutting corners. */
export function rotatedBox(w, h, deg) {
  const a = Math.abs(deg) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { w: Math.round(w * c + h * s), h: Math.round(w * s + h * c) };
}

/** Scale factor so the longer side is at most `max` (never enlarges). */
export const fitScale = (w, h, max) => Math.min(1, max / Math.max(w, h, 1));

/** EAN-8, UPC-A (12), EAN-13 and GTIN-14 carry a check digit; other codes (Code 128, QR) pass as they are.
 *  Used for digits read by AI from a photo, where one misread digit would look up the wrong product. */
export function checkDigitOk(code) {
  const s = String(code || "");
  if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return true;
  let sum = 0;
  for (let i = s.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += +s[i] * w;
  return (10 - sum % 10) % 10 === +s[s.length - 1];
}

/* ---------- Decoders ---------- */
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];
let nativeDet; // undefined: not checked yet; null: not available
/** The browser's own BarcodeDetector (Chrome on Android) reads codes at any angle. Safari on iPhone has none. */
async function nativeDetector() {
  if (nativeDet !== undefined) return nativeDet;
  nativeDet = null;
  try {
    if ("BarcodeDetector" in window) {
      const have = await window.BarcodeDetector.getSupportedFormats();
      const want = NATIVE_FORMATS.filter(f => have.includes(f));
      if (want.length) nativeDet = new window.BarcodeDetector({ formats: want });
    }
  } catch {}
  return nativeDet;
}

let zx = null;
function zxReader() {
  if (zx || !window.ZXing) return zx;
  const Z = window.ZXing, hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.QR_CODE]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  zx = new Z.MultiFormatReader(); zx.setHints(hints);
  return zx;
}

/** Draws `src` (video or image, sw×sh) scaled to at most `max` px and turned by `deg` onto `canvas`. */
function drawTurned(canvas, src, sw, sh, deg, max) {
  const k = fitScale(sw, sh, max), w = Math.round(sw * k), h = Math.round(sh * k), box = rotatedBox(w, h, deg);
  canvas.width = box.w; canvas.height = box.h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff"; g.fillRect(0, 0, box.w, box.h); // corners outside the image read as quiet white space
  g.save(); g.translate(box.w / 2, box.h / 2); g.rotate(deg * Math.PI / 180); g.drawImage(src, -w / 2, -h / 2, w, h); g.restore();
}

/** One ZXing attempt on the canvas; `global` uses the histogram binarizer, which copes better with blur. */
function zxDecode(canvas, global) {
  const r = zxReader(); if (!r) return null;
  const Z = window.ZXing;
  try {
    const lum = new Z.HTMLCanvasElementLuminanceSource(canvas);
    const bin = global ? new Z.GlobalHistogramBinarizer(lum) : new Z.HybridBinarizer(lum);
    return r.decodeWithState(new Z.BinaryBitmap(bin)).getText();
  } catch { return null; }
}

/* ---------- Barcode decoding from a photo ---------- */
export async function decodeBarcode(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return null; }
  const det = await nativeDetector();
  if (det) { try { const codes = await det.detect(bmp); if (codes.length) return codes[0].rawValue; } catch {} }
  const canvas = document.createElement("canvas");
  for (const max of [1600, 900]) for (const deg of PHOTO_ANGLES) for (const global of [false, true]) {
    drawTurned(canvas, bmp, bmp.width, bmp.height, deg, max);
    const text = zxDecode(canvas, global);
    if (text) return text;
    await new Promise(r => setTimeout(r)); // keep the page responsive between attempts
  }
  return null;
}

/* ---------- Live camera scanner ---------- */
let live = null; // { stream, timer, stopped }
/** Opens the camera overlay. Callbacks keep this module free of UI imports:
 *  onCode(text) when a code is read, onPhoto() to fall back to a photo, onError(message). */
export async function startScanner({ onCode, onPhoto, onError }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.ZXing) { onPhoto(); return; }
  stopScanner();
  const box = $("#scanner"), video = $("#scanVideo"); box.hidden = false; $("#scanHint").textContent = tText("scan.hint");
  const me = { stream: null, timer: 0, stopped: false }; live = me;
  try {
    me.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    if (me.stopped) { me.stream.getTracks().forEach(tr => tr.stop()); return; }
    const track = me.stream.getVideoTracks()[0];
    try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch {}
    video.srcObject = me.stream; await video.play();
  } catch (e) {
    stopScanner();
    onError(e && e.name === "NotAllowedError" ? tText("scan.noCamera") : tText("scan.cameraUnavailable"));
    if (!(e && e.name === "NotAllowedError")) onPhoto();
    return;
  }
  const det = await nativeDetector();
  const canvas = document.createElement("canvas");
  let n = 0;
  const found = text => {
    if (me.stopped) return;
    try { navigator.vibrate && navigator.vibrate(60); } catch {}
    stopScanner(); onCode(String(text).trim());
  };
  const tick = async () => {
    if (me.stopped) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && vh) {
      let text = null;
      if (det) { try { const codes = await det.detect(video); if (codes.length) text = codes[0].rawValue; } catch {} }
      else {
        // One angle per frame, cycling through SCAN_ANGLES; every other round uses the other binarizer.
        const deg = SCAN_ANGLES[n % SCAN_ANGLES.length], global = Math.floor(n / SCAN_ANGLES.length) % 2 === 1; n++;
        drawTurned(canvas, video, vw, vh, deg, 960);
        text = zxDecode(canvas, global);
      }
      if (text) return found(text);
    }
    if (!me.stopped) me.timer = setTimeout(tick, 60);
  };
  tick();
}
export function stopScanner() {
  const me = live; live = null;
  if (me) { me.stopped = true; clearTimeout(me.timer); if (me.stream) me.stream.getTracks().forEach(tr => tr.stop()); }
  const video = $("#scanVideo"); if (video) { try { video.pause(); } catch {} video.srcObject = null; }
  const box = $("#scanner"); if (box) box.hidden = true;
}
