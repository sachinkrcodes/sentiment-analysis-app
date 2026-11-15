/* Attendly design helpers. No libraries. Include after the HTML.
   - Theme: dark/light, remembered, button with id="themeBtn" toggles it.
   - Dock: the moving navy blob follows the link with aria-current="page".
   - toast(message, isError), openModal(html) / closeModal(). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

  function applyTheme(t) {
    document.documentElement.dataset.theme = t; set('theme', t);
    const m = $('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#1A2B3C' : '#F7FAFC';
    const b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀' : '☾';
  }
  applyTheme(get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const tb = $('#themeBtn'); if (tb) tb.onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

  function moveDock() {
    const a = $('.dock a[aria-current="page"]'), wrap = $('.dock-liquid'); if (!a || !wrap) return;
    const base = wrap.getBoundingClientRect(), r = a.getBoundingClientRect(), x = r.left - base.left;
    ['lead', 'trail'].forEach((c) => { const el = $('.' + c, wrap); el.style.width = r.width + 'px'; el.style.transform = `translateX(${x}px)`; });
  }
  document.querySelectorAll('.dock a').forEach((a) => a.addEventListener('click', () => {
    document.querySelectorAll('.dock a').forEach((o) => o.removeAttribute('aria-current')); a.setAttribute('aria-current', 'page'); moveDock();
  }));
  addEventListener('resize', moveDock); addEventListener('load', moveDock);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveDock);

  window.toast = (msg, isErr) => {
    let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'toast' + (isErr ? ' err' : ''); el.textContent = msg; box.appendChild(el);
    setTimeout(() => el.remove(), isErr ? 5000 : 2800);
  };
  window.openModal = (html) => {
    closeModal();
    const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim';
    s.innerHTML = `<div class="glass modal" role="dialog" aria-modal="true">${html}</div>`;
    s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-cancel]')) closeModal(); });
    document.body.appendChild(s);
  };
  window.closeModal = () => { const s = $('#scrim'); if (s) s.remove(); };
})();

const $ = id => document.getElementById(id);
const esc = s => (s || "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const pct = x => Math.round((x || 0) * 100) + "%";
const engine = () => $("engine").value;

async function api(path, body) {
  const r = await fetch(path, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body || {}) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Request failed");
  return j.data;
}
async function apiGet(path) {
  const r = await fetch(path);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Request failed");
  return j.data;
}

// ---------------- tabs (dock) ----------------
document.querySelectorAll(".dock a").forEach(b => b.addEventListener("click", ev => {
  ev.preventDefault();
  const t = b.dataset.tab;
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("on"));
  $("tab-" + t).classList.add("on");
  window.scrollTo({ top: 0 });
  if (t === "dashboard") loadDashboard();
  if (t === "history") loadHistory();
  if (t === "lexicon") loadLexicon();
  if (t === "model") loadDataset();
}));
const chip = l => l === "Positive" ? '<span class="chip good">+ Positive</span>'
  : l === "Negative" ? '<span class="chip bad"><span>&minus; Negative</span></span>'
  : '<span class="chip warn">&plusmn; Neutral</span>';
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---------------- Analyze ----------------
function splitHl(r) {
  return r.tokens.map(tok => {
    const v = tok.v;
    const cls = v > 0.05 ? "p" : v < -0.05 ? "n" : "";
    const title = v ? v.toFixed(2) : "";
    return `<span class="${cls}" title="${title}">${esc(tok.t)}</span>`;
  }).join(" ");
}
function showResult(r) {
  $("res").classList.add("on");
  $("lab").textContent = r.label; $("lab").className = "label " + r.label;
  $("cmp").textContent = "Compound score: " + r.compound.toFixed(3) + "   (engine: " + r.analyzer + ")";
  $("mark").style.left = ((r.compound + 1) / 2 * 100) + "%";
  $("split").innerHTML = `<div class="sp" style="width:${r.pos*100}%"></div><div class="sn" style="width:${r.neu*100}%"></div><div class="sg" style="width:${r.neg*100}%"></div>`;
  $("leg").innerHTML = `<span>&#9632; Positive ${pct(r.pos)}</span><span>&#9633; Neutral ${pct(r.neu)}</span><span>&#9639; Negative ${pct(r.neg)}</span>`;
  $("hl").innerHTML = splitHl(r);
}
$("go").onclick = async () => {
  try { showResult(await api("/api/analyze", { text: $("txt").value, analyzer: engine() })); }
  catch (e) { toast(e.message, true); }
};
document.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { $("txt").value = b.dataset.s; $("go").click(); });
$("go").click();

// ---------------- Live feed ----------------
let feedTimer = null;
async function feedNext() {
  try {
    const r = await apiGet("/api/feed/next?analyzer=" + engine());
    const div = document.createElement("div");
    div.className = "feeditem";
    div.innerHTML = `${chip(r.label)} <b>${esc(r.handle)}</b> on ${r.platform}
      <span class="small">score ${r.compound.toFixed(2)}</span><br>${esc(r.text)}`;
    $("feedList").prepend(div);
    while ($("feedList").children.length > 12) $("feedList").removeChild($("feedList").lastChild);
  } catch (e) { console.error(e); }
}
$("feedGo").onclick = feedNext;
$("feedAuto").onclick = () => {
  if (feedTimer) { clearInterval(feedTimer); feedTimer = null; $("feedAuto").textContent = "Auto (every 2s)"; }
  else { feedTimer = setInterval(feedNext, 2000); $("feedAuto").textContent = "Stop auto"; feedNext(); }
};

// ---------------- Batch ----------------
function batchTable(results) {
  const c = { Positive: 0, Neutral: 0, Negative: 0 };
  results.forEach(r => c[r.label]++);
  const n = results.length, avg = results.reduce((a, r) => a + r.compound, 0) / n;
  return `<div class="split"><div class="sp" style="width:${c.Positive/n*100}%"></div><div class="sn" style="width:${c.Neutral/n*100}%"></div><div class="sg" style="width:${c.Negative/n*100}%"></div></div>
  <div class="legend"><span>Positive ${c.Positive}</span><span>Neutral ${c.Neutral}</span><span>Negative ${c.Negative}</span><span>Average score ${avg.toFixed(3)}</span></div>
  <div class="wrap"><table><tr><th>Text</th><th>Result</th><th>Score</th></tr>${results.map(r =>
    `<tr><td>${esc(r.text)}</td><td>${chip(r.label)}</td><td class="mono">${r.compound.toFixed(3)}</td></tr>`).join("")}</table></div>`;
}
$("runB").onclick = async () => {
  const lines = $("batch").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!lines.length) { $("bout").innerHTML = ""; return; }
  try { $("bout").innerHTML = batchTable((await api("/api/batch", { texts: lines, analyzer: engine() })).results); }
  catch (e) { $("bout").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
};
$("runB").click();

$("csvGo").onclick = async () => {
  const f = $("csvFile").files[0];
  if (!f) { toast("Choose a CSV file first.", true); return; }
  const csv = await f.text();
  try {
    const d = await api("/api/upload", { csv, analyzer: engine() });
    $("csvOut").innerHTML = `<p class="small">${d.count} rows analyzed.</p>` + batchTable(d.results);
  } catch (e) { $("csvOut").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
};

// ---------------- Dashboard (charts drawn with plain canvas, no library) ----------------
function lineChart(canvas, values) {
  const ctx = canvas.getContext("2d"); const w = canvas.width = canvas.clientWidth; const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = cssv("--line"); ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = h - (i / 4) * (h - 20) - 10; ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(w - 6, y); ctx.stroke(); }
  ctx.fillStyle = cssv("--mid"); ctx.font = "11px monospace";
  ["-1", "-0.5", "0", "0.5", "1"].forEach((t, i) => ctx.fillText(t, 2, h - (i / 4) * (h - 20) - 7));
  if (!values.length) return;
  const x0 = 34, x1 = w - 6, y0 = h - 10, y1 = 10;
  ctx.strokeStyle = cssv("--ink"); ctx.lineWidth = 2.5; ctx.beginPath();
  values.forEach((v, i) => {
    const x = x0 + (x1 - x0) * (values.length === 1 ? 1 : i / (values.length - 1));
    const y = y0 + (y1 - y0) * ((v + 1) / 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}
function barChart(canvas, counts) {
  const ctx = canvas.getContext("2d"); const w = canvas.width = canvas.clientWidth; const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const labels = ["Positive", "Neutral", "Negative"];
  const max = Math.max(1, ...counts);
  const bw = (w - 40) / 3;
  counts.forEach((c, i) => {
    const bh = (h - 44) * (c / max), x = 20 + i * bw, y = h - 20 - bh;
    const ink = cssv("--ink");
    ctx.lineWidth = 2; ctx.strokeStyle = ink;
    if (i === 0) { ctx.fillStyle = ink; ctx.fillRect(x + 10, y, bw - 30, bh); }
    else if (i === 1) { ctx.fillStyle = cssv("--tint-2"); ctx.fillRect(x + 10, y, bw - 30, bh); ctx.strokeRect(x + 10, y, bw - 30, bh); }
    else { ctx.setLineDash([5, 4]); ctx.strokeRect(x + 10, y, bw - 30, bh); ctx.setLineDash([]); ctx.fillStyle = cssv("--tint"); ctx.fillRect(x + 10, y, bw - 30, bh); }
    ctx.fillStyle = ink; ctx.font = "12px sans-serif"; ctx.fillText("" + c, x + 10, y - 4);
    ctx.fillStyle = cssv("--mid"); ctx.fillText(labels[i], x + 10, h - 5);
  });
}
async function loadDashboard() {
  const d = await apiGet("/api/stats");
  $("dashTop").innerHTML = `<div class="stat"><b>${d.total}</b><span>total analyzed</span></div>
    <div class="stat"><b>${d.avg.toFixed(3)}</b><span>average score</span></div>
    <div class="stat"><b>${d.counts[0]}</b><span>positive</span></div>
    <div class="stat"><b>${d.counts[1]}</b><span>neutral</span></div>
    <div class="stat"><b>${d.counts[2]}</b><span>negative</span></div>`;
  lineChart($("trendChart"), d.trend);
  barChart($("shareChart"), d.counts);
  const words = (arr, cls) => arr.length ? arr.map(w => `<span class="wordchip"><span>${esc(w.word)}</span><b class="${cls}">${w.count}</b></span>`).join("") : '<p class="small">Not enough data yet. Analyze some text first.</p>';
  $("topPos").innerHTML = words(d.topPositive, "Positive");
  $("topNeg").innerHTML = words(d.topNegative, "Negative");
}

// ---------------- History ----------------
async function loadHistory() {
  const q = new URLSearchParams({ q: $("hq").value, label: $("hlabel").value, limit: 200 });
  const d = await apiGet("/api/history?" + q.toString());
  $("hOut").innerHTML = `<p class="small">${d.total} total saved</p><div class="wrap"><table><tr><th>Text</th><th>Engine</th><th>Result</th><th>Score</th><th></th></tr>` +
    d.entries.map(e => `<tr><td>${esc(e.text)}</td><td class="small">${e.analyzer}</td><td>${chip(e.label)}</td><td class="mono">${e.compound.toFixed(3)}</td><td><button data-id="${e.id}" class="del">Delete</button></td></tr>`).join("") + `</table></div>`;
  document.querySelectorAll(".del").forEach(b => b.onclick = async () => { await api("/api/history/delete", { id: Number(b.dataset.id) }); loadHistory(); });
}
$("hSearch").onclick = loadHistory;
$("hClear").onclick = async () => { if (confirm("Delete all saved history?")) { await api("/api/history/clear", {}); loadHistory(); } };

// ---------------- Lexicon ----------------
async function loadLexicon() {
  const d = await apiGet("/api/lexicon?" + new URLSearchParams({ q: $("lQuery").value, limit: 300 }));
  $("lCount").textContent = d.size + " words in total";
  $("lOut").innerHTML = `<div class="wrap"><table><tr><th>Word</th><th>Score</th><th>Source</th><th></th></tr>` +
    d.words.map(w => `<tr><td class="mono">${esc(w.word)}</td><td class="mono">${w.score.toFixed(2)}</td><td class="small">${w.source}</td><td><button data-w="${esc(w.word)}" class="rm">Remove</button></td></tr>`).join("") + `</table></div>`;
  document.querySelectorAll(".rm").forEach(b => b.onclick = async () => { await api("/api/lexicon/remove", { word: b.dataset.w }); loadLexicon(); });
}
$("lSet").onclick = async () => {
  try { await api("/api/lexicon/set", { word: $("lWord").value, score: parseFloat($("lScore").value || "0") }); $("lWord").value = ""; $("lScore").value = ""; loadLexicon(); }
  catch (e) { toast(e.message, true); }
};
$("lReset").onclick = async () => { if (confirm("Remove all your custom words and restore built-in scores?")) { await api("/api/lexicon/reset", {}); loadLexicon(); } };
$("lSearch").onclick = loadLexicon;

// ---------------- Model Lab ----------------
async function loadDataset() {
  const d = await apiGet("/api/dataset");
  $("dsInfo").innerHTML = `<p>Using <b>${esc(d.name)}</b>: ${d.size} labelled examples
     (positive ${d.counts[0]}, neutral ${d.counts[1]}, negative ${d.counts[2]}), vocabulary ${d.vocabulary} words.</p>
     <p class="small">Cleaning: ${d.duplicatesRemoved} repeated rows removed, ${d.conflicting} rows dropped for having two different labels.
     ${d.labelMapping ? "Labels: " + esc(d.labelMapping) + "." : ""}</p>
     <div class="wrap"><table><tr><th>Sample text</th><th>Label</th></tr>${d.examples.map(e => `<tr><td>${esc(e.text)}</td><td>${chip(e.label)}</td></tr>`).join("")}</table></div>`;
}
$("trainGo").onclick = async () => {
  const f = $("trainFile").files[0];
  if (!f) { toast("Choose a CSV file first (text,label columns).", true); return; }
  try { await api("/api/train", { csv: await f.text() }); loadDataset(); toast("Trained successfully."); }
  catch (e) { toast(e.message, true); }
};
$("trainReset").onclick = async () => { await api("/api/train", { csv: null }); loadDataset(); };

function confusionTable(cm) {
  const labels = ["Positive", "Neutral", "Negative"];
  let h = '<table class="conf"><tr><th>actual \\ predicted</th>' + labels.map(l => `<th>${l}</th>`).join("") + "</tr>";
  cm.forEach((row, i) => { h += `<tr><th>${labels[i]}</th>` + row.map(v => `<td>${v}</td>`).join("") + "</tr>"; });
  return h + "</table>";
}
$("evalGo").onclick = async () => {
  $("evalOut").innerHTML = '<p class="small">Training and testing...</p>';
  try {
    const d = await api("/api/evaluate", { testFraction: 0.25, seed: Date.now() % 100000 });
    let html = `<p class="small">${d.trainSize} training rows, ${d.testSize} test rows (held out, never used for training; every class keeps its share).</p>
      <p>Baseline: always answering <b>${d.baseline.label}</b> gives <b class="mono">${(d.baseline.accuracy*100).toFixed(1)}%</b>. A model must beat this to be worth anything.</p><div class="grid2">`;
    d.models.forEach(m => {
      html += `<div><h2 style="margin-bottom:6px">${esc(m.name)}</h2>
        <p>Accuracy <b class="mono">${(m.accuracy*100).toFixed(1)}%</b> &nbsp; Macro F1 <b class="mono">${m.macroF1.toFixed(3)}</b></p>
        ${confusionTable(m.confusion)}
        <table style="margin-top:8px"><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr>
        ${m.perClass.map(c => `<tr><td>${c.label}</td><td>${c.precision.toFixed(2)}</td><td>${c.recall.toFixed(2)}</td><td>${c.f1.toFixed(2)}</td><td>${c.support}</td></tr>`).join("")}
        </table></div>`;
    });
    html += "</div>";
    const cv = d.crossValidation;
    if (cv && cv.folds > 0) {
      html += `<h2 style="margin:14px 0 6px">${cv.folds}-fold cross-validation</h2>
        <p class="small">The data is split ${cv.folds} ways and each part takes a turn as the test set. A small spread means the number is stable.</p>
        <table><tr><th>Engine</th><th>Mean accuracy</th><th>Spread (std)</th></tr>
        <tr><td>Lexicon (rule based)</td><td class="mono">${(cv.lexiconMean*100).toFixed(1)}%</td><td class="mono">&plusmn; ${(cv.lexiconStd*100).toFixed(1)}</td></tr>
        <tr><td>Naive Bayes (machine learning)</td><td class="mono">${(cv.naiveBayesMean*100).toFixed(1)}%</td><td class="mono">&plusmn; ${(cv.naiveBayesStd*100).toFixed(1)}</td></tr></table>`;
    }
    $("evalOut").innerHTML = html;
  } catch (e) { $("evalOut").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
};

$("themeBtn").addEventListener("click", () => { if ($("tab-dashboard").classList.contains("on")) loadDashboard(); });
