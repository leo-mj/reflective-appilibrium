/**
 * @fileoverview Landing page — lets the user choose between starting a fresh RE
 * process (with a custom topic) or loading the sample RE process.
 * @module components/HomePage
 */

import { useState } from "react";
import { C } from "../constants/colors.js";

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

const TITLE_STYLE = {
  fontSize: 15,
  fontWeight: "bold",
  color: C.text,
};

const DESC_STYLE = {
  fontSize: 12,
  color: C.dim,
  lineHeight: 1.7,
  flex: 1,
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
    if (e.key === "Enter" && trimmed) onStart(trimmed);
  };

  return (
    <div style={CARD_STYLE}>
      <div style={TITLE_STYLE}>Start your own RE process</div>
      <div style={DESC_STYLE}>
        Begin a new wide reflective equilibrium process from scratch.
        Enter a topic and start adding your moral judgments and principles.
      </div>
      <label style={{ fontSize: 11, color: C.dim }}>Topic</label>
      <input
        style={INPUT_STYLE}
        placeholder="e.g. obligations to future generations"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <button
        style={{
          ...BTN_STYLE,
          background: trimmed ? C.supports : C.border,
          color: trimmed ? "#fff" : C.dim,
          cursor: trimmed ? "pointer" : "not-allowed",
        }}
        disabled={!trimmed}
        onClick={() => onStart(trimmed)}>
        Start
      </button>
    </div>
  );
}

/**
 * Card for loading the built-in sample RE process.
 *
 * @param {Object}   props
 * @param {Function} props.onLoad - Called when the user confirms.
 */
function SampleProcessCard({ onLoad }) {
  return (
    <div style={CARD_STYLE}>
      <div style={TITLE_STYLE}>Explore the sample RE process</div>
      <div style={DESC_STYLE}>
        Browse a pre-built reflective equilibrium process on obligations to
        future generations. Explore the graph, review the element history, and
        see how judgments, principles, and theories fit together.
      </div>
      <button
        style={{ ...BTN_STYLE, background: C.principle.high, color: "#fff" }}
        onClick={onLoad}>
        Load sample
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen landing page.
 *
 * @param {Object}   props
 * @param {Function} props.onStartFresh  - Called with a topic string to start a blank RE process.
 * @param {Function} props.onLoadSample  - Called to load the sample RE process.
 */
export function HomePage({ onStartFresh, onLoadSample }) {
  return (
    <div style={{
      height: "100vh",
      background: C.bg,
      color: C.text,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 24px",
      boxSizing: "border-box",
      fontFamily: "monospace",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 28, fontWeight: "bold", marginBottom: 10 }}>
          Reflective APPilibrium
        </div>
        <div style={{ fontSize: 13, color: C.dim, maxWidth: 480, lineHeight: 1.7 }}>
          A structured tool for conducting wide reflective equilibrium in ethics —
          iteratively building coherent moral positions by working between
          judgments, principles, and background theories.
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: "flex",
        gap: 20,
        width: "100%",
        maxWidth: 760,
        flexWrap: "wrap",
      }}>
        <NewProcessCard onStart={onStartFresh} />
        <SampleProcessCard onLoad={onLoadSample} />
      </div>
    </div>
  );
}
