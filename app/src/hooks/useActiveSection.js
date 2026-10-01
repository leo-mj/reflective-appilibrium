/**
 * @fileoverview Tracks which text-panel section is currently in the viewport.
 * @module hooks/useActiveSection
 */

import { useState, useEffect, useCallback, useRef } from "react";

const SECTION_KEYS = [
  "judgments",
  "principles",
  "theories",
  "arguments",
  "relations",
  "coherence",
  "clusters",
  "log",
];

/** How far below the container's top edge a section counts as "reached". */
const THRESHOLD_PX = 12;

/**
 * Reports which section the reader is currently inside.
 *
 * Measures on demand rather than through an IntersectionObserver. Sections come
 * and go — the arguments section exists only while all relations are shown, and
 * the whole listing is replaced when an element is selected — and an observer
 * has to be told about each one, which means keeping a dependency list in step
 * with every condition that governs rendering. It was not in step: a section
 * mounted later was never observed, and because the old code only ever *set*
 * the active section and never cleared it, the nav bar went on pointing at
 * whichever section it had last managed to see.
 *
 * Reading the refs at measure time leaves no such set to maintain: whatever is
 * mounted right now is what gets measured.
 *
 * @param {Object<string, React.RefObject>} sectionRefs - Map of key → ref on each section wrapper.
 * @param {React.RefObject} scrollRef - Ref on the scrollable container element.
 * @returns {string|null} The key of the section currently under the top edge.
 */
export function useActiveSection(sectionRefs, scrollRef) {
  const [activeSection, setActiveSection] = useState(null);
  // The last value measured, so an unchanged one sets no state at all.
  const measured = useRef(null);

  const measure = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const line = container.getBoundingClientRect().top + THRESHOLD_PX;
    // The last section whose top edge has passed the line is the one being
    // read; anything below it has not been reached yet.
    let reached = null;
    let firstMounted = null;
    for (const key of SECTION_KEYS) {
      const el = sectionRefs[key]?.current;
      if (!el) continue;
      if (!firstMounted) firstMounted = key;
      if (el.getBoundingClientRect().top <= line) reached = key;
    }
    // Above the first section — the round banner and the add bar sit there —
    // the reader is still on their way into it.
    const next = reached ?? firstMounted;
    if (next === measured.current) return;
    measured.current = next;
    setActiveSection(next);
  }, [sectionRefs, scrollRef]);

  // After every render, because expanding a section moves every section below
  // it and no scroll event is fired for that.
  //
  // set-state-in-effect guards against effects that drive renders in a loop,
  // and this one did drive one. React does not reliably drop an update that
  // leaves the value as it was: it may render again first to find out. While
  // the graph layout settles the text panel renders on every tick, and each of
  // those renders queued one more here, until dev mode stopped it with
  // "Maximum update depth exceeded". So `measure` sets state only when the
  // section it measured is not the one it measured last.
  useEffect(measure);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // Coalesce the burst a smooth scroll produces into one measurement per
    // frame; each one reads layout for every mounted section.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      container.removeEventListener("scroll", onScroll);
    };
  }, [measure, scrollRef]);

  return activeSection;
}
