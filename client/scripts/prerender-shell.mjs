/**
 * Adds a ready-made copy of the sign-in page ("app shell") to dist/index.html, so the browser can show it
 * before the app's JavaScript has loaded. Run after `vite build`:   npm run build:static
 *
 * How: serves dist locally, opens /login in headless Chrome as a signed-out visitor, copies the rendered
 * HTML and the CSS it uses, and writes them into dist/index.html. Also inlines the small stylesheet and
 * preloads the main font file. The app removes the copy when the real page is ready (src/lib/appShell.ts).
 *
 * Needs Chrome or Edge. Set CHROME_PATH if it is not in a usual place. No npm packages.
 */
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const INDEX = path.join(DIST, 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && fs.existsSync(p));
if (!chromePath) {
  console.error('prerender-shell: Chrome not found (set CHROME_PATH). dist/index.html left as built.');
  process.exit(1);
}

let html = fs.readFileSync(INDEX, 'utf8');
if (html.includes('id="app-shell"')) {
  console.log('prerender-shell: dist/index.html already has the shell. Run vite build first for a fresh one.');
  process.exit(0);
}

// ── Serve dist the way the live web server does (unknown paths → index.html).
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = INDEX;
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] ?? 'application/octet-stream' }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ── Headless Chrome over the DevTools protocol.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-'));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let err = '';
  chrome.stderr.on('data', (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) resolve(m[1]); });
  setTimeout(() => reject(new Error('Chrome did not start')), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
const handlers = new Set();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  for (const h of handlers) h(m);
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

async function finish(code) {
  ws.close();
  chrome.kill();
  server.close();
  process.exit(code);
}

try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await s('Emulation.setFocusEmulationEnabled', { enabled: true });

  // Every API call answers "nobody is signed in", wherever the build's API address points.
  await s('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  handlers.add((m) => {
    if (m.method !== 'Fetch.requestPaused' || m.sessionId !== sessionId) return;
    const reqOrigin = m.params.request.headers.Origin ?? m.params.request.headers.origin ?? origin;
    void s('Fetch.fulfillRequest', {
      requestId: m.params.requestId,
      responseCode: 200,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: reqOrigin },
        { name: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
      body: Buffer.from('{"user":null}').toString('base64'),
    });
  });

  await s('Page.navigate', { url: `${origin}/login` });
  const evaluate = async (expression) => {
    const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    await sleep(250);
    ready = await evaluate(`!!document.querySelector('#root form input[type=password]') && location.pathname === '/login'`);
  }
  if (!ready) throw new Error('the sign-in page did not render');

  const shot = await evaluate(`(async () => {
    await document.fonts.ready;
    // Same state as the real page on arrival: cursor in the email field.
    document.querySelector('#root input[type=email]').focus();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const root = document.getElementById('root').cloneNode(true);
    for (const el of root.querySelectorAll('input')) el.setAttribute('value', '');
    root.querySelector('input[type=email]').setAttribute('autofocus', '');
    // The copy must not send the form anywhere; the real page takes over the typed values.
    root.querySelector('form').setAttribute('onsubmit', 'return false');
    // Every rule MUI/Emotion has added so far (in production they exist only in the CSSOM, not as text).
    const css = [...document.styleSheets]
      .filter((sh) => sh.ownerNode && sh.ownerNode.tagName === 'STYLE' && sh.ownerNode.hasAttribute('data-emotion'))
      .flatMap((sh) => [...sh.cssRules].map((r) => r.cssText))
      .join('');
    return { html: root.innerHTML, css };
  })()`);
  if (!shot.html.includes('type="password"') || shot.css.length < 2000) throw new Error('captured page looks incomplete');

  // ── Write the new index.html.
  // 1. The small stylesheet goes inline (one request fewer before first paint).
  let inlineCss = '';
  for (const m of [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*/g)]) {
    inlineCss += fs.readFileSync(path.join(DIST, m[1]), 'utf8');
    html = html.replace(m[0], '');
  }
  // 2. The app's scripts start after the sign-in copy has painted (or at once when the copy is not shown),
  //    so they never compete with the first paint. Vite's own tags are replaced by a small loader.
  const entry = /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>\s*/.exec(html);
  if (!entry) throw new Error('entry script tag not found in dist/index.html');
  html = html.replace(entry[0], '');
  const preloads = [...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"[^>]*>\s*/g)];
  for (const m of preloads) html = html.replace(m[0], '');
  const loader = `<script>
      (function () {
        var d = document, started = false;
        function start() {
          if (started) return;
          started = true;
          ${JSON.stringify(preloads.map((m) => m[1]))}.forEach(function (href) {
            var l = d.createElement('link'); l.rel = 'modulepreload'; l.crossOrigin = ''; l.href = href; d.head.appendChild(l);
          });
          var s = d.createElement('script'); s.type = 'module'; s.crossOrigin = ''; s.src = ${JSON.stringify(entry[1])}; d.head.appendChild(s);
        }
        if (!d.documentElement.classList.contains('shell-on')) return start();
        try {
          new PerformanceObserver(function (list) {
            if (list.getEntriesByName('first-contentful-paint').length) start();
          }).observe({ type: 'paint', buffered: true });
        } catch (e) { start(); }
        setTimeout(start, 2500);
      })();
    </script>`;
  // 3. The main font file is fetched straight away; the API connection is opened early.
  const font = fs.readdirSync(path.join(DIST, 'assets')).find((f) => /^dm-sans-latin-wght-normal-.*\.woff2$/.test(f));
  const apiOrigin = (process.env.VITE_API_URL ?? '').replace(/\/+$/, '');
  const NL = '\n    ';
  const early = [
    font ? `<link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin>` : '',
    apiOrigin ? `<link rel="preconnect" href="${apiOrigin}">` : '',
  ].filter(Boolean).join(NL);
  // Function replacements: the captured CSS/HTML may contain "$" sequences that replace() would interpret.
  html = html.replace(/(<meta name="viewport"[^>]*>)/, (m) => m + NL + early);
  const head = [inlineCss ? `<style>${inlineCss}</style>` : '', `<style id="app-shell-css">${shot.css}</style>`, loader].filter(Boolean).join(NL);
  html = html.replace('</head>', () => `  ${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', () => `<div id="app-shell">${shot.html}</div>${NL}<div id="root"></div>`);
  if (!html.includes('id="app-shell"')) throw new Error('could not place the shell in index.html');
  fs.writeFileSync(INDEX, html);
  console.log(`prerender-shell: added sign-in shell (${(shot.html.length / 1024).toFixed(1)} KB HTML, ${(shot.css.length / 1024).toFixed(1)} KB CSS). index.html is now ${(html.length / 1024).toFixed(1)} KB.`);
  await finish(0);
} catch (err) {
  console.error('prerender-shell failed:', err.message, '\ndist/index.html left as built.');
  await finish(1);
}
