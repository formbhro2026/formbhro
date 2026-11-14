export function renderErrorPage(error?: unknown): string {
  const message =
    error instanceof Error
      ? `${error.name ? `${error.name}: ` : ""}${error.message}`
      : typeof error === "string"
        ? error
        : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0b0c10; color: #fff; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: #151821; border-radius: 1rem; border: 1px solid #2d3748; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; font-weight: 700; }
      p { color: #9ca3af; margin: 0 0 1.25rem; font-size: 0.875rem; }
      .err { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); color: #f87171; border-radius: 0.75rem; padding: 0.75rem; font-family: monospace; font-size: 0.75rem; text-align: left; word-break: break-all; max-height: 8rem; overflow-y: auto; margin-bottom: 1.25rem; }
      .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.6rem 1.2rem; border-radius: 0.5rem; font: inherit; cursor: pointer; text-decoration: none; border: none; font-weight: 600; font-size: 0.875rem; }
      .primary { background: #ff5e1e; color: #fff; }
      .secondary { background: #232733; color: #e2e8f0; border: 1px solid #374151; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      ${message ? `<div class="err">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
      <div class="actions">
        <button class="primary" onclick="try{if('caches' in window)caches.keys().then(k=>Promise.all(k.map(c=>caches.delete(c))));if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(r=>Promise.all(r.map(w=>w.unregister())));}catch(e){}location.href=location.pathname+'?_b='+Date.now()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
