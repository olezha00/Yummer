import { handleCode, pickPhoto } from "../actions.js";
import { ui } from "../state.js";
import { setStatus } from "../ui/sheet.js";
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
export async function startScanner() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.ZXing) { pickPhoto("scan"); return; }
  const box = $("#scanner"), video = $("#scanVideo"); box.hidden = false; $("#scanHint").textContent = "Наведите камеру на штрихкод";
  try {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.QR_CODE]);
    scanReader = new ZXing.BrowserMultiFormatReader(hints, 250);
    let done = false;
    await scanReader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video, (result) => {
      if (!result || done) return; done = true;
      try { navigator.vibrate && navigator.vibrate(60); } catch {}
      stopScanner(); if (ui.sheet) handleCode(result.getText().trim());
    });
  } catch (e) {
    stopScanner();
    setStatus(e && e.name === "NotAllowedError" ? "Нет доступа к камере. Разрешите камеру для Yummer в настройках Safari, или сделайте фото штрихкода." : "Камера недоступна, откроем фото.", true);
    if (!(e && e.name === "NotAllowedError")) pickPhoto("scan");
  }
}
export function stopScanner() { try { scanReader && scanReader.reset(); } catch {} scanReader = null; $("#scanner").hidden = true; }
