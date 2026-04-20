/**
 * @fileoverview Tutorial overlay — renders explanation bubbles anchored to
 * elements that carry a `data-tutorial="<id>"` attribute.
 *
 * Bubbles are `position:fixed` and go through two placement steps:
 *   1. Initial position: below (or above) the target element, staggered by `row`.
 *   2. Collision resolution: overlapping bubbles are pushed downward until clear.
 *
 * Click a bubble to bring it to the foreground as a fallback for any cases
 * where pushed bubbles still visually stack.
 * @module components/TutorialOverlay
 */

import { useEffect, useState } from "react";
import { C } from "../constants/colors.js";

const BUBBLE_W = 155;
const BUBBLE_H = 64; // generous estimate; actual height varies with text length
const ROW_GAP = 64;
const GAP = 10;
const PUSH_GAP = 5; // minimum vertical gap enforced by collision resolution

const ANNOTATIONS = {
  // ── Meta-tabs ──────────────────────────────────────────────────────────────
  "meta-analyze": {
    text: "View your RE state — switch between graph, text, coherence and history.",
    row: 0,
  },
  "meta-assist": {
    text: "AI-guided mode — elicit judgments, suggest principles and relations. Try out the Workflow!",
    row: 1,
  },
  // ── Analyze sub-tabs ───────────────────────────────────────────────────────
  "tab-graph": {
    text: "Force-directed graph. Click a node to select; Ctrl+click to start a relation.",
    row: 2,
  },
  "tab-history": {
    text: "Replay your RE process round by round using the history slider.",
    row: 0,
  },
  "tab-clusters": {
    text: "Coherence clusters — the largest possible groups of connected elements with no conflicts.",
    row: 1,
  },
  "tab-matrix": {
    text: "LLM-based relation matrix between every pair of elements.",
    row: 2,
  },
  // ── Assist sub-tabs ────────────────────────────────────────────────────────
  "tab-elicitJudgments": {
    text: "AI helps you surface and refine your moral judgments.",
    row: 2,
  },
  "tab-suggestPrinciples": {
    text: "AI proposes general principles that systematize your judgments.",
    row: 1,
  },
  "tab-suggestRelations": {
    text: "AI suggests missing relations between existing elements.",
    row: 0,
  },
  // ── Right-side controls ────────────────────────────────────────────────────
  "toggle-withdrawn": {
    text: "Show or hide withdrawn elements in the graph and text panel.",
    row: 0,
  },
  "btn-undo": {
    text: "Undo the last change. Keyboard shortcut: Ctrl+Z.",
    row: 1,
  },
  "btn-file": {
    text: "Import a saved JSON file, or export the current RE state as Markdown.",
    row: 2,
  },
  "btn-llm": {
    text: "Configure your LLM provider, model name, and API key.",
    row: 0,
  },
  "btn-home": {
    text: "Return to the home screen. Unsaved changes will be lost.",
    row: 1,
  },
};

/** Step 1 — preferred position: below (or above) the target element. */
function initialPlacement(rect, row) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.bottom + GAP + row * ROW_GAP;
  if (top + BUBBLE_H > vh - 8) {
    top = rect.top - BUBBLE_H - GAP - row * ROW_GAP;
  }

  let left = rect.left + rect.width / 2 - BUBBLE_W / 2;
  left = Math.max(8, Math.min(vw - BUBBLE_W - 8, left));

  return { top, left };
}

/**
 * Step 2 — push overlapping bubbles downward until none overlap.
 * Iterates up to MAX_ITER times; in practice one or two passes suffice.
 */
function resolveOverlaps(placements) {
  const items = placements.map((p) => ({ ...p }));
  const vh = window.innerHeight;
  const MAX_ITER = 20;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Process top-to-bottom so earlier items pin later ones down
    items.sort((a, b) => a.top - b.top || a.left - b.left);
    let moved = false;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const xOverlap =
          Math.min(a.left + BUBBLE_W, b.left + BUBBLE_W) -
          Math.max(a.left, b.left);
        const yOverlap =
          Math.min(a.top + BUBBLE_H, b.top + BUBBLE_H) - Math.max(a.top, b.top);
        if (xOverlap > 0 && yOverlap > 0) {
          b.top = a.top + BUBBLE_H + PUSH_GAP;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Clamp back inside viewport after pushing
  items.forEach((p) => {
    p.top = Math.max(8, Math.min(vh - BUBBLE_H - 8, p.top));
  });

  return items;
}

function getMeasurements() {
  const result = [];
  Object.entries(ANNOTATIONS).forEach(([id, cfg]) => {
    const el = document.querySelector(`[data-tutorial="${id}"]`);
    if (!el) return;
    result.push({ id, cfg, rect: el.getBoundingClientRect() });
  });
  return result;
}

export function TutorialOverlay({ active }) {
  const [items, setItems] = useState([]);
  const [topId, setTopId] = useState(null);

  useEffect(() => {
    if (!active) return;
    let raf = requestAnimationFrame(() => setItems(getMeasurements()));
    const onUpdate = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setItems(getMeasurements()));
    };
    const mo = new MutationObserver(onUpdate);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", onUpdate);
    window.addEventListener("scroll", onUpdate, true);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("scroll", onUpdate, true);
    };
  }, [active]);

  if (!active || items.length === 0) return null;

  // Compute initial positions, then resolve collisions
  const withPositions = items.map(({ id, cfg, rect }) => ({
    id,
    cfg,
    rect,
    ...initialPlacement(rect, cfg.row),
  }));
  const placed = resolveOverlaps(withPositions);

  return (
    <>
      {/* Subtle dim */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 899,
          pointerEvents: "none",
        }}
      />

      {/* Connector lines */}
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 900,
          overflow: "visible",
        }}
      >
        {placed.map(({ id, rect, top, left }) => {
          const bubbleCx = left + BUBBLE_W / 2;
          const belowElement = top > rect.bottom;
          return (
            <g key={id}>
              <line
                x1={bubbleCx}
                y1={belowElement ? top : top + BUBBLE_H}
                x2={rect.left + rect.width / 2}
                y2={belowElement ? rect.bottom : rect.top}
                stroke={C.supports}
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
              <circle
                cx={rect.left + rect.width / 2}
                cy={belowElement ? rect.bottom : rect.top}
                r="3"
                fill={C.supports}
                fillOpacity="0.8"
              />
            </g>
          );
        })}
      </svg>

      {/* Bubbles — click to bring to foreground */}
      {placed.map(({ id, cfg, top, left }) => (
        <div
          key={id}
          onClick={() => setTopId(id)}
          style={{
            position: "fixed",
            top,
            left,
            width: BUBBLE_W,
            background: "#0a1a30",
            border: `1px solid ${id === topId ? C.text : C.supports}`,
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 11,
            color: C.text,
            lineHeight: 1.55,
            boxShadow:
              id === topId
                ? "0 4px 20px rgba(0,0,0,0.9)"
                : "0 2px 12px rgba(0,0,0,0.65)",
            zIndex: id === topId ? 910 : 901,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {cfg.text}
        </div>
      ))}
    </>
  );
}
