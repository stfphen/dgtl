'use strict';
// DGTL report deploy portal — deploy.dgtl.report
// One portal, two targets:
//   report -> https://dgtl.report/<slug>/        (dgtl-worklog-status-report pages)
//   audit  -> https://audit.dgtl.report/<slug>/  (dgtl-client-audit pages)
// Same token-auth html/zip deploy model as deploy/portal (deploy.dgtlmag.com), but:
// no public hub index is ever written — the apex serves a static placeholder from the
// report-host nginx image, so client slugs are never listed publicly.
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');

const PORT = process.env.PORT || 80;
const TOKEN = process.env.DEPLOY_TOKEN || '';
const MAX = 12e6, MZIP = +(process.env.MAX_ZIP_BYTES || 150e6);
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;

const TARGETS = {
  report: {
    dir: process.env.REPORT_DIR || '/data/reports',
    base: (process.env.REPORT_BASE || 'https://dgtl.report').replace(/\/+$/, ''),
    label: 'Status report',
  },
  audit: {
    dir: process.env.AUDIT_DIR || '/data/audits',
    base: (process.env.AUDIT_BASE || 'https://audit.dgtl.report').replace(/\/+$/, ''),
    label: 'Client audit',
  },
};
const host = t => TARGETS[t].base.replace(/^https?:\/\//, '');

const LOGO = 'data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%2273%20148%20987%20453%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%0A%3Cpath%20d%3D%22M221.797%20286.332H138.578L93.3214%20455.354H176.532C211.656%20455.354%20243.005%20442.391%20265.166%20421.412C287.089%20400.433%20299.108%20371.906%20299.108%20344.568C299.108%20309.674%20275.537%20286.332%20221.797%20286.332ZM242.3%20394.296C228.861%20409.852%20207.176%20418.105%20183.842%20418.105H143.295L168.754%20322.875H209.301C242.3%20322.875%20257.388%20332.302%20257.388%20353.519C257.388%20368.607%20251.727%20383.687%20242.3%20394.296Z%22%20fill%3D%22white%22/%3E%0A%3Cpath%20d%3D%22M379.743%20394.066H436.79L432.072%20411.509C424.294%20416.456%20412.98%20421.88%20390.581%20421.88C355.22%20421.88%20339.196%20410.804%20339.196%20388.643C339.196%20369.551%20348.156%20350.689%20361.825%20338.669C374.558%20327.593%20391.763%20320.988%20411.799%20320.988C445.035%20320.988%20459.418%20329.004%20466.72%20339.612L496.658%20312.505C484.868%20295.529%20463.66%20283.51%20425.229%20283.51C387.045%20283.51%20356.163%20295.062%20334.003%20315.335C311.136%20336.552%20297.23%20368.14%20297.23%20397.84C297.23%20440.037%20331.41%20459.367%20378.791%20459.367C401.896%20459.367%20444.797%20452.056%20468.131%20427.541L486.279%20359.886H388.932L379.743%20394.066Z%22%20fill%3D%22white%22/%3E%0A%3Cpath%20d%3D%22M660.921%20322.875L670.824%20286.332H508.882L498.979%20322.875H559.8L524.438%20455.354H564.747L600.109%20322.875H660.921Z%22%20fill%3D%22white%22/%3E%0A%3Cpath%20d%3D%22M716.191%20286.332H676.111L630.855%20455.354H769.93L779.833%20418.105H680.829L716.191%20286.332Z%22%20fill%3D%22white%22/%3E%0A%3Cpath%20d%3D%22M1039.67%20371.642V371.583C1039.67%20371.515%201039.66%20371.447%201039.66%20371.387C1039.65%20371.243%201039.65%20371.098%201039.63%20370.962C1039.3%20363.626%201033.27%20357.778%201025.85%20357.778H945.286C937.661%20357.778%20931.473%20363.958%20931.473%20371.591V372.178C931.473%20379.803%20937.652%20385.991%20945.286%20385.991H991.486L858.641%20516.6L973.771%20183.638C975.717%20178.019%20973.805%20172.009%20969.461%20168.448C969.376%20168.363%20969.308%20168.269%20969.223%20168.176C963.757%20162.617%20954.832%20162.549%20949.272%20168.006L752.513%20361.476C749.529%20364.408%20748.144%20368.344%20748.331%20372.22C748.331%20372.246%20748.331%20372.28%20748.331%20372.305V372.892C748.331%20380.517%20754.511%20386.705%20762.144%20386.705H843.451C851.075%20386.705%20857.264%20380.525%20857.264%20372.892V372.305C857.264%20364.68%20851.084%20358.492%20843.451%20358.492H795.797L928.625%20227.891L813.461%20560.93C810.97%20568.138%20814.796%20576.001%20822.004%20578.5L822.556%20578.696C822.573%20578.704%20822.599%20578.704%20822.616%20578.713C827.801%20581.135%20834.151%20580.251%20838.469%20576.001L1035.47%20382.31C1038.44%20379.386%201039.83%20375.493%201039.67%20371.642Z%22%20fill%3D%22%23F0CF50%22/%3E%0A%3C/svg%3E';
const SPARK = 'data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%22222%20160%20327%20450%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%0A%3Cpath%20d%3D%22M529.17%20383.142V383.083C529.17%20383.015%20529.161%20382.947%20529.161%20382.887C529.153%20382.743%20529.153%20382.598%20529.136%20382.462C528.804%20375.126%20522.769%20369.278%20515.356%20369.278H434.789C427.164%20369.278%20420.976%20375.458%20420.976%20383.091V383.678C420.976%20391.303%20427.156%20397.491%20434.789%20397.491H480.989L348.144%20528.1L463.274%20195.138C465.221%20189.519%20463.308%20183.51%20458.964%20179.948C458.88%20179.863%20458.812%20179.769%20458.727%20179.676C453.261%20174.117%20444.335%20174.049%20438.776%20179.506L242.016%20372.976C239.033%20375.908%20237.647%20379.844%20237.834%20383.72C237.834%20383.746%20237.834%20383.78%20237.834%20383.805V384.392C237.834%20392.017%20244.014%20398.205%20251.648%20398.205H332.954C340.579%20398.205%20346.767%20392.025%20346.767%20384.392V383.805C346.767%20376.18%20340.588%20369.992%20332.954%20369.992H285.301L418.128%20239.391L302.965%20572.43C300.474%20579.638%20304.299%20587.501%20311.508%20590L312.06%20590.196C312.077%20590.204%20312.103%20590.204%20312.12%20590.213C317.305%20592.635%20323.655%20591.751%20327.973%20587.501L524.97%20393.81C527.946%20390.886%20529.331%20386.993%20529.17%20383.142Z%22%20fill%3D%22%23F0CF50%22/%3E%0A%3C/svg%3E';

const J = (r, c, b) => { r.writeHead(c, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(b)); };
const ok = q => TOKEN && q.headers['x-deploy-token'] === TOKEN;
const tgt = name => TARGETS[name] || null;

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

// NOTE: no reindex()/hub page on purpose — the apex placeholder ships in the
// report-host nginx image and never lists client slugs.

function pub(t, slug, html) {
  const dir = path.join(t.dir, slug);
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  const f = path.join(dir, 'index.html');
  fs.writeFileSync(f, html, { mode: 0o644 });
  try { fs.chmodSync(f, 0o644); fs.chmodSync(dir, 0o755); } catch {}
  return { url: t.base + '/' + slug + '/' };
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
  return { url: t.base + '/' + slug + '/', files: files.length, spa };
}

const UI = '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex,nofollow"><title>DGTL Report Deploy</title><link rel=preconnect href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel=stylesheet><style>:root{--bg:#000;--s1:#0a0a0a;--s2:#111;--bd:#2a2a2a;--tx:#F0F0F0;--muted:#D0D0D0;--dim:#8a8a8a;--tan:#b3a06a;--gold:#F0CF50;--err:#E5484D}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:Manrope,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(1100px 620px at 82% -10%,rgba(240,207,80,.06),transparent 60%),radial-gradient(900px 600px at -5% 105%,rgba(255,255,255,.03),transparent 55%)}.bg:after{content:"";position:absolute;right:-100px;top:40px;width:520px;height:520px;background:url("' + SPARK + '") no-repeat center/contain;opacity:.05;transform:rotate(16deg)}main{position:relative;z-index:1;max-width:600px;margin:0 auto;padding:40px 22px 72px}.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:34px}.top img{height:26px}.badge{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);background:rgba(240,207,80,.08);border-radius:9999px;padding:5px 12px}.kick{color:var(--tan);font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin:0 0 9px}h1{font-weight:800;font-size:34px;letter-spacing:-.5px;margin:0 0 6px}h1 span{color:var(--gold)}.lead{color:var(--dim);margin:0 0 26px;font-size:14px;line-height:1.6}.lead b{color:var(--muted);font-weight:700}.card{background:rgba(0,0,0,.45);border:1px solid var(--bd);border-radius:16px;padding:24px;box-shadow:0 6px 6px rgba(0,0,0,.3),0 0 20px rgba(0,0,0,.15)}label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em}label:first-of-type{margin-top:0}input[type=text],input[type=password]{width:100%;background:var(--s1);border:1px solid var(--bd);border-radius:7px;padding:12px 14px;color:var(--tx);font:inherit;font-size:15px}input[type=text]::placeholder{color:#6a6a6a}input[type=text]:focus,input[type=password]:focus{outline:0;border-color:var(--gold);box-shadow:0 0 0 3px rgba(240,207,80,.15)}.seg{display:flex;gap:8px;margin-top:2px}.seg button{flex:1;margin:0;background:var(--s1);color:var(--muted);border:1px solid var(--bd);border-radius:7px;padding:11px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}.seg button.on{background:rgba(240,207,80,.1);border-color:var(--gold);color:var(--gold)}.seg button small{display:block;font-weight:500;font-size:11px;color:var(--dim);margin-top:2px}#d{margin-top:6px;border:1.5px dashed #333;border-radius:12px;padding:28px 18px;text-align:center;color:var(--dim);cursor:pointer;font-size:14px;transition:border-color .15s,color .15s,background .15s}#d:hover{border-color:#454545}#d.h{border-color:var(--gold);color:var(--tx);background:rgba(240,207,80,.04)}#d b{color:var(--gold)}#fi{margin-top:8px;color:var(--muted);font-size:13px}.chk{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:13px;color:var(--muted);text-transform:none;letter-spacing:0}.chk input{width:auto;accent-color:var(--gold);width:16px;height:16px}button.go{margin-top:20px;width:100%;background:var(--gold);color:#000;border:0;border-radius:7px;padding:14px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;transition:filter .15s,transform .1s}button.go:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}button.go:disabled{opacity:.35;cursor:not-allowed}#m{margin-top:15px;font-size:14px;white-space:pre-wrap;line-height:1.5}#m a{color:var(--gold)}.live{margin-top:34px}.live .kick{margin-bottom:12px}.d{display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border:1px solid #1e1e1e;border-radius:10px;margin-bottom:8px;font-size:14px;background:var(--s1)}.d .nm{font-weight:600;text-transform:capitalize}.d a{color:var(--gold);text-decoration:none}.d .sep{color:#3a3a3a;margin:0 4px}.d .x{color:var(--err);cursor:pointer}.d .x:hover{text-decoration:underline}.emptyd{color:var(--dim);font-size:13px}footer{color:var(--dim);font-size:12px;margin-top:38px;border-top:1px solid var(--bd);padding-top:18px}@media (prefers-reduced-motion:reduce){*{transition:none!important}}</style></head><body><div class=bg></div><main><div class=top><a href="https://dgtlgroup.io" target=_blank rel=noopener><img src="' + LOGO + '" alt=DGTL></a><span class=badge>Report Deploy</span></div><p class=kick>Client reporting host</p><h1>Publish a <span>report</span></h1><p class=lead>Drop an <b>.html</b> or project <b>.zip</b>, pick a destination, add the client slug. Status reports go to <b>dgtl.report/&lt;slug&gt;/</b>, audits to <b>audit.dgtl.report/&lt;slug&gt;/</b>.</p><section class=card><label>Deploy token</label><input id=t type=password><label>Destination</label><div class=seg><button id=tg-report class=on type=button>Status report<small>dgtl.report/&lt;slug&gt;/</small></button><button id=tg-audit type=button>Client audit<small>audit.dgtl.report/&lt;slug&gt;/</small></button></div><label>Client slug</label><input id=s type=text placeholder=acme-corp><label>Report HTML or project ZIP</label><div id=d>Drag &amp; drop an <b>.html</b> or <b>.zip</b>, or click<div id=fi></div></div><input id=f type=file accept=".html,.zip" style=display:none><label class=chk><input id=spa type=checkbox> SPA / client-side routing (zip only)</label><button id=g class=go disabled>Publish &rarr;</button><div id=m></div></section><div class=live><p class=kick>Live <span id=lt>status reports</span></p><div id=l></div></div><footer>&copy; 2026 DGTL. All Rights Reserved.</footer></main><script>' +
'var $=s=>document.querySelector(s),H="",F=null,Z=false,T="report";' +
'$("#t").value=localStorage.getItem("tok")||"";' +
'function setT(t){T=t;$("#tg-report").classList.toggle("on",t==="report");$("#tg-audit").classList.toggle("on",t==="audit");$("#lt").textContent=t==="report"?"status reports":"client audits";rf();}' +
'$("#tg-report").onclick=()=>setT("report");$("#tg-audit").onclick=()=>setT("audit");' +
'function rf(){var t=$("#t").value.trim();if(!t){$("#l").innerHTML="";return;}fetch("/api/sites?target="+T,{headers:{"x-deploy-token":t}}).then(r=>r.json()).then(d=>{if(d.error){$("#l").innerHTML="";return;}$("#l").innerHTML=(d.sites||[]).map(x=>"<div class=d><div class=nm>"+x.slug+"</div><div><a href=\\""+x.url+"\\" target=_blank>open</a><span class=sep>&middot;</span><span class=x data-s=\\""+x.slug+"\\">delete</span></div></div>").join("")||"<p class=emptyd>Nothing live yet.</p>";document.querySelectorAll(".x").forEach(b=>b.onclick=()=>{if(confirm("Delete "+b.dataset.s+"?"))fetch("/api/sites/"+b.dataset.s+"?target="+T,{method:"DELETE",headers:{"x-deploy-token":$("#t").value.trim()}}).then(()=>rf());});});}' +
'function ck(){var okslug=/^[a-z0-9][a-z0-9-]{0,60}$/.test($("#s").value.trim().toLowerCase()),okfile=Z?!!F:H.length>20;$("#g").disabled=!($("#t").value.trim()&&okslug&&okfile);}' +
'function sf(f){if(!f)return;F=f;Z=/\\.zip$/i.test(f.name);if(!$("#s").value)$("#s").value=f.name.replace(/\\.(html?|zip)$/i,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-");if(Z){H="";$("#fi").textContent=f.name+" (zip project)";ck();}else{var r=new FileReader();r.onload=()=>{H=r.result;$("#fi").textContent=f.name;ck();};r.readAsText(f);}}' +
'$("#d").onclick=()=>$("#f").click();$("#f").onchange=e=>sf(e.target.files[0]);' +
'["dragover","dragenter"].forEach(e=>$("#d").addEventListener(e,ev=>{ev.preventDefault();$("#d").classList.add("h");}));["dragleave","drop"].forEach(e=>$("#d").addEventListener(e,ev=>{ev.preventDefault();$("#d").classList.remove("h");}));$("#d").addEventListener("drop",e=>sf(e.dataTransfer.files[0]));' +
'$("#t").oninput=()=>{localStorage.setItem("tok",$("#t").value.trim());ck();rf();};$("#s").oninput=ck;' +
'$("#g").onclick=()=>{$("#g").disabled=true;var t=$("#t").value.trim(),s=$("#s").value.trim().toLowerCase();$("#m").textContent="Publishing\\u2026";if(Z){var q="/api/deploy-zip?target="+T+"&slug="+encodeURIComponent(s)+($("#spa").checked?"&spa=1":"");fetch(q,{method:"POST",headers:{"x-deploy-token":t,"content-type":"application/zip"},body:F}).then(r=>r.json()).then(d=>{if(d.ok){$("#m").innerHTML="\\u2705 <a href=\\""+d.url+"\\" target=_blank>"+d.url+"</a> ("+d.files+" files"+(d.spa?", SPA":"")+")";F=null;Z=false;$("#fi").textContent="";$("#s").value="";}else $("#m").textContent=d.error||"failed";ck();rf();});}else{fetch("/api/deploy",{method:"POST",headers:{"x-deploy-token":t,"content-type":"application/json"},body:JSON.stringify({target:T,slug:s,html:H})}).then(r=>r.json()).then(d=>{if(d.ok){$("#m").innerHTML="\\u2705 <a href=\\""+d.url+"\\" target=_blank>"+d.url+"</a>";H="";$("#fi").textContent="";$("#s").value="";}else $("#m").textContent=d.error||"failed";ck();rf();});}};' +
'rf();' +
'</script></body></html>';

const S = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), p = u.pathname;
  if (q.method === 'GET' && p === '/') { r.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); return r.end(UI); }
  if (q.method === 'GET' && p === '/health') return J(r, 200, { ok: true });
  if (!p.startsWith('/api/')) return J(r, 404, { error: 'not found' });
  if (!ok(q)) return J(r, 401, { error: 'bad token' });

  const t = tgt(u.searchParams.get('target') || 'report');

  if (q.method === 'GET' && p === '/api/sites') {
    if (!t) return J(r, 400, { error: 'bad target' });
    return J(r, 200, { target: u.searchParams.get('target') || 'report', sites: list(t) });
  }

  if (q.method === 'POST' && p === '/api/deploy') return rbody(q, b => {
    let d; try { d = JSON.parse(b); } catch { return J(r, 400, { error: 'bad json' }); }
    const tt = tgt(d.target || 'report'); if (!tt) return J(r, 400, { error: 'bad target' });
    const s = String(d.slug || '').trim().toLowerCase();
    if (!SLUG.test(s)) return J(r, 400, { error: 'bad slug' });
    if (typeof d.html !== 'string' || d.html.length < 20) return J(r, 400, { error: 'html too short' });
    try { return J(r, 200, { ok: true, ...pub(tt, s, d.html) }); } catch (e) { return J(r, 500, { error: String(e) }); }
  });

  if (q.method === 'POST' && p === '/api/deploy-zip') {
    if (!t) return J(r, 400, { error: 'bad target' });
    const s = String(u.searchParams.get('slug') || '').trim().toLowerCase();
    if (!SLUG.test(s)) return J(r, 400, { error: 'bad slug' });
    const spa = u.searchParams.get('spa') === '1';
    return rbuf(q, MZIP, buf => {
      if (!buf || buf.length < 22) return J(r, 400, { error: 'empty or too-small zip' });
      try { return J(r, 200, { ok: true, ...pubZip(t, s, buf, spa) }); } catch (e) { return J(r, 400, { error: String(e && e.message || e) }); }
    });
  }

  if (q.method === 'DELETE' && p.startsWith('/api/sites/')) {
    if (!t) return J(r, 400, { error: 'bad target' });
    const s = decodeURIComponent(p.slice('/api/sites/'.length)).toLowerCase();
    if (!SLUG.test(s)) return J(r, 400, { error: 'bad slug' });
    try { fs.rmSync(path.join(t.dir, s), { recursive: true, force: true }); return J(r, 200, { ok: true }); } catch (e) { return J(r, 500, { error: String(e) }); }
  }

  return J(r, 404, { error: 'not found' });
});
S.listen(PORT, () => console.log('dgtl-report-deploy on ' + PORT));
