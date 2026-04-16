const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT      = 5000;
const BASE_PATH = '/Admin-Log-Sync';
const ROOT_DIR  = __dirname;

// ── GAS & GitHub config ───────────────────────────────────────────────────────
const GAS_URLS = [
  'https://script.google.com/macros/s/AKfycbzZEAcXt4lp0t_FVdIgJR2dKQARlIdY8MkuHjwxfadN5Wpj4v7GOQr1Xo7OhQWd3h8k/exec',
  'https://script.google.com/macros/s/AKfycbwZh3CodBYIMDCqIFKQhT28FkRHYpaoQUNlRsstxZf8eMO_GjPpr4zCMsLbQ5-aGA3v8g/exec',
];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = 'mooviedwebsite';
const GITHUB_REPO  = 'Admin-Log-Sync';
const GITHUB_BRANCH = 'main';

const AUTOSYNC_CONFIG_FILE = path.join(__dirname, '.local', 'autosync-config.json');

// ── Mime types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// Fetch a URL using native https/http — returns parsed JSON or throws
function fetchUrl(targetUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   opts.method || 'GET',
      headers:  opts.headers || {},
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body), raw: body }); }
        catch { resolve({ status: res.statusCode, body: null, raw: body }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

// Call GAS GET action
async function gasGet(action, extra = {}) {
  const params = new URLSearchParams({ action, ...extra });
  for (const gasUrl of GAS_URLS) {
    try {
      const r = await fetchUrl(`${gasUrl}?${params}`);
      if (r.body && r.body.success !== undefined) return r.body;
    } catch {}
  }
  return { success: false, error: 'GAS unreachable' };
}

// Call GAS POST action
async function gasPost(body) {
  for (const gasUrl of GAS_URLS) {
    try {
      const r = await fetchUrl(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.body && r.body.success !== undefined) return r.body;
    } catch {}
  }
  return { success: false, error: 'GAS unreachable' };
}

// Push a file to GitHub
async function githubPush(filePath, contentB64, message, isRaw = false) {
  if (!GITHUB_TOKEN) return { ok: false, error: 'No GITHUB_TOKEN' };
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
  // Get current SHA
  let sha = '';
  try {
    const r = await fetchUrl(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (r.body && r.body.sha) sha = r.body.sha;
  } catch {}

  const content = isRaw ? contentB64 : Buffer.from(
    typeof contentB64 === 'string' ? contentB64 : JSON.stringify(contentB64)
  ).toString('base64');

  const payload = { message: message || 'Update via MOOVIED', content, branch: GITHUB_BRANCH };
  if (sha) payload.sha = sha;

  const r = await fetchUrl(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return r.status === 200 || r.status === 201 ? 'ok' : 'error';
}

// ── Autosync config helpers ───────────────────────────────────────────────────

function loadAutosyncConfig() {
  try {
    return JSON.parse(fs.readFileSync(AUTOSYNC_CONFIG_FILE, 'utf8'));
  } catch {
    return { enabled: false, intervalHours: 6, gasUrl: GAS_URLS[0], lastSync: null };
  }
}

function saveAutosyncConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(AUTOSYNC_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(AUTOSYNC_CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch {}
}

// ── HTML injection — sets correct API URL in localStorage on page load ─────────
const INJECT_SCRIPT = `<script>
(function(){
  var api = window.location.origin + '/api';
  var old = 'https://a16cbf22-021e-4fbd-a6d1-5c8d3c7e4244-00-923mtzjoxrcz.worf.replit.dev/api';
  function fix(k) {
    var v = localStorage.getItem(k);
    if (!v || v === old) localStorage.setItem(k, api);
  }
  fix('moovied_comments_api_url');
  fix('moovied_api_server_url');
})();
</script>`;

function injectIntoHtml(buf) {
  const html = buf.toString('utf8');
  if (html.includes(INJECT_SCRIPT)) return buf;
  return Buffer.from(html.replace('</head>', INJECT_SCRIPT + '</head>'), 'utf8');
}

// ── API route handler ─────────────────────────────────────────────────────────

async function handleApi(req, res, apiPath) {
  const method  = req.method.toUpperCase();
  const qs      = new URL('http://x' + req.url).searchParams;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── GET /api/comments?movieId=xxx ── or ── GET /api/comments/all ──────────
  if (apiPath === '/comments' && method === 'GET') {
    const movieId = qs.get('movieId');
    if (!movieId) return json(res, { success: false, error: 'movieId required' }, 400);
    const r = await gasGet('getComments', { movieId });
    return json(res, r);
  }

  if (apiPath === '/comments/all' && method === 'GET') {
    const r = await gasGet('getAllComments');
    return json(res, r);
  }

  // ── POST /api/comments ── (add comment) ───────────────────────────────────
  if (apiPath === '/comments' && method === 'POST') {
    const body = await readBody(req);
    const r = await gasPost({
      action:       'addComment',
      movieId:      body.movieId,
      userId:       body.userId,
      userName:     body.userName,
      content:      body.content,
      reply_to:     body.reply_to     || '',
      reply_to_name:body.reply_to_name|| '',
    });
    return json(res, r);
  }

  // ── PUT /api/comments/:id ── (edit comment) ───────────────────────────────
  const editMatch = apiPath.match(/^\/comments\/([^/]+)$/);
  if (editMatch && method === 'PUT') {
    const body = await readBody(req);
    const r = await gasPost({ action: 'editComment', id: editMatch[1], content: body.content });
    return json(res, r);
  }

  // ── DELETE /api/comments/:id ── ───────────────────────────────────────────
  if (editMatch && method === 'DELETE') {
    const r = await gasPost({ action: 'deleteComment', id: editMatch[1] });
    return json(res, r);
  }

  // ── POST /api/comments/:id/like ── ───────────────────────────────────────
  const likeMatch = apiPath.match(/^\/comments\/([^/]+)\/like$/);
  if (likeMatch && method === 'POST') {
    const r = await gasPost({ action: 'likeComment', id: likeMatch[1] });
    return json(res, r);
  }

  // ── PUT /api/github/push ── (image / file upload) ─────────────────────────
  if (apiPath === '/github/push' && method === 'PUT') {
    const body = await readBody(req);
    if (!body.file || !body.content) return json(res, { error: 'file and content required' }, 400);
    const result = await githubPush(body.file, body.content, body.message || 'Upload via MOOVIED', body.raw || false);
    return json(res, result === 'ok' ? { success: true } : { error: 'github push failed' });
  }

  // ── GET /api/autosync/config ── ───────────────────────────────────────────
  if (apiPath === '/autosync/config' && method === 'GET') {
    return json(res, loadAutosyncConfig());
  }

  // ── PUT /api/autosync/config ── ───────────────────────────────────────────
  if (apiPath === '/autosync/config' && method === 'PUT') {
    const body = await readBody(req);
    const existing = loadAutosyncConfig();
    const merged = { ...existing, ...body };
    saveAutosyncConfig(merged);
    return json(res, merged);
  }

  // ── POST /api/autosync/trigger ── ─────────────────────────────────────────
  if (apiPath === '/autosync/trigger' && method === 'POST') {
    // Kick off GAS sync (non-blocking)
    gasGet('getAllData').catch(() => {});
    const cfg = loadAutosyncConfig();
    cfg.lastSync = new Date().toISOString();
    saveAutosyncConfig(cfg);
    return json(res, { success: true, triggeredAt: cfg.lastSync });
  }

  // ── POST /api/login ── authenticate via GAS ──────────────────────────────
  if (apiPath === '/login' && method === 'POST') {
    const body = await readBody(req);
    const r = await gasPost({ action: 'loginUser', email: body.email, password: body.password });
    return json(res, r);
  }

  // ── GET /api/gas ── proxy any GET action directly ─────────────────────────
  if (apiPath === '/gas' && method === 'GET') {
    const action = qs.get('action');
    if (!action) return json(res, { error: 'action required' }, 400);
    const params = {};
    qs.forEach((v, k) => { if (k !== 'action') params[k] = v; });
    const r = await gasGet(action, params);
    return json(res, r);
  }

  // ── POST /api/gas ── proxy any POST action directly ───────────────────────
  if (apiPath === '/gas' && method === 'POST') {
    const body = await readBody(req);
    const r = await gasPost(body);
    return json(res, r);
  }

  return json(res, { error: 'Not found' }, 404);
}

// ── Main request handler ──────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  let urlPath = parsedUrl.pathname || '/';

  // Root redirect
  if (urlPath === '/' || urlPath === '') {
    res.writeHead(302, { Location: BASE_PATH + '/' });
    res.end();
    return;
  }

  // ── API routes: /api/* ───────────────────────────────────────────────────
  if (urlPath.startsWith('/api/') || urlPath === '/api') {
    const apiPath = urlPath.slice(4) || '/';
    try {
      await handleApi(req, res, apiPath);
    } catch (err) {
      console.error('API error:', err);
      json(res, { success: false, error: 'Internal server error' }, 500);
    }
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────
  let filePath;
  if (urlPath.startsWith(BASE_PATH)) {
    filePath = urlPath.slice(BASE_PATH.length) || '/';
  } else {
    filePath = urlPath;
  }
  if (filePath === '' || filePath === '/') filePath = '/index.html';

  const fullPath = path.join(ROOT_DIR, filePath);
  const ext      = path.extname(fullPath).toLowerCase();
  const mime     = MIME[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(ROOT_DIR, '404.html'), (e2, d2) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2 || 'Not Found');
        });
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }

    // Inject correct API URL into HTML pages
    if (ext === '.html') {
      data = injectIntoHtml(data);
    }

    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MOOVIED server running at http://0.0.0.0:${PORT}${BASE_PATH}/`);
  console.log(`API endpoints available at http://0.0.0.0:${PORT}/api/*`);
});
