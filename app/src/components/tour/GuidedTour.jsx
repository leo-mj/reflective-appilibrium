/**
 * @fileoverview The wide-screen guided tour: one page the visitor scrolls.
 *
 * The tour is a column down the left of the screen. Scrolling it is what moves
 * the tour on — whichever section is nearest the reading line is the active
 * one, and the app behind rearranges itself to show what that section is
 * talking about: the graph zooms to the elements named, selects them, opens the
 * tab under discussion, and rings a control when the section is about one.
 *
 * Why a page rather than a stack of Next/Back cards: the opening chapters are
 * an explanation of a method, not a walk round a toolbar, and they read better
 * as continuous prose with the graph answering alongside. Back and Next remain
 * in the footer for anyone who would rather step than scroll.
 *
 * The script lives in `tourSections.js`; this file only applies it.
 *
 * @module components/tour/GuidedTour
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "../../constants/colors.js";
import { LLM_ENABLED } from "../../config.js";
import { buildTourSections } from "./tourSections.js";
import { TOUR_Z } from "./tourZ.js";

/** Width of the tour column. The app is padded by this much while it is open. */
export const TOUR_W = 400;

const RING_PAD = 5;

/**
 * How far down the column the reading line sits, as a fraction of its height.
 * The active section is the last one whose top has crossed it, so this wants to
 * stay above the shortest section — set it too low and a short section is never
 * the active one, because its successor has already crossed the line too.
 */
const READING_LINE = 0.25;

/** Scroll events are ignored for this long after Back or Next scrolls for you. */
const PROGRAMMATIC_MS = 700;

const TYPE_COLOR = {
  judgment: C.judgment.high,
  principle: C.principle.high,
  theory: C.theory.high,
};
const TYPE_LABEL = {
  judgment: "Judgment",
  principle: "Principle",
  theory: "Background theory",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * An element as the tour quotes it: its own text, pulled from the live state
 * rather than copied into the script, so a section can never describe a node
 * the graph beside it no longer holds.
 */
function QuoteCard({ element }) {
  const color = TYPE_COLOR[element.type] ?? C.dim;
  const gone = element.status === "withdrawn" || element.status === "rejected";
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: C.bg,
        borderRadius: "0 6px 6px 0",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: "bold", color }}>
          {element.id}
        </span>
        <span style={{ fontSize: 10, color: C.dim }}>
          {TYPE_LABEL[element.type] ?? element.type}
          {gone ? ` · ${element.status}` : ""}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: C.text,
          textDecoration: gone ? "line-through" : "none",
        }}
      >
        {element.text}
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div
      style={{
        height: 3,
        background: C.border,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value * 100}%`,
          height: "100%",
          background: C.supports,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

const navBtn = (enabled) => ({
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: enabled ? C.text : C.dim,
  fontSize: 11,
  padding: "5px 12px",
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.45,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Drops any section whose elements or argument the state does not hold.
 *
 * The demo-graph chapter names elements by ID. Editing the sample fixture, or
 * running the tour over an imported process, should cost the tour that section
 * rather than leave it pointing at nothing.
 */
function applicableSections(sections, state) {
  const ids = new Set(state.elements.map((e) => e.id));
  const args = new Set(state.relations.map((r) => r.argumentId).filter(Boolean));
  return sections.filter((s) => {
    const named = [...(s.quote ?? []), ...(s.focus ?? []), s.select].filter(
      Boolean,
    );
    if (named.some((id) => !ids.has(id))) return false;
    return !s.argument || args.has(s.argument);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {boolean}  props.active
 * @param {Object}   props.state          - The live RE state; sections quote from it.
 * @param {boolean}  props.isSample       - Gates the chapter that walks the demo graph.
 * @param {boolean}  props.hideNonEntailsRels
 * @param {Function} props.onClose
 * @param {Function} props.onSetTab
 * @param {Function} props.onSelectNode   - Takes an updater, like the graph's own handler.
 * @param {Function} props.onSelectRel
 * @param {Function} props.onSetChrome    - `{ chrome, text }` — whether the app's tab
 *   bar and text panel belong on screen for the section being read.
 * @param {Function} props.onFocusGraph   - Element IDs to frame, or null for all of them.
 */
export function GuidedTour({
  active,
  state,
  isSample,
  hideNonEntailsRels,
  onClose,
  onSetTab,
  onSelectNode,
  onSelectRel,
  onSetChrome,
  onFocusGraph,
}) {
  const sections = useMemo(
    () =>
      applicableSections(
        buildTourSections({
          isSample,
          hideNonEntailsRels,
          llmEnabled: LLM_ENABLED,
          topic: state.topic,
        }),
        state,
      ),
    // The script depends on the shape of the state, not on every edit to it:
    // rebuilding on each keystroke would reset nothing but would churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSample, hideNonEntailsRels, state.topic, state.elements.length],
  );

  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);
  const quietUntil = useRef(0);
  const section = sections[idx];

  // ── Scroll drives the active section ──────────────────────────────────────
  const measureActive = useCallback(() => {
    const root = scrollRef.current;
    // No layout yet (or none at all, under jsdom): every rect would read 0 and
    // the last section would win.
    if (!root || !root.clientHeight) return;
    if (Date.now() < quietUntil.current) return;
    const line = root.getBoundingClientRect().top + root.clientHeight * READING_LINE;
    let next = 0;
    sectionRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) next = i;
    });
    setIdx((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!active || !root) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measureActive);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("scroll", onScroll);
    };
  }, [active, measureActive]);

  // ── The app follows the section being read ────────────────────────────────
  const wasActive = useRef(false);
  useEffect(() => {
    if (!active) {
      wasActive.current = false;
      return;
    }
    // Reopening starts at the top. Rewinding on the way out instead would fire
    // the first section's effects on a tour that is closing, putting away the
    // chrome it had just restored; rewinding here means the section left over
    // from last time is never applied, because this pass returns before it.
    if (!wasActive.current) {
      wasActive.current = true;
      if (idx !== 0) {
        setIdx(0);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        return;
      }
    }
    if (!section) return;
    if (section.tab) onSetTab(section.tab);
    onSetChrome({ chrome: !!section.chrome, text: !!section.text });

    if (section.argument) {
      const rel = state.relations.find(
        (r) => r.argumentId === section.argument,
      );
      onSelectRel(() => rel ?? null);
    } else if (section.select) {
      onSelectNode(() => section.select);
    } else {
      // Clearing the node selection clears the relation with it.
      onSelectNode(() => null);
    }

    if (section.focus) onFocusGraph(section.focus.length ? section.focus : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idx, section?.id]);

  // ── Ring whatever control the section is about ────────────────────────────
  const measureRing = useCallback(() => {
    if (!section?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${section.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [section?.target]);

  useEffect(() => {
    if (!active) return;
    // Two frames: the first lets the tab switch and the chrome above render,
    // the second measures where the target actually landed.
    const outer = requestAnimationFrame(() =>
      requestAnimationFrame(measureRing),
    );
    return () => cancelAnimationFrame(outer);
  }, [active, idx, measureRing]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measureRing);
    return () => window.removeEventListener("resize", measureRing);
  }, [active, measureRing]);

  // ── Leaving ───────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    onSelectNode(() => null);
    onSetChrome({ chrome: true, text: true });
    onFocusGraph(null);
    onClose();
  }, [onClose, onSelectNode, onSetChrome, onFocusGraph]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, handleClose]);

  const goTo = (target) => {
    const clamped = Math.max(0, Math.min(sections.length - 1, target));
    // The scroll this kicks off would otherwise be measured frame by frame,
    // firing every section it passes over on the way.
    quietUntil.current = Date.now() + PROGRAMMATIC_MS;
    setIdx(clamped);
    sectionRefs.current[clamped]?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  };

  if (!active || !section) return null;

  const elementById = new Map(state.elements.map((e) => [e.id, e]));
  const isLast = idx === sections.length - 1;

  return (
    <>
      {/* Spotlight. Only sections about a control dim the app; the ones about
          the graph leave it lit, because the graph is what they are pointing at. */}
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
            zIndex: TOUR_Z.ring,
            pointerEvents: "none",
          }}
        />
      )}

      <aside
        aria-label="Guided tour"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: TOUR_W,
          background: C.panel,
          borderRight: `1px solid ${C.border}`,
          boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
          zIndex: TOUR_Z.card,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 20px 10px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: C.dim,
              }}
            >
              Guided tour
            </span>
            <button
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "none",
                color: C.dim,
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Skip tour
            </button>
          </div>
          <ProgressBar value={(idx + 1) / sections.length} />
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            scrollSnapType: "y proximity",
            padding: "0 20px",
          }}
        >
          {sections.map((s, i) => {
            const isActive = i === idx;
            // The argument's own explanation, written when it was recorded —
            // a better gloss on why these premises give that conclusion than
            // anything the script could say about them from outside.
            const argRel = s.argument
              ? state.relations.find((r) => r.argumentId === s.argument)
              : null;
            return (
              <section
                key={s.id}
                ref={(el) => {
                  sectionRefs.current[i] = el;
                }}
                aria-labelledby={`tour-title-${s.id}`}
                aria-current={isActive ? "step" : undefined}
                style={{
                  scrollSnapAlign: "start",
                  scrollMarginTop: 16,
                  padding: "22px 0",
                  borderBottom:
                    i === sections.length - 1
                      ? "none"
                      : `1px solid ${C.border}`,
                  opacity: isActive ? 1 : 0.62,
                  transition: "opacity 0.35s ease",
                }}
              >
                {s.chapter && (
                  <h2
                    style={{
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: C.supports,
                      margin: "0 0 10px",
                    }}
                  >
                    {s.chapter}
                  </h2>
                )}
                <h3
                  id={`tour-title-${s.id}`}
                  style={{
                    fontSize: 14,
                    fontWeight: "bold",
                    color: C.text,
                    margin: "0 0 8px",
                  }}
                >
                  {s.title}
                </h3>
                {s.body.filter(Boolean).map((paragraph, p) => (
                  <p
                    key={p}
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.75,
                      color: C.dim,
                      margin: "0 0 10px",
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
                {s.quote?.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginTop: 12,
                    }}
                  >
                    {s.quote.map((id) => {
                      const element = elementById.get(id);
                      return element ? (
                        <QuoteCard key={id} element={element} />
                      ) : null;
                    })}
                  </div>
                )}
                {argRel?.explanation && (
                  <p
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.7,
                      color: C.dim,
                      fontStyle: "italic",
                      margin: "10px 0 0",
                    }}
                  >
                    {argRel.explanation}
                  </p>
                )}
              </section>
            );
          })}
          {/* Lets the last section reach the reading line. */}
          <div style={{ height: "45vh" }} aria-hidden="true" />
        </div>

        <div
          style={{
            padding: "10px 20px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: C.dim }}>
            {idx + 1} / {sections.length}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => goTo(idx - 1)}
              disabled={idx === 0}
              style={navBtn(idx > 0)}
            >
              ← Back
            </button>
            <button
              onClick={() => (isLast ? handleClose() : goTo(idx + 1))}
              style={{
                ...navBtn(true),
                background: C.supports,
                border: "none",
                color: "#fff",
                fontWeight: "bold",
              }}
            >
              {isLast ? "Finish" : "Next ↓"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
