"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toWhitePerspective, type Score } from "@/lib/uci";

// Served out of public/ by scripts/copy-stockfish.mjs. Keep the version here in
// sync with the flavour that script copies.
const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

// Deep enough to be trustworthy in the opening, shallow enough that the lite
// engine reaches it in well under a second on a laptop.
export const ANALYSIS_DEPTH = 18;

export type EngineStatus = "off" | "loading" | "ready" | "error";

export type Analysis = {
  // The position this evaluation belongs to — never a stale one.
  fen: string;
  depth: number;
  // Always from White's point of view.
  score: Score;
  // Best move in UCI ("e2e4"), i.e. the first move of the PV.
  bestMove: string | null;
  // Principal variation in UCI.
  pv: string[];
  nodes: number | null;
  nps: number | null;
  // True once the engine reported bestmove for the requested depth.
  complete: boolean;
};

type Options = {
  fen: string;
  // The panel's on/off switch — nothing is loaded or searched while false.
  enabled: boolean;
  depth?: number;
  debounceMs?: number;
};

// Parse one "info …" line into a partial analysis. Returns null for the lines we
// do not display: bounds from an aborted search window, "info string" chatter,
// secondary MultiPV lines, and anything without a principal variation.
function parseInfo(line: string): {
  depth: number;
  score: Score;
  pv: string[];
  nodes: number | null;
  nps: number | null;
} | null {
  if (line.includes(" lowerbound") || line.includes(" upperbound")) return null;
  const tokens = line.split(/\s+/);
  let depth: number | null = null;
  let nodes: number | null = null;
  let nps: number | null = null;
  let score: Score | null = null;
  let pv: string[] | null = null;

  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case "string":
        return null;
      case "multipv":
        if (tokens[i + 1] !== "1") return null;
        break;
      case "depth":
        depth = Number(tokens[++i]);
        break;
      case "nodes":
        nodes = Number(tokens[++i]);
        break;
      case "nps":
        nps = Number(tokens[++i]);
        break;
      case "score": {
        const kind = tokens[++i];
        const value = Number(tokens[++i]);
        if (!Number.isFinite(value)) return null;
        if (kind === "cp") score = { cp: value, mate: null };
        else if (kind === "mate") score = { cp: null, mate: value };
        break;
      }
      case "pv":
        pv = tokens.slice(i + 1).filter(Boolean);
        i = tokens.length;
        break;
    }
  }

  if (depth === null || !Number.isFinite(depth) || !score || !pv?.length) return null;
  return { depth, score, pv, nodes, nps };
}

function fenTurn(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

// Runs stockfish.js (WASM) in a Web Worker and analyses `fen` to a fixed depth.
//
// The worker is created on the first `enabled` turn and reused for every later
// position — booting the engine costs far more than a search. Position changes
// are debounced.
//
// Only ever one search runs at a time. Sending `position`/`go` while a search is
// still live wedges the engine — it stops answering `isready` and never speaks
// again. `readyok` is NOT a safe barrier for this: UCI requires `isready` to be
// answered even mid-search. The only signal that a search has really ended is
// its `bestmove`, so switching positions sends `stop` and waits for that before
// starting the next one.
//
// Stale output needs no barrier: every evaluation is tagged with the FEN it was
// computed for, and results for anything but the position on screen are dropped
// on the way out.
export function useStockfish({ fen, enabled, depth = ANALYSIS_DEPTH, debounceMs = 250 }: Options) {
  const [status, setStatus] = useState<EngineStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [searching, setSearching] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const handshakeDoneRef = useRef(false);
  // Position we want analysed — updated immediately, searched once the engine
  // is free.
  const targetRef = useRef<string>(fen);
  // Position the engine is searching right now; non-null means a search is live
  // and no `position`/`go` may be sent until its `bestmove` arrives.
  const searchingFenRef = useRef<string | null>(null);
  // Set once we have asked the live search to stop, so we ask only once.
  const stopSentRef = useRef(false);
  // "<fen>@<depth>" that already ran to completion, so we do not re-search it.
  const completedRef = useRef<string | null>(null);
  // Read through refs so the long-lived worker.onmessage closure always sees
  // current values without having to be rebuilt.
  const depthRef = useRef(depth);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    depthRef.current = depth;
    enabledRef.current = enabled;
  }, [depth, enabled]);

  const send = useCallback((cmd: string) => {
    workerRef.current?.postMessage(cmd);
  }, []);

  // Start searching the current target. Only ever called when the engine is
  // idle — i.e. from the handshake, or from a `bestmove`.
  const beginSearch = useCallback(() => {
    const target = targetRef.current;
    if (!workerRef.current || !handshakeDoneRef.current || !target) return;
    if (!enabledRef.current) return;
    if (completedRef.current === `${target}@${depthRef.current}`) return;
    searchingFenRef.current = target;
    stopSentRef.current = false;
    setSearching(true);
    send(`position fen ${target}`);
    send(`go depth ${depthRef.current}`);
  }, [send]);

  // Ask for the current target to be analysed. If a search is already live we
  // only send `stop`; the `bestmove` handler picks the new target up from there.
  const requestSearch = useCallback(() => {
    if (!workerRef.current || !handshakeDoneRef.current) return;
    if (searchingFenRef.current !== null) {
      if (!stopSentRef.current) {
        stopSentRef.current = true;
        send("stop");
      }
      return;
    }
    beginSearch();
  }, [send, beginSearch]);

  // ── Engine lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || workerRef.current) return;

    let worker: Worker;
    try {
      worker = new Worker(ENGINE_URL);
    } catch {
      // A worker that cannot even be constructed (no Worker support, blocked by
      // CSP) has no onerror to report through, so this one failure has to be
      // surfaced from the effect body itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      setError("Could not start the engine worker.");
      return;
    }
    workerRef.current = worker;
    handshakeDoneRef.current = false;
    stopSentRef.current = false;
    completedRef.current = null;
    searchingFenRef.current = null;
    setStatus("loading");
    setError(null);

    worker.onmessage = (event: MessageEvent) => {
      const line = typeof event.data === "string" ? event.data : String(event.data ?? "");

      if (line.startsWith("uciok")) {
        send("isready");
        return;
      }

      // Only ever used to close the initial handshake — never as a search
      // barrier, since the engine answers it mid-search too.
      if (line.startsWith("readyok")) {
        if (!handshakeDoneRef.current) {
          handshakeDoneRef.current = true;
          setStatus("ready");
          beginSearch();
        }
        return;
      }

      if (line.startsWith("info ")) {
        const searched = searchingFenRef.current;
        if (!searched) return;
        const info = parseInfo(line);
        if (!info) return;
        setAnalysis({
          fen: searched,
          depth: info.depth,
          score: toWhitePerspective(info.score, fenTurn(searched)),
          bestMove: info.pv[0] ?? null,
          pv: info.pv,
          nodes: info.nodes,
          nps: info.nps,
          complete: false,
        });
        return;
      }

      // The search is over and the engine is idle again — the one moment it is
      // safe to start the next one.
      if (line.startsWith("bestmove")) {
        const searched = searchingFenRef.current;
        const aborted = stopSentRef.current;
        searchingFenRef.current = null;
        stopSentRef.current = false;

        if (searched && !aborted) {
          completedRef.current = `${searched}@${depthRef.current}`;
          const best = line.split(/\s+/)[1];
          setAnalysis((prev) => {
            if (!prev || prev.fen !== searched) return prev;
            return {
              ...prev,
              bestMove: best && best !== "(none)" ? best : prev.bestMove,
              complete: true,
            };
          });
        }

        // Whatever we were told to analyse in the meantime starts now. Keyed on
        // "not yet completed" rather than "target changed", so a search that was
        // aborted and still wants the same position does get restarted.
        const target = targetRef.current;
        const pending = target && completedRef.current !== `${target}@${depthRef.current}`;
        if (enabledRef.current && pending) beginSearch();
        else setSearching(false);
      }
    };

    worker.onerror = () => {
      setStatus("error");
      setError("The Stockfish engine failed to load.");
      setSearching(false);
    };

    send("uci");
  }, [enabled, beginSearch, send]);

  // Tear the worker down when the editor unmounts.
  useEffect(() => {
    return () => {
      const worker = workerRef.current;
      workerRef.current = null;
      if (!worker) return;
      try {
        worker.postMessage("quit");
      } catch {}
      worker.terminate();
    };
  }, []);

  // ── Position changes, debounced ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    targetRef.current = fen;
    // Nothing to do when this exact position already ran to this depth.
    if (completedRef.current === `${fen}@${depth}` && searchingFenRef.current === null) return;
    const timer = setTimeout(requestSearch, debounceMs);
    return () => clearTimeout(timer);
  }, [fen, depth, enabled, debounceMs, requestSearch]);

  // ── Panel switched off: stop the search, keep the loaded engine ───────────
  useEffect(() => {
    if (enabled || !workerRef.current) return;
    completedRef.current = null;
    // Leave searchingFenRef alone: the search is still live until its bestmove
    // lands, and clearing it here would let the next search start on top of it.
    if (searchingFenRef.current !== null && !stopSentRef.current) {
      stopSentRef.current = true;
      send("stop");
    }
  }, [enabled, send]);

  return {
    status,
    error,
    // Null until the engine has said something about the position on screen.
    // The last evaluation survives a toggle-off, so flipping the panel back on
    // for the same position shows it instantly while the re-search runs.
    analysis: enabled && analysis?.fen === fen ? analysis : null,
    searching: enabled && searching,
  };
}
