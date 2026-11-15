// Makes a smaller, balanced training file from a big labelled CSV (for example the 50,000-row IMDB reviews file).
// Usage:  node tools/make-sample.mjs big.csv sample.csv [rows] [--text N] [--label N] [--no-header]
//   rows        how many rows to keep in total (default 10000). The same number is taken from each label.
//   --text N    0-based column number of the text   (only needed if there is no header like "review" or "text")
//   --label N   0-based column number of the label  (only needed if there is no header like "sentiment" or "label")
//   --no-header the first row is data, not column names
// Then upload sample.csv in the app: Model Lab > Train on this CSV.
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const noHeader = args.includes("--no-header"); if (noHeader) args.splice(args.indexOf("--no-header"), 1);
const textOpt = flag("--text"), labelOpt = flag("--label");
const [input, output, rowsArg] = args;
if (!input || !output) { console.log("Usage: node tools/make-sample.mjs big.csv sample.csv [rows] [--text N] [--label N] [--no-header]"); process.exit(1); }
const want = Number(rowsArg || 10000);

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = [], f = "", q = false, any = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') { q = true; any = true; }
    else if (c === ",") { row.push(f); f = ""; any = true; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; if (any || f) { row.push(f); rows.push(row); } row = []; f = ""; any = false; }
    else { f += c; any = true; }
  }
  if (any || f) { row.push(f); rows.push(row); }
  return rows;
}

const rows = parseCsv(fs.readFileSync(input, "utf8"));
let tc = textOpt == null ? -1 : Number(textOpt), lc = labelOpt == null ? -1 : Number(labelOpt), start = 0;
if (!noHeader && rows.length) {
  const head = rows[0].map((h) => h.trim().toLowerCase());
  if (tc < 0) tc = head.findIndex((h) => ["text", "review", "comment", "sentence", "content", "tweet", "post", "message", "body"].includes(h));
  if (lc < 0) lc = head.findIndex((h) => ["label", "sentiment", "class", "target", "polarity", "category"].includes(h));
  start = 1;
}
if (tc < 0 || lc < 0) { console.log("Could not find the text and label columns. Pass --text N and --label N (0-based)."); process.exit(1); }

// Small seeded random generator, so the same input always gives the same sample.
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const groups = new Map();
for (let i = start; i < rows.length; i++) {
  const r = rows[i]; if (r.length <= Math.max(tc, lc)) continue;
  const text = r[tc].replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim(); const label = r[lc].trim();
  if (!text || !label) continue;
  if (!groups.has(label)) groups.set(label, []);
  groups.get(label).push(text);
}
const labels = [...groups.keys()];
if (labels.length < 2) { console.log("Found fewer than 2 different labels. Check the column numbers."); process.exit(1); }
const per = Math.floor(want / labels.length);
const esc = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const out = ["text,label"];
for (const [label, list] of groups) {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  for (const t of list.slice(0, per)) out.push(esc(t) + "," + esc(label));
  console.log(`label "${label}": ${list.length} rows found, ${Math.min(per, list.length)} kept`);
}
fs.writeFileSync(output, out.join("\n") + "\n");
console.log(`Wrote ${out.length - 1} rows to ${output}`);
