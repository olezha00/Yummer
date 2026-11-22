import { IDB } from "../data/store.js";
import { blobToB64 } from "../util.js";

/* ---------- AI: Google Gemini (free tier, default) or Claude, with the person's own key stored on this device ---------- */
export const CLAUDE_MODEL = "claude-opus-5-5";
export const AI = {
  provider: "gemini", keys: { gemini: null, claude: null }, geminiModel: "gemini-3.5-flash-lite",
  get key() { return this.keys[this.provider]; },
  ready() { return !!this.key; },
  label() { return this.provider === "gemini" ? "Gemini" : "Claude"; },
  async call(text, images, wantJSON, schema) {
    if (!this.key) throw Object.assign(new Error("Добавьте ключ " + this.label() + " в «Настройках», чтобы пользоваться ИИ."), { code: "nokey" });
    if (!navigator.onLine) throw Object.assign(new Error("Нет интернета."), { code: "offline" });
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
    } catch { throw Object.assign(new Error("Не удалось связаться с Gemini. Попробуйте ещё раз."), { code: "net" }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && j.error.message) || "";
      if (r.status === 429) throw Object.assign(new Error("Бесплатный лимит Gemini на сейчас исчерпан. Подождите минуту (или до завтра, если кончился дневной лимит)."), { code: "rate" });
      if (r.status === 404) throw Object.assign(new Error("Модель «" + this.geminiModel + "» не найдена. Укажите другую модель в «Настройках»."), { code: "model" });
      if (r.status === 400 && /api key/i.test(msg) || r.status === 401 || r.status === 403) throw Object.assign(new Error("Ключ Gemini не подошёл. Проверьте его в «Настройках»."), { code: "auth" });
      throw Object.assign(new Error("Gemini вернул ошибку " + r.status + (msg ? ": " + msg : "")), { code: "bad" });
    }
    const c = j.candidates && j.candidates[0];
    const out = c && c.content && (c.content.parts || []).map(x => x.text || "").join("");
    if (!out) throw Object.assign(new Error("Gemini не дал ответа" + (c && c.finishReason ? " (" + c.finishReason + ")" : "") + ". Попробуйте ещё раз."), { code: "empty" });
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
      if (st === 401) throw Object.assign(new Error("Ключ Claude не подошёл. Проверьте его в «Настройках»."), { code: "auth" });
      if (st === 429) throw Object.assign(new Error("Слишком много запросов. Подождите минуту и попробуйте снова."), { code: "rate" });
      if (st === 400) throw Object.assign(new Error("Запрос не принят: " + (e.message || "")), { code: "bad" });
      throw Object.assign(new Error("Не удалось связаться с Claude. Попробуйте ещё раз."), { code: "net" });
    }
    if (res.stop_reason === "refusal") throw Object.assign(new Error("Claude отказался обработать этот запрос."), { code: "refusal" });
    return res.content.filter(b => b.type === "text").map(b => b.text).join("");
  },
  async text(prompt) { return this.call(prompt, [], false); },
  async json(prompt, schema, images) {
    const t = await this.call(prompt, images, true, schema);
    const x = t.indexOf("{"), y = t.lastIndexOf("}");
    return JSON.parse(x >= 0 ? t.slice(x, y + 1) : t);
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

export const LABEL_PROMPT = `Read this photo of a food product (nutrition table and/or front of the pack, possibly in Polish).
Return JSON only, no prose, in exactly this shape:
{"name": string|null, "brand": string|null, "barcode": string|null, "kcal": number|null, "protein": number|null, "fat": number|null, "carbs": number|null, "serving": number|null}
Rules: nutrition values are per 100 g or 100 ml (in Polish "w 100 g"). If only kJ is shown, divide by 4.184. "carbs" is total carbohydrates (węglowodany), not sugars.
"serving" is the portion or pack size in grams if printed, else null. "barcode" is the digits under a barcode if visible, else null. Give the product name in its original language as printed on the pack. Use null for anything unreadable.`;

export const NUM = { type: ["number", "null"] }, STR = { type: ["string", "null"] };
export const LABEL_SCHEMA = { type: "object", additionalProperties: false, required: ["name", "brand", "barcode", "kcal", "protein", "fat", "carbs", "serving"],
  properties: { name: STR, brand: STR, barcode: STR, kcal: NUM, protein: NUM, fat: NUM, carbs: NUM, serving: NUM } };
export const ITEMS_SCHEMA = { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false,
  required: ["name", "grams", "kcal", "protein", "fat", "carbs"], properties: { name: { type: "string" }, grams: { type: "number" }, kcal: { type: "number" }, protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" } } } } } };
export async function readLabel(file) {
  const img = await shrink(file);
  const out = await AI.json(LABEL_PROMPT, LABEL_SCHEMA, [img]);
  if (!out || typeof out !== "object") throw new Error("Не удалось прочитать этикетку. Сделайте более чёткое фото поближе.");
  return out;
}
