/**
 * @fileoverview Tracks which text-panel section is currently in the viewport.
 * @module hooks/useActiveSection
 */

import { useState, useEffect } from "react";

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

/**
 * Uses IntersectionObserver to determine which section heading is nearest
 * the top of the scrollable container.
 *
 * @param {Object<string, React.RefObject>} sectionRefs - Map of key → ref for each section heading.
 * @param {React.RefObject} scrollRef - Ref on the scrollable container element.
 * @param {Array} deps - Re-run the observer when any of these change.
 * @returns {string|null} The key of the currently active section.
 */
export function useActiveSection(sectionRefs, scrollRef, deps) {
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const intersecting = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = SECTION_KEYS.find(
            (k) => sectionRefs[k]?.current === entry.target,
          );
          if (!key) return;
          if (entry.isIntersecting) intersecting.add(key);
          else intersecting.delete(key);
        });
        const first = SECTION_KEYS.find((k) => intersecting.has(k));
        if (first) setActiveSection(first);
      },
      { root: container, rootMargin: "-10px 0px -80% 0px", threshold: 0 },
    );
    let firstKey = null;
    SECTION_KEYS.forEach((k) => {
      const el = sectionRefs[k]?.current;
      if (el) {
        observer.observe(el);
        if (!firstKey) firstKey = k;
      }
    });
    if (firstKey) requestAnimationFrame(() => setActiveSection(firstKey));
    return () => observer.disconnect();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return activeSection;
}
