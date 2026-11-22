// Syntax-checks every app module and confirms each relative import points at a real export.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") && files.push(p); } })("js");

let failed = false;
const exportsOf = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  exportsOf.set(resolve(f), new Set([...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+([\w$]+)/gm)].map(m => m[1])));
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { failed = true; console.error(`Syntax error in ${f}:\n${e.stderr}`); }
}
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/^import\s+\{([^}]*)\}\s+from\s+"(\.[^"]+)";/gm)) {
    const target = resolve(dirname(f), m[2]);
    const names = exportsOf.get(target);
    if (!names) { failed = true; console.error(`${f}: imports missing file ${m[2]}`); continue; }
    for (const n of m[1].split(",").map(s => s.trim()).filter(Boolean))
      if (!names.has(n)) { failed = true; console.error(`${f}: "${n}" is not exported by ${m[2]}`); }
  }
}
// No import cycles: a module may not (directly or indirectly) import itself.
const graph = new Map(files.map(f => [resolve(f), [...readFileSync(f, "utf8").matchAll(/^import\s+[^;]*?from\s+"(\.[^"]+)";/gm)].map(m => resolve(dirname(f), m[1]))]));
const state = new Map();
function visit(n, path) {
  if (state.get(n) === "done") return;
  if (state.get(n) === "active") { failed = true; const cyc = path.slice(path.indexOf(n)).concat(n).map(p => p.slice(process.cwd().length + 1)); console.error("Import cycle: " + cyc.join(" -> ")); return; }
  state.set(n, "active");
  for (const m of graph.get(n) || []) visit(m, [...path, n]);
  state.set(n, "done");
}
for (const n of graph.keys()) visit(n, []);

// Every shipped file must be cached by the service worker, or the app breaks offline.
const sw = readFileSync("sw.js", "utf8");
const shell = new Set([...sw.slice(sw.indexOf("SHELL"), sw.indexOf("];")).matchAll(/"([^"]+)"/g)].map(m => m[1]));
const shipped = [...files, "css/styles.css", "css/fonts.css",
  ...readdirSync("fonts").filter(f => f.endsWith(".woff2")).map(f => "fonts/" + f),
  ...readdirSync("vendor").filter(f => f.endsWith(".js")).map(f => "vendor/" + f)];
const swVersion = (sw.match(/const VERSION = "([^"]+)"/) || [])[1];
const appVersion = (readFileSync("js/services/updates.js", "utf8").match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!swVersion || swVersion !== appVersion) { failed = true; console.error(`sw.js VERSION (${swVersion}) must equal APP_VERSION in js/services/updates.js (${appVersion})`); }
for (const f of shipped) if (!shell.has(f.split("\\").join("/"))) { failed = true; console.error(`${f} is not listed in SHELL in sw.js`); }

// Every language has the same keys and the same {placeholders}; no UI text is hard-coded outside js/i18n/.
const dicts = await Promise.all(["ru", "en", "pl", "de"].map(async l => [l, Object.values(await import(pathToFileURL(resolve("js/i18n", l + ".js")).href))[0]]));
const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
const [, base] = dicts[0];
for (const [l, d] of dicts) {
  for (const k of Object.keys(base)) {
    if (!(k in d)) { failed = true; console.error(`js/i18n/${l}.js is missing "${k}"`); }
    else if (ph(d[k]) !== ph(base[k])) { failed = true; console.error(`js/i18n/${l}.js "${k}" has placeholders {${ph(d[k])}}, ru has {${ph(base[k])}}`); }
  }
  for (const k of Object.keys(d)) if (!(k in base)) { failed = true; console.error(`js/i18n/${l}.js has extra key "${k}"`); }
}
const usedKeys = new Set();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt(?:Text)?\("([\w.]*\w)"/g)) usedKeys.add(m[1]);
  // t() HTML-escapes its values, so it belongs in js/ui/ templates; elsewhere text goes to textContent/Errors via tText().
  if (!f.includes(`ui${sep}`) && /import \{[^}]*\bt\b[^}]*\} from "[^"]*i18n\.js"/.test(src)) { failed = true; console.error(`${f} imports t(): outside js/ui/ use tText()`); }
  // A local variable or parameter named `t` would hide the translator and break rendering at runtime.
  if (/import \{[^}]*\bt\b[^}]*\} from "[^"]*i18n\.js"/.test(src) && /(?:const|let|var)\s+t\b|\(\s*t\s*[,)]|\bt\s*=>/.test(src)) { failed = true; console.error(`${f} shadows the translator t(): rename the local variable`); }
  if (!f.includes("i18n") && !f.endsWith("foods.js") && /[\u0400-\u04FF]/.test(src)) { failed = true; console.error(`${f} has Cyrillic text: move it to js/i18n/`); }
}
for (const k of usedKeys) if (!(k in base)) { failed = true; console.error(`t("${k}") is used but not defined in js/i18n/`); }

// Vendored libraries must match their recorded checksums (supply-chain integrity).
import("node:crypto").then(({ createHash }) => {
  for (const line of readFileSync("vendor/SHA256SUMS", "utf8").trim().split("\n")) {
    const [hash, name] = line.split(/\s+/);
    const actual = createHash("sha256").update(readFileSync(join("vendor", name))).digest("hex");
    if (actual !== hash) { failed = true; console.error(`vendor/${name} does not match vendor/SHA256SUMS`); }
  }
  // No inline scripts or inline event handlers: the Content-Security-Policy forbids them.
  const html = readFileSync("index.html", "utf8");
  if (!/http-equiv="Content-Security-Policy"/.test(html)) { failed = true; console.error("index.html lost its Content-Security-Policy"); }
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html) || /\son[a-z]+=/i.test(html)) { failed = true; console.error("index.html has inline script or on* handler"); }
  if (failed) process.exit(1);
  console.log(`OK: ${files.length} modules, no import cycles, SHELL complete, ${dicts.length} languages with ${Object.keys(base).length} keys each, vendor checksums and CSP checked.`);
});
