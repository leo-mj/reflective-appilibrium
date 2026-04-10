/**
 * @fileoverview Landing page — lets the user choose between starting a fresh RE
 * process (with a custom topic) or loading the sample RE process.
 * @module components/HomePage
 */

import { useState, useEffect, useCallback } from "react";
import { C } from "../constants/colors.js";
import { fetchSessions, loadSession, deleteSession } from "../utils/sessionsClient.js";

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
    if (e.key === "Enter" && e.ctrlKey && trimmed) onStart(trimmed);
  };

  return (
    <div style={{ ...CARD_STYLE, minWidth: 300 }}>
      <div style={TITLE_STYLE}>Start your own RE process</div>
      <div style={DESC_STYLE}>
        Begin a new wide reflective equilibrium process from scratch. Enter a
        topic and start adding your moral judgments and principles.
      </div>
      <label style={{ fontSize: 11, color: C.dim }}>Topic</label>
      <input
        style={INPUT_STYLE}
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
          color: trimmed ? "#fff" : C.dim,
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
 * Card for loading the built-in sample RE process.
 *
 * @param {Object}   props
 * @param {Function} props.onLoad - Called when the user confirms.
 */
function SampleProcessCard({ onLoad }) {
  return (
    <div style={{ ...CARD_STYLE, minWidth: 300 }}>
      <div style={TITLE_STYLE}>Explore the sample RE process</div>
      <div style={DESC_STYLE}>
        Browse a pre-built reflective equilibrium process on obligations to
        future generations. Explore the graph, review the element history, and
        see how judgments, principles, and theories fit together.
      </div>
      <button
        style={{ ...BTN_STYLE, background: C.principle.high, color: "#fff" }}
        onClick={onLoad}
      >
        Load sample
      </button>
    </div>
  );
}

// ─── SessionsCard ─────────────────────────────────────────────────────────────

/**
 * Card listing saved backend sessions with load and delete actions.
 *
 * @param {Object}   props
 * @param {Function} props.onLoad - Called with a loaded REState object.
 */
function SessionsCard({ onLoad }) {
  const [sessions, setSessions] = useState(null); // null = not yet fetched
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const refresh = useCallback(() => {
    setError(null);
    fetchSessions()
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleLoad = async (id) => {
    setLoadingId(id);
    try {
      const state = await loadSession(id);
      onLoad(state);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  let body;
  if (sessions === null) {
    body = <div style={{ fontSize: 12, color: C.dim }}>Loading…</div>;
  } else if (error) {
    body = <div style={{ fontSize: 12, color: C.conflicts }}>{error}</div>;
  } else if (sessions.length === 0) {
    body = <div style={{ fontSize: 12, color: C.dim }}>No saved sessions.</div>;
  } else {
    body = sessions.map((s) => (
      <div
        key={s.session_id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 10px",
          borderRadius: 6,
          background: C.bg,
          border: `1px solid ${C.border}`,
        }}
      >
        {/* Topic + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: C.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {s.topic || "(untitled)"}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
            Round {s.round} · {formatDate(s.saved_at)}
          </div>
        </div>

        {/* Actions */}
        <button
          style={{
            ...BTN_STYLE,
            padding: "4px 12px",
            fontSize: 11,
            background: loadingId === s.session_id ? C.border : C.supports,
            color: "#fff",
          }}
          disabled={loadingId === s.session_id || deletingId === s.session_id}
          onClick={() => handleLoad(s.session_id)}
        >
          {loadingId === s.session_id ? "…" : "Load"}
        </button>
        <button
          style={{
            ...BTN_STYLE,
            padding: "4px 8px",
            fontSize: 11,
            background: "transparent",
            color: deletingId === s.session_id ? C.dim : C.dim,
            border: `1px solid ${C.border}`,
          }}
          disabled={loadingId === s.session_id || deletingId === s.session_id}
          onClick={() => handleDelete(s.session_id)}
          title="Delete session"
        >
          {deletingId === s.session_id ? "…" : "×"}
        </button>
      </div>
    ));
  }

  return (
    <div style={{ ...CARD_STYLE, flexBasis: "100%", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={TITLE_STYLE}>Saved sessions</div>
        {sessions !== null && (
          <button
            style={{
              ...BTN_STYLE,
              padding: "3px 8px",
              fontSize: 11,
              background: "transparent",
              color: C.dim,
              border: `1px solid ${C.border}`,
            }}
            onClick={refresh}
          >
            Refresh
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {body}
      </div>
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
 * @param {Function} props.onLoadSession  - Called with a full REState loaded from the backend.
 */
export function HomePage({ onStartFresh, onLoadSample, onLoadSession }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 10px",
        boxSizing: "border-box",
        fontFamily: "monospace",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div>
          <img
            src={"favicon.svg"}
            alt="RE Logo"
            style={{ width: 96, height: "auto" }}
          />
        </div>
        <div style={{ fontSize: 28, fontWeight: "bold", marginBottom: 10 }}>
          Reflective APPilibrium
        </div>
        <div
          style={{ fontSize: 13, color: C.dim, maxWidth: 480, lineHeight: 1.7 }}
        >
          A structured tool for conducting wide reflective equilibrium in ethics
          — iteratively building coherent moral positions by working between
          judgments, principles, and background theories.
        </div>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          gap: 20,
          width: "100%",
          maxWidth: 760,
          flexWrap: "wrap",
        }}
      >
        <NewProcessCard onStart={onStartFresh} />
        <SampleProcessCard onLoad={onLoadSample} />
        <SessionsCard onLoad={onLoadSession} />
      </div>
    </div>
  );
}
