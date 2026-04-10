/**
 * @fileoverview Wide (desktop) two-row layout for AppHeader.
 * @module components/app_header/AppHeaderWide
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { LLM_ENABLED, VITE_USE_DUMMY, BACKEND_ENABLED } from "../../config.js";
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

const FileIcon = () => (
  <svg
    width="11"
    height="13"
    viewBox="0 0 11 13"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <path d="M1.5 1.5h5l3 3v7.5a.5.5 0 01-.5.5h-7.5a.5.5 0 01-.5-.5v-10a.5.5 0 01.5-.5z" />
    <path d="M6.5 1.5v3h3" />
  </svg>
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
  const [fileMenuOpen, setFileMenuOpen] = useState(false);

  const fileDropdownItem = {
    ...btn(false),
    width: "100%",
    justifyContent: "flex-start",
    height: 32,
    padding: "0 10px",
    borderRadius: 4,
    border: "none",
  };

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
              style={{
                marginRight: 2,
                flexShrink: 0,
                ...btn(false),
                opacity: canUndo ? 1 : 0.4,
              }}
            >
              ↩ Undo
            </button>
            {BACKEND_ENABLED && (
              <button
                onClick={onSave}
                disabled={saveBusy}
                title="Save session"
                style={{
                  marginRight: 2,
                  flexShrink: 0,
                  ...btn(false),
                  ...(saveColor
                    ? { color: saveColor, borderColor: saveColor }
                    : {}),
                }}
              >
                {saveLabel}Save
              </button>
            )}
            {/* File menu: Import + Export in a dropdown */}
            <div
              style={{ position: "relative", marginRight: 2, flexShrink: 0 }}
            >
              <button
                onClick={() => setFileMenuOpen((o) => !o)}
                style={{ ...btn(fileMenuOpen) }}
                title="Import / Export"
              >
                <FileIcon />
              </button>
              {fileMenuOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 99 }}
                    onClick={() => setFileMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      zIndex: 100,
                      background: C.panel,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: 4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 120,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    }}
                  >
                    <button
                      style={fileDropdownItem}
                      onClick={() => {
                        handleImportClick();
                        setFileMenuOpen(false);
                      }}
                    >
                      ↑ Import
                    </button>
                    <button
                      style={{ ...fileDropdownItem, color: C.theory.high }}
                      onClick={() => {
                        onDownload();
                        setFileMenuOpen(false);
                      }}
                    >
                      ↓ Export
                    </button>
                  </div>
                </>
              )}
            </div>
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
