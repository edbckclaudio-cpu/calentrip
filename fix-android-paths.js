const fs = require('fs');
const path = require('path');

const dirs = [
  './android/app/src/main/assets/public',
  './calentrip/android/app/src/main/assets/public'
];

const replaceInFiles = (folder) => {
  fs.readdirSync(folder).forEach(file => {
    const filePath = path.join(folder, file);
    if (fs.lstatSync(filePath).isDirectory()) return replaceInFiles(filePath);
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Corrigir caminhos do Next e ícones para relativos
      // 1) /_next -> _next (atributos src/href)
      content = content.replace(/(src|href)="\/_?next\//g, '$1="_next/');
      content = content.replace(/(src|href)='\/_?next\//g, '$1=\'_next/');
      // 2) http(s)://localhost/_next -> file:///android_asset/public/_next (atributos e strings gerais)
      content = content.replace(/(["'])https?:\/\/localhost\/_?next\//g, '$1file:///android_asset/public/_next/');
      // 3) http(s)://app.calentrip.digital/_next -> file:///android_asset/public/_next
      content = content.replace(/(["'])https?:\/\/app\.calentrip\.digital\/_?next\//g, '$1file:///android_asset/public/_next/');
      // 4) CSS url() com http(s)://localhost/_next ou /_next
      content = content.replace(/url\(\s*["']?https?:\/\/localhost\/_?next\//g, 'url(_next/');
      content = content.replace(/url\(\s*["']?\/_?next\//g, 'url(_next/');
      // 4b) Removido ajuste global de '/_next/static/' para evitar duplicações
      // 4c) Evitar duplicações: não substituir /_next/ genericamente para não gerar prefixos duplicados
      // 5) Ícones absolutos -> relativos
      content = content.replace(/(src|href)="\/(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)"/g, '$1="$2"');
      content = content.replace(/(src|href)='\/(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)'/g, '$1=\'$2\'');
      // 6) Ícones com http(s)://localhost ou domínio -> relativos
      content = content.replace(/(["'])https?:\/\/(?:localhost|app\.calentrip\.digital)\/(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)/g, '$1$2');
      // 6b) Strings gerais: /icon-*.png e /favicon.ico -> file:///android_asset/public/...
      content = content.replace(/\/(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)/g, 'file:///android_asset/public/$1');
      // 7) Forçar prefixo absoluto file:///android_asset/public para _next e ícones
      content = content.replace(/(src|href)="_next\//g, '$1="file:///android_asset/public/_next/');
      content = content.replace(/(src|href)='_next\//g, '$1=\'file:///android_asset/public/_next/');
      content = content.replace(/(src|href)="(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)"/g, '$1="file:///android_asset/public/$2"');
      content = content.replace(/(src|href)='(icon-192\.png|icon-512\.png|icon\.svg|favicon\.ico)'/g, '$1=\'file:///android_asset/public/$2\'');
      // 8) CSS url() apontar direto para file:///android_asset/public/_next/static (evitando duplicação)
      content = content.replace(/url\(\s*["']?(?<!file:\/\/\/android_asset\/public)_next\/static\//g, 'url(file:///android_asset/public/_next/static/');
      // 8b) Limpeza de repetições em strings geradas
      content = content.replace(/(file:\/\/\/android_asset\/public)+(\/_next\/static\/)/g, 'file:///android_asset/public$2');
      content = content.replace(/url\(\s*["']?\.\.\/media\//g, 'url(file:///android_asset/public/_next/static/media/');
      // 8c) Corrigir base '/_next/' em literais JS para file:// (Turbopack runtime)
      content = content.replace(/(?<!file:\/\/\/android_asset\/public)(["'])\/_next\/\1/g, '$1file:///android_asset/public/_next/$1');
      // 8d) Tratar variante 'next/static' (sem underscore), absolutas e relativas
      content = content.replace(/(["'])https?:\/\/localhost\/next\/static\//g, '$1file:///android_asset/public/_next/static/');
      content = content.replace(/(["'])https?:\/\/app\.calentrip\.digital\/next\/static\//g, '$1file:///android_asset/public/_next/static/');
      content = content.replace(/(?<!file:\/\/\/android_asset\/public)\/next\/static\//g, 'file:///android_asset/public/_next/static/');
      content = content.replace(/(?<!file:\/\/\/android_asset\/public)next\/static\//g, 'file:///android_asset/public/_next/static/');
      content = content.replace(/url\(\s*["']?\/?next\/static\//g, 'url(file:///android_asset/public/_next/static/');
      // 8e) Limpezas adicionais para evitar prefixos duplicados em atributos e strings
      content = content.replace(/file:\/\/\/android_asset\/public\/_file:\/\/\/android_asset\/public\/_next\//g, 'file:///android_asset/public/_next/');
      content = content.replace(/file:\/\/\/android_asset\/public\/file:\/\/\/android_asset\/public\/_next\//g, 'file:///android_asset/public/_next/');
      content = content.replace(/file:\/\/\/android_asset\/public\/_file:\/\/\/android_asset\/public\//g, 'file:///android_asset/public/');
      content = content.replace(/file:\/\/\/android_asset\/public\/file:\/\/\/android_asset\/public\//g, 'file:///android_asset/public/');
      content = content.replace(/(file:\/\/\/android_asset\/public\/)+/g, 'file:///android_asset/public/');
      // 9) Injetar correção runtime nos HTML (apenas uma vez)
      if (filePath.endsWith('.html')) {
        const runtimeNeeded = !content.includes('fix-paths-runtime');
        const runtime = [
          '<script id="fix-paths-runtime">',
          '(function(){',
          '  function fix(el, attr){',
          '    try{',
          '      var v=el.getAttribute(attr); if(!v) return;',
          "      v=v.replace(/^https?:\\/\\/(?:localhost|app\\.calentrip\\.digital)\\/\\_?next\\//,'file:///android_asset/public/_next/');",
          "      v=v.replace(/^https?:\\/\\/(?:localhost|app\\.calentrip\\.digital)\\/next\\//,'file:///android_asset/public/_next/');",
          "      v=v.replace(/^\\/\\_?next\\//,'file:///android_asset/public/_next/');",
          "      v=v.replace(/^_next\\//,'file:///android_asset/public/_next/');",
          "      v=v.replace(/^\\/next\\//,'file:///android_asset/public/_next/');",
          "      v=v.replace(/^next\\//,'file:///android_asset/public/_next/');",
          "      v=v.replace(/^https?:\\/\\/(?:localhost|app\\.calentrip\\.digital)\\/(icon-192\\.png|icon-512\\.png|icon\\.svg|favicon\\.ico)$/,'file:///android_asset/public/$1');",
          "      v=v.replace(/^\\/(icon-192\\.png|icon-512\\.png|icon\\.svg|favicon\\.ico)$/,'file:///android_asset/public/$1');",
          "      v=v.replace(/^(icon-192\\.png|icon-512\\.png|icon\\.svg|favicon\\.ico)$/,'file:///android_asset/public/$1');",
          '      if(v!==el.getAttribute(attr)) el.setAttribute(attr,v);',
          '    }catch{}',
          '  }',
          '  function run(){',
          '    try{',
          "      var els=document.querySelectorAll('link[href],script[src],img[src]');",
          "      els.forEach(function(el){fix(el,el.tagName==='LINK'?'href':'src')});",
          '    }catch{}',
          '  }',
          '  try{run();document.addEventListener("DOMContentLoaded",run);}catch{}',
          '})();',
          '</script>'
        ].join('');
        // Injetar overlay de erros para diagnosticar tela branca
        const overlayNeeded = !content.includes('error-overlay-style') && !content.includes('error-overlay');
        const overlay = [
          '<style id="error-overlay-style">#errOv{position:fixed;top:0;left:0;right:0;z-index:100000;background:#b00020;color:#fff;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:.75rem;display:none}#errOv pre{white-space:pre-wrap;margin:0}</style>',
          '<script id="error-overlay">',
          '(function(){',
          '  var box=document.createElement("div");box.id="errOv";var pre=document.createElement("pre");box.appendChild(pre);document.addEventListener("DOMContentLoaded",function(){document.body.appendChild(box)});',
          '  function show(msg){try{pre.textContent=String(msg||"Erro");box.style.display="block"}catch{}}',
          '  window.addEventListener("error",function(e){show("Uncaught: "+(e.message||e.error||e))});',
          '  window.addEventListener("unhandledrejection",function(e){var m=(e&&e.reason&&e.reason.message)||e.reason||e;show("Promise: "+m)});',
          '})();',
          '</script>'
        ].join('');
        if (runtimeNeeded || overlayNeeded) {
          content = content.replace('</head>', (runtimeNeeded ? runtime : '') + (overlayNeeded ? overlay : '') + '</head>');
        }
      }
      // 10) Corrigir TURBOPACK_WORKER_LOCATION que usa location.origin
      content = content.replace(/self\.TURBOPACK_WORKER_LOCATION\s*=\s*location\.origin/g, 'self.TURBOPACK_WORKER_LOCATION = "file:///android_asset/public/_next/"');
      content = content.replace(/JSON\.stringify\(location\.origin\)/g, 'JSON.stringify("file:///android_asset/public/_next/")');
      fs.writeFileSync(filePath, content);
    }
  });
};

dirs.forEach((d) => {
  if (fs.existsSync(d)) {
    replaceInFiles(d);
    console.log('✅ Caminhos corrigidos em:', d);
  } else {
    console.warn('⚠️ Diretório não encontrado, pulando:', d);
  }
});
console.log('✅ Correção de caminhos concluída!');
