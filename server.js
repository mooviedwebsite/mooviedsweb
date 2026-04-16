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
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxIz_Cp3iSlHCOmGE_h2ucp2a4zGsOqZY6WaOhIJpR8nggw-bvajcFYU119aKbUQ5hO/exec';
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER  = 'mooviedwebsite';
const GITHUB_REPO   = 'Admin-Log-Sync';
const GITHUB_BRANCH = 'main';

// ── Local data files (primary data store — instant reads/writes) ──────────────
const DATA_DIR          = path.join(ROOT_DIR, 'data');
const COMMENTS_FILE     = path.join(DATA_DIR, 'comments.json');
const AUTOSYNC_CFG_FILE = path.join(ROOT_DIR, '.local', 'autosync-config.json');

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

// ── Comments — local file helpers ─────────────────────────────────────────────

function readComments() {
  try { return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8')); }
  catch { return []; }
}

function writeComments(comments) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
}

// ── Autosync config helpers ───────────────────────────────────────────────────

function loadAutosyncConfig() {
  try { return JSON.parse(fs.readFileSync(AUTOSYNC_CFG_FILE, 'utf8')); }
  catch { return { enabled: false, intervalHours: 6, gasUrl: GAS_URL, lastSync: null }; }
}

function saveAutosyncConfig(cfg) {
  ensureDir(path.dirname(AUTOSYNC_CFG_FILE));
  fs.writeFileSync(AUTOSYNC_CFG_FILE, JSON.stringify(cfg, null, 2));
}

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

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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

// ── HTTP fetch (follow redirects) ─────────────────────────────────────────────

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
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, targetUrl).href;
        const switchGet = [301, 302, 303].includes(res.statusCode);
        res.resume();
        fetchUrl(loc, switchGet ? { method: 'GET', headers: { 'User-Agent': 'MOOVIED-Server/1.0' } } : opts, redirects + 1)
          .then(resolve).catch(reject);
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

// Fire-and-forget to GAS (no redirect follow — GAS always returns 302 for POST)
function fetchUrlNoRedirect(targetUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + parsed.search,
      method:   opts.method || 'GET',
      headers:  opts.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, raw: body }));
    });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

// ── GAS helpers ───────────────────────────────────────────────────────────────

async function gasGet(action, extra = {}) {
  const params = new URLSearchParams({ action, ...extra });
  try {
    const r = await fetchUrl(`${GAS_URL}?${params}`);
    return r.body || { success: false, error: 'No response from GAS' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Fire-and-forget POST to GAS — never blocks the response
function gasPost(body) {
  const jsonBody = JSON.stringify(body);
  fetchUrlNoRedirect(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(jsonBody).toString(),
      'User-Agent':    'MOOVIED-Server/1.0',
    },
    body: jsonBody,
  }).then(r => {
    console.log(`[GAS POST] ${body.action} → HTTP ${r.status}`);
  }).catch(e => {
    console.log(`[GAS POST] ${body.action} error: ${e.message}`);
  });
}

// Fire-and-forget GET to GAS — uses doGet directly (no redirect issues)
// This is the RELIABLE path for syncing comment mutations to the sheet
function gasSync(action, params = {}) {
  gasGet(action, params)
    .then(r => console.log(`[GAS GET] ${action} → success:${r.success}${r.error ? ' err:' + r.error : ''}`))
    .catch(e => console.log(`[GAS GET] ${action} error: ${e.message}`));
}

// ── GitHub push helper ────────────────────────────────────────────────────────

async function githubPush(filePath, content, message) {
  if (!GITHUB_TOKEN) return;
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
  try {
    let sha = '';
    const r = await fetchUrl(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (r.body && r.body.sha) sha = r.body.sha;
    const b64 = Buffer.from(typeof content === 'string' ? content : JSON.stringify(content, null, 2)).toString('base64');
    const payload = { message, content: b64, branch: GITHUB_BRANCH };
    if (sha) payload.sha = sha;
    await fetchUrl(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    console.log(`[GitHub] pushed ${filePath}`);
  } catch (e) {
    console.log(`[GitHub] push ${filePath} error: ${e.message}`);
  }
}

// Async: push comments.json to GitHub (don't await)
function syncCommentsToGithub(comments) {
  githubPush('data/comments.json', comments, 'sync: comments updated').catch(() => {});
}

// ── On-startup: load comments from GAS if local file is empty ─────────────────

async function initCommentsFromGAS() {
  const local = readComments();
  if (local.length > 0) {
    console.log(`[comments] loaded ${local.length} comments from local file`);
    return;
  }
  console.log('[comments] local file empty — pulling from GAS...');
  try {
    const r = await gasGet('getAllComments');
    if (r.success && Array.isArray(r.comments) && r.comments.length > 0) {
      writeComments(r.comments);
      console.log(`[comments] synced ${r.comments.length} comments from GAS`);
    } else {
      console.log('[comments] GAS has no comments — starting fresh');
    }
  } catch (e) {
    console.log('[comments] GAS pull failed:', e.message);
  }
}

// ── HTML inject ───────────────────────────────────────────────────────────────

const INJECT_SCRIPT = `<script>
(function(){
  var GAS = '${GAS_URL}';
  var API = window.location.origin + '/api';
  localStorage.setItem('moovied_comments_api_url', API);
  localStorage.setItem('moovied_api_server_url',   API);
  localStorage.setItem('moovied_gas_url',           GAS);
  var _g = Storage.prototype.getItem;
  Storage.prototype.getItem = function(k) {
    if (k === 'moovied_comments_api_url') return API;
    if (k === 'moovied_api_server_url')   return API;
    if (k === 'moovied_gas_url')          return GAS;
    return _g.call(this, k);
  };
})();
</script>`;

const INJECT_MARKER = '<!-- moovied-inject -->';
function injectIntoHtml(buf) {
  const html = buf.toString('utf8');
  if (html.includes(INJECT_MARKER)) return buf;
  return Buffer.from(
    html.replace('<head>', '<head>\n' + INJECT_MARKER + '\n' + INJECT_SCRIPT),
    'utf8'
  );
}

// ── API handler ───────────────────────────────────────────────────────────────

async function handleApi(req, res, apiPath) {
  const method = req.method.toUpperCase();
  const qs     = new URL('http://x' + req.url).searchParams;

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

  // ══════════════════════════════════════════════════════════════════════════
  // COMMENTS — local-file-first: instant reads/writes, GAS synced in background
  // ══════════════════════════════════════════════════════════════════════════

  // GET /api/comments?movieId=xxx
  if (apiPath === '/comments' && method === 'GET') {
    const movieId = qs.get('movieId') || '';
    if (!movieId) return json(res, { success: true, comments: [] });
    const all = readComments();
    const comments = all
      .filter(c => String(c.movie_id) === movieId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return json(res, { success: true, comments });
  }

  // GET /api/comments/all
  if (apiPath === '/comments/all' && method === 'GET') {
    const all = readComments();
    all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return json(res, { success: true, comments: all });
  }

  // POST /api/comments  — add a comment
  if (apiPath === '/comments' && method === 'POST') {
    const body = await readBody(req);
    const movieId     = body.movie_id  || body.movieId  || '';
    const userId      = body.user_id   || body.userId   || '';
    const userName    = body.user_name || body.userName || 'Anonymous';
    const content     = (body.content  || '').trim();
    const replyTo     = body.reply_to     || body.replyTo     || '';
    const replyToName = body.reply_to_name || body.replyToName || '';

    if (!movieId || !userId || !content) {
      return json(res, { success: false, error: 'movie_id, user_id and content are required' }, 400);
    }

    const comment = {
      id:            crypto.randomUUID(),
      movie_id:      movieId,
      user_id:       userId,
      user_name:     userName,
      content,
      timestamp:     new Date().toISOString(),
      likes:         0,
      edited:        false,
      reply_to:      replyTo,
      reply_to_name: replyToName,
    };

    // Save to local file immediately — this is the fast path
    const all = readComments();
    all.push(comment);
    writeComments(all);

    // Async: POST to GAS (triggers doPost, data saved to sheet)
    // id is passed so GAS uses the same UUID as local (requires code.gs v4.1+)
    gasPost({ action: 'addComment', id: comment.id, movieId, userId, userName, content, reply_to: replyTo, reply_to_name: replyToName });

    // Async: push updated comments.json to GitHub
    syncCommentsToGithub(all);

    return json(res, { success: true, comment });
  }

  // PATCH or PUT /api/comments/:id  — edit a comment
  const editMatch = apiPath.match(/^\/comments\/([^/]+)$/);
  if (editMatch && (method === 'PATCH' || method === 'PUT')) {
    const id   = editMatch[1];
    const body = await readBody(req);
    const content = (body.content || '').trim();

    const all = readComments();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return json(res, { success: false, error: 'Comment not found' });

    all[idx].content = content;
    all[idx].edited  = true;
    writeComments(all);

    gasPost({ action: 'editComment', id, content });
    syncCommentsToGithub(all);

    return json(res, { success: true });
  }

  // DELETE /api/comments/:id
  if (editMatch && method === 'DELETE') {
    const id  = editMatch[1];
    const all = readComments();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return json(res, { success: true }); // idempotent

    all.splice(idx, 1);
    writeComments(all);

    gasPost({ action: 'deleteComment', id });
    syncCommentsToGithub(all);

    return json(res, { success: true });
  }

  // POST /api/comments/:id/like
  const likeMatch = apiPath.match(/^\/comments\/([^/]+)\/like$/);
  if (likeMatch && method === 'POST') {
    const id  = likeMatch[1];
    const all = readComments();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return json(res, { success: false, error: 'Comment not found' });

    all[idx].likes = (Number(all[idx].likes) || 0) + 1;
    writeComments(all);

    gasPost({ action: 'likeComment', id });
    syncCommentsToGithub(all);

    return json(res, { success: true, likes: all[idx].likes });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════════════════════

  if (apiPath === '/login' && method === 'POST') {
    const body = await readBody(req);
    const r = await gasGet('loginUser', { email: body.email, password: body.password });
    // loginUser is POST-based in GAS — use gasGet as proxy
    try {
      const pr = await fetchUrl(`${GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'loginUser', email: body.email, password: body.password }),
      });
      return json(res, pr.body || { success: false, error: 'GAS error' });
    } catch (e) {
      return json(res, { success: false, error: e.message });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAS PROXY — pass any other action through
  // ══════════════════════════════════════════════════════════════════════════

  if (apiPath === '/gas' && method === 'GET') {
    const action = qs.get('action');
    if (!action) return json(res, { error: 'action required' }, 400);
    const params = {};
    qs.forEach((v, k) => { if (k !== 'action') params[k] = v; });
    const r = await gasGet(action, params);
    return json(res, r);
  }

  if (apiPath === '/gas' && method === 'POST') {
    const body = await readBody(req);
    try {
      const r = await fetchUrl(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return json(res, r.body || { success: false, error: 'No response' });
    } catch (e) {
      return json(res, { success: false, error: e.message });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GITHUB PUSH
  // ══════════════════════════════════════════════════════════════════════════

  if (apiPath === '/github/push' && method === 'PUT') {
    const body = await readBody(req);
    if (!body.file || !body.content) return json(res, { error: 'file and content required' }, 400);
    await githubPush(body.file, body.content, body.message || 'Upload via MOOVIED');
    return json(res, { success: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-SYNC CONFIG — GET / PUT / POST trigger
  // ══════════════════════════════════════════════════════════════════════════

  if (apiPath === '/autosync/config' && method === 'GET') {
    return json(res, loadAutosyncConfig());
  }

  if (apiPath === '/autosync/config' && (method === 'PUT' || method === 'POST')) {
    const body = await readBody(req);
    const existing = loadAutosyncConfig();
    const merged   = { ...existing, ...body, updatedAt: new Date().toISOString() };
    saveAutosyncConfig(merged);
    return json(res, { success: true, config: merged });
  }

  if (apiPath === '/autosync/trigger' && method === 'POST') {
    // Pull fresh data from GAS and update local cache
    const cfg = loadAutosyncConfig();
    cfg.lastSync = new Date().toISOString();
    saveAutosyncConfig(cfg);

    // Async sync: pull all comments from GAS, overwrite local file
    gasGet('getAllComments').then(r => {
      if (r.success && Array.isArray(r.comments)) {
        writeComments(r.comments);
        syncCommentsToGithub(r.comments);
        console.log('[autosync] pulled', r.comments.length, 'comments from GAS');
      }
    }).catch(e => console.log('[autosync] error:', e.message));

    return json(res, { success: true, triggeredAt: cfg.lastSync });
  }

  return json(res, { error: 'Not found' }, 404);
}

// ── Main request handler ──────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  let urlPath     = parsedUrl.pathname || '/';

  if (urlPath === '/' || urlPath === '') {
    res.writeHead(302, { Location: BASE_PATH + '/' });
    res.end();
    return;
  }

  // API routes
  if (urlPath.startsWith('/api/') || urlPath === '/api') {
    const apiPath = urlPath.slice(4) || '/';
    try { await handleApi(req, res, apiPath); }
    catch (err) {
      console.error('API error:', err);
      json(res, { success: false, error: 'Internal server error' }, 500);
    }
    return;
  }

  // Static files
  let filePath = urlPath.startsWith(BASE_PATH)
    ? urlPath.slice(BASE_PATH.length) || '/'
    : urlPath;
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
        res.writeHead(500); res.end('Server Error');
      }
      return;
    }

    if (ext === '.html') {
      data = injectIntoHtml(data);
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.end(data);
      return;
    }

    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`MOOVIED server running at http://0.0.0.0:${PORT}${BASE_PATH}/`);
  console.log(`API: http://0.0.0.0:${PORT}/api/*`);
  ensureDir(DATA_DIR);
  await initCommentsFromGAS();
});
