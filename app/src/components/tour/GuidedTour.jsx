/**
 * @fileoverview The guided tour: one page the visitor scrolls, beside the app
 * rather than over it.
 *
 * Scrolling it is what moves the tour on — whichever section is nearest the
 * reading line is the active one, and the app rearranges itself to show what
 * that section is talking about: the graph zooms to the elements named, selects
 * them, opens the tab under discussion, and rings a control when the section is
 * about one.
 *
 * Why a page rather than a stack of Next/Back cards: the opening chapters are
 * an explanation of a method, not a walk round a toolbar, and they read better
 * as continuous prose with the graph answering alongside. Back and Next remain
 * in the footer for anyone who would rather step than scroll.
 *
 * **Two layouts, one tour.** `column` runs down the left of a wide screen;
 * `sheet` runs along the bottom of a narrow one. The difference is where the
 * reader's own screen has room — beside the graph or under it — and nothing
 * else: the same script, the same scrolling, the same graph keeping up. A phone
 * used to get a stack of cards that walked the ☰ menu and never said what
 * reflective equilibrium was, which is the one thing a first-time visitor is
 * there to find out.
 *
 * The script lives in `tourSections.js`; this file only applies it. What it
 * draws is in the files beside it: `TourSection`, `TourControls` and
 * `Spotlight`, whose rings `useTourRing` measures.
 *
 * @module components/tour/GuidedTour
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "../../constants/colors.js";
import { BACKEND_ENABLED, LLM_ENABLED } from "../../config.js";
import { useHasLLMKey } from "../../utils/llmKey.js";
import {
  setStatementViewOn,
  statementViewOn,
} from "../../utils/statementViewSetting.js";
import { buildTourSections } from "./tourSections.js";
import { TOUR_Z, sheetHeight } from "./tourZ.js";
import { useTourWidth } from "./tourWidth.js";
import { applicableSections } from "./tourHelpers.js";
import { ColumnResizer, ProgressBar, SheetHandle } from "./TourControls.jsx";
import { TourSection } from "./TourSection.jsx";
import { Spotlight } from "./Spotlight.jsx";
import { useTourRing } from "./useTourRing.js";

/**
 * How far down the column the reading line sits, as a fraction of its height.
 * The active section is the last one whose top has crossed it, so this wants to
 * stay above the shortest section — set it too low and a short section is never
 * the active one, because its successor has already crossed the line too.
 */
const READING_LINE = 0.25;

/** Scroll events are ignored for this long after Back or Next scrolls for you. */
const PROGRAMMATIC_MS = 700;

/** Gap above a section scrolled to by Back or Next. */
const SCROLL_PAD = 12;

const navBtn = (enabled) => ({
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: enabled ? C.text : C.dim,
  fontSize: 12,
  padding: "6px 14px",
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.45,
});

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
 * @param {Function} props.onSetChrome    - `{ chrome, text, menu, addBar }` —
 *   what the app should have on screen for the section being read.
 * @param {Function} props.onFocusGraph   - Element IDs to frame, or null for all of them.
 * @param {"column"|"sheet"} [props.layout] - Where the reader's screen has room
 *   for it: a column beside the app, or a sheet under it.
 * @param {Function} [props.onExpandChange] - Sheet only. The app pads itself by
 *   the sheet's height, and works that height out from the same viewport, so
 *   only the expanded flag has to cross.
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
  layout = "column",
  onExpandChange,
}) {
  const sheet = layout === "sheet";
  // The column's width, which the reader may have dragged. Read from the shared
  // store rather than held here: the app pads itself by the same number, and a
  // tour wider than the room made for it covers what it is pointing at.
  const width = useTourWidth();
  // A backend build with no key yet serves the pre-set suggestions, so the
  // script has to know which of the two it is describing.
  const hasKey = useHasLLMKey();
  const sections = useMemo(
    () =>
      applicableSections(
        buildTourSections({
          isSample,
          hideNonEntailsRels,
          llmEnabled: LLM_ENABLED,
          hasKey,
          backendEnabled: BACKEND_ENABLED,
          topic: state.topic,
          narrow: sheet,
        }),
        state,
      ),
    // The script depends on the shape of the state, not on every edit to it:
    // rebuilding on each keystroke would reset nothing but would churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isSample,
      hideNonEntailsRels,
      hasKey,
      state.topic,
      state.elements.length,
      sheet,
    ],
  );

  const [idx, setIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const setSheetExpanded = useCallback(
    (value) => {
      setExpanded(value);
      onExpandChange?.(value);
    },
    [onExpandChange],
  );
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);
  const quietUntil = useRef(0);
  // Resizing across the wide/narrow line mid-tour rebuilds the script, and the
  // two are not the same length — the sheet carries a section introducing the
  // ☰ menu that the column has no use for. Left alone, an index taken from the
  // longer of the two lands past the end of the shorter and the tour vanishes.
  if (idx > sections.length - 1) setIdx(sections.length - 1);
  const section = sections[idx];

  // ── Scroll drives the active section ──────────────────────────────────────
  const measureActive = useCallback(() => {
    const root = scrollRef.current;
    // No layout yet (or none at all, under jsdom): every rect would read 0 and
    // the last section would win.
    if (!root || !root.clientHeight) return;
    if (Date.now() < quietUntil.current) return;
    const line =
      root.getBoundingClientRect().top + root.clientHeight * READING_LINE;
    let next = 0;
    sectionRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) next = i;
    });
    // Scrolled as far as it goes. The last section can be shorter than the
    // space below the reading line, in which case its top never reaches the
    // line and it could not be read at all.
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2)
      next = sectionRefs.current.length - 1;
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
  // The tour reads the graph as nodes — circles, rounded rectangles, diamonds —
  // and comes to the statement cards near its end, so it opens on the nodes and
  // hands the reader's own setting back as it closes, unless they switched the
  // cards on again while reading.
  const statementsBefore = useRef(false);
  useEffect(() => {
    if (!active) {
      if (wasActive.current && statementsBefore.current && !statementViewOn())
        setStatementViewOn(true);
      statementsBefore.current = false;
      wasActive.current = false;
      return;
    }
    // Reopening starts at the top. Rewinding on the way out instead would fire
    // the first section's effects on a tour that is closing, putting away the
    // chrome it had just restored; rewinding here means the section left over
    // from last time is never applied, because this pass returns before it.
    if (!wasActive.current) {
      wasActive.current = true;
      statementsBefore.current = statementViewOn();
      setStatementViewOn(false);
      if (idx !== 0) {
        // The rewind has to be this pass, for the reason above: done during
        // render it would not stop this effect applying the old section.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIdx(0);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        return;
      }
    }
    if (!section) return;
    if (section.tab) onSetTab(section.tab);
    onSetChrome({
      chrome: !!section.chrome,
      text: !!section.text,
      menu: section.menu ?? false,
      addBar: !!section.addBar,
    });

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

    if (section.focus)
      onFocusGraph(section.focus.length ? section.focus : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idx, section?.id]);

  // ── Ring whatever controls the section is about ───────────────────────────
  const rects = useTourRing({
    active,
    idx,
    target: section?.target,
    sheet,
    expanded,
    width,
    panelRef,
  });

  // ── How much of the bottom edge the sheet has taken ───────────────────────
  // On <html>, beside the theme attributes, because what needs it is a stylesheet
  // rather than a component: the ☰ menu bounds itself to the space left above
  // the sheet, and it is nowhere near this in the tree.
  useEffect(() => {
    if (!active || !sheet) return;
    const root = document.documentElement;
    root.style.setProperty(
      "--tour-sheet-h",
      `${sheetHeight(window.innerHeight, expanded)}px`,
    );
    return () => root.style.removeProperty("--tour-sheet-h");
  }, [active, sheet, expanded]);

  // ── Leaving ───────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    onSelectNode(() => null);
    onSetChrome({ chrome: true, text: true, menu: false, addBar: false });
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
    const root = scrollRef.current;
    const el = sectionRefs.current[clamped];
    // scrollIntoView would do this, but it scrolls the nearest scrollable
    // ancestor by its own reckoning and lands a section short or long. The
    // column's offsets are known exactly, so use them.
    if (root && el)
      root.scrollTo({ top: el.offsetTop - SCROLL_PAD, behavior: "smooth" });
  };

  if (!active || !section) return null;

  const elementById = new Map(state.elements.map((e) => [e.id, e]));
  const isLast = idx === sections.length - 1;
  // Read at render rather than held in state: the app around it re-renders on
  // every resize, and one arithmetic for the sheet's height means the padding
  // it asks the app for can never disagree with the space it takes.
  const sheetH = sheet ? sheetHeight(window.innerHeight, expanded) : 0;
  const panelBox = sheet
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        height: sheetH,
        borderTop: `1px solid ${C.border}`,
        borderRadius: "12px 12px 0 0",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.35)",
        transition: "height 0.3s ease",
      }
    : {
        top: 0,
        left: 0,
        bottom: 0,
        // The reader's, and shared with the app, which pads itself by it.
        width,
        borderRight: `1px solid ${C.border}`,
        boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
      };
  // The sheet is short, so its furniture is trimmed to leave the prose the room.
  const pad = sheet ? 16 : 24;
  // Which chapter the reader is in. The column shows it inline, where it stays
  // in view; in a sheet a few paragraphs tall it has long scrolled off, so that
  // layout pins it to the header instead of naming itself there.
  const chapter = sections
    .slice(0, idx + 1)
    .reduce((found, s) => s.chapter ?? found, null);

  return (
    <>
      {/* Only sections about a control raise the spotlight; the ones about the
          graph leave the app lit, because the graph is what they are pointing
          at — and so does any section whose reader has started using the app. */}
      {rects.length > 0 && <Spotlight rects={rects} />}

      <aside
        ref={panelRef}
        aria-label="Guided tour"
        style={{
          position: "fixed",
          background: C.panel,
          zIndex: TOUR_Z.card,
          display: "flex",
          flexDirection: "column",
          ...panelBox,
        }}
      >
        {sheet ? (
          <SheetHandle expanded={expanded} onToggle={setSheetExpanded} />
        ) : (
          <ColumnResizer width={width} />
        )}
        <div
          style={{
            padding: sheet ? `0 ${pad}px 8px` : "14px 24px 10px",
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
                fontSize: 12,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: C.dim,
              }}
            >
              {sheet ? (chapter ?? "Guided tour") : "Guided tour"}
            </span>
            <button
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "none",
                color: C.dim,
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Close tour
            </button>
          </div>
          <ProgressBar value={(idx + 1) / sections.length} />
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            // `position: relative` makes each section's offsetTop relative to
            // this box, which is what Back and Next scroll to. No scroll
            // snapping: with sections of wildly different heights it fought
            // both the reader and those scrolls, landing a section past the
            // one that was asked for.
            position: "relative",
            padding: `0 ${pad}px`,
          }}
        >
          {sections.map((s, i) => (
            <TourSection
              key={s.id}
              section={s}
              isActive={i === idx}
              isLast={i === sections.length - 1}
              sheet={sheet}
              elementById={elementById}
              relations={state.relations}
              sectionRef={(el) => {
                sectionRefs.current[i] = el;
              }}
            />
          ))}
          {/* Lets the last section climb to the reading line rather than
              stopping at the bottom edge. It cannot reach it on a tall screen,
              which is why `measureActive` also treats "scrolled to the end" as
              the last section. Measured against the box rather than the
              viewport in a sheet, where 40vh would be most of the sheet. */}
          <div style={{ height: sheet ? "40%" : "40vh" }} aria-hidden="true" />
        </div>

        <div
          style={{
            padding: `10px ${pad}px`,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: C.dim }}>
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
                color: C.onFill,
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
