// @ts-nocheck
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Chess } from "chess.js";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

export default function ChessBoard({ boardWidth = 480 }) {
  const [game, setGame]       = useState(new Chess());
  const [history, setHistory] = useState([]);
  const [cursor, setCursor]   = useState(-1);
  const [highlights, setHighlights] = useState({});
  const [selectedSq, setSel]  = useState(null);
  const [lastMove, setLastMove] = useState(null);

  const isLive     = cursor === -1;
  const displayFen = isLive ? game.fen() : history[cursor]?.fen ?? game.fen();

  function doMove(from, to) {
    const copy = new Chess(game.fen());
    let result;
    try { result = copy.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!result) return false;
    setGame(copy);
    setHistory(prev => [...prev, { san: result.san, fen: copy.fen() }]);
    setCursor(-1);
    setLastMove({ from: result.from, to: result.to });
    setHighlights({});
    setSel(null);
    return true;
  }

  function showMovesFrom(sq) {
    const moves = game.moves({ square: sq, verbose: true });
    if (!moves.length) { setHighlights({}); setSel(null); return; }
    const h = { [sq]: { background: "#c8a96e30" } };
    moves.forEach(m => {
      h[m.to] = {
        background: game.get(m.to)
          ? "radial-gradient(circle, #00000080 58%, transparent 60%)"
          : "radial-gradient(circle, #00000060 34%, transparent 36%)",
        borderRadius: "50%",
      };
    });
    setHighlights(h);
    setSel(sq);
  }

  function onDrop({ sourceSquare, targetSquare }) { return doMove(sourceSquare, targetSquare); }

  function onPieceDragStart({ square }) {
    if (!isLive) return;
    showMovesFrom(square);
  }

  function onSquareClick({ square: sq }) {
    if (!isLive) return;
    if (selectedSq && selectedSq !== sq) {
      const ok = doMove(selectedSq, sq);
      if (ok) return;
    }
    showMovesFrom(sq);
  }

  function goTo(i)   { setCursor(i); setHighlights({}); setSel(null); }
  function goPrev()  { if (cursor === -1 && history.length) goTo(history.length - 2); else if (cursor > 0) goTo(cursor - 1); }
  function goNext()  { if (cursor !== -1) goTo(cursor < history.length - 1 ? cursor + 1 : -1); }
  function goFirst() { if (history.length) goTo(0); }
  function goLast()  { goTo(-1); }
  function reset()   { setGame(new Chess()); setHistory([]); setCursor(-1); setHighlights({}); setSel(null); setLastMove(null); }

  let dot = game.turn() === "w" ? "#e8e0d0" : "#666";
  let txt = `${game.turn() === "w" ? "Weiß" : "Schwarz"} am Zug`;
  if (game.isCheck())     { dot = "#c8a96e"; txt = `Schach — ${game.turn() === "w" ? "Weiß" : "Schwarz"} am Zug`; }
  if (game.isCheckmate()) { dot = "#e05252"; txt = `Schachmatt — ${game.turn() === "w" ? "Schwarz" : "Weiß"} gewinnt`; }
  if (game.isDraw())      { dot = "#6699cc"; txt = "Remis"; }

  const sqStyles = { ...highlights };
  if (lastMove && isLive) {
    sqStyles[lastMove.from] = { background: "#c8a96e20" };
    sqStyles[lastMove.to]   = { background: "#c8a96e35" };
  }

  const pairs = [];
  for (let i = 0; i < history.length; i += 2)
    pairs.push({ num: i/2+1, w: history[i], b: history[i+1], wi: i, bi: i+1 });

  return (
    <div style={{ display:"flex", gap:24, alignItems:"flex-start", fontFamily:"'IBM Plex Mono',monospace", padding:32, background:"#0f0f0f", minHeight:"100vh", color:"#e8e0d0" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ borderRadius:4, overflow:"hidden", boxShadow:"0 0 0 1px #2a2a2a, 0 24px 64px #000a" }}>
          <Chessboard
            options={{
              position: displayFen,
              onPieceDrop: isLive ? onDrop : () => false,
              onPieceDrag: onPieceDragStart,
              onSquareClick,
              boardStyle: { borderRadius: 0, width: boardWidth, height: boardWidth },
              animationDurationInMs: 100,
              darkSquareStyle: { backgroundColor: "#4a3728" },
              lightSquareStyle: { backgroundColor: "#c8b89a" },
              squareStyles: sqStyles,
            }}
          />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"#161616", borderRadius:4, border:"1px solid #2a2a2a", fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:dot }} />
          <span>{txt}</span>
          {!isLive && <span style={{ marginLeft:"auto", color:"#555" }}>Zug {cursor+1}/{history.length}</span>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[["⟨⟨", goFirst], ["⟨", goPrev], ["⟩", goNext], ["⟩⟩", goLast]].map(([l, fn], i) => (
            <button key={i} onClick={fn} style={{ flex:1, padding:"10px 0", background:"transparent", border:"1px solid #2a2a2a", color:"#666", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", borderRadius:3, fontFamily:"inherit" }}
              onMouseEnter={e => { e.target.style.color="#c8a96e"; e.target.style.borderColor="#c8a96e44"; }}
              onMouseLeave={e => { e.target.style.color="#666"; e.target.style.borderColor="#2a2a2a"; }}
            >{l}</button>
          ))}
          <button onClick={reset} style={{ flex:1, padding:"10px 0", background:"transparent", border:"1px solid #3d1f1f", color:"#a04040", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", borderRadius:3, fontFamily:"inherit" }}
            onMouseEnter={e => { e.target.style.color="#e05252"; e.target.style.borderColor="#5d2222"; }}
            onMouseLeave={e => { e.target.style.color="#a04040"; e.target.style.borderColor="#3d1f1f"; }}
          >Reset</button>
        </div>
      </div>
      <div style={{ width:220, flexShrink:0, display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ background:"#161616", border:"1px solid #2a2a2a", borderRadius:4, overflow:"hidden" }}>
          <div style={{ padding:"10px 14px", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#555", borderBottom:"1px solid #1e1e1e" }}>Zugfolge</div>
          <div style={{ maxHeight:320, overflowY:"auto", padding:"8px 0" }}>
            {!pairs.length && <div style={{ padding:"12px 14px", color:"#333", fontSize:11 }}>Noch keine Züge</div>}
            {pairs.map(({ num, w, b, wi, bi }) => (
              <div key={num} style={{ display:"grid", gridTemplateColumns:"32px 1fr 1fr", gap:4, padding:"2px 12px", fontSize:12 }}>
                <span style={{ color:"#444", fontSize:11, paddingTop:2 }}>{num}.</span>
                <span onClick={() => goTo(wi)} style={{ padding:"2px 6px", borderRadius:2, cursor:"pointer", color: cursor===wi?"#c8a96e":"#888", background: cursor===wi?"#c8a96e22":"transparent" }}>{w.san}</span>
                {b && <span onClick={() => goTo(bi)} style={{ padding:"2px 6px", borderRadius:2, cursor:"pointer", color: cursor===bi?"#c8a96e":"#888", background: cursor===bi?"#c8a96e22":"transparent" }}>{b.san}</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"#161616", border:"1px solid #2a2a2a", borderRadius:4 }}>
          <div style={{ padding:"10px 14px", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#555", borderBottom:"1px solid #1e1e1e" }}>Statistik</div>
          <div style={{ padding:14, display:"flex", flexDirection:"column", gap:10 }}>
            {[["Züge", history.length], ["Status", game.isGameOver()?"Beendet":"Läuft"]].map(([l,v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                <span style={{ color:"#444", textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</span>
                <span style={{ color:"#c8a96e", fontWeight:"bold" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"#161616", border:"1px solid #2a2a2a", borderRadius:4 }}>
          <div style={{ padding:"10px 14px", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#555", borderBottom:"1px solid #1e1e1e" }}>FEN</div>
          <div style={{ padding:"10px 14px", fontSize:9, color:"#555", wordBreak:"break-all", letterSpacing:"0.05em", lineHeight:1.6 }}>{displayFen}</div>
        </div>
      </div>
    </div>
  );
}
