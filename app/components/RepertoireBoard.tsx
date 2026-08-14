// @ts-nocheck
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Chess, Square } from "chess.js";

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
  parentMoveId: string | null;
  repertoireId: string;
};

type Repertoire = {
  id: string;
  name: string;
  color: string;
  moves: Move[];
};

type TreeNode = { move: Move; children: TreeNode[] };

function buildTree(moves: Move[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(
    moves.map((m) => [m.id, { move: m, children: [] }])
  );
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (!node.move.parentMoveId) {
      roots.push(node);
    } else {
      byId.get(node.move.parentMoveId)?.children.push(node);
    }
  }
  function sort(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.move.order - b.move.order);
    nodes.forEach((n) => sort(n.children));
  }
  sort(roots);
  return roots;
}

function getAncestorIds(moves: Move[], moveId: string | null): Set<string> {
  const set = new Set<string>();
  const byId = new Map(moves.map((m) => [m.id, m]));
  let cur = moveId ? byId.get(moveId) : undefined;
  while (cur) {
    set.add(cur.id);
    cur = cur.parentMoveId ? byId.get(cur.parentMoveId) : undefined;
  }
  return set;
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function MoveNode({ node, depth, currentMoveId, activePath, onSelect }: {
  node: TreeNode;
  depth: number;
  currentMoveId: string | null;
  activePath: Set<string>;
  onSelect: (id: string) => void;
}) {
  const isActive = node.move.id === currentMoveId;
  const isOnPath = activePath.has(node.move.id);
  const isWhiteMove = node.move.order % 2 === 1;
  const moveNumber = Math.ceil(node.move.order / 2);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", paddingLeft: depth * 10 }}>
        {isWhiteMove && (
          <span style={{ fontSize: 10, color: "#444", marginRight: 4, minWidth: 22, flexShrink: 0 }}>
            {moveNumber}.
          </span>
        )}
        <span
          onClick={() => onSelect(node.move.id)}
          style={{
            padding: "2px 6px", borderRadius: 3, cursor: "pointer", fontSize: 12,
            color: isActive ? "#c8a96e" : isOnPath ? "#a88850" : "#666",
            background: isActive ? "#c8a96e22" : "transparent",
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {node.move.san}
        </span>
      </div>
      {node.children.map((child) => (
        <MoveNode
          key={child.move.id}
          node={child}
          depth={depth + 1}
          currentMoveId={currentMoveId}
          activePath={activePath}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function RepertoireBoard({ repertoire }: { repertoire: Repertoire }) {
  const router = useRouter();
  const [moves, setMoves] = useState<Move[]>(repertoire.moves);
  const [currentMoveId, setCurrentMoveId] = useState<string | null>(null);
  const [fen, setFen] = useState<string>(STARTING_FEN);
  const [highlights, setHighlights] = useState({});
  const [selectedSq, setSel] = useState<string | null>(null);
  const [savedMoveId, setSavedMoveId] = useState<string | null>(null);

  const currentMove = currentMoveId ? moves.find((m) => m.id === currentMoveId) ?? null : null;
  const currentOrder = currentMove?.order ?? 0;
  const activePath = getAncestorIds(moves, currentMoveId);

  function clearSelection() { setHighlights({}); setSel(null); }

  function navigate(moveId: string | null) {
    const target = moveId ? moves.find((m) => m.id === moveId) ?? null : null;
    const isTemp = typeof moveId === "string" && moveId.startsWith("tmp_");
    // Never use a temp id as parentMoveId in API calls — use its real parent instead
    setSavedMoveId(isTemp ? (target?.parentMoveId ?? null) : moveId);
    setCurrentMoveId(moveId);
    setFen(target?.fen ?? STARTING_FEN);
    clearSelection();
  }

  function showMovesFrom(sq: string) {
    const game = new Chess(fen);
    const legalMoves = game.moves({ square: sq as Square, verbose: true });
    if (!legalMoves.length) { clearSelection(); return; }
    const h: Record<string, object> = { [sq]: { background: "#c8a96e30" } };
    legalMoves.forEach((m) => {
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
    const game = new Chess(fen);
    let result;
    try { result = game.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!result) return false;

    const newFen = game.fen();
    setFen(newFen);
    clearSelection();

    const tempId = "tmp_" + Date.now();
    const tempMove: Move = {
      id: tempId,
      fen: newFen,
      san: result.san,
      fromSq: result.from,
      toSq: result.to,
      order: currentOrder + 1,
      repertoireId: repertoire.id,
      parentMoveId: savedMoveId,
    };

    setMoves((prev) => [...prev, tempMove]);
    setCurrentMoveId(tempId);

    fetch("/api/moves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: newFen,
        san: result.san,
        fromSq: result.from,
        toSq: result.to,
        order: currentOrder + 1,
        repertoireId: repertoire.id,
        parentMoveId: savedMoveId,
      }),
    })
      .then((r) => r.json())
      .then((saved: Move) => {
        setMoves((prev) => {
          const without = prev.filter((m) => m.id !== tempId && m.id !== saved.id);
          return [...without, saved];
        });
        setCurrentMoveId(saved.id);
        setSavedMoveId(saved.id);
      })
      .catch(console.error);

    return true;
  }

  function onDrop({ sourceSquare, targetSquare }) {
    return applyMove(sourceSquare, targetSquare);
  }

  function onPieceDragStart({ square }) {
    showMovesFrom(square);
  }

  function onSquareClick({ square: sq }) {
    if (selectedSq && selectedSq !== sq) {
      if (applyMove(selectedSq, sq)) return;
    }
    showMovesFrom(sq);
  }

  function goBack() {
    if (!currentMoveId) return;
    const cur = moves.find((m) => m.id === currentMoveId);
    navigate(cur?.parentMoveId ?? null);
  }

  function goForward() {
    const children = moves.filter((m) => m.parentMoveId === currentMoveId);
    if (!children.length) return;
    const onPath = children.find((m) => activePath.has(m.id));
    navigate((onPath ?? children[0]).id);
  }

  function goToStart() { navigate(null); }

  const sqStyles = { ...highlights };
  if (currentMove) {
    sqStyles[currentMove.fromSq] = { background: "#c8a96e20" };
    sqStyles[currentMove.toSq] = { background: "#c8a96e35" };
  }

  const tree = buildTree(moves);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f0f0f", color: "#e8e0d0", fontFamily: "'IBM Plex Mono', monospace" }}>

      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e1e1e" }}>
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit", padding: 0 }}
          >
            ← All Repertoires
          </button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e0d0", marginBottom: 3 }}>{repertoire.name}</div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {repertoire.color === "white" ? "♔ White" : "♚ Black"}
          </div>
        </div>

        <div style={{ padding: "8px 16px", borderBottom: "1px solid #1a1a1a", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444" }}>
          Variations
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 8px 4px" }}>
          <div
            onClick={goToStart}
            style={{
              padding: "3px 8px", borderRadius: 3, cursor: "pointer", fontSize: 11, marginBottom: 4,
              color: !currentMoveId ? "#c8a96e" : "#444",
              background: !currentMoveId ? "#c8a96e15" : "transparent",
            }}
          >
            Start position
          </div>

          {tree.length === 0 && (
            <div style={{ padding: "8px", color: "#333", fontSize: 11 }}>No moves yet</div>
          )}

          {tree.map((node) => (
            <MoveNode
              key={node.move.id}
              node={node}
              depth={0}
              currentMoveId={currentMoveId}
              activePath={activePath}
              onSelect={(id) => navigate(id)}
            />
          ))}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid #1e1e1e", fontSize: 10, color: "#333", letterSpacing: "0.08em" }}>
          {moves.length} {moves.length === 1 ? "move" : "moves"} saved
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16 }}>
        <div style={{ borderRadius: 4, overflow: "hidden", boxShadow: "0 0 0 1px #2a2a2a, 0 24px 64px #000a" }}>
          <Chessboard
            options={{
              position: fen,
              onPieceDrop: onDrop,
              onPieceDrag: onPieceDragStart,
              onSquareClick,
              boardStyle: { width: 460, height: 460 },
              animationDurationInMs: 80,
              darkSquareStyle: { backgroundColor: "#4a3728" },
              lightSquareStyle: { backgroundColor: "#c8b89a" },
              squareStyles: sqStyles,
              boardOrientation: repertoire.color === "black" ? "black" : "white",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, width: 460 }}>
          {([["⟨⟨", goToStart], ["⟨", goBack], ["⟩", goForward]] as const).map(([label, fn], i) => (
            <button
              key={i}
              onClick={fn}
              style={{
                flex: 1, padding: "10px 0", background: "transparent", border: "1px solid #2a2a2a",
                color: "#666", fontSize: 14, cursor: "pointer",
                borderRadius: 3, fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#c8a96e"; e.currentTarget.style.borderColor = "#c8a96e44"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
