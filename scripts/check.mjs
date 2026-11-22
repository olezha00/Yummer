// Syntax-checks every app module and confirms each relative import points at a real export.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

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
  console.log(`OK: ${files.length} modules, vendor checksums and CSP checked.`);
});
