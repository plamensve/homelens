const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve("extension");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const files = new Set();

for (const icon of Object.values(manifest.icons || {})) files.add(icon);
for (const icon of Object.values(manifest.action?.default_icon || {})) files.add(icon);
files.add(manifest.action.default_popup);
files.add(manifest.background.service_worker);
files.add(manifest.options_page);
for (const entry of manifest.content_scripts || []) {
  entry.js.forEach((file) => files.add(file));
  entry.css.forEach((file) => files.add(file));
}

const missing = [...files].filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing manifest files: ${missing.join(", ")}`);

const forbidden = [];
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isDirectory()) walk(full);
    else if (/\.(js|html)$/.test(item.name) && /eval\s*\(|new Function\s*\(/.test(fs.readFileSync(full, "utf8"))) forbidden.push(full);
  }
}
walk(root);
if (forbidden.length) throw new Error(`Unsafe dynamic code: ${forbidden.join(", ")}`);

for (const html of ["popup/popup.html", "options/options.html", "saved/saved.html"]) {
  const text = fs.readFileSync(path.join(root, html), "utf8");
  if (/<script(?![^>]*\bsrc=)/i.test(text)) throw new Error(`Inline script in ${html}`);
}

console.log(`Validated HomeLens ${manifest.version}: ${files.size} manifest assets present.`);
