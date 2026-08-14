// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Chess, Square } from "chess.js";
import MoveTrainer from "./MoveTrainer";
import ThemeToggle from "./ThemeToggle";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

type Move = {
  id: string;
  fen: string;
  san: string;
  fromSq: string;
  toSq: string;
  order: number;
  comment?: string | null;
  variationId: string;
};

type Variation = {
  id: string;
  name: string;
  moves: Move[];
};

type Repertoire = {
  id: string;
  name: string;
  color: string;
  variations: Variation[];
};

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Split a multi-game PGN file into individual game strings. Games are
// detected by a header block ([Tag "..."]) appearing after movetext.
function splitPgnGames(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const games: string[] = [];
  let current: string[] = [];
  let inMovetext = false;
  for (const line of lines) {
    const isHeader = /^\s*\[\w+\s+"/.test(line);
    if (isHeader && inMovetext) {
      games.push(current.join("\n"));
      current = [];
      inMovetext = false;
    }
    if (!isHeader && line.trim()) inMovetext = true;
    current.push(line);
  }
  if (current.some((l) => l.trim())) games.push(current.join("\n"));
  return games;
}

function pgnGameName(pgn: string, fileName: string, index: number, total: number): string {
  for (const key of ["ChapterName", "Event", "Opening"]) {
    const m = pgn.match(new RegExp(`\\[${key}\\s+"([^"]+)"\\]`));
    if (m?.[1] && m[1] !== "?" && m[1] !== "Casual Game") return m[1];
  }
  const base = fileName.replace(/\.pgn$/i, "");
  return total > 1 ? `${base} (${index + 1})` : base;
}

// ── PGN movetext parser with sideline (RAV) support ─────────────────────────
// ChessBase repertoires are usually one game with deeply nested sidelines, so
// every branch is flattened into its own complete line from move 1.

type PgnItem = { san: string; comment: string | null; alternatives: PgnItem[][] };
type PgnLineMove = { san: string; comment: string | null };

function tokenizePgnMovetext(movetext: string): (string | { comment: string })[] {
  const tokens: (string | { comment: string })[] = [];
  let i = 0;
  while (i < movetext.length) {
    const ch = movetext[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "{") {
      const end = movetext.indexOf("}", i + 1);
      const body = movetext.slice(i + 1, end === -1 ? movetext.length : end);
      tokens.push({ comment: body.replace(/\s+/g, " ").trim() });
      i = end === -1 ? movetext.length : end + 1;
      continue;
    }
    if (ch === ";") { // rest-of-line comment
      const nl = movetext.indexOf("\n", i);
      i = nl === -1 ? movetext.length : nl + 1;
      continue;
    }
    if (ch === "(" || ch === ")") { tokens.push(ch); i++; continue; }
    let j = i;
    while (j < movetext.length && !/[\s(){;]/.test(movetext[j])) j++;
    tokens.push(movetext.slice(i, j));
    i = j;
  }
  return tokens;
}

function parsePgnSequence(
  tokens: (string | { comment: string })[],
  pos: { i: number }
): PgnItem[] {
  const items: PgnItem[] = [];
  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok === ")") break;
    pos.i++;
    if (tok === "(") {
      const alt = parsePgnSequence(tokens, pos);
      if (tokens[pos.i] === ")") pos.i++;
      if (items.length && alt.length) items[items.length - 1].alternatives.push(alt);
      continue;
    }
    if (typeof tok === "object") {
      if (items.length && tok.comment) {
        const last = items[items.length - 1];
        last.comment = last.comment ? `${last.comment} ${tok.comment}` : tok.comment;
      }
      continue;
    }
    // skip move numbers, NAGs ($3) and results
    if (/^\d+\.*$/.test(tok) || /^\$\d+$/.test(tok)) continue;
    if (tok === "1-0" || tok === "0-1" || tok === "1/2-1/2" || tok === "*" || tok === "...") continue;
    // strip a glued move number ("12.Nf3"), annotation suffixes, normalize castling zeros
    const san = tok
      .replace(/^\d+\.+/, "")
      .replace(/[!?]+$/, "")
      .replace(/^0-0-0/, "O-O-O")
      .replace(/^0-0/, "O-O");
    if (!san) continue;
    items.push({ san, comment: null, alternatives: [] });
  }
  return items;
}

// Flatten the variation tree: the mainline plus one complete line (from move 1)
// per sideline. A sideline replaces the move it is attached to.
function enumeratePgnLines(items: PgnItem[]): PgnLineMove[][] {
  const lines: PgnLineMove[][] = [];
  function walk(seq: PgnItem[], idx: number, path: PgnLineMove[]) {
    if (idx === seq.length) {
      if (path.length) lines.push(path);
      return;
    }
    const item = seq[idx];
    walk(seq, idx + 1, [...path, { san: item.san, comment: item.comment }]);
    for (const alt of item.alternatives) walk(alt, 0, [...path]);
  }
  walk(items, 0, []);
  return lines;
}

function pgnMovetext(pgn: string): string {
  return pgn
    .split(/\r?\n/)
    .filter((l) => !/^\s*\[\w+\s+"/.test(l))
    .join("\n");
}

export default function RepertoireEditor({ repertoire }: { repertoire: Repertoire }) {
  const router = useRouter();
  const [variations, setVariations] = useState<Variation[]>(repertoire.variations);
  const [selectedId, setSelectedId] = useState<string | null>(
    repertoire.variations[0]?.id ?? null
  );
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [fen, setFen] = useState(STARTING_FEN);
  const [highlights, setHighlights] = useState<Record<string, object>>({});
  const [selectedSq, setSel] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState("");
  const [showNewVar, setShowNewVar] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<"edit" | "learn" | "train">("edit");
  const [commentDraft, setCommentDraft] = useState("");
  const [learnNote, setLearnNote] = useState<Move | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedVar = variations.find((v) => v.id === selectedId) ?? null;
  const moves = selectedVar?.moves ?? [];
  const currentMove = currentIndex >= 0 ? (moves[currentIndex] ?? null) : null;

  // Next variation with moves (wrapping), for "next" in training mode
  const trainable = variations.filter((v) => v.moves.length > 0);
  const nextTrainable = (() => {
    if (!trainable.length) return null;
    const i = trainable.findIndex((v) => v.id === selectedId);
    const candidate = i === -1 ? trainable[0] : trainable[(i + 1) % trainable.length];
    return candidate.id === selectedId ? null : candidate;
  })();

  function selectVariation(id: string) {
    setSelectedId(id);
    setCurrentIndex(-1);
    setFen(STARTING_FEN);
    setHighlights({});
    setSel(null);
  }

  function navigateTo(index: number) {
    if (index < -1 || index >= moves.length) return;
    setCurrentIndex(index);
    setFen(index === -1 ? STARTING_FEN : moves[index].fen);
    setHighlights({});
    setSel(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (mode !== "edit") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          navigateTo(currentIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          navigateTo(currentIndex + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          navigateTo(-1);
          break;
        case "ArrowDown":
          e.preventDefault();
          navigateTo(moves.length - 1);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    setCommentDraft(currentMove?.comment ?? "");
  }, [currentMove?.id]);

  function saveComment() {
    if (!currentMove || currentMove.id.startsWith("tmp_")) return;
    const text = commentDraft.trim();
    if ((currentMove.comment ?? "") === text) return;
    setVariations((prev) =>
      prev.map((v) => {
        if (v.id !== selectedId) return v;
        return {
          ...v,
          moves: v.moves.map((m) =>
            m.id === currentMove.id ? { ...m, comment: text || null } : m
          ),
        };
      })
    );
    fetch("/api/moves", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentMove.id, comment: text || null }),
    }).catch(console.error);
  }

  function clearSel() { setHighlights({}); setSel(null); }

  function showLegalMoves(sq: string) {
    const game = new Chess(fen);
    const legal = game.moves({ square: sq as Square, verbose: true });
    if (!legal.length) { clearSel(); return; }
    const h: Record<string, object> = { [sq]: { background: "#c8a96e30" } };
    legal.forEach((m) => {
      h[m.to] = {
        background: game.get(m.to as Square)
          ? "radial-gradient(circle, #00000080 58%, transparent 60%)"
          : "radial-gradient(circle, #00000060 34%, transparent 36%)",
        borderRadius: "50%",
      };
    });
    setHighlights(h);
    setSel(sq);
  }

  function applyMove(from: string, to: string): boolean {
    if (!selectedId) return false;
    const game = new Chess(fen);
    let result;
    try { result = game.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!result) return false;

    const newFen = game.fen();
    const newOrder = currentIndex + 2; // 1-indexed; currentIndex=-1 → order=1

    // If the next move already in the variation is the same, just advance
    const nextMove = moves[currentIndex + 1];
    if (nextMove?.san === result.san) {
      setFen(newFen);
      setCurrentIndex(currentIndex + 1);
      clearSel();
      return true;
    }

    // Truncate local state at this point, then optimistically append
    const tempId = "tmp_" + Date.now();
    const tempMove: Move = {
      id: tempId,
      fen: newFen,
      san: result.san,
      fromSq: result.from,
      toSq: result.to,
      order: newOrder,
      variationId: selectedId,
    };
    const newMoves = [...moves.slice(0, currentIndex + 1), tempMove];
    setVariations((prev) =>
      prev.map((v) => (v.id === selectedId ? { ...v, moves: newMoves } : v))
    );
    setFen(newFen);
    setCurrentIndex(currentIndex + 1);
    clearSel();

    fetch("/api/moves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: newFen,
        san: result.san,
        fromSq: result.from,
        toSq: result.to,
        order: newOrder,
        variationId: selectedId,
      }),
    })
      .then((r) => r.json())
      .then((saved: Move) => {
        setVariations((prev) =>
          prev.map((v) => {
            if (v.id !== selectedId) return v;
            return { ...v, moves: v.moves.map((m) => (m.id === tempId ? saved : m)) };
          })
        );
      })
      .catch(console.error);

    return true;
  }

  async function createVariation() {
    const name = newVarName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, repertoireId: repertoire.id }),
      });
      if (!res.ok) return;
      const created = await res.json();
      const withMoves: Variation = { ...created, moves: [] };
      setVariations((prev) => [...prev, withMoves]);
      setNewVarName("");
      setShowNewVar(false);
      selectVariation(withMoves.id);
    } finally {
      setCreating(false);
    }
  }

  async function importPgnFile(file: File) {
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const rawGames = splitPgnGames(text);
      const games: { name: string; moves: object[] }[] = [];
      let skipped = 0;

      rawGames.forEach((pgn, i) => {
        // Skip games starting from a custom position — variations assume the standard start
        const fenHeader = pgn.match(/\[FEN\s+"([^"]+)"\]/);
        if (fenHeader && fenHeader[1] !== STARTING_FEN) { skipped++; return; }

        const tokens = tokenizePgnMovetext(pgnMovetext(pgn));
        const items = parsePgnSequence(tokens, { i: 0 });
        const lines = enumeratePgnLines(items);
        if (!lines.length) { skipped++; return; }

        const baseName = pgnGameName(pgn, file.name, i, rawGames.length);
        lines.forEach((line, li) => {
          const game = new Chess();
          const lineMoves: object[] = [];
          try {
            for (const { san, comment } of line) {
              const r = game.move(san);
              lineMoves.push({
                fen: game.fen(),
                san: r.san,
                fromSq: r.from,
                toSq: r.to,
                order: lineMoves.length + 1,
                comment: comment || undefined,
              });
            }
          } catch { skipped++; return; }
          games.push({
            name: lines.length > 1 ? `${baseName} #${li + 1}` : baseName,
            moves: lineMoves,
          });
        });
      });

      if (!games.length) {
        setImportStatus({ kind: "error", text: "No playable games found in this PGN." });
        return;
      }

      const res = await fetch("/api/variations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repertoireId: repertoire.id, games }),
      });
      if (!res.ok) {
        setImportStatus({ kind: "error", text: "Import failed on the server." });
        return;
      }
      const created: Variation[] = await res.json();
      setVariations((prev) => [...prev, ...created]);
      if (created[0]) selectVariation(created[0].id);
      setImportStatus({
        kind: "info",
        text: skipped
          ? `Imported ${created.length}, skipped ${skipped} game(s).`
          : `Imported ${created.length} ${created.length === 1 ? "variation" : "variations"}.`,
      });
    } catch (e) {
      console.error(e);
      setImportStatus({ kind: "error", text: "Could not read this PGN file." });
    } finally {
      setImporting(false);
    }
  }

  function onDrop({ sourceSquare, targetSquare }) {
    return applyMove(sourceSquare, targetSquare);
  }
  function onPieceDragStart({ square }) { showLegalMoves(square); }
  function onSquareClick({ square: sq }) {
    if (selectedSq && selectedSq !== sq) {
      if (applyMove(selectedSq, sq)) return;
    }
    showLegalMoves(sq);
  }

  const sqStyles = { ...highlights };
  if (currentMove) {
    sqStyles[currentMove.fromSq] = { background: "#c8a96e20" };
    sqStyles[currentMove.toSq] = { background: "#c8a96e35" };
  }

  // Group moves into pairs: { num, white: Move, black?: Move }
  const movePairs = moves.reduce<{ num: number; white: Move; black?: Move }[]>((acc, m, i) => {
    if (i % 2 === 0) acc.push({ num: i / 2 + 1, white: m, black: moves[i + 1] });
    return acc;
  }, []);

  // ── Shared style helpers ──────────────────────────────────────────────────
  const border = "1px solid var(--border-soft)";

  function moveChip(moveIndex: number, san: string) {
    const active = moveIndex === currentIndex;
    return (
      <span
        onClick={() => navigateTo(moveIndex)}
        style={{
          padding: "2px 6px", borderRadius: 3, cursor: "pointer", fontSize: 12,
          minWidth: 48, display: "inline-block",
          color: active ? "var(--accent)" : "var(--text-2)",
          background: active ? "var(--accent-soft)" : "transparent",
          fontWeight: active ? 600 : 400,
        }}
      >
        {san}
      </span>
    );
  }

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "var(--bg)", color: "var(--text)",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>

      {/* ── Left sidebar: variation list ─────────────────────────────────── */}
      <div style={{ width: 250, flexShrink: 0, borderRight: border, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Back + repertoire name */}
        <div style={{ padding: "14px 16px", borderBottom: border }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => router.push("/")}
              style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 11, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit", padding: 0 }}
            >
              ← All Repertoires
            </button>
            <ThemeToggle />
          </div>
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{repertoire.name}</div>
          <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>
            {repertoire.color === "white" ? "♔ White" : "♚ Black"}
          </div>
        </div>

        {/* New variation */}
        <div style={{ padding: "12px 16px", borderBottom: border }}>
          {showNewVar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createVariation();
                  if (e.key === "Escape") { setShowNewVar(false); setNewVarName(""); }
                }}
                placeholder="Variation name"
                autoFocus
                style={{
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3,
                  padding: "7px 10px", color: "var(--text)", fontSize: 12,
                  fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={createVariation}
                  disabled={creating || !newVarName.trim()}
                  style={{
                    flex: 1, padding: "8px 0", background: "var(--accent)", border: "none",
                    borderRadius: 3, color: "var(--accent-text)", fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                    fontFamily: "inherit", opacity: (creating || !newVarName.trim()) ? 0.5 : 1,
                  }}
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => { setShowNewVar(false); setNewVarName(""); }}
                  style={{
                    padding: "8px 12px", background: "transparent", border: "1px solid var(--border)",
                    borderRadius: 3, color: "var(--text-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => setShowNewVar(true)}
                style={{
                  width: "100%", padding: "8px 0", background: "var(--accent)", border: "none",
                  borderRadius: 3, color: "var(--accent-text)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                + New Variation
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                style={{
                  width: "100%", padding: "8px 0", background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 3, color: "var(--text-3)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: importing ? "default" : "pointer", fontFamily: "inherit",
                  opacity: importing ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!importing) { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                {importing ? "Importing…" : "⬆ Import PGN"}
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pgn,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importPgnFile(f);
              e.target.value = "";
            }}
          />
          {importStatus && (
            <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: importStatus.kind === "error" ? "var(--danger)" : "var(--success)" }}>
              {importStatus.text}
            </div>
          )}
        </div>

        {/* Variation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {variations.length === 0 && (
            <div style={{ padding: "24px 16px", color: "var(--text-4)", fontSize: 12, textAlign: "center" }}>
              No variations yet
            </div>
          )}
          {variations.map((v) => {
            const active = v.id === selectedId;
            return (
              <div
                key={v.id}
                onClick={() => selectVariation(v.id)}
                style={{
                  padding: "10px 16px", cursor: "pointer",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  background: active ? "var(--accent-faint)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--hover)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 12, color: active ? "var(--text)" : "var(--text-2)", fontWeight: active ? 600 : 400 }}>
                  {v.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-4)", marginTop: 2 }}>
                  {v.moves.length} {v.moves.length === 1 ? "move" : "moves"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Center: board ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16, minWidth: 0 }}>
        {!selectedVar ? (
          <div style={{ color: "var(--text-4)", fontSize: 13 }}>Select or create a variation to start</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ fontSize: 11, color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {selectedVar.name}
              </div>
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
                {(["edit", "learn", "train"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      padding: "5px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      background: mode === m ? "var(--accent)" : "transparent",
                      color: mode === m ? "var(--bg)" : "var(--text-3)",
                    }}
                  >
                    {m === "edit" ? "Edit" : m === "learn" ? "Learn" : "Train"}
                  </button>
                ))}
              </div>
            </div>
            {mode !== "edit" ? (
              <MoveTrainer
                key={`${selectedVar.id}-${mode}`}
                variation={selectedVar}
                color={repertoire.color}
                mode={mode}
                onNext={nextTrainable ? () => selectVariation(nextTrainable.id) : null}
                onTrain={mode === "learn" ? () => setMode("train") : null}
                onMovePlayed={setLearnNote}
              />
            ) : (
            <div style={{ width: "min(calc(100vh - 180px), 100%, 860px)", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ borderRadius: 4, overflow: "hidden", boxShadow: "var(--board-shadow)", aspectRatio: "1" }}>
                <Chessboard
                  options={{
                    position: fen,
                    onPieceDrop: onDrop,
                    onPieceDrag: onPieceDragStart,
                    onSquareClick,
                    boardStyle: { width: "100%", height: "100%" },
                    animationDurationInMs: 80,
                    darkSquareStyle: { backgroundColor: "#4a3728" },
                    lightSquareStyle: { backgroundColor: "#c8b89a" },
                    squareStyles: sqStyles,
                    boardOrientation: repertoire.color === "black" ? "black" : "white",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
              {([
                ["⟨⟨", () => navigateTo(-1)],
                ["⟨", () => navigateTo(currentIndex - 1)],
                ["⟩", () => navigateTo(currentIndex + 1)],
                ["⟩⟩", () => navigateTo(moves.length - 1)],
              ] as [string, () => void][]).map(([label, fn], i) => (
                <button
                  key={i}
                  onClick={fn}
                  style={{
                    flex: 1, padding: "9px 0", background: "transparent", border: "1px solid var(--border)",
                    color: "var(--text-3)", fontSize: 14, cursor: "pointer", borderRadius: 3, fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  {label}
                </button>
              ))}
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {/* ── Right sidebar: move list (hidden while training — it would reveal answers) ── */}
      {mode !== "train" && (
      <div style={{ width: 260, flexShrink: 0, borderLeft: border, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: border, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-4)" }}>
          Move List
        </div>

        {/* Learn mode: notes for the move just played */}
        {mode === "learn" && (
          <div style={{ borderBottom: border, padding: "12px 14px", minHeight: 96, boxSizing: "border-box" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-4)", marginBottom: 6 }}>
              Notes{learnNote ? ` · ${learnNote.san}` : ""}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--comment)", fontStyle: "italic" }}>
              {learnNote?.comment
                ? learnNote.comment
                : <span style={{ color: "var(--text-4)" }}>Move comments will appear here as you play</span>}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {/* Start position */}
          <div
            onClick={() => navigateTo(-1)}
            style={{
              padding: "3px 12px", cursor: "pointer", fontSize: 11, borderRadius: 3, margin: "0 4px",
              color: currentIndex === -1 ? "var(--accent)" : "var(--text-4)",
              background: currentIndex === -1 ? "var(--accent-faint)" : "transparent",
            }}
          >
            Start
          </div>

          {/* Move pairs, with comments shown under their pair */}
          {movePairs.map(({ num, white, black }, pairIdx) => {
            const commentStyle = {
              padding: "1px 12px 4px 30px", fontSize: 10, lineHeight: 1.5,
              color: "var(--comment)", fontStyle: "italic" as const,
            };
            const both = white.comment && black?.comment;
            return (
              <div key={white.id}>
                <div style={{ display: "flex", alignItems: "center", padding: "1px 6px", gap: 2 }}>
                  <span style={{ fontSize: 10, color: "var(--text-4)", minWidth: 20, textAlign: "right", flexShrink: 0 }}>
                    {num}.
                  </span>
                  {moveChip(pairIdx * 2, white.san)}
                  {black && moveChip(pairIdx * 2 + 1, black.san)}
                </div>
                {white.comment && (
                  <div style={commentStyle}>{both ? `${white.san}: ${white.comment}` : white.comment}</div>
                )}
                {black?.comment && (
                  <div style={commentStyle}>{both ? `${black.san}: ${black.comment}` : black.comment}</div>
                )}
              </div>
            );
          })}

          {selectedVar && moves.length === 0 && (
            <div style={{ padding: "16px 12px", color: "var(--text-4)", fontSize: 11 }}>
              Play a move to start recording
            </div>
          )}
        </div>

        {/* Comment editor for the selected move (edit mode only) */}
        {mode === "edit" && currentMove && (
          <div style={{ borderTop: border, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-4)", marginBottom: 6 }}>
              Comment · {Math.ceil((currentIndex + 1) / 2)}.{currentIndex % 2 === 0 ? "" : ".."} {currentMove.san}
            </div>
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onBlur={saveComment}
              placeholder="Add a note for this move…"
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box", background: "var(--bg)",
                border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-2)",
                fontSize: 11, lineHeight: 1.5, fontFamily: "inherit", outline: "none",
                resize: "vertical", padding: "6px 8px",
              }}
            />
          </div>
        )}
      </div>
      )}

    </div>
  );
}
