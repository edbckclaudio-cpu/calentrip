const fs = require("fs");
const path = require("path");
const rootDir = path.resolve(__dirname, "android", "app", "src", "main", "assets", "public");
const exts = new Set([".html", ".htm", ".js", ".css", ".txt", ".json", ".xml"]);
let changedFiles = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
    } else {
      const ext = path.extname(full).toLowerCase();
      if (!exts.has(ext)) continue;
      try {
        const inBuf = fs.readFileSync(full, "utf8");
        const outBuf = inBuf
          .replace(/\/_next\//g, "_next/")
          .replace(/href="\/icon/g, 'href="icon')
          .replace(/href="\/favicon/g, 'href="favicon')
          .replace(/href="\/manifest/g, 'href="manifest');
        if (outBuf !== inBuf) {
          fs.writeFileSync(full, outBuf, "utf8");
          changedFiles++;
        }
      } catch (e) {
        // ignore unreadable files
      }
    }
  }
}

try {
  walk(rootDir);
  console.log(`nuclear-fix: arquivos ajustados: ${changedFiles}`);
} catch (e) {
  console.error("nuclear-fix: falhou ao ajustar assets:", e && e.message ? e.message : String(e));
  process.exit(1);
}
