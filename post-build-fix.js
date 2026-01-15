const fs = require('fs');
const path = require('path');

function readScheme() {
  try {
    const p = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
    if (!fs.existsSync(p)) return 'http';
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (json && json.server && json.server.androidScheme) || 'http';
  } catch { return 'http'; }
}
const scheme = readScheme();
const isFileScheme = String(scheme).toLowerCase() === 'file';

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (/\.(html|js|txt)$/.test(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        let fixed = content
          // Opcional: normaliza ocorrências redundantes de // em caminhos
          .replace(/([^:])\/{2,}/g, '$1/');
        if (isFileScheme) {
          fixed = fixed
            .replace(/(["'])\/_next\//g, '$1_next/')
            .replace(/(["'])\/(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)/g, '$1$2');
        }
        // Injeta link da folha de estilos gerada pelo Next, se ausente
        if (/\.html$/.test(fullPath) && !/_next\/static\/css\/.+\.css/.test(fixed)) {
          const publicDir = fullPath.split(path.sep).slice(0, -1).join(path.sep);
          const cssDir = path.join(publicDir, '_next', 'static', 'css');
          let cssFile = null;
          try {
            const files = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter(f => f.endsWith('.css')) : [];
            cssFile = files.sort((a, b) => a.localeCompare(b))[0] || null;
          } catch {}
          if (cssFile) {
            const linkTag = `<link rel="stylesheet" href="/_next/static/css/${cssFile}" precedence="next">`;
            if (/<\/head>/i.test(fixed)) {
              fixed = fixed.replace(/<\/head>/i, `${linkTag}</head>`);
            } else if (/<\/body>/i.test(fixed)) {
              fixed = fixed.replace(/<\/body>/i, `<script>(function(){try{var href="${linkTag.match(/href=\"([^\"]+)\"/)[1]}";if(!document.querySelector('link[rel=\"stylesheet\"][href*=\"_next/static/css/\"]')){var l=document.createElement('link');l.rel='stylesheet';l.href=href;l.setAttribute('precedence','next');document.head.appendChild(l);}}catch{}})();</script></body>`);
            }
          }
        }
        if (fixed !== content) fs.writeFileSync(fullPath, fixed);
      } catch {}
    }
  }
}

function fixPluginsJson(p) {
  try {
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, 'utf8');
    const arr = JSON.parse(raw);
    const filtered = Array.isArray(arr) ? arr.filter(x =>
      !(x && (x.pkg === '@capacitor-community/sqlite' || String(x.classpath || '').includes('CapacitorSQLitePlugin')))
    ) : arr;
    fs.writeFileSync(p, JSON.stringify(filtered, null, 2));
  } catch {}
}

const targets = [
  path.join(__dirname, 'android/app/src/main/assets/public'),
  path.join(__dirname, 'calentrip/android/app/src/main/assets/public'),
];
targets.forEach(walk);

fixPluginsJson(path.join(__dirname, 'android/app/src/main/assets/capacitor.plugins.json'));
fixPluginsJson(path.join(__dirname, 'calentrip/android/app/src/main/assets/capacitor.plugins.json'));

console.log('✅ Caminhos corrigidos e CSS garantido no head dos HTML!');
