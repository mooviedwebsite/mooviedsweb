const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const crypto = require('crypto');

const PORT      = 5000;
const BASE_PATH = '/Admin-Log-Sync';
const ROOT_DIR  = __dirname;

// ── GAS & GitHub config ───────────────────────────────────────────────────────
const GAS_URL_PRIMARY   = 'https://script.google.com/macros/s/AKfycbxIz_Cp3iSlHCOmGE_h2ucp2a4zGsOqZY6WaOhIJpR8nggw-bvajcFYU119aKbUQ5hO/exec';
const GAS_URL_SECONDARY = 'https://script.google.com/macros/s/AKfycbwZh3CodBYIMDCqIFKQhT28FkRHYpaoQUNlRsstxZf8eMO_GjPpr4zCMsLbQ5-aGA3v8g/exec';
const GAS_URLS = [ GAS_URL_PRIMARY, GAS_URL_SECONDARY ];
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

// Fetch a URL using native https/http with redirect following — returns parsed JSON or throws
function fetchUrl(targetUrl, opts = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('Too many redirects'));
    const parsed = new URL(targetUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   opts.method || 'GET',
      headers:  { 'User-Agent': 'MOOVIED-Server/1.0', ...(opts.headers || {}) },
    };
    const req = lib.request(options, (res) => {
      // Follow redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, targetUrl).href;
        // 301/302/303 → switch to GET (browser standard behavior, required for GAS)
        const switchToGet = [301, 302, 303].includes(res.statusCode);
        const redirectOpts = switchToGet
          ? { ...opts, method: 'GET', body: undefined, headers: { 'User-Agent': 'MOOVIED-Server/1.0' } }
          : opts;
        res.resume(); // drain the response
        fetchUrl(redirectUrl, redirectOpts, redirects + 1).then(resolve).catch(reject);
        return;
      }
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

// Fetch a URL — no redirect following (returns raw status/body)
function fetchUrlNoRedirect(targetUrl, opts = {}) {
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

// Call GAS GET action — tries all URLs, returns first successful response
async function gasGet(action, extra = {}) {
  const params = new URLSearchParams({ action, ...extra });
  let lastErr = 'GAS unreachable';
  for (const gasUrl of GAS_URLS) {
    try {
      const r = await fetchUrl(`${gasUrl}?${params}`);
      if (r.body) {
        // Only accept a response from this URL if it actually handled the action
        if (r.body.success === true) return r.body;
        // If it failed due to unknown action, try the next URL
        if (r.body.error && r.body.error.startsWith('Unknown action')) {
          lastErr = `Action not found on ${gasUrl}`; continue;
        }
        // Any other error (auth, etc.) — return it
        return r.body;
      }
    } catch (e) { lastErr = e.message; }
  }
  return { success: false, error: lastErr };
}

// Fire-and-forget POST to GAS — GAS always returns 302 for POST (data IS saved),
// so we don't follow the redirect. Returns { fired: true } if GAS accepted it.
async function gasFirePost(body) {
  const jsonBody = JSON.stringify(body);
  for (const gasUrl of GAS_URLS) {
    try {
      const r = await fetchUrlNoRedirect(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonBody).toString(),
          'User-Agent': 'MOOVIED-Server/1.0',
        },
        body: jsonBody,
      });
      // GAS returns 302 when it accepts and processes the POST
      if (r.status === 302 || r.status === 200) {
        console.log('[gasFirePost] accepted by GAS, status:', r.status, 'action:', body.action);
        return { fired: true };
      }
      console.log('[gasFirePost] unexpected status:', r.status, 'action:', body.action);
    } catch (e) { console.log('[gasFirePost] error:', e.message); }
  }
  return { fired: false };
}

// Call GAS POST action — tries all URLs, returns first successful response
async function gasPost(body) {
  let lastErr = 'GAS unreachable';
  for (const gasUrl of GAS_URLS) {
    try {
      const r = await fetchUrl(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.body) {
        if (r.body.success === true) return r.body;
        if (r.body.error && r.body.error.startsWith('Unknown action')) {
          lastErr = `Action not found on ${gasUrl}`; continue;
        }
        return r.body;
      }
    } catch (e) { lastErr = e.message; }
  }
  return { success: false, error: lastErr };
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
// (GAS_URL_PRIMARY / GAS_URL_SECONDARY are defined above)

const INJECT_SCRIPT = `<script>
(function(){
  var api = window.location.origin + '/api';
  var gasNew = '${GAS_URL_PRIMARY}';
  localStorage.setItem('moovied_comments_api_url', api);
  localStorage.setItem('moovied_api_server_url', api);
  localStorage.setItem('moovied_gas_url', gasNew);
})();
</script>`;

const INJECT_MARKER = '<!-- moovied-api-inject -->';
function injectIntoHtml(buf) {
  const html = buf.toString('utf8');
  if (html.includes(INJECT_MARKER)) return buf;
  const tag = INJECT_MARKER + '\n' + INJECT_SCRIPT;
  return Buffer.from(html.replace('</head>', tag + '\n</head>'), 'utf8');
}

// ── API route handler ─────────────────────────────────────────────────────────

async function handleApi(req, res, apiPath) {
  const method  = req.method.toUpperCase();
  const qs      = new URL('http://x' + req.url).searchParams;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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
  // Frontend sends snake_case (movie_id, user_id, user_name) — accept both forms.
  // GAS POST always returns 302 (data IS saved). We build the response immediately
  // and fire-and-forget the sheet write in the background.
  if (apiPath === '/comments' && method === 'POST') {
    const body = await readBody(req);
    // Accept both snake_case (frontend native) and camelCase
    const movieId  = body.movie_id  || body.movieId;
    const userId   = body.user_id   || body.userId;
    const userName = body.user_name || body.userName || 'Anonymous';
    const content  = body.content;
    const replyTo      = body.reply_to      || '';
    const replyToName  = body.reply_to_name || '';

    if (!movieId || !userId || !content) {
      return json(res, { success: false, error: 'movie_id, user_id and content are required' }, 400);
    }

    const commentId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const comment = {
      id:        commentId,
      movie_id:  movieId,
      user_id:   userId,
      user_name: userName,
      content,
      timestamp,
      likes:     0,
      edited:    false,
    };
    if (replyTo)     comment.reply_to      = replyTo;
    if (replyToName) comment.reply_to_name = replyToName;

    // Fire to GAS to save in Google Sheet (non-blocking)
    gasFirePost({
      action:        'addComment',
      movieId,
      userId,
      userName,
      content,
      reply_to:      replyTo,
      reply_to_name: replyToName,
    }).catch(() => {});

    return json(res, { success: true, comment });
  }

  // ── PUT or PATCH /api/comments/:id ── (edit comment) ──────────────────────
  // Frontend sends PATCH; we also accept PUT for admin panel compatibility.
  const editMatch = apiPath.match(/^\/comments\/([^/]+)$/);
  if (editMatch && (method === 'PUT' || method === 'PATCH')) {
    const body = await readBody(req);
    const commentId = editMatch[1];
    gasFirePost({ action: 'editComment', id: commentId, content: body.content }).catch(() => {});
    return json(res, { success: true });
  }

  // ── DELETE /api/comments/:id ── ───────────────────────────────────────────
  if (editMatch && method === 'DELETE') {
    gasFirePost({ action: 'deleteComment', id: editMatch[1] }).catch(() => {});
    return json(res, { success: true });
  }

  // ── POST /api/comments/:id/like ── ───────────────────────────────────────
  const likeMatch = apiPath.match(/^\/comments\/([^/]+)\/like$/);
  if (likeMatch && method === 'POST') {
    gasFirePost({ action: 'likeComment', id: likeMatch[1] }).catch(() => {});
    return json(res, { success: true });
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
