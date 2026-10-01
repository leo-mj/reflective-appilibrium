/**
 * @fileoverview Log overlay for a graph being played: the History tab's, over
 * the process's own log, and the Graph tab's while the Simulate tab plays a
 * result, over one entry per simulation step (`stepLog` in
 * utils/simulationDiff.js).
 * @module components/history/LogOverlay
 */

import { C } from "../../constants/colors.js";

/**
 * Absolutely-positioned overlay showing all log entries up to `snappedRound`.
 * Future entries are hidden (opacity 0, no pointer events) and fade in as
 * playback advances. Auto-scrolls the current entry into view via `currentLogRef`.
 *
 * @param {Object}      props
 * @param {Array}       props.sortedLog     - Log entries sorted ascending by round.
 * @param {number}      props.snappedRound
 * @param {React.Ref}   props.logRef        - Ref on the scrollable container.
 * @param {React.Ref}   props.currentLogRef - Ref on the current-round entry.
 */
export function LogOverlay({ sortedLog, snappedRound, logRef, currentLogRef }) {
  if (snappedRound === 0 || sortedLog.length === 0) return null;
  return (
    <div
      ref={logRef}
      className="history-log"
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        width: 260,
        maxHeight: 130,
        overflowY: "auto",
        background: `${C.panel}cc`,
        backdropFilter: "blur(4px)",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {sortedLog.map((entry, i) => {
        const isCurrent = entry.round === snappedRound;
        const isFuture = entry.round > snappedRound;
        return (
          <div
            // By position, not step: rejecting suggestions logs an entry
            // without taking a step, so two entries can share one.
            key={i}
            // The first of the step's entries is the one scrolled to.
            ref={isCurrent && sortedLog[i - 1]?.round !== entry.round ? currentLogRef : null}
            style={{
              flexShrink: 0,
              fontSize: 11,
              lineHeight: 1.6,
              padding: "4px 6px",
              borderRadius: 5,
              background: isCurrent ? `${C.supports}22` : "transparent",
              border: isCurrent
                ? `1px solid ${C.supports}55`
                : "1px solid transparent",
              color: isCurrent ? C.text : C.dim,
              opacity: isFuture ? 0 : 1,
              transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
              pointerEvents: isFuture ? "none" : "auto",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                color: isCurrent ? C.supports : C.dim,
              }}
            >
              Step {entry.round}:
            </span>{" "}
            {entry.changes}
          </div>
        );
      })}
    </div>
  );
}
