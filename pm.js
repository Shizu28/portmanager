// ─── Port Manager ────────────────────────────────────────────────
// Kleiner Hilfs-Server auf Port 3099
// Starten: node pm.js
// ─────────────────────────────────────────────────────────────────
const http = require('http');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs   = require('fs');

const PM_PORT = 3099;
const ROOT    = __dirname;

// ── Hilfsfunktionen ──────────────────────────────────────────────

function getPorts() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress"',
      { timeout: 6000, encoding: 'utf8' }
    );
    const rows = JSON.parse(out.trim() || '[]');
    const arr  = Array.isArray(rows) ? rows : [rows];

    // Gather process names
    const pids = [...new Set(arr.map(r => r.OwningProcess).filter(Boolean))];
    const nameMap = {};
    for (const pid of pids) {
      try {
        const n = execSync(
          `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`,
          { timeout: 3000, encoding: 'utf8' }
        ).trim();
        nameMap[pid] = n || '?';
      } catch { nameMap[pid] = '?'; }
    }

    return arr
      .map(r => ({ port: r.LocalPort, pid: r.OwningProcess, name: nameMap[r.OwningProcess] || '?' }))
      .sort((a, b) => a.port - b.port);
  } catch(e) {
    return [{ port: 0, pid: 0, name: 'Fehler: ' + e.message }];
  }
}

function killPid(pid) {
  execSync(`powershell -NoProfile -Command "Stop-Process -Id ${parseInt(pid)} -Force -ErrorAction SilentlyContinue"`, { timeout: 4000 });
}

// Track restarted processes so we can kill them later
const managed = {}; // port -> { child, cmd }

function restartServer(port) {
  // Kill whatever is on that port first
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${parseInt(port)} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { timeout: 5000 }
    );
  } catch {}

  // Look for a JS entry file that was on this port
  const candidates = ['server.js', 'index.js', 'app.js'];
  let entryFile = null;
  for (const c of candidates) {
    if (fs.existsSync(path.join(ROOT, c))) { entryFile = c; break; }
  }
  if (!entryFile) return { ok: false, error: 'Kein server.js / index.js gefunden' };

  const env = { ...process.env, PORT: String(port) };
  const child = spawn('node', [entryFile], {
    cwd: ROOT, env,
    detached: true, stdio: 'ignore',
  });
  child.unref();
  managed[port] = { pid: child.pid, cmd: `node ${entryFile}` };
  return { ok: true, pid: child.pid, cmd: `node ${entryFile}` };
}

// ── HTML ─────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Port Manager</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f0f17;color:#e2ddf5;min-height:100vh;padding:24px}
h1{font-size:17px;font-weight:700;letter-spacing:.04em;color:#c9b8ff;margin-bottom:4px}
.sub{font-size:11px;color:#6b6880;margin-bottom:22px}
.card{background:#18182a;border:1px solid #2e2b45;border-radius:10px;overflow:hidden}
.hdr{display:grid;grid-template-columns:80px 90px 1fr 1fr;gap:0;padding:10px 16px;background:#22203a;font-size:11px;font-weight:600;color:#8880a8;letter-spacing:.06em;text-transform:uppercase}
.row{display:grid;grid-template-columns:80px 90px 1fr 1fr;align-items:center;gap:0;padding:12px 16px;border-top:1px solid #2a2840;transition:background .15s}
.row:hover{background:#1e1c30}
.port{font-size:14px;font-weight:700;color:#a78bfa;font-variant-numeric:tabular-nums}
.pid{font-size:12px;color:#6b6880;font-variant-numeric:tabular-nums}
.name{font-size:12px;color:#c4bde0}
.name.node{color:#68d391}
.name.python{color:#f6ad55}
.btns{display:flex;gap:6px;justify-content:flex-end}
button{border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;transition:opacity .15s}
button:hover{opacity:.85}
.bkill{background:#7f1d1d;color:#fca5a5}
.brestart{background:#1e3a5f;color:#93c5fd}
.bopen{background:#1a2e1a;color:#86efac}
.refresh-btn{background:#2a2840;color:#a78bfa;border:1px solid #3d3860;border-radius:8px;padding:8px 18px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:16px;display:flex;align-items:center;gap:7px}
.refresh-btn:hover{background:#342f58}
.refresh-btn svg{animation:none}
.refresh-btn.spinning svg{animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px}
.badge.this{background:#2a2840;color:#a78bfa}
.empty{padding:28px;text-align:center;color:#6b6880;font-size:12px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#312d58;border:1px solid #4e4880;border-radius:8px;padding:10px 20px;font-size:12px;color:#c9b8ff;pointer-events:none;opacity:0;transition:opacity .3s;z-index:99}
.toast.show{opacity:1}
</style>
</head>
<body>
<h1>Port Manager</h1>
<div class="sub">Aktive lauschende Ports auf diesem Rechner</div>

<button class="refresh-btn" id="rfBtn" onclick="load()">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
  Aktualisieren
</button>

<div class="card">
  <div class="hdr"><span>Port</span><span>PID</span><span>Prozess</span><span style="text-align:right">Aktionen</span></div>
  <div id="rows"><div class="empty">Lade…</div></div>
</div>

<div class="toast" id="toast"></div>

<script>
const THIS_PORT = ${PM_PORT};

function toast(msg, ok=true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = ok ? '#4e4880' : '#7f1d1d';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function load() {
  const btn = document.getElementById('rfBtn');
  btn.classList.add('spinning');
  try {
    const r = await fetch('/api/ports');
    const d = await r.json();
    const rows = document.getElementById('rows');
    if (!d.length) { rows.innerHTML = '<div class="empty">Keine lauschenden Ports gefunden</div>'; return; }
    rows.innerHTML = d.map(p => \`
      <div class="row">
        <span class="port">\${p.port}\${p.port==THIS_PORT ? '<span class="badge this">PM</span>' : ''}</span>
        <span class="pid">\${p.pid}</span>
        <span class="name \${p.name==='node'?'node':p.name==='python'||p.name==='python3'?'python':''}">\${p.name}</span>
        <div class="btns">
          \${p.port != THIS_PORT ? \`<button class="bkill" onclick="killProc(\${p.pid},\${p.port})">Kill</button>\` : ''}
          \${p.name==='node' && p.port != THIS_PORT ? \`<button class="brestart" onclick="restart(\${p.port})">Restart</button>\` : ''}
          \${p.port > 1000 && p.port < 65000 ? \`<button class="bopen" onclick="window.open('http://localhost:\${p.port}')">Öffnen</button>\` : ''}
        </div>
      </div>
    \`).join('');
  } catch(e) { toast('Fehler: ' + e.message, false); }
  finally { btn.classList.remove('spinning'); }
}

async function killProc(pid, port) {
  if (!confirm(\`PID \${pid} auf Port \${port} beenden?\`)) return;
  try {
    const r = await fetch('/api/kill/' + pid, { method:'POST' });
    const d = await r.json();
    toast(d.ok ? \`PID \${pid} beendet\` : d.error, d.ok);
    setTimeout(load, 800);
  } catch(e) { toast('Fehler: ' + e.message, false); }
}

async function restart(port) {
  if (!confirm(\`Server auf Port \${port} neu starten?\`)) return;
  try {
    const r = await fetch('/api/restart/' + port, { method:'POST' });
    const d = await r.json();
    toast(d.ok ? \`Neugestartet als PID \${d.pid}\` : (d.error||'Fehler'), d.ok);
    setTimeout(load, 1500);
  } catch(e) { toast('Fehler: ' + e.message, false); }
}

load();
setInterval(load, 8000); // auto-refresh every 8s
</script>
</body>
</html>`;

// ── Server ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }

  if (url === '/api/ports') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getPorts()));
  }

  if (url.startsWith('/api/kill/') && req.method === 'POST') {
    const pid = parseInt(url.slice('/api/kill/'.length));
    try { killPid(pid); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true })); }
    catch(e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e.message })); }
    return;
  }

  if (url.startsWith('/api/restart/') && req.method === 'POST') {
    const port = parseInt(url.slice('/api/restart/'.length));
    try { const r = restartServer(port); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r)); }
    catch(e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e.message })); }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Error: Port ${PM_PORT} is already in use. Is Port Manager already running?\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen(PM_PORT, () => {
  console.log(`\n  Port Manager läuft auf http://localhost:${PM_PORT}\n`);
});
