const fs = require("fs");
const path = require("path");
function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && (p.endsWith(".html") || p.endsWith(".js"))) out.push(p);
  }
}
function run() {
  const root = path.resolve(process.cwd(), "out");
  const files = [];
  walk(root, files);
  for (const f of files) {
    const c = fs.readFileSync(f, "utf8");
    const isHtml = f.endsWith(".html");
    const isJs = f.endsWith(".js");
    let n = c;
    const nuclear = (s) => s.replace(/\/(?=_next|icon|favicon|manifest)/g, "");
    if (isHtml) {
      n = nuclear(n)
        .replace(/(src|href)="\/_next\//g, '$1="_next/')
        .replace(/src="\//g, 'src="./')
        .replace(/href="\//g, 'href="./')
        .replace(/\/_next\/static/g, '_next/static');
    } else if (isJs) {
      n = nuclear(n).replace(/\/_next\/static/g, '_next/static');
    }
    if (n !== c) fs.writeFileSync(f, n, "utf8");
  }
  process.exit(0);
}
run();
