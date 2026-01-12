const fs = require('fs');
const path = require('path');

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
        const fixed = content
          // Remove barra inicial em caminhos para _next dentro de aspas
          .replace(/(["'])\/_next\//g, '$1_next/')
          // Remove barra inicial em ícones comuns
          .replace(/(["'])\/(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)/g, '$1$2')
          // Opcional: normaliza ocorrências redundantes de // em caminhos
          .replace(/([^:])\/{2,}/g, '$1/');
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

function fixCapConfigJson(p) {
  try {
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    json.server = json.server || {};
    delete json.server.url;
    delete json.server.cleartext;
    json.server.androidScheme = 'file';
    fs.writeFileSync(p, JSON.stringify(json, null, 2));
  } catch {}
}

const targets = [
  path.join(__dirname, 'android/app/src/main/assets/public'),
  path.join(__dirname, 'calentrip/android/app/src/main/assets/public'),
];
targets.forEach(walk);

fixPluginsJson(path.join(__dirname, 'android/app/src/main/assets/capacitor.plugins.json'));
fixPluginsJson(path.join(__dirname, 'calentrip/android/app/src/main/assets/capacitor.plugins.json'));
fixCapConfigJson(path.join(__dirname, 'android/app/src/main/assets/capacitor.config.json'));
fixCapConfigJson(path.join(__dirname, 'calentrip/android/app/src/main/assets/capacitor.config.json'));

console.log('✅ Caminhos absolutos convertidos para relativos e plugin SQLite desativado do autoload!');
