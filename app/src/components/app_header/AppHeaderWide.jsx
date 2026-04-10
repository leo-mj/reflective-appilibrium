/**
 * @fileoverview Wide (desktop) two-row layout for AppHeader.
 * @module components/app_header/AppHeaderWide
 */

import { C } from "../../constants/colors.js";
import { LLM_ENABLED, VITE_USE_DUMMY } from "../../config.js";
import { WORKFLOW_PHASE_LABELS } from "../../utils/workflowUtils.js";
import { TAB_ICONS, TAB_LABELS } from "../../constants/tabConstants.jsx";
import { btn, metaTabBtn } from "./appHeaderStyles.js";
import { TopicLabel } from "./TopicLabel.jsx";

const divider = (
  <div
    style={{
      width: 1,
      height: 20,
      background: C.border,
      alignSelf: "center",
      margin: "0 4px",
    }}
  />
);

/** Two-row desktop header: title row + tab bar. Props mirror AppHeader. */
export function AppHeaderWide({
  round,
  topic,
  tab,
  setTab,
  showText,
  setShowText,
  showWithdrawn,
  setShowWithdrawn,
  showRejected,
  setShowRejected,
  assistSidePanel,
  setAssistSidePanel,
  handleImportClick,
  onDownload,
  onSave,
  saveLabel,
  saveColor,
  saveBusy,
  onHome,
  onUndo,
  canUndo,
  metaTab,
  ANALYZE_TABS,
  visibleSubTabs,
  workflowPhase,
  workflowLoops,
  onStartWorkflow,
  onStopWorkflow,
}) {
  return (
    <div>
      {/* Row 1: utility — import/export, title, show-text, home */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Reflective Equilibrium — Round {round}
          </div>
          <TopicLabel
            topic={topic}
            style={{ fontSize: 14, color: C.dim, marginTop: 2 }}
          />
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          {metaTab === "assist" ? (
            <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
              {[
                { value: "text", label: "Text" },
                { value: "graph", label: "Graph" },
              ].map(({ value, label }, i) => (
                <button
                  key={value}
                  onClick={() => setAssistSidePanel(value)}
                  style={{
                    ...btn(assistSidePanel === value),
                    borderRadius:
                      i === 0 ? "4px 0 0 4px" : i === 1 ? "0 4px 4px 0" : 0,
                    fontSize: 11,
                    padding: "0 10px",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setShowText((s) => !s)}
              style={{ ...btn(false), position: "relative" }}
            >
              <span style={{ visibility: "hidden" }}>
                {showText ? "Hide text" : "Show text"}
              </span>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showText ? "Hide text" : "Show text"}
              </span>
            </button>
          )}
          {[
            {
              label: "Withdrawn",
              value: showWithdrawn,
              set: setShowWithdrawn,
              color: "#7c3aed",
            },
            {
              label: "Rejected",
              value: showRejected,
              set: setShowRejected,
              color: "#fb7185",
            },
          ].map(({ label, value, set, color }) => (
            <label
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: C.dim,
                cursor: "pointer",
                marginLeft: 6,
              }}
            >
              <div
                onClick={() => set((s) => !s)}
                style={{
                  width: 28,
                  height: 16,
                  borderRadius: 8,
                  position: "relative",
                  background: value ? color : C.border,
                  transition: "background 0.3s",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: C.text,
                    position: "absolute",
                    top: 2,
                    left: value ? 14 : 2,
                    transition: "left 0.3s ease",
                  }}
                />
              </div>
              {label}
            </label>
          ))}
          {divider}
          <div style={{ display: "flex", flex: "1 1 0", minWidth: 0 }}>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              style={{ marginRight: 2, flexShrink: 0, ...btn(false), opacity: canUndo ? 1 : 0.4 }}
            >
              ↩ Undo
            </button>
            <button
              onClick={onSave}
              disabled={saveBusy}
              style={{
                marginRight: 2,
                flexShrink: 0,
                ...btn(false),
                ...(saveColor ? { color: saveColor, borderColor: saveColor } : {}),
              }}
            >
              {saveLabel}
            </button>
            <button
              onClick={handleImportClick}
              style={{ marginRight: 2, flexShrink: 0, ...btn(false) }}
            >
              ↑ Import
            </button>
            <button
              onClick={onDownload}
              style={{ flexShrink: 0, ...btn(true), background: C.theory.high }}
            >
              ↓ Export
            </button>
            {divider}
            <button onClick={onHome} style={{ ...btn(false) }}>
              ← Home
            </button>
          </div>
        </div>
      </div>
      {/* Row 2: tab bar — meta-tabs connect to the border below */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 6,
          paddingBottom: 2,
        }}
      >
        {LLM_ENABLED | VITE_USE_DUMMY ? (
          <>
            <button
              style={metaTabBtn(metaTab === "analyze")}
              onClick={() => {
                if (metaTab !== "analyze") setTab("graph");
              }}
            >
              Analyze
            </button>
            <button
              style={metaTabBtn(metaTab === "assist")}
              onClick={() => {
                if (metaTab !== "assist") setTab("elicitJudgments");
              }}
            >
              Assist
            </button>
            <div
              style={{
                width: 1,
                height: 20,
                background: C.border,
                alignSelf: "center",
                margin: "0 4px",
              }}
            />
          </>
        ) : null}
        {visibleSubTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={btn(tab === t)}>
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
        {metaTab === "assist" && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {workflowPhase && (
              <span style={{ fontSize: 11, color: C.dim }}>
                {WORKFLOW_PHASE_LABELS[workflowPhase]}
                {workflowLoops > 0 ? ` · Loop ${workflowLoops + 1}` : ""}
              </span>
            )}
            {workflowPhase ? (
              <button
                onClick={onStopWorkflow}
                style={{
                  ...btn(false),
                  color: C.conflicts,
                  borderColor: C.conflicts,
                }}
              >
                ✕ Stop Workflow
              </button>
            ) : (
              <button
                onClick={onStartWorkflow}
                style={{ ...btn(false), color: C.supports }}
              >
                ▶ Start Workflow
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
