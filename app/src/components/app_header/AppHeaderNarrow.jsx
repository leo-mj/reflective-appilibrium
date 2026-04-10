/**
 * @fileoverview Narrow (mobile) layout for AppHeader: title + hamburger menu.
 * @module components/app_header/AppHeaderNarrow
 */

import { C } from "../../constants/colors.js";
import { LLM_ENABLED, VITE_USE_DUMMY, BACKEND_ENABLED } from "../../config.js";
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
        <button
          onClick={() => setMenuOpen((m) => !m)}
          style={{
            ...btn(menuOpen),
            flexShrink: 0,
            marginLeft: 8,
            border: `1px solid ${C.text}`,
          }}
        >
          ☰
        </button>
      </div>
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
          {LLM_ENABLED | VITE_USE_DUMMY ? (
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
          ) : null}
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
        </div>
      )}
    </div>
  );
}
