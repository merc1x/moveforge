// Copy the Stockfish WASM engine out of node_modules into public/ so the browser
// can load it with `new Worker("/stockfish/…")`.
//
// We ship the "lite single-threaded" flavour (~7 MB): it is the only one that
// runs without cross-origin-isolation headers (COOP/COEP), and it is still far
// stronger than any human. The binaries are downloaded by the stockfish
// package's own postinstall, so they are build output — public/stockfish is
// gitignored and regenerated on install/dev/build.

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const projectRoot = path.resolve(root, "..");
const destDir = path.join(projectRoot, "public", "stockfish");

let pkg;
let srcDir;
try {
  pkg = require("stockfish/package.json");
  srcDir = path.join(path.dirname(require.resolve("stockfish/package.json")), "bin");
} catch {
  console.warn("[stockfish] package not installed — skipping engine copy");
  process.exit(0);
}

const base = `stockfish-${pkg.buildVersion}-lite-single`;
const files = [`${base}.js`, `${base}.wasm`];

const missing = files.filter((f) => !existsSync(path.join(srcDir, f)));
if (missing.length) {
  // The stockfish postinstall downloads these from GitHub releases; a blocked
  // network leaves them absent. Warn rather than fail the whole install/build —
  // the analysis panel degrades to an error message in the UI.
  console.warn(`[stockfish] missing engine files (${missing.join(", ")}) — skipping engine copy`);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const file of files) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  // Skip when the destination is already byte-identical in size and no older
  // than the source, so `predev` stays instant on every run.
  if (existsSync(dest)) {
    const a = statSync(src);
    const b = statSync(dest);
    if (a.size === b.size && b.mtimeMs >= a.mtimeMs) continue;
  }
  copyFileSync(src, dest);
  copied++;
}

console.log(
  copied
    ? `[stockfish] copied ${copied} file(s) to public/stockfish`
    : "[stockfish] engine already up to date"
);
