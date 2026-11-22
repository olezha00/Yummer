import { tText } from "../i18n.js";
import { $ } from "../util.js";

/* ---------- Barcode decoding from a photo ---------- */
export async function decodeBarcode(file) {
  if ("BarcodeDetector" in window) {
    try {
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
      const bmp = await createImageBitmap(file);
      const codes = await det.detect(bmp);
      if (codes.length) return codes[0].rawValue;
    } catch {}
  }
  if (window.ZXing) {
    const url = URL.createObjectURL(file);
    try {
      const hints = new Map(); hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const reader = new ZXing.BrowserMultiFormatReader(hints);
      const res = await reader.decodeFromImageUrl(url);
      return res.getText();
    } catch {} finally { URL.revokeObjectURL(url); }
  }
  return null;
}

/* ---------- Live camera scanner ---------- */
export let scanReader = null;
/** Opens the camera overlay. Callbacks keep this module free of UI imports:
 *  onCode(text) when a code is read, onPhoto() to fall back to a photo, onError(message). */
export async function startScanner({ onCode, onPhoto, onError }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.ZXing) { onPhoto(); return; }
  const box = $("#scanner"), video = $("#scanVideo"); box.hidden = false; $("#scanHint").textContent = tText("scan.hint");
  try {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.QR_CODE]);
    scanReader = new ZXing.BrowserMultiFormatReader(hints, 250);
    let done = false;
    await scanReader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video, (result) => {
      if (!result || done) return; done = true;
      try { navigator.vibrate && navigator.vibrate(60); } catch {}
      stopScanner(); onCode(result.getText().trim());
    });
  } catch (e) {
    stopScanner();
    onError(e && e.name === "NotAllowedError" ? tText("scan.noCamera") : tText("scan.cameraUnavailable"));
    if (!(e && e.name === "NotAllowedError")) onPhoto();
  }
}
export function stopScanner() { try { scanReader && scanReader.reset(); } catch {} scanReader = null; $("#scanner").hidden = true; }
