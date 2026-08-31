# Third-party notices

MoveForge bundles and serves third-party code to the browser. This file records
what, and under which terms.

## Stockfish.js — GPL-3.0-or-later

The live analysis in the repertoire editor runs [Stockfish.js][sfjs], a
WebAssembly build of the [Stockfish][sf] chess engine, by Nathan Rugg, with
development sponsored by Chess.com.

It is licensed under the **GNU General Public License v3.0 or later**. The full
text ships with the npm package as `node_modules/stockfish/Copying.txt` and is
also available at <https://www.gnu.org/licenses/gpl-3.0.txt>.

- Upstream source: <https://github.com/nmrugg/stockfish.js>
- Engine source: <https://github.com/official-stockfish/Stockfish>
- Version bundled: see the `stockfish` entry in [package.json](package.json)

**How it is distributed here.** The engine is *not* checked into this
repository. `scripts/copy-stockfish.mjs` copies two files —
`stockfish-<version>-lite-single.js` and its `.wasm` — out of `node_modules`
into `public/stockfish/` at install and build time, from where the browser
loads them as a Web Worker. They are served unmodified.

**Obligation.** Serving these files to a browser is distribution under the GPL.
Anyone who receives them is entitled to the corresponding source under the same
licence; the upstream links above point to it. This notice records the licence
and its origin — it is not a legal review, and it does not by itself settle how
the GPL interacts with the rest of this project. Get advice before relying on
it commercially.

[sfjs]: https://github.com/nmrugg/stockfish.js
[sf]: https://github.com/official-stockfish/Stockfish
