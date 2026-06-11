/**
 * @fileoverview Step-by-step guided tour for the main interface.
 *
 * Each step optionally targets a `data-tutorial="<id>"` element, which gets a
 * highlight ring. A card with title, description, and Prev/Next navigation
 * floats near the target (or centers on screen for untargeted steps).
 *
 * Steps that carry a `tab` value call `onSetTab` when entered so the right
 * sub-tab buttons are visible before the element is measured.
 * @module components/TutorialStepper
 */

import { useEffect, useState, useCallback } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";

const CARD_W = 280;
const RING_PAD = 5;
const GAP = 14;

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Reflective APPilibrium",
    text: "This tour walks you through the main sections of the interface. \n Warning: Using the appilibrium does not guarantee finding moral truth!",
    target: null,
    tab: "graph",
  },
  {
    id: "meta-analyze",
    title: "Analyze your RE state",
    text: "The Analyze section shows your current position. \n Switch between graph, history, and clusters.",
    target: "meta-analyze",
    tab: "graph",
  },
  {
    id: "tab-graph",
    title: "Graph view",
    text: "A directed graph of all your elements. \n Click a node to select it; hold Ctrl and click a second node to create a relation between them.",
    target: "tab-graph",
    tab: "graph",
  },
  {
    id: "tab-history",
    title: "History",
    text: "Replay your RE process round by round. \n Drag the slider or press Play to animate each change and see how your position evolved.",
    target: "tab-history",
    tab: "history",
  },
  {
    id: "tab-clusters",
    title: "Coherence clusters",
    text: "Here you find the largest sets of currently accepted connected elements with no internal conflicts.",
    target: "tab-clusters",
    tab: "clusters",
  },
  ...(LLM_ENABLED
    ? [
        {
          id: "tab-matrix",
          title: "Relation matrix",
          text: "See the relation type between every pair of elements at a glance — a quick overview of the full argument structure.",
          target: "tab-matrix",
          tab: "matrix",
        },
      ]
    : []),
  {
    id: "meta-assist",
    title: "AI-guided assistance",
    text: "The Assist tab drives the iterative RE process. \nCycle through Judgments → Principles → Arguments repeatedly — each pass lets you refine your position until it is coherent.",
    target: "meta-assist",
    tab: "elicitJudgments",
  },
  {
    id: "tab-elicit",
    title: "1 — Elicit Judgments",
    text: "Start here. Articulate your initial moral judgments on the topic.\n If you use the LLM feature, the LLM will suggest thought-experiments and questions to prompt your judgments.",
    target: "tab-elicitJudgments",
    tab: "elicitJudgments",
  },
  {
    id: "tab-principles",
    title: "2 — Suggest Principles",
    text: "With judgments in place, find general principles that systematize them.\n The LLM feature can help suggest candidate principles which you can accept, reject, or modify.",
    target: "tab-suggestPrinciples",
    tab: "elicitJudgments",
  },
  {
    id: "tab-arguments",
    title: "3 — Detect Arguments",
    text: "Find valid argument structures among your elements.\n New arguments may reveal missing premises or expose tensions. \n The LLM feature can help you identify them.",
    target: "tab-detectArguments",
    tab: "elicitJudgments",
  },
  {
    id: "btn-workflow",
    title: "Start Workflow",
    text: "Runs the full Judgments → Principles → Arguments cycle automatically and repeatedly, round by round.",
    target: "btn-workflow",
    tab: "elicitJudgments",
  },
  {
    id: "btn-undo",
    title: "Undo",
    text: "Undo the last change at any time with this button or Ctrl+Z. Changes are grouped by round.",
    target: "btn-undo",
    tab: null,
  },
  {
    id: "done",
    title: "You're all set",
    text: "Press ? at any time to replay this tour. \n You can also hover over a button or tab to get some information on its function.",
    target: null,
    tab: null,
  },
];

export function TutorialStepper({ active, onClose, onSetTab }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);

  const step = STEPS[stepIdx];

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${step.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useEffect(() => {
    if (!active) return;
    if (step.tab) onSetTab(step.tab);
    // Two RAF frames: first lets the tab re-render, second measures final layout.
    const outer = requestAnimationFrame(() => {
      const inner = requestAnimationFrame(measure);
      return inner;
    });
    return () => cancelAnimationFrame(outer);
  }, [active, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, measure]);

  const handleClose = () => {
    setStepIdx(0);
    onClose();
  };

  const prev = () => setStepIdx((i) => Math.max(0, i - 1));
  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else handleClose();
  };

  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  // Position the card near the target or centered
  let cardTop, cardLeft;
  if (rect) {
    const cardH = 220;
    const spaceBelow = vh - rect.bottom - GAP;
    cardTop = spaceBelow >= cardH ? rect.bottom + GAP : rect.top - cardH - GAP;
    cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
    cardLeft = Math.max(8, Math.min(vw - CARD_W - 8, cardLeft));
    cardTop = Math.max(8, Math.min(vh - cardH - 8, cardTop));
  } else {
    cardTop = vh / 2 - 110;
    cardLeft = vw / 2 - CARD_W / 2;
  }

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 910,
        }}
      />

      {/* Highlight ring */}
      {rect && (
        <div
          style={{
            position: "fixed",
            top: rect.top - RING_PAD,
            left: rect.left - RING_PAD,
            width: rect.width + RING_PAD * 2,
            height: rect.height + RING_PAD * 2,
            borderRadius: 7,
            boxShadow: `0 0 0 2px ${C.supports}, 0 0 0 2000px rgba(0,0,0,0.45)`,
            zIndex: 915,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: cardTop,
          left: cardLeft,
          width: CARD_W,
          background: C.panel,
          border: `1px solid ${C.supports}`,
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
          zIndex: 920,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: "bold", color: C.text }}>
            {step.title}
          </div>
          <div style={{ fontSize: 10, color: C.dim }}>
            {stepIdx + 1} / {STEPS.length}
          </div>
        </div>

        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.65 }}>
          {step.text}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 2,
          }}
        >
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.dim,
              fontSize: 11,
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            {isLast ? "" : "Skip tour"}
          </button>

          <div style={{ display: "flex", gap: 6 }}>
            {!isFirst && (
              <button
                onClick={prev}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  color: C.text,
                  fontSize: 11,
                  cursor: "pointer",
                  padding: "4px 10px",
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={next}
              style={{
                background: C.supports,
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 11,
                fontWeight: "bold",
                cursor: "pointer",
                padding: "4px 14px",
              }}
            >
              {isLast ? "Finish" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
