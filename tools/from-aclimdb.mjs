// Turns the extracted "Large Movie Review Dataset" (aclImdb) into one CSV the app can train on.
// Usage:  node tools/from-aclimdb.mjs <path-to-aclImdb-folder> <output.csv> [rows]
//   rows  how many rows to keep in total (default 10000), half positive and half negative.
// The folder must contain train\pos, train\neg, test\pos and test\neg (one .txt file per review).
// Dataset: Maas et al. (2011), "Learning Word Vectors for Sentiment Analysis", ACL. Please cite it if you publish results.
import fs from "node:fs";
import path from "node:path";

const [root, output, rowsArg] = process.argv.slice(2);
if (!root || !output) { console.log("Usage: node tools/from-aclimdb.mjs <aclImdb-folder> <output.csv> [rows]"); process.exit(1); }
const want = Number(rowsArg || 10000);

let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const esc = (s) => (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);

const out = ["text,label"];
for (const label of ["pos", "neg"]) {
  const files = [];
  for (const split of ["train", "test"]) {
    const dir = path.join(root, split, label);
    if (!fs.existsSync(dir)) { console.log("Folder not found: " + dir); process.exit(1); }
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".txt")) files.push(path.join(dir, f));
  }
  for (let i = files.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [files[i], files[j]] = [files[j], files[i]]; }
  const keep = files.slice(0, Math.floor(want / 2));
  for (const f of keep) {
    const text = fs.readFileSync(f, "utf8").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
    if (text) out.push(esc(text) + "," + (label === "pos" ? "positive" : "negative"));
  }
  console.log(`${label}: ${files.length} reviews found, ${keep.length} kept`);
}
fs.writeFileSync(output, out.join("\n") + "\n");
console.log(`Wrote ${out.length - 1} rows to ${output}`);
