/**
 * @fileoverview Narrow (mobile) layout for AppHeader: title + hamburger menu.
 * @module components/app_header/AppHeaderNarrow
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { useTheme } from "../../hooks/useTheme.js";
import { BACKEND_ENABLED, BYOK_ENABLED } from "../../config.js";
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

export function AppHeaderNarrow({
  round,
  topic,
  tab,
  setTab,
  menuOpen,
  setMenuOpen,
  ANALYZE_TABS,
  showText,
  setShowText,
  metaTab,
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
  showTabNav,
  setShowTabNav,
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
  const icon = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    flexShrink: 0,
  };
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
          <button
            onClick={() => setMenuOpen((m) => !m)}
            style={{ ...btn(menuOpen), border: `1px solid ${C.text}` }}
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
            <span style={icon}>←</span>Home
          </button>

          {divider}

          {metaTab !== "assist" && (
            <button onClick={close(() => setShowText((s) => !s))} style={menuBtn()}>
              <span style={icon}>≡</span>{showText ? "Hide text" : "Show text"}
            </button>
          )}

          <button onClick={close(() => setShowTabNav((s) => !s))} style={menuBtn()}>
            <span style={icon}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                <circle cx="11" cy="11" r="7"/>
                <line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
            </span>{showTabNav ? "Hide nav bar" : "Show nav bar"}
          </button>

          {divider}

          <button
            onClick={() => { setMenuOpen(false); setFontOpen(true); }}
            style={menuBtn()}
          >
            <span style={icon}>Aa</span>Select Font
          </button>

          <button onClick={() => { toggleTheme(); setMenuOpen(false); }} style={menuBtn()}>
            <span style={icon}>
              {isDark ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </span>
            {isDark ? "Light mode" : "Dark mode"}
          </button>

          {divider}

          <button
            onClick={() => { handleImportClick(); setMenuOpen(false); }}
            style={menuBtn()}
          >
            <span style={icon}>↑</span>Import
          </button>
          <button
            onClick={close(onDownload)}
            style={{ ...menuBtn(), color: C.theory.high }}
          >
            <span style={icon}>↓</span>Export
          </button>

          {BYOK_ENABLED && (
            <>
              {divider}
              <button
                onClick={() => { setMenuOpen(false); setLlmOpen(true); }}
                style={menuBtn()}
              >
                <span style={icon}>⚙</span>{llmSaved ? `LLM: ${llmSaved.model}` : "LLM settings"}
              </button>
            </>
          )}

          <>
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
                <button key={t} onClick={close(() => setTab(t))} style={menuBtn(tab === t)}>
                  {TAB_ICONS[t]}
                  {TAB_LABELS[t]}
                </button>
              ))}

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
                <button key={t} onClick={close(() => setTab(t))} style={menuBtn(tab === t)}>
                  {TAB_ICONS[t]}
                  {TAB_LABELS[t]}
                </button>
              ))}
              {workflowPhase ? (
                <button
                  onClick={close(onStopWorkflow)}
                  style={{ ...menuBtn(), color: C.conflicts, borderColor: C.conflicts }}
                >
                  ✕ Stop Workflow
                  <span style={{ marginLeft: 6, fontSize: 10, color: C.dim }}>
                    ({WORKFLOW_PHASE_LABELS[workflowPhase]}
                    {workflowLoops > 0 ? ` · Loop ${workflowLoops + 1}` : ""})
                  </span>
                </button>
              ) : (
                <button onClick={close(onStartWorkflow)} style={{ ...menuBtn(), color: C.supports }}>
                  ▶ Start Workflow
                </button>
              )}
          </>

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
                ...(saveColor ? { color: saveColor, borderColor: saveColor } : {}),
              }}
            >
              {saveLabel}Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}
