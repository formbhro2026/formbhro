const fs = require('fs');
const path = require('path');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('[SPA Generator] Starting SPA HTML generation...');
  const publicDir = path.resolve('.output/public');
  const distDir = path.resolve('dist');
  const serverDir = path.resolve('.output/server');

  if (!fs.existsSync(publicDir)) {
    console.error('[SPA Generator] .output/public not found. Please run vite build first.');
    process.exit(1);
  }

  // 1. Copy all .output/public files to dist
  console.log('[SPA Generator] Copying .output/public to dist...');
  copyDirRecursive(publicDir, distDir);

  // 2. Discover manifest and asset files
  const assetsDir = path.join(distDir, 'assets');
  const assetFiles = fs.readdirSync(assetsDir);
  const cssFile = assetFiles.find(f => f.startsWith('styles-') && f.endsWith('.css'));
  const jsEntryFile = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));

  if (!cssFile || !jsEntryFile) {
    console.error('[SPA Generator] Could not find styles-*.css or index-*.js in assets directory.');
    process.exit(1);
  }

  console.log(`[SPA Generator] Found CSS: ${cssFile}`);
  console.log(`[SPA Generator] Found Entry JS: ${jsEntryFile}`);

  // Find manifest file in .output/server
  let manifest = { routes: { __root__: { preloads: [] }, '/': { preloads: [] } } };
  try {
    const serverFiles = fs.readdirSync(serverDir);
    const manifestFileName = serverFiles.find(f => f.startsWith('_tanstack-start-manifest_v-') && f.endsWith('.mjs'));
    if (manifestFileName) {
      const manifestPath = path.join(serverDir, manifestFileName);
      const manifestUrl = 'file:///' + manifestPath.replace(/\\/g, '/');
      const manifestModule = await import(manifestUrl);
      manifest = manifestModule.tsrStartManifest ? manifestModule.tsrStartManifest() : manifest;
      console.log(`[SPA Generator] Loaded route manifest from ${manifestFileName}`);
    }
  } catch (err) {
    console.warn('[SPA Generator] Warning: could not load dynamic manifest, using fallback:', err.message);
  }

  const rootPreloads = manifest.routes?.__root__?.preloads || [`/assets/${jsEntryFile}`];
  const slashPreloads = manifest.routes?.['/']?.preloads || [];

  // Generate preload tags for head
  const preloadLinks = [
    `<link rel="modulepreload" href="/assets/${jsEntryFile}"/>`,
    ...rootPreloads.filter(p => p !== `/assets/${jsEntryFile}`).map(p => `<link rel="modulepreload" href="${p}"/>`),
    ...slashPreloads.slice(0, 15).map(p => `<link rel="modulepreload" href="${p}"/>`),
  ].join('\n    ');

  // Build the $_TSR.router manifest JSON
  const routesManifest = {
    manifest: {
      routes: {
        __root__: {
          preloads: rootPreloads,
          scripts: [
            {
              attrs: {
                type: 'module',
                async: true,
                src: `/assets/${jsEntryFile}`,
              },
            },
          ],
        },
        '/': {
          preloads: slashPreloads,
        },
      },
    },
    matches: [
      { i: '__root__', u: Date.now(), s: 'success', ssr: true },
      { i: '/', u: Date.now(), s: 'success', ssr: true },
    ],
    lastMatchId: '/',
  };

  const tsrBootstrapScript = `
(self.$R = self.$R || {})["tsr"] = [];
self.$_TSR = {
  h() { this.hydrated = !0; this.c(); },
  e() { this.streamEnded = !0; this.c(); },
  c() { this.hydrated && this.streamEnded && (delete self.$_TSR, delete self.$R.tsr); },
  p(e) { this.initialized ? e() : this.buffer.push(e); },
  buffer: []
};
$_TSR.router = ($R => $R[0] = ${JSON.stringify(routesManifest)})($R["tsr"]);
$_TSR.e();
document.currentScript && document.currentScript.remove();
  `.trim();

  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"/>
    <title>Formbhro — Online Form Filling &amp; Government Exam Assistance</title>
    <meta name="keywords" content="Formbhro, form bhro, formbhro.com, formbhro.in, online form filling, sarkari naukri form, sarkari exam form, upsc form, ssc form, railway form, pan card apply, passport form assistance, csc center online, admission form online"/>
    <meta name="author" content="Formbhro"/>
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>
    <meta property="og:site_name" content="Formbhro"/>
    <meta property="og:type" content="website"/>
    <meta property="og:url" content="https://formbhro.com"/>
    <meta property="og:image" content="https://formbhro.com/icon-512.png"/>
    <meta property="og:image:width" content="512"/>
    <meta property="og:image:height" content="512"/>
    <meta property="og:image:alt" content="Formbhro Logo"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:site" content="@formbhro"/>
    <meta name="twitter:title" content="Formbhro — Online Form Filling &amp; Government Exam Assistance"/>
    <meta name="twitter:description" content="Error-free form filling for Govt Exams, Jobs, Passport, PAN Card &amp; more starting at ₹49."/>
    <meta name="twitter:image" content="https://formbhro.com/icon-512.png"/>
    <meta name="apple-mobile-web-app-capable" content="yes"/>
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
    <meta name="apple-mobile-web-app-title" content="Formbhro"/>
    <meta name="theme-color" content="#09090b"/>
    <meta name="description" content="Formbhro is India's trusted digital form assistance and CSC platform. Get expert help with Government Exams (UPSC, SSC, Railway, Banking), Admissions, Jobs, Passport, PAN Card &amp; Certificates starting at ₹49."/>
    <meta property="og:title" content="Formbhro — Online Form Filling &amp; Government Exam Assistance"/>
    <meta property="og:description" content="Get expert assistance for your forms in real-time. Fast, secure, and error-free form filling starting at ₹49."/>
    <link rel="stylesheet" href="/assets/${cssFile}" data-precedence="default"/>
    ${preloadLinks}
    <link rel="canonical" href="https://formbhro.com"/>
    <link rel="icon" href="/favicon.ico" sizes="any"/>
    <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"/>
    <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512"/>
    <link rel="shortcut icon" href="/favicon.png"/>
    <link rel="manifest" href="/manifest.webmanifest"/>
    <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png"/>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background-color: #09090b !important;
        color: #f4f4f5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        overflow-x: hidden;
      }
      #app-splash-loader {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: #09090b;
        z-index: 9999;
        transition: opacity 0.3s ease;
      }
      .splash-logo {
        width: 72px;
        height: 72px;
        margin-bottom: 16px;
        border-radius: 16px;
      }
      .splash-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid rgba(255, 138, 31, 0.2);
        border-top-color: #ff8a1f;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
</head>
<body class="light-theme">
    <div id="app-splash-loader">
      <img src="/icon-192.png" alt="Formbhro" class="splash-logo" onerror="this.style.display='none'"/>
      <div class="splash-spinner"></div>
    </div>
    <script>
      (function(a,f){
        let l;
        try { l = JSON.parse(sessionStorage.getItem(a) || "{}"); } catch { return; }
        const n = l?.[f || history.state?.__TSR_key];
        let c = !1;
        for (const t in n) {
          const e = n[t], o = e?.scrollX, s = e?.scrollY;
          if (Number.isFinite(o) && Number.isFinite(s)) {
            if (t === "window") scrollTo(o, s), c = !0;
            else if (t) try { const r = document.querySelector(t); r && (r.scrollLeft = o, r.scrollTop = s); } catch {}
          }
        }
        if (c) return;
        const i = location.hash.slice(1);
        if (i) {
          const t = history.state?.__hashScrollIntoViewOptions ?? !0;
          if (t) { const e = document.getElementById(i); e && e.scrollIntoView(t); }
          return;
        }
        scrollTo(0, 0);
      })("tsr-scroll-restoration-v1_3");
      document.currentScript && document.currentScript.remove();
    </script>
    <section aria-label="Notifications alt+T" tabindex="-1" aria-live="polite" aria-relevant="additions text" aria-atomic="false"></section>
    <script class="$tsr" id="$tsr-stream-barrier">${tsrBootstrapScript}</script>
    <script type="module" async="" src="/assets/${jsEntryFile}"></script>
    <script>
      // Cleanly dismiss the splash loader once TanStack router mounts or after timeout
      function dismissSplash() {
        var loader = document.getElementById('app-splash-loader');
        if (loader) {
          loader.style.opacity = '0';
          setTimeout(function() {
            if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
          }, 250);
        }
      }
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(dismissSplash, 200);
      } else {
        window.addEventListener('load', function() { setTimeout(dismissSplash, 200); });
        document.addEventListener('DOMContentLoaded', function() { setTimeout(dismissSplash, 400); });
      }
      setTimeout(dismissSplash, 1200);
    </script>
</body>
</html>`;

  const indexPath = path.join(distDir, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(`[SPA Generator] Successfully wrote ${indexPath} (${html.length} bytes).`);
}

main().catch(err => {
  console.error('[SPA Generator] Fatal error:', err);
  process.exit(1);
});
