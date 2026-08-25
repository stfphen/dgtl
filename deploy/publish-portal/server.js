'use strict';
// DGTL publish portal — deploy.dgtl.ltd
//
// One portal, many destinations. Supersedes the two single-purpose portals that
// used to run side by side:
//   deploy/portal        (deploy.dgtlmag.com -> pitch.dgtlmag.com only, public hub index)
//   deploy/report-portal (deploy.dgtl.report -> dgtl.report + audit.dgtl.report)
//
// Destinations are DATA, not code: see targets.json. Adding a domain is a JSON edit,
// a volume mount and a DNS record — never a change to this file.
//
// Per-destination policy lives on the registry entry:
//   hub: true   -> regenerate a public index of live slugs at that destination's root
//                  (the pitch.dgtlmag.com behaviour)
//   hub: false  -> private by URL; slugs are never listed publicly. This is the default
//                  and matches the 2026-08-10 decision for reports and audits.
//
// Auth is a single shared DEPLOY_TOKEN across every destination.
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { LOGO, SPARK } = require('./brand.js');

const PORT = process.env.PORT || 80;
const TOKEN = process.env.DEPLOY_TOKEN || '';
const MAX = 12e6, MZIP = +(process.env.MAX_ZIP_BYTES || 150e6);
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;
const REGISTRY = process.env.TARGETS_FILE || path.join(__dirname, 'targets.json');

// --- destination registry ---------------------------------------------------

// A destination whose dir is not mounted is skipped rather than fatal, so the same
// image runs before every domain in the registry has been routed.
function loadTargets() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); }
  catch (e) { console.error('FATAL: cannot read ' + REGISTRY + ': ' + e.message); process.exit(1); }

  const out = {}, skipped = [];
  for (const [key, t] of Object.entries(raw)) {
    if (!SLUG.test(key)) { console.error('FATAL: bad target key ' + JSON.stringify(key)); process.exit(1); }
    const env = 'TARGET_' + key.toUpperCase().replace(/-/g, '_');
    const dir = process.env[env + '_DIR'] || t.dir;
    const base = process.env[env + '_BASE'] || t.base;
    if (!dir || !base) { console.error('FATAL: target ' + key + ' needs both dir and base'); process.exit(1); }
    if (!fs.existsSync(dir)) { skipped.push(key + ' (' + dir + ' not mounted)'); continue; }
    out[key] = {
      key,
      dir,
      base: String(base).replace(/\/+$/, ''),
      label: t.label || key,
      group: t.group || 'Other',
      hub: !!t.hub,
      noindex: t.noindex !== false,
      default: !!t.default,
      note: t.note || '',
    };
  }
  if (!Object.keys(out).length) { console.error('FATAL: no destination in ' + REGISTRY + ' is mounted'); process.exit(1); }
  if (skipped.length) console.log('skipped destinations: ' + skipped.join(', '));
  return out;
}

const TARGETS = loadTargets();
const DEFAULT = (Object.values(TARGETS).find(t => t.default) || Object.values(TARGETS)[0]).key;
const host = t => t.base.replace(/^https?:\/\//, '');
const tgt = name => TARGETS[name] || null;

const J = (r, c, b) => { r.writeHead(c, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(b)); };
const ok = q => TOKEN && q.headers['x-deploy-token'] === TOKEN;

// --- publishing -------------------------------------------------------------

function list(t) {
  try {
    return fs.readdirSync(t.dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(t.dir, d.name, 'index.html')))
      .map(d => ({
        slug: d.name,
        url: t.base + '/' + d.name + '/',
        updated: fs.statSync(path.join(t.dir, d.name, 'index.html')).mtime.toISOString(),
      }))
      .sort((a, b) => b.updated.localeCompare(a.updated));
  } catch { return []; }
}

// Only ever called for a destination flagged hub:true. Every other destination is
// private by URL — writing an index there would publish the client slug list.
function reindex(t) {
  if (!t.hub) return 0;
  const H = host(t), d = list(t);
  const cards = d.map(x => '<a class=c href="/' + x.slug + '/"><span class=dot></span><div class=meta><b>' + x.slug + '</b><span>' + H + '/' + x.slug + '/</span></div><span class=go>&rarr;</span></a>').join('');
  const h = '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex,nofollow"><title>DGTL &mdash; Live Pitches</title><link rel=preconnect href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel=stylesheet><style>:root{--bg:#000;--s1:#0a0a0a;--s2:#111;--bd:#2a2a2a;--tx:#F0F0F0;--dim:#8a8a8a;--tan:#b3a06a;--gold:#F0CF50}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:Manrope,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(1100px 600px at 78% -8%,rgba(240,207,80,.05),transparent 60%),radial-gradient(900px 600px at 0% 100%,rgba(255,255,255,.03),transparent 55%)}.bg:after{content:"";position:absolute;right:-90px;top:60px;width:460px;height:460px;background:url("' + SPARK + '") no-repeat center/contain;opacity:.05;transform:rotate(18deg)}main{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:64px 24px 80px}.kick{color:var(--tan);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 10px}h1{font-weight:800;font-size:38px;letter-spacing:-.5px;margin:0 0 6px}h1 span{color:var(--gold)}.sub{color:var(--dim);margin:0 0 34px;font-size:15px}.c{display:flex;align-items:center;gap:15px;padding:17px 20px;border:1px solid var(--bd);border-radius:16px;text-decoration:none;color:var(--tx);margin-bottom:11px;background:rgba(0,0,0,.45);transition:border-color .15s,transform .15s}.c:hover{border-color:var(--gold);transform:translateY(-2px)}.c .dot{width:9px;height:9px;border-radius:50%;background:var(--gold);flex:0 0 auto;box-shadow:0 0 12px rgba(240,207,80,.6)}.c .meta{flex:1;min-width:0}.c b{display:block;text-transform:capitalize;font-weight:700;font-size:17px}.c .meta span{color:var(--dim);font-size:13px}.c .go{color:var(--gold);font-size:20px}.empty{color:var(--dim);font-size:14px;border:1px dashed var(--bd);border-radius:16px;padding:34px;text-align:center}footer{color:var(--dim);font-size:12px;margin-top:40px;border-top:1px solid var(--bd);padding-top:20px}</style></head><body><div class=bg></div><main><p class=kick>DGTL &middot; Live</p><h1>Live <span>Pitches</span></h1><p class=sub>Every project deployed under ' + H + '.</p>' + (d.length ? cards : '<div class=empty>Nothing live yet &mdash; publish your first project from the deploy portal.</div>') + '<footer>&copy; 2026 DGTL. All Rights Reserved.</footer></main></body></html>';
  fs.writeFileSync(path.join(t.dir, 'index.html'), h, { mode: 0o644 });
  try { fs.chmodSync(path.join(t.dir, 'index.html'), 0o644); } catch {}
  return d.length;
}

function pub(t, slug, html) {
  const dir = path.join(t.dir, slug);
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  const f = path.join(dir, 'index.html');
  fs.writeFileSync(f, html, { mode: 0o644 });
  try { fs.chmodSync(f, 0o644); fs.chmodSync(dir, 0o755); } catch {}
  return { url: t.base + '/' + slug + '/', hub: t.hub, live: reindex(t) };
}

function rbody(req, cb) { let b = '', n = 0, a = false; req.on('data', c => { n += c.length; if (n > MAX) { a = true; req.destroy(); } else b += c; }); req.on('end', () => { if (!a) cb(b); }); }
function rbuf(req, max, cb) { const cs = []; let n = 0, a = false; req.on('data', c => { n += c.length; if (n > max) { a = true; req.destroy(); } else cs.push(c); }); req.on('end', () => { if (!a) cb(Buffer.concat(cs)); }); req.on('error', () => {}); }

function readZip(buf) {
  if (buf.length < 22) throw new Error('not a zip');
  let e = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; } }
  if (e < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(e + 10); let off = buf.readUInt32LE(e + 16); const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central dir');
    const method = buf.readUInt16LE(off + 10), compSize = buf.readUInt32LE(off + 20), nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), commentLen = buf.readUInt16LE(off + 32), localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen); off += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('bad local header');
    const lNameLen = buf.readUInt16LE(localOff + 26), lExtraLen = buf.readUInt16LE(localOff + 28), dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    let data; if (method === 0) data = Buffer.from(comp); else if (method === 8) data = zlib.inflateRawSync(comp); else throw new Error('unsupported compression ' + method);
    out.push({ name, data });
  }
  return out;
}

function prepare(buf, spaFlag) {
  const entries = readZip(buf);
  for (const en of entries) { const nm = en.name.replace(/\\/g, '/'); if (nm.startsWith('/') || nm.split('/').some(s => s === '..')) throw new Error('unsafe path in zip: ' + en.name); }
  const norm = entries.map(en => ({ rel: en.name.replace(/\\/g, '/'), data: en.data }));
  let files = norm;
  if (!norm.some(en => en.rel === 'index.html')) {
    const tops = new Set(norm.map(en => en.rel.split('/')[0]));
    if (tops.size === 1) { const pre = [...tops][0] + '/'; files = norm.map(en => ({ rel: en.rel.slice(pre.length), data: en.data })).filter(en => en.rel); }
  }
  if (!files.some(en => en.rel === 'index.html')) throw new Error('no index.html at the root of the zip (a single wrapping folder is OK)');
  let spa = !!spaFlag; const red = files.find(en => en.rel === '_redirects');
  if (red && /^\s*\/\*\s+\/index\.html\s+200\b/m.test(red.data.toString('utf8'))) spa = true;
  return { files, spa };
}

function pubZip(t, slug, buf, spaFlag) {
  const { files, spa } = prepare(buf, spaFlag);
  const dir = path.join(t.dir, slug);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  for (const f of files) {
    const target = path.join(dir, f.rel);
    if (!(target === dir || target.startsWith(dir + path.sep))) throw new Error('path escapes dest: ' + f.rel);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    fs.writeFileSync(target, f.data, { mode: 0o644 });
  }
  if (spa) { try { fs.writeFileSync(path.join(dir, '.spa'), '', { mode: 0o644 }); } catch {} }
  try { fs.chmodSync(dir, 0o755); } catch {}
  return { url: t.base + '/' + slug + '/', files: files.length, spa, hub: t.hub, live: reindex(t) };
}

// What /api/targets hands the UI (and any skill that wants to discover destinations).
function publicTargets() {
  return Object.values(TARGETS).map(t => ({
    key: t.key, label: t.label, group: t.group, base: t.base, host: host(t),
    hub: t.hub, noindex: t.noindex, default: t.key === DEFAULT, note: t.note,
  }));
}

// --- UI ---------------------------------------------------------------------

const UI = '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex,nofollow"><title>DGTL Publish</title><link rel=preconnect href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel=stylesheet><style>:root{--bg:#000;--s1:#0a0a0a;--s2:#111;--bd:#2a2a2a;--tx:#F0F0F0;--muted:#D0D0D0;--dim:#8a8a8a;--tan:#b3a06a;--gold:#F0CF50;--err:#E5484D}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:Manrope,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(1100px 620px at 82% -10%,rgba(240,207,80,.06),transparent 60%),radial-gradient(900px 600px at -5% 105%,rgba(255,255,255,.03),transparent 55%)}.bg:after{content:"";position:absolute;right:-100px;top:40px;width:520px;height:520px;background:url("' + SPARK + '") no-repeat center/contain;opacity:.05;transform:rotate(16deg)}main{position:relative;z-index:1;max-width:600px;margin:0 auto;padding:40px 22px 72px}.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:34px}.top img{height:26px}.badge{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);background:rgba(240,207,80,.08);border-radius:9999px;padding:5px 12px}.kick{color:var(--tan);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 9px}h1{font-weight:800;font-size:34px;letter-spacing:-.5px;margin:0 0 6px}h1 span{color:var(--gold)}.lead{color:var(--dim);margin:0 0 26px;font-size:14px;line-height:1.6}.lead b{color:var(--muted);font-weight:700}.card{background:rgba(0,0,0,.45);border:1px solid var(--bd);border-radius:16px;padding:24px;box-shadow:0 6px 6px rgba(0,0,0,.3),0 0 20px rgba(0,0,0,.15)}label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em}label:first-of-type{margin-top:0}input[type=text],input[type=password],select{width:100%;background:var(--s1);border:1px solid var(--bd);border-radius:7px;padding:12px 14px;color:var(--tx);font:inherit;font-size:15px}select{appearance:none;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--gold) 50%),linear-gradient(135deg,var(--gold) 50%,transparent 50%);background-position:calc(100% - 19px) 20px,calc(100% - 13px) 20px;background-size:6px 6px;background-repeat:no-repeat}select:disabled{opacity:.45;cursor:not-allowed}input[type=text]::placeholder{color:#6a6a6a}input[type=text]:focus,input[type=password]:focus,select:focus{outline:0;border-color:var(--gold);box-shadow:0 0 0 3px rgba(240,207,80,.15)}.dest{margin-top:8px;font-size:12.5px;color:var(--dim);line-height:1.5;min-height:17px}.dest b{color:var(--gold);font-weight:700}.pill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:9999px;padding:2px 8px;margin-left:6px;vertical-align:1px}.pill.priv{color:var(--dim);background:rgba(255,255,255,.05)}.pill.pub{color:var(--gold);background:rgba(240,207,80,.1)}#d{margin-top:6px;border:1.5px dashed #333;border-radius:12px;padding:28px 18px;text-align:center;color:var(--dim);cursor:pointer;font-size:14px;transition:border-color .15s,color .15s,background .15s}#d:hover{border-color:#454545}#d.h{border-color:var(--gold);color:var(--tx);background:rgba(240,207,80,.04)}#d b{color:var(--gold)}#fi{margin-top:8px;color:var(--muted);font-size:13px}.chk{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:13px;color:var(--muted);text-transform:none;letter-spacing:0}.chk input{width:auto;accent-color:var(--gold);width:16px;height:16px}button.go{margin-top:20px;width:100%;background:var(--gold);color:#000;border:0;border-radius:7px;padding:14px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;transition:filter .15s,transform .1s}button.go:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}button.go:disabled{opacity:.35;cursor:not-allowed}#m{margin-top:15px;font-size:14px;white-space:pre-wrap;line-height:1.5}#m a{color:var(--gold)}.live{margin-top:34px}.live .kick{margin-bottom:12px}.d{display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border:1px solid #1e1e1e;border-radius:10px;margin-bottom:8px;font-size:14px;background:var(--s1)}.d .nm{font-weight:600;text-transform:capitalize}.d a{color:var(--gold);text-decoration:none}.d .sep{color:#3a3a3a;margin:0 4px}.d .x{color:var(--err);cursor:pointer}.d .x:hover{text-decoration:underline}.emptyd{color:var(--dim);font-size:13px}footer{color:var(--dim);font-size:12px;margin-top:38px;border-top:1px solid var(--bd);padding-top:18px}@media (prefers-reduced-motion:reduce){*{transition:none!important}}</style></head><body><div class=bg></div><main><div class=top><a href="https://dgtlgroup.io" target=_blank rel=noopener><img src="' + LOGO + '" alt=DGTL></a><span class=badge>Publish</span></div><p class=kick>One portal, every destination</p><h1>Publish a <span>page</span></h1><p class=lead>Drop an <b>.html</b> or project <b>.zip</b>, pick where it goes, name the slug. Destinations come from the portal registry &mdash; the same token works for all of them.</p><section class=card><label>Deploy token</label><input id=t type=password autocomplete=off><label>Destination</label><select id=tg disabled><option>Enter your token to load destinations</option></select><div class=dest id=dh></div><label>Slug</label><input id=s type=text placeholder=acme-corp><label>Page HTML or project ZIP</label><div id=d>Drag &amp; drop an <b>.html</b> or <b>.zip</b>, or click<div id=fi></div></div><input id=f type=file accept=".html,.zip" style=display:none><label class=chk><input id=spa type=checkbox> SPA / client-side routing (zip only)</label><button id=g class=go disabled>Publish &rarr;</button><div id=m></div></section><div class=live><p class=kick>Live at <span id=lt>&mdash;</span></p><div id=l></div></div><footer>&copy; 2026 DGTL. All Rights Reserved.</footer></main><script>' +
'var $=s=>document.querySelector(s),H="",F=null,Z=false,T="",TG={};' +
'$("#t").value=localStorage.getItem("tok")||"";' +
'function tok(){return $("#t").value.trim();}' +
'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
'function loadT(){var t=tok();if(!t){$("#tg").disabled=true;$("#tg").innerHTML="<option>Enter your token to load destinations</option>";$("#dh").textContent="";$("#l").innerHTML="";$("#lt").innerHTML="&mdash;";return;}' +
'fetch("/api/targets",{headers:{"x-deploy-token":t}}).then(r=>r.json()).then(d=>{if(!d.targets){$("#tg").disabled=true;return;}' +
'TG={};d.targets.forEach(x=>TG[x.key]=x);' +
'var groups=[];d.targets.forEach(x=>{if(groups.indexOf(x.group)<0)groups.push(x.group);});' +
'$("#tg").innerHTML=groups.map(g=>"<optgroup label=\\""+esc(g)+"\\">"+d.targets.filter(x=>x.group===g).map(x=>"<option value=\\""+esc(x.key)+"\\">"+esc(x.label)+" \\u2014 "+esc(x.host)+"</option>").join("")+"</optgroup>").join("");' +
'$("#tg").disabled=false;' +
'var saved=localStorage.getItem("target");T=TG[saved]?saved:(d.default||d.targets[0].key);$("#tg").value=T;setT(T);});}' +
'function setT(k){T=k;localStorage.setItem("target",k);var x=TG[k];if(!x)return;' +
'$("#dh").innerHTML="Publishes to <b>"+esc(x.base)+"/&lt;slug&gt;/</b><span class=\\"pill "+(x.hub?"pub":"priv")+"\\">"+(x.hub?"public index":"private by URL")+"</span>"+(x.note?"<br>"+esc(x.note):"");' +
'$("#lt").textContent=x.host;rf();ck();}' +
'$("#tg").onchange=e=>setT(e.target.value);' +
'function rf(){var t=tok();if(!t||!T){$("#l").innerHTML="";return;}fetch("/api/sites?target="+encodeURIComponent(T),{headers:{"x-deploy-token":t}}).then(r=>r.json()).then(d=>{if(d.error){$("#l").innerHTML="";return;}$("#l").innerHTML=(d.sites||[]).map(x=>"<div class=d><div class=nm>"+esc(x.slug)+"</div><div><a href=\\""+esc(x.url)+"\\" target=_blank rel=noopener>open</a><span class=sep>&middot;</span><span class=x data-s=\\""+esc(x.slug)+"\\">delete</span></div></div>").join("")||"<p class=emptyd>Nothing live here yet.</p>";document.querySelectorAll(".x").forEach(b=>b.onclick=()=>{if(confirm("Delete "+b.dataset.s+" from "+TG[T].host+"?"))fetch("/api/sites/"+encodeURIComponent(b.dataset.s)+"?target="+encodeURIComponent(T),{method:"DELETE",headers:{"x-deploy-token":tok()}}).then(()=>rf());});});}' +
'function ck(){var okslug=/^[a-z0-9][a-z0-9-]{0,60}$/.test($("#s").value.trim().toLowerCase()),okfile=Z?!!F:H.length>20;$("#g").disabled=!(tok()&&T&&okslug&&okfile);}' +
'function sf(f){if(!f)return;F=f;Z=/\\.zip$/i.test(f.name);if(!$("#s").value)$("#s").value=f.name.replace(/\\.(html?|zip)$/i,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-");if(Z){H="";$("#fi").textContent=f.name+" (zip project)";ck();}else{var r=new FileReader();r.onload=()=>{H=r.result;$("#fi").textContent=f.name;ck();};r.readAsText(f);}}' +
'$("#d").onclick=()=>$("#f").click();$("#f").onchange=e=>sf(e.target.files[0]);' +
'["dragover","dragenter"].forEach(e=>$("#d").addEventListener(e,ev=>{ev.preventDefault();$("#d").classList.add("h");}));["dragleave","drop"].forEach(e=>$("#d").addEventListener(e,ev=>{ev.preventDefault();$("#d").classList.remove("h");}));$("#d").addEventListener("drop",e=>sf(e.dataTransfer.files[0]));' +
'$("#t").oninput=()=>{localStorage.setItem("tok",tok());ck();loadT();};$("#s").oninput=ck;' +
'$("#g").onclick=()=>{$("#g").disabled=true;var t=tok(),s=$("#s").value.trim().toLowerCase();$("#m").textContent="Publishing\\u2026";' +
'var done=d=>{if(d.ok){$("#m").innerHTML="\\u2705 <a href=\\""+esc(d.url)+"\\" target=_blank rel=noopener>"+esc(d.url)+"</a>"+(d.files?" ("+d.files+" files"+(d.spa?", SPA":"")+")":"");H="";F=null;Z=false;$("#fi").textContent="";$("#s").value="";}else $("#m").textContent=d.error||"failed";ck();rf();};' +
'if(Z){fetch("/api/deploy-zip?target="+encodeURIComponent(T)+"&slug="+encodeURIComponent(s)+($("#spa").checked?"&spa=1":""),{method:"POST",headers:{"x-deploy-token":t,"content-type":"application/zip"},body:F}).then(r=>r.json()).then(done);}' +
'else{fetch("/api/deploy",{method:"POST",headers:{"x-deploy-token":t,"content-type":"application/json"},body:JSON.stringify({target:T,slug:s,html:H})}).then(r=>r.json()).then(done);}};' +
'loadT();' +
'</script></body></html>';

// --- router -----------------------------------------------------------------

const S = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), p = u.pathname;
  if (q.method === 'GET' && p === '/') { r.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); return r.end(UI); }
  if (q.method === 'GET' && p === '/health') return J(r, 200, { ok: true, targets: Object.keys(TARGETS).length });
  if (!p.startsWith('/api/')) return J(r, 404, { error: 'not found' });
  if (!ok(q)) return J(r, 401, { error: 'bad token' });

  // /api/decks is the deploy.dgtlmag.com-era alias for /api/sites — kept so callers
  // written against the old pitch portal keep working.
  const api = p.replace(/^\/api\/decks/, '/api/sites');
  const t = tgt(u.searchParams.get('target') || DEFAULT);

  if (q.method === 'GET' && api === '/api/targets') return J(r, 200, { default: DEFAULT, targets: publicTargets() });

  if (q.method === 'GET' && api === '/api/sites') {
    if (!t) return J(r, 400, { error: 'bad target' });
    return J(r, 200, { target: t.key, sites: list(t) });
  }

  if (q.method === 'POST' && api === '/api/deploy') return rbody(q, b => {
    let d; try { d = JSON.parse(b); } catch { return J(r, 400, { error: 'bad json' }); }
    const tt = tgt(d.target || DEFAULT); if (!tt) return J(r, 400, { error: 'bad target' });
    const s = String(d.slug || '').trim().toLowerCase();
    if (!SLUG.test(s)) return J(r, 400, { error: 'bad slug' });
    if (typeof d.html !== 'string' || d.html.length < 20) return J(r, 400, { error: 'html too short' });
    try { return J(r, 200, { ok: true, target: tt.key, ...pub(tt, s, d.html) }); } catch (e) { return J(r, 500, { error: String(e) }); }
  });

  if (q.method === 'POST' && api === '/api/deploy-zip') {
    if (!t) return J(r, 400, { error: 'bad target' });
    const s = String(u.searchParams.get('slug') || '').trim().toLowerCase();
    if (!SLUG.test(s)) return J(r, 400, { error: 'bad slug' });
    const spa = u.searchParams.get('spa') === '1';
    return rbuf(q, MZIP, buf => {
      if (!buf || buf.length < 22) return J(r, 400, { error: 'empty or too-small zip' });
      try { return J(r, 200, { ok: true, target: t.key, ...pubZip(t, s, buf, spa) }); } catch (e) { return J(r, 400, { error: String(e && e.message || e) }); }
    });
  }

  if (q.method === 'DELETE' && api.startsWith('/api/sites/')) {
    if (!t) return J(r, 400, { error: 'bad target' });
    const s = decodeURIComponent(api.slice('/api/sites/'.length)).toLowerCase();
    if (!SLUG.test(s)) return J(r, 400, { error: 'bad slug' });
    try { fs.rmSync(path.join(t.dir, s), { recursive: true, force: true }); return J(r, 200, { ok: true, target: t.key, live: reindex(t) }); } catch (e) { return J(r, 500, { error: String(e) }); }
  }

  return J(r, 404, { error: 'not found' });
});
S.listen(PORT, () => console.log('dgtl-publish on ' + PORT + ' — destinations: ' + Object.keys(TARGETS).join(', ') + ' (default ' + DEFAULT + ')'));
