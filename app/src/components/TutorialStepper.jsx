/**
 * @fileoverview The guided tour a phone gets: a stack of cards, one control at
 * a time.
 *
 * Wide screens run {@link module:components/tour/GuidedTour} instead — a page
 * the reader scrolls, which explains the method and walks the demo graph before
 * it ever mentions a button. That tour is no use here: it needs a column beside
 * the graph, and most of what it points at lives in a tab bar this width has no
 * room for. At this width the app is the graph plus the ☰ menu, so the tour is
 * the graph, then the menu, opened and walked section by section.
 *
 * Each step optionally targets a `data-tutorial="<id>"` element, which gets a
 * highlight ring. A card with title, description, and Prev/Next navigation
 * floats near the target (or centers on screen for untargeted steps).
 *
 * Steps that carry a `tab` value call `onSetTab` when entered so the right
 * sub-tab buttons are visible before the element is measured; steps carrying
 * `menu: true` open the ☰ menu before they are measured.
 * @module components/TutorialStepper
 */

import { useEffect, useState, useCallback } from "react";
import { C } from "../constants/colors.js";
import { TOUR_Z } from "./tour/tourZ.js";

const CARD_W = 280;
const RING_PAD = 5;
const GAP = 14;

// Re-exported: AppHeaderNarrow lifts its ☰ menu into this stack while the tour
// walks it, and would otherwise have to guess the layer.
export { TOUR_Z };

/**
 * @param {string} cycle - The RE cycle, named for whichever relation modes are on.
 */
function buildSteps(cycle) {
  return [
    {
      id: "welcome",
      title: "Welcome to Reflective APPilibrium",
      text: "This short tour walks you through the interface.\nWarning: using the appilibrium does not guarantee finding moral truth!",
      target: null,
      tab: "graph",
    },
    {
      id: "graph",
      title: "Your position, as a graph",
      text: "Behind this card is a directed graph of everything in your position — your judgments and principles, and the relations between them.\nTap a node to select it and highlight its neighbours. Tap a relation arrow to highlight the whole argument it belongs to.\nDrag to move around; use + and − to zoom.",
      target: null,
      tab: "graph",
    },
    {
      id: "btn-menu",
      title: "Everything else is in here",
      text: "There is no room for a tab bar on a screen this narrow, so the rest of the app lives behind ☰.\nLet's open it and go through it.",
      target: "btn-menu",
      tab: "graph",
    },
    {
      id: "menu-assist",
      title: "Assist — the RE cycle",
      text: `This is the heart of the process. Work through ${cycle}, then round again — each pass lets you refine your position until it holds together.\nStart Workflow runs the whole cycle for you, round by round.`,
      target: "menu-assist",
      menu: true,
      tab: "graph",
    },
    {
      id: "menu-analyze",
      title: "Analyze — see where you stand",
      text: "Text lists your position in full, with everything you can edit.\nGraph draws it. History replays the process round by round. Clusters shows the largest sets of your accepted elements that hold no conflict.",
      target: "menu-analyze",
      menu: true,
      tab: "graph",
    },
    {
      id: "menu-settings",
      title: "Settings",
      text: "Four blocks, in order of what they reach: what counts as a relation, which model assists you, how the app looks, and two details of the text panel.\nEach switch shows whether that setting is on.",
      target: "menu-settings",
      menu: true,
      tab: "graph",
    },
    {
      id: "menu-files",
      title: "Import and export",
      text: "Export writes the whole process out as a Markdown file. Import reads one back — your own, or one someone sent you.",
      target: "menu-files",
      menu: true,
      tab: "graph",
    },
    {
      id: "menu-undo",
      title: "Undo",
      text: "Undo the last change at any time. Changes are grouped by round, so this steps back through the process rather than through single keystrokes.",
      target: "menu-undo",
      menu: true,
      tab: "graph",
    },
    {
      id: "done",
      title: "You're all set",
      text: "Open ☰ → Guided tour at any time to see this again.\nLong-press a button to find out what it does.",
      target: null,
      tab: "graph",
    },
  ];
}

/**
 * @param {function} [props.onSetMenuOpen] - Opens or closes the narrow header's
 *   ☰ menu. The narrow tour walks the menu's own entries, so it has to be open
 *   — and in the DOM — before those steps can be measured.
 */
export function TutorialStepper({
  active,
  onClose,
  onSetTab,
  onSetMenuOpen,
  hideNonEntailsRels,
}) {
  const steps = buildSteps(
    hideNonEntailsRels
      ? "Judgments → Principles → Arguments"
      : "Judgments → Principles → Relations → Arguments",
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[stepIdx];

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    // A long menu on a short phone scrolls; a target below the fold would be
    // ringed off-screen. Bring it up first, then read where it landed.
    el.scrollIntoView?.({ block: "nearest" });
    setRect(el.getBoundingClientRect());
  }, [step.target]);

  useEffect(() => {
    if (!active) return;
    if (step.tab) onSetTab(step.tab);
    onSetMenuOpen?.(!!step.menu);
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
    // The tour opened the menu; leaving it hanging open would be a surprise.
    onSetMenuOpen?.(false);
    onClose();
  };

  const prev = () => setStepIdx((i) => Math.max(0, i - 1));
  const next = () => {
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
    else handleClose();
  };

  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  // A phone can be narrower than the card was drawn for, in which case a fixed
  // 280 hangs off the right edge whatever the clamp below does.
  const cardW = Math.min(CARD_W, vw - 16);

  // Position the card near the target or centered
  let cardTop, cardLeft;
  if (rect) {
    const cardH = 220;
    const spaceBelow = vh - rect.bottom - GAP;
    cardTop = spaceBelow >= cardH ? rect.bottom + GAP : rect.top - cardH - GAP;
    cardLeft = rect.left + rect.width / 2 - cardW / 2;
    cardLeft = Math.max(8, Math.min(vw - cardW - 8, cardLeft));
    cardTop = Math.max(8, Math.min(vh - cardH - 8, cardTop));
  } else {
    cardTop = vh / 2 - 110;
    cardLeft = vw / 2 - cardW / 2;
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
          zIndex: TOUR_Z.dim,
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
            // Above the ☰ menu, which lifts itself over the dim while the tour
            // walks it. The shadow only paints outside the ring, so the entry
            // being described stays bright and the rest of the menu dims.
            zIndex: TOUR_Z.ring,
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
          width: cardW,
          // Steps that name a route through the ☰ menu run longer than the
          // height the placement above assumes; scroll rather than spill off.
          maxHeight: vh - 16,
          overflowY: "auto",
          boxSizing: "border-box",
          background: C.panel,
          border: `1px solid ${C.supports}`,
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
          zIndex: TOUR_Z.card,
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
            {stepIdx + 1} / {steps.length}
          </div>
        </div>

        {/* The step texts break their lines with \n, which HTML would otherwise
            collapse into spaces and run every sentence together. */}
        <div
          style={{
            fontSize: 12,
            color: C.dim,
            lineHeight: 1.65,
            whiteSpace: "pre-line",
          }}
        >
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
                color: C.onFill,
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
