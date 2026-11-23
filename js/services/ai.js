import { IDB, sanitizeLabel } from "../data/store.js";
import { tText } from "../i18n.js";
import { blobToB64 } from "../util.js";

/* ---------- AI: Google Gemini (free tier, default) or Claude, with the person's own key stored on this device ---------- */
export const CLAUDE_MODEL = "claude-opus-5-5";
export const AI = {
  provider: "gemini", keys: { gemini: null, claude: null }, geminiModel: "gemini-3.5-flash-lite",
  get key() { return this.keys[this.provider]; },
  ready() { return !!this.key; },
  label() { return this.provider === "gemini" ? "Gemini" : "Claude"; },
  async call(text, images, wantJSON, schema) {
    if (!this.key) throw Object.assign(new Error(tText("ai.err.noKey", { provider: this.label() })), { code: "nokey" });
    if (!navigator.onLine) throw Object.assign(new Error(tText("ai.err.offline")), { code: "offline" });
    const b64 = []; for (const img of images || []) b64.push(await blobToB64(img));
    return this.provider === "gemini" ? this.gemini(text, b64, wantJSON) : this.claude(text, b64, schema);
  },
  async gemini(text, b64, wantJSON) {
    const parts = b64.map(d => ({ inline_data: { mime_type: "image/jpeg", data: d } })); parts.push({ text });
    let r;
    try {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(this.geminiModel) + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": this.key },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: wantJSON ? { responseMimeType: "application/json" } : {} }) });
    } catch { throw Object.assign(new Error(tText("ai.err.geminiNet")), { code: "net" }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && j.error.message) || "";
      if (r.status === 429) throw Object.assign(new Error(tText("ai.err.geminiRate")), { code: "rate" });
      if (r.status === 404) throw Object.assign(new Error(tText("ai.err.geminiModel", { model: this.geminiModel })), { code: "model" });
      if (r.status === 400 && /api key/i.test(msg) || r.status === 401 || r.status === 403) throw Object.assign(new Error(tText("ai.err.geminiAuth")), { code: "auth" });
      throw Object.assign(new Error(tText("ai.err.geminiStatus", { status: r.status, msg: msg ? ": " + msg : "" })), { code: "bad" });
    }
    const c = j.candidates && j.candidates[0];
    const out = c && c.content && (c.content.parts || []).map(x => x.text || "").join("");
    if (!out) throw Object.assign(new Error(tText("ai.err.geminiEmpty", { reason: c && c.finishReason ? " (" + c.finishReason + ")" : "" })), { code: "empty" });
    return out;
  },
  async claude(text, b64, schema) {
    const { default: Anthropic } = await import("../../vendor/anthropic.js");
    const client = new Anthropic({ apiKey: this.key, dangerouslyAllowBrowser: true, maxRetries: 1 });
    const content = b64.map(d => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } })); content.push({ type: "text", text });
    let res;
    try {
      res = await client.beta.messages.create({
        model: CLAUDE_MODEL, max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
        output_config: schema ? { effort: "low", format: { type: "json_schema", schema } } : { effort: "low" },
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      const st = e && e.status;
      if (st === 401) throw Object.assign(new Error(tText("ai.err.claudeAuth")), { code: "auth" });
      if (st === 429) throw Object.assign(new Error(tText("ai.err.claudeRate")), { code: "rate" });
      if (st === 400) throw Object.assign(new Error(tText("ai.err.claudeBad", { msg: e.message || "" })), { code: "bad" });
      throw Object.assign(new Error(tText("ai.err.claudeNet")), { code: "net" });
    }
    if (res.stop_reason === "refusal") throw Object.assign(new Error(tText("ai.err.refusal")), { code: "refusal" });
    return res.content.filter(b => b.type === "text").map(b => b.text).join("");
  },
  async text(prompt) { return this.call(prompt, [], false); },
  async json(prompt, schema, images) {
    const out = await this.call(prompt, images, true, schema);
    const x = out.indexOf("{"), y = out.lastIndexOf("}");
    return JSON.parse(x >= 0 ? out.slice(x, y + 1) : out);
  },
};
export async function saveAISettings() { await IDB.put("kv", { provider: AI.provider, keys: AI.keys, geminiModel: AI.geminiModel }, "ai"); }

/* ---------- Label photos ---------- */
export async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), "image/jpeg", 0.85));
  } catch { return file; }
}

export const LABEL_PROMPT = `Read these photos (one or more) of the same food product: the nutrition table and/or the front of the pack, possibly in Polish.
Return JSON only, no prose, in exactly this shape:
{"name": string|null, "brand": string|null, "barcode": string|null, "kcal": number|null, "protein": number|null, "fat": number|null, "carbs": number|null, "serving": number|null}
Rules: nutrition values are per 100 g or 100 ml (in Polish "w 100 g"). If only kJ is shown, divide by 4.184. "carbs" is total carbohydrates (węglowodany), not sugars.
"serving" is the portion or pack size in grams if printed, else null. "barcode" is the digits under a barcode if visible, else null. Give the product name in its original language as printed on the pack. Use null for anything unreadable.`;

export const NUM = { type: ["number", "null"] }, STR = { type: ["string", "null"] };
export const LABEL_SCHEMA = { type: "object", additionalProperties: false, required: ["name", "brand", "barcode", "kcal", "protein", "fat", "carbs", "serving"],
  properties: { name: STR, brand: STR, barcode: STR, kcal: NUM, protein: NUM, fat: NUM, carbs: NUM, serving: NUM } };
export const ITEMS_SCHEMA = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false,
  required: ["name", "grams", "kcal", "protein", "fat", "carbs"], properties: { name: { type: "string" }, grams: { type: "number" }, kcal: { type: "number" }, protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" } } } } } };
/** Up to this many photos go to the AI at once (front of the pack plus the nutrition table). */
export const MAX_LABEL_PHOTOS = 3;
export async function readLabel(files) {
  const list = (Array.isArray(files) ? files : [files]).slice(0, MAX_LABEL_PHOTOS);
  const imgs = []; for (const f of list) imgs.push(await shrink(f));
  const out = await AI.json(LABEL_PROMPT, LABEL_SCHEMA, imgs);
  if (!out || typeof out !== "object") throw new Error(tText("ai.err.label"));
  return sanitizeLabel(out);
}
