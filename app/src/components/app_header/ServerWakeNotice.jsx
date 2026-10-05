/**
 * @fileoverview Says that the server is still starting, and how long it has been.
 *
 * A hosted backend that has scaled to zero takes a while to answer its first
 * request — about 25 seconds on Cloud Run before the server stopped loading
 * rethon itself, and its workers still have to load it. The start page sets
 * that going as it appears (utils/wakeBackend.js), so this only shows when
 * someone reaches the editor before it has finished: there the score badges
 * stay blank and a simulation waits, and without a word that would look like a
 * broken app rather than a busy one.
 *
 * Shown only once a wait has gone on for a moment, so a backend that is already
 * up never flashes it, and gone as soon as the workers are ready. It comes back
 * when a later request reaches no server — a hosted backend scales to zero
 * behind a page left open — since that starts the wake-up over. And it stays,
 * without a clock, if the server could not be reached at all: the health
 * check's retries outlast any start. The phase is
 * announced; the seconds are not, since a live region that changes every second
 * is read out every second.
 *
 * @module components/app_header/ServerWakeNotice
 */

import { useEffect, useState } from "react";
import { C } from "../../constants/colors.js";
import { useBackendWake } from "../../utils/wakeBackend.js";

/** A wait shorter than this is not worth a notice. */
const SHOW_AFTER_SECONDS = 2;

const MESSAGES = {
  starting: {
    title: "Starting the server.",
    detail:
      "After a quiet spell it switches itself off, and waking it can take up to about half a minute. AI suggestions, scores and simulations work once it is up; everything else works now.",
  },
  unavailable: {
    title: "The server could not be reached.",
    detail:
      "AI suggestions, scores and simulations are unavailable for now; everything else works, and your work is kept in this browser. Reload the page to try again.",
  },
  warming: {
    title: "Preparing scores and simulations.",
    detail:
      "The server is up and is loading rethon, the library that computes them; this can take up to about half a minute. AI suggestions already work.",
  },
};

export function ServerWakeNotice() {
  const { phase, since } = useBackendWake();
  const waiting = phase === "starting" || phase === "warming";
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while there is a wait. The first tick comes within a second,
  // which is also roughly when a wait becomes worth showing.
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  const unavailable = phase === "unavailable";
  if (!unavailable && (!waiting || since == null)) return null;
  const seconds = unavailable
    ? null
    : Math.max(0, Math.floor((now - since) / 1000));
  if (!unavailable && seconds < SHOW_AFTER_SECONDS) return null;
  const { title, detail } = MESSAGES[phase];

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: "4px 10px",
        fontSize: 11,
        lineHeight: 1.5,
        color: C.text,
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: "5px 10px",
        margin: "0 0 8px",
      }}
    >
      <span>
        <strong>{title}</strong> {detail}
      </span>
      {seconds != null && (
        <span
          aria-hidden="true"
          style={{
            marginLeft: "auto",
            color: C.dim,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {seconds} s
        </span>
      )}
    </div>
  );
}
