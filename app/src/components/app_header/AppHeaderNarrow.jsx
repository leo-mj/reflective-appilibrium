/**
 * @fileoverview Narrow (mobile) layout for AppHeader: title + hamburger menu.
 * @module components/app_header/AppHeaderNarrow
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { useTheme } from "../../hooks/useTheme.js";
import { LLM_ENABLED, BACKEND_ENABLED, BYOK_ENABLED } from "../../config.js";
import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { FontSettingsModal } from "./FontSettingsModal.jsx";
import { WORKFLOW_PHASE_LABELS } from "../../utils/workflowUtils.js";
import {
  ASSIST_TABS,
  TAB_ICONS,
  TAB_LABELS,
} from "../../constants/tabConstants.jsx";
import { btn } from "./appHeaderStyles.js";
import { TopicLabel } from "./TopicLabel.jsx";

/**
 * @param {Object}   props
 * @param {number}   props.round
 * @param {string}   props.topic
 * @param {string}   props.tab
 * @param {function} props.setTab
 * @param {boolean}  props.menuOpen
 * @param {function} props.setMenuOpen
 * @param {string[]} props.ANALYZE_TABS
 * @param {function} props.handleImportClick
 * @param {function} props.onDownload
 * @param {function} props.onHome
 * @param {function} props.onUndo
 * @param {boolean}  props.canUndo
 * @param {string}   props.workflowPhase
 * @param {number}   props.workflowLoops
 * @param {function} props.onStartWorkflow
 * @param {function} props.onStopWorkflow
 */
export function AppHeaderNarrow({
  round,
  topic,
  tab,
  setTab,
  menuOpen,
  setMenuOpen,
  ANALYZE_TABS,
  handleImportClick,
  onDownload,
  onSave,
  saveLabel,
  saveColor,
  saveBusy,
  onHome,
  onUndo,
  canUndo,
  workflowPhase,
  workflowLoops,
  onStartWorkflow,
  onStopWorkflow,
}) {
  const [llmOpen, setLlmOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();

  const llmSaved = (() => {
    if (!BYOK_ENABLED) return null;
    try {
      const s = JSON.parse(sessionStorage.getItem("llmSettings") ?? "{}");
      return s?.apiKey ? s : null;
    } catch {
      return null;
    }
  })();

  const menuBtn = (active = false) => ({
    ...btn(active),
    width: "100%",
    justifyContent: "flex-start",
    gap: 8,
  });
  const divider = (
    <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
  );
  const close = (fn) => () => {
    fn();
    setMenuOpen(false);
  };

  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Round {round}
          </div>
          <TopicLabel topic={topic} style={{ fontSize: 12, color: C.dim }} />
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {BYOK_ENABLED && (
            <button
              onClick={() => setLlmOpen((o) => !o)}
              title="LLM settings"
              style={{
                ...btn(llmOpen),
                color: llmSaved ? C.supports : C.dim,
                borderColor: llmSaved ? C.supports : undefined,
                fontSize: 10,
                gap: 4,
              }}
            >
              {llmSaved ? llmSaved.model : "LLM"}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setMenuOpen((m) => !m)}
            style={{
              ...btn(menuOpen),
              border: `1px solid ${C.text}`,
            }}
          >
            ☰
          </button>
        </div>
      </div>
      {BYOK_ENABLED && (
        <LLMSettingsModal open={llmOpen} onClose={() => setLlmOpen(false)} />
      )}
      <FontSettingsModal open={fontOpen} onClose={() => setFontOpen(false)} />
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            width: "100%",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <button onClick={close(onHome)} style={menuBtn()}>
            ← Home
          </button>
          {divider}
          <div
            style={{
              fontSize: 10,
              color: C.dim,
              fontWeight: "bold",
              padding: "4px 4px 2px",
              letterSpacing: "0.05em",
            }}
          >
            Analyze
          </div>
          {ANALYZE_TABS.map((t) => (
            <button
              key={t}
              onClick={close(() => setTab(t))}
              style={menuBtn(tab === t)}
            >
              {TAB_ICONS[t]}
              {TAB_LABELS[t]}
            </button>
          ))}
          <>
              <div
                style={{
                  fontSize: 10,
                  color: C.dim,
                  fontWeight: "bold",
                  padding: "4px 4px 2px",
                  letterSpacing: "0.05em",
                }}
              >
                Assist
              </div>
              {ASSIST_TABS.map((t) => (
                <button
                  key={t}
                  onClick={close(() => setTab(t))}
                  style={menuBtn(tab === t)}
                >
                  {TAB_ICONS[t]}
                  {TAB_LABELS[t]}
                </button>
              ))}
              {workflowPhase ? (
                <button
                  onClick={close(onStopWorkflow)}
                  style={{
                    ...menuBtn(),
                    color: C.conflicts,
                    borderColor: C.conflicts,
                  }}
                >
                  ✕ Stop Workflow
                  <span style={{ marginLeft: 6, fontSize: 10, color: C.dim }}>
                    ({WORKFLOW_PHASE_LABELS[workflowPhase]}
                    {workflowLoops > 0 ? ` · Loop ${workflowLoops + 1}` : ""})
                  </span>
                </button>
              ) : (
                <button
                  onClick={close(onStartWorkflow)}
                  style={{ ...menuBtn(), color: C.supports }}
                >
                  ▶ Start Workflow
                </button>
              )}
          </>
          <button
            onClick={close(() => setTab("text"))}
            style={menuBtn(tab === "text")}
          >
            Text
          </button>
          {divider}
          <button
            onClick={close(onUndo)}
            disabled={!canUndo}
            style={{ ...menuBtn(), opacity: canUndo ? 1 : 0.4 }}
          >
            ↩ Undo
          </button>
          {BACKEND_ENABLED && (
            <button
              onClick={close(onSave)}
              disabled={saveBusy}
              title="Save session"
              style={{
                ...menuBtn(),
                ...(saveColor
                  ? { color: saveColor, borderColor: saveColor }
                  : {}),
              }}
            >
              {saveLabel}Save
            </button>
          )}
          <button
            onClick={() => {
              handleImportClick();
              setMenuOpen(false);
            }}
            style={menuBtn()}
          >
            ↑ Import
          </button>
          <button
            onClick={close(onDownload)}
            style={{
              ...menuBtn(),
              background: C.theory.high,
              color: C.text,
              border: "none",
            }}
          >
            ↓ Export
          </button>
          {divider}
          <button
            onClick={() => {
              setMenuOpen(false);
              setFontOpen(true);
            }}
            style={menuBtn()}
          >
            Aa Font
          </button>
          <button
            onClick={() => { toggleTheme(); setMenuOpen(false); }}
            style={menuBtn()}
          >
            {isDark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      )}
    </div>
  );
}
