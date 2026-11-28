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
  let publicDir = path.resolve('.output/public');
  const distDir = path.resolve('dist');
  let serverDir = path.resolve('.output/server');
  const androidPublicDir = path.resolve('android/app/src/main/assets/public');

  // Detect Vercel output structure where Nitro outputs to .vercel/output/static
  if (!fs.existsSync(publicDir)) {
    const vercelStaticDir = path.resolve('.vercel/output/static');
    if (fs.existsSync(vercelStaticDir)) {
      publicDir = vercelStaticDir;
      console.log('[SPA Generator] Detected Vercel output directory: .vercel/output/static');
    } else if (process.env.VERCEL) {
      console.log('[SPA Generator] VERCEL environment detected with prebuilt output. Exiting cleanly.');
      process.exit(0);
    } else {
      console.error('[SPA Generator] Neither .output/public nor .vercel/output/static found. Please run vite build first.');
      process.exit(1);
    }
  }

  // 1. Copy all public files to dist
  console.log('[SPA Generator] Copying public assets to dist...');
  copyDirRecursive(publicDir, distDir);

  // 2. Attempt genuine SSR pre-rendering from Nitro server bundle
  // This generates the 100% accurate, matching HTML that React 19's hydrateRoot(document) requires.
  const serverEntryPath = path.join(serverDir, 'index.mjs');
  let ssrRendered = false;

  if (fs.existsSync(serverEntryPath)) {
    try {
      console.log('[SPA Generator] Importing Nitro server bundle to pre-render genuine SSR HTML...');
      const serverUrl = 'file:///' + serverEntryPath.replace(/\\/g, '/');
      const serverModule = await import(serverUrl);
      if (serverModule?.default?.fetch) {
        const req = new Request('http://localhost/');
        const res = await serverModule.default.fetch(req, {}, { waitUntil: () => {} });
        if (res.status === 200) {
          const html = await res.text();
          if (html && html.length > 500 && html.includes('<!DOCTYPE html>')) {
            const indexPath = path.join(distDir, 'index.html');
            fs.writeFileSync(indexPath, html, 'utf8');
            console.log(`[SPA Generator] Successfully pre-rendered genuine SSR index.html (${html.length} bytes).`);

            // Also copy to Android assets public directory
            if (fs.existsSync(androidPublicDir)) {
              copyDirRecursive(distDir, androidPublicDir);
              console.log('[SPA Generator] Synced genuine pre-rendered dist to Android public assets.');
            }

            // Also sync to .vercel/output/static if present
            const vercelStaticDir = path.resolve('.vercel/output/static');
            if (fs.existsSync(vercelStaticDir)) {
              fs.writeFileSync(path.join(vercelStaticDir, 'index.html'), html, 'utf8');
              console.log('[SPA Generator] Synced genuine pre-rendered index.html to .vercel/output/static.');
            }

            ssrRendered = true;
            return;
          }
        }
      }
    } catch (ssrErr) {
      console.warn('[SPA Generator] SSR pre-rendering encountered error, falling back to manifest synthesis:', ssrErr.message);
    }
  }

  // 3. Fallback: Discover manifest and asset files if SSR fetch wasn't available
  console.log('[SPA Generator] Running manifest fallback generator...');
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.log('[SPA Generator] No assets directory in dist. Completing.');
    return;
  }

  const assetFiles = fs.readdirSync(assetsDir);
  const cssFile = assetFiles.find(f => f.startsWith('styles-') && f.endsWith('.css'));
  const jsEntryFile = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));

  if (!cssFile || !jsEntryFile) {
    console.warn('[SPA Generator] Could not find styles-*.css or index-*.js in assets directory.');
    if (process.env.VERCEL) {
      console.log('[SPA Generator] Running on Vercel, skipping HTML synthesis.');
      return;
    }
    process.exit(1);
  }

  let manifest = { routes: { __root__: { preloads: [] }, '/': { preloads: [] } } };
  if (fs.existsSync(serverDir)) {
    try {
      const serverFiles = fs.readdirSync(serverDir);
      const manifestFileName = serverFiles.find(f => f.startsWith('_tanstack-start-manifest_v-') && f.endsWith('.mjs'));
      if (manifestFileName) {
        const manifestPath = path.join(serverDir, manifestFileName);
        const manifestUrl = 'file:///' + manifestPath.replace(/\\/g, '/');
        const manifestModule = await import(manifestUrl);
        manifest = manifestModule.tsrStartManifest ? manifestModule.tsrStartManifest() : manifest;
      }
    } catch (err) {
      console.warn('[SPA Generator] Warning: could not load dynamic manifest, using fallback:', err.message);
    }
  }

  const rootPreloads = manifest.routes?.__root__?.preloads || [`/assets/${jsEntryFile}`];
  const slashPreloads = manifest.routes?.['/']?.preloads || [];

  const preloadLinks = [
    `<link rel="modulepreload" href="/assets/${jsEntryFile}"/>`,
    ...rootPreloads.filter(p => p !== `/assets/${jsEntryFile}`).map(p => `<link rel="modulepreload" href="${p}"/>`),
    ...slashPreloads.slice(0, 15).map(p => `<link rel="modulepreload" href="${p}"/>`),
  ].join('\n    ');

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
<html lang="en" suppressHydrationWarning class="light-theme">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"/>
    <title>Formbhro — Online Form Filling &amp; Government Exam Assistance</title>
    <link rel="stylesheet" href="/assets/${cssFile}" data-precedence="default"/>
    ${preloadLinks}
    <link rel="canonical" href="https://formbhro.com"/>
    <link rel="icon" href="/favicon.ico" sizes="any"/>
    <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"/>
    <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512"/>
    <link rel="shortcut icon" href="/favicon.png"/>
    <link rel="manifest" href="/manifest.webmanifest"/>
</head>
<body suppressHydrationWarning class="light-theme">
    <section aria-label="Notifications alt+T" tabindex="-1" aria-live="polite" aria-relevant="additions text" aria-atomic="false"></section>
    <script class="$tsr" id="$tsr-stream-barrier">${tsrBootstrapScript}</script>
    <script type="module" async="" src="/assets/${jsEntryFile}"></script>
</body>
</html>`;

  const indexPath = path.join(distDir, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(`[SPA Generator] Successfully wrote fallback ${indexPath} (${html.length} bytes).`);

  if (fs.existsSync(androidPublicDir)) {
    copyDirRecursive(distDir, androidPublicDir);
    console.log('[SPA Generator] Synced fallback dist to Android public assets.');
  }

  const vercelStaticDir = path.resolve('.vercel/output/static');
  if (fs.existsSync(vercelStaticDir)) {
    fs.writeFileSync(path.join(vercelStaticDir, 'index.html'), html, 'utf8');
    console.log('[SPA Generator] Synced fallback index.html to .vercel/output/static.');
  }
}

main().catch(err => {
  console.error('[SPA Generator] Fatal error:', err);
  process.exit(1);
});
