/**
 * @fileoverview Landing page — lets the user choose between starting a fresh RE
 * process (with a custom topic) or loading the sample RE process.
 * @module components/HomePage
 */

import { useEffect, useState } from "react";
import { C, inkOn } from "../constants/colors.js";
import { Tooltip } from "./Tooltip.jsx";
import { ModalShell } from "./user_edits/ModalShell.jsx";
import { useTheme, usePalette } from "../hooks/useTheme.js";
import { prefetchBackendCapabilities } from "../hooks/useBackendCapabilities.js";
import {
  clearDraft,
  isWorthResuming,
  loadDraft,
} from "../utils/draftStorage.js";
import { currentRound } from "../utils/stateUtils.js";
import {
  DEFAULT_EXPORT_SECTIONS,
  downloadMarkdown,
} from "../utils/exportMarkdown.js";

// The export as the editor writes it by default, less the graph and cluster
// images: those are drawn from a layout, and only the editor has one. The full
// history — what Import reads back — is in it.
const LANDING_EXPORT_SECTIONS = new Set(
  [...DEFAULT_EXPORT_SECTIONS].filter((k) => k !== "graph" && k !== "clusters"),
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_STYLE = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "28px 32px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  flex: 1,
  minWidth: 0,
};

// Card titles are h2s under the page h1, so the browser's default heading
// margins have to go — the cards space themselves.
const TITLE_STYLE = {
  fontSize: 15,
  fontWeight: "bold",
  color: C.text,
  margin: 0,
};

const DESC_STYLE = {
  fontSize: 12,
  color: C.dim,
  lineHeight: 1.7,
  flex: 1,
  textAlign: "left",
};

const BTN_STYLE = {
  border: "none",
  borderRadius: 6,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: "bold",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const INPUT_STYLE = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 12,
  color: C.text,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Card for starting a new RE process from a clean slate.
 *
 * @param {Object}   props
 * @param {Function} props.onStart - Called with the topic string.
 */
function NewProcessCard({ onStart }) {
  const [topic, setTopic] = useState("");
  const trimmed = topic.trim();

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.ctrlKey && trimmed) onStart(trimmed);
  };

  return (
    <div style={{ ...CARD_STYLE, minWidth: 300 }}>
      <h2 style={TITLE_STYLE}>Start your own process</h2>
      <div style={DESC_STYLE}>
        Begin a new reflective equilibrium process from scratch. <br />
        Enter a topic and start adding your moral judgments and principles.
      </div>
      {/* The placeholder is an example, not a label — it goes as soon as you
          type, taking the only description of the field with it. */}
      <input
        style={INPUT_STYLE}
        aria-label="Topic of your reflective equilibrium process"
        placeholder="e.g. obligations to future generations"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <button
        style={{
          ...BTN_STYLE,
          background: trimmed ? C.supports : C.border,
          color: trimmed ? C.onFill : C.dim,
          cursor: trimmed ? "pointer" : "not-allowed",
        }}
        disabled={!trimmed}
        onClick={() => onStart(trimmed)}
      >
        Start
      </button>
    </div>
  );
}

/**
 * Offers back the work in progress this browser last held.
 *
 * The state otherwise lives only in React, so a refresh or a closed tab ends
 * the session — which is the whole story on a hosted instance and on the demo,
 * where there is no server-side store to fall back on.
 *
 * @param {Object}   props
 * @param {Object}   props.draft   From draftStorage.loadDraft().
 * @param {Function} props.onResume
 * @param {Function} props.onDiscard
 */
function ResumeCard({ draft, onResume, onDiscard }) {
  const { state, savedAt } = draft;
  const when = savedAt
    ? new Date(savedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div style={{ ...CARD_STYLE, minWidth: 300, borderColor: C.supports }}>
      <h2 style={TITLE_STYLE}>Continue where you left off</h2>
      <div style={DESC_STYLE}>
        <strong style={{ color: C.text }}>{state.topic || "Untitled"}</strong>
        <br />
        Round {currentRound(state)} · Step {state.round} ·{" "}
        {state.elements.length} element
        {state.elements.length === 1 ? "" : "s"}
        {when ? ` · saved ${when}` : ""}
        <br />
        Kept in this browser only, and replaced by the next process you start.
        Export it to keep a copy elsewhere.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ ...BTN_STYLE, background: C.supports, color: C.onFill }}
          onClick={onResume}
        >
          Resume
        </button>
        <button
          style={{
            ...BTN_STYLE,
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.dim,
          }}
          onClick={onDiscard}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

/**
 * Asks before a new process takes the draft's place.
 *
 * There is one draft slot, and a new process's first autosave writes over it —
 * so without this, Start threw away the process on offer beside it, unasked.
 * Export is offered here rather than only named, so the reader who wants both
 * is not sent back to Resume, the menu and Home to get them.
 *
 * @param {Object}   props
 * @param {Object}   props.draft     From draftStorage.loadDraft().
 * @param {string}   props.topic     The new process's topic.
 * @param {Function} props.onReplace
 * @param {Function} props.onCancel
 */
function ReplaceDraftDialog({ draft, topic, onReplace, onCancel }) {
  const [exported, setExported] = useState(false);
  const { state } = draft;
  const count = state.elements.length;
  const exportDraft = () => {
    downloadMarkdown(state, {}, LANDING_EXPORT_SECTIONS);
    setExported(true);
  };

  return (
    <ModalShell
      title="Replace the process you left off?"
      subtitle={
        `This browser keeps one unfinished process. Starting “${topic}” ` +
        `replaces “${state.topic || "Untitled"}” (round ${currentRound(state)}, step ${state.round}, ` +
        `${count} element${count === 1 ? "" : "s"}).`
      }
      onCancel={onCancel}
      onSave={onReplace}
      saveLabel="Replace"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          fontSize: 12,
          color: C.dim,
          lineHeight: 1.6,
        }}
      >
        <button
          style={{
            ...BTN_STYLE,
            alignSelf: "center",
            flexShrink: 0,
            background: "transparent",
            border: `1px solid ${C.supportsText}`,
            color: C.supportsText,
          }}
          onClick={exportDraft}
        >
          Export it first
        </button>
        <span role="status">
          {exported
            ? "Exported. Import the file to pick it up again."
            : "Downloads it as Markdown, which Import reads back in."}
        </span>
      </div>
    </ModalShell>
  );
}

/**
 * Card for loading the built-in sample RE process.
 *
 * @param {Object}   props
 * @param {Function} props.onLoad - Called when the user confirms.
 */
function SampleProcessCard({ onLoad, onTour }) {
  return (
    <div style={{ ...CARD_STYLE, minWidth: 300 }}>
      <h2 style={TITLE_STYLE}>Explore the demo</h2>
      <div style={DESC_STYLE}>
        Browse a pre-built reflective equilibrium process on obligations to
        future generations. <br /> Explore the graph, review the element
        history, and see how judgments, principles, and theories fit together.
      </div>
      {/* Both buttons open the demo, so both say so; the second used to read
          "Skip tutorial", naming what it left out rather than what it did.
          Wrapping, since the labels no longer fit one row on a narrow card. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          style={{
            ...BTN_STYLE,
            background: C.principle.accent,
            color: C.onFill,
          }}
          onClick={onTour}
        >
          Guided tour
        </button>
        <button
          style={{
            ...BTN_STYLE,
            background: "transparent",
            border: `1px solid ${C.supportsText}`,
            color: C.supportsText,
          }}
          onClick={onLoad}
        >
          Skip guided tour
        </button>
      </div>
    </div>
  );
}

const questionnaireModules = import.meta.glob("../questionnaires/*.js", {
  eager: true,
});
const QUESTIONNAIRE_SPECS = Object.values(questionnaireModules)
  .map((m) => m.default)
  .filter(Boolean);

function renderDescription(description) {
  const parts = Array.isArray(description) ? description : [description];
  return parts.map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <a
        key={i}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: C.dim }}
      >
        {part.link}
      </a>
    ),
  );
}

function QuestionnaireCard({ spec, onLoad }) {
  const palette = usePalette();
  return (
    <div style={{ ...CARD_STYLE, minWidth: 300 }}>
      <h2 style={TITLE_STYLE}>{spec.card.title}</h2>
      <div style={DESC_STYLE}>{renderDescription(spec.card.description)}</div>
      <button
        // Asked for rather than named: this ink was pinned dark once, and
        // stayed pinned when the colour under it moved.
        style={{
          ...BTN_STYLE,
          background: palette.theory.high,
          color: inkOn(palette.theory.high),
        }}
        onClick={onLoad}
      >
        {spec.card.buttonLabel}
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen landing page.
 *
 * @param {Object}   props
 * @param {Function} props.onStartFresh   - Called with a topic string to start a blank RE process.
 * @param {Function} props.onLoadSample   - Called to load the sample RE process.
 * @param {Function} props.onLoadSession  - Called with a full REState — the
 *   autosaved draft this page offers back under "Continue where you left off".
 */
export function HomePage({
  onStartFresh,
  onLoadSample,
  onLoadQuestionnaire,
  onLoadSession,
}) {
  const { isDark, toggle: toggleTheme } = useTheme();
  // Wakes a backend that has scaled to zero while the reader is still here,
  // rather than once they open the editor. The editor makes the same request
  // and joins this one; the demo build makes none.
  useEffect(() => {
    prefetchBackendCapabilities();
  }, []);
  // Read once on mount: the draft is written by the editor, so it cannot change
  // while this page is on screen, and re-reading would fight the Discard button.
  const [draft, setDraft] = useState(() => loadDraft());
  const discardDraft = () => {
    clearDraft();
    setDraft(null);
  };
  // The topic waiting on ReplaceDraftDialog, when there is a draft to lose.
  const [pendingTopic, setPendingTopic] = useState(null);
  const startFresh = (topic) =>
    isWorthResuming(draft) ? setPendingTopic(topic) : onStartFresh(topic);
  return (
    // <main>: the landing page's one main landmark. Semantic only — it lays out
    // exactly as the div it replaces.
    <main
      style={{
        // svh, not vh: the floor has to be the viewport at its smallest, with
        // the phone's URL bar showing, or the page is born taller than the
        // screen and scrolls when there is nothing below the fold to reach.
        minHeight: "100svh",
        background: C.bg,
        color: C.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 10px",
        boxSizing: "border-box",
        fontFamily: "monospace",
        position: "relative",
      }}
    >
      <Tooltip text={isDark ? "Switch to light mode" : "Switch to dark mode"}>
        <button
          onClick={toggleTheme}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.dim,
            cursor: "pointer",
            padding: "6px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isDark ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </Tooltip>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div>
          <img
            src={"favicon.svg"}
            alt="RE Logo"
            style={{ width: 96, height: "auto" }}
          />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: "bold", margin: "0 0 10px" }}>
          Reflective APPilibrium
        </h1>
        <div
          style={{ fontSize: 13, color: C.dim, maxWidth: 480, lineHeight: 1.7 }}
        >
          A structured tool for conducting reflective equilibrium in ethics —
          iteratively building coherent moral positions by working between
          judgments, principles, and background theories.
        </div>
      </div>

      {/* Cards */}
      <section
        aria-label="Start a process"
        style={{
          display: "flex",
          gap: 20,
          width: "100%",
          maxWidth: 760,
          flexWrap: "wrap",
        }}
      >
        {/* First, so returning to unfinished work is the first thing offered. */}
        {isWorthResuming(draft) && (
          <ResumeCard
            draft={draft}
            onResume={() => onLoadSession(draft.state)}
            onDiscard={discardDraft}
          />
        )}
        <SampleProcessCard
          onLoad={onLoadSample}
          onTour={() => {
            sessionStorage.setItem("startTour", "1");
            onLoadSample();
          }}
        />
        <NewProcessCard onStart={startFresh} />
        {QUESTIONNAIRE_SPECS.map((spec) => (
          <QuestionnaireCard
            key={spec.name}
            spec={spec}
            onLoad={() => onLoadQuestionnaire(spec)}
          />
        ))}
      </section>
      {pendingTopic !== null && (
        <ReplaceDraftDialog
          draft={draft}
          topic={pendingTopic}
          onReplace={() => onStartFresh(pendingTopic)}
          onCancel={() => setPendingTopic(null)}
        />
      )}
      <div
        style={{
          ...DESC_STYLE,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          margin: "5em 0 5em 0",
        }}
      >
        <img
          src="ieit_logo.svg"
          alt="Institute for Ethics in IT, TU Hamburg"
          style={{ width: "15em" }}
        />
        <span>
          By the{" "}
          <a
            href="https://www.tuhh.de/ethics/welcome"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.dim }}
          >
            Institute for Ethics in Technology (TUHH)
          </a>
        </span>
      </div>
    </main>
  );
}
