const fs = require("fs");
const path = require("path");
const assetsDir = path.resolve(process.cwd(), "android", "app", "src", "main", "assets", "public");
function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && (p.endsWith(".js") || p.endsWith(".html"))) out.push(p);
  }
}
const files = [];
walk(assetsDir, files);
for (const f of files) {
  try {
    const c = fs.readFileSync(f, "utf8");
    const u = c
      .replace(/(src|href)="\/(?![a-zA-Z]+:)/g, '$1="')
      .replace(/"\/_next\//g, '"_next/')
      .replace(/\/_next\/static/g, "_next/static")
      .replace(/"\/(icon|favicon|manifest)/g, '"$1');
    if (u !== c) fs.writeFileSync(f, u, "utf8");
  } catch {}
}
process.exit(0);
