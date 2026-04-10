/**
 * @fileoverview App-level header: navigation tabs, import/export, workflow controls.
 * @module components/AppHeader
 */

import { useState, useRef } from "react";
import { C } from "../constants/colors.js";
import { LLM_ENABLED, VITE_USE_DUMMY } from "../config.js";
import { WORKFLOW_PHASE_LABELS } from "../utils/workflowUtils.js";
import { ModalShell } from "./user_edits/ModalShell.jsx";
import { ASSIST_TABS, TAB_ICONS, TAB_LABELS } from "../constants/tabConstants.jsx";

// ─── TopicLabel ───────────────────────────────────────────────────────────────

/**
 * Topic text with hover tooltip (desktop) and tap tooltip (mobile).
 *
 * @param {Object} props
 * @param {string} props.topic
 * @param {import('react').CSSProperties} [props.style]
 */
function TopicLabel({ topic, style }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ position: "relative", minWidth: 0, ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") setOpen((s) => !s);
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {topic}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            zIndex: 200,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            color: C.text,
            whiteSpace: "normal",
            maxWidth: 320,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {topic}
        </div>
      )}
    </div>
  );
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {number}   props.round
 * @param {string}   props.topic
 * @param {string}   props.tab
 * @param {function(string): void} props.setTab
 * @param {boolean}  props.showText
 * @param {import('react').Dispatch<import('react').SetStateAction<boolean>>} props.setShowText
 * @param {boolean}  props.showWithdrawn
 * @param {import('react').Dispatch<import('react').SetStateAction<boolean>>} props.setShowWithdrawn
 * @param {boolean}  props.showRejected
 * @param {import('react').Dispatch<import('react').SetStateAction<boolean>>} props.setShowRejected
 * @param {function(): void} props.onDownload
 * @param {function(File): void} props.onImportFile
 * @param {boolean}  props.hasExistingState
 * @param {function(): void} props.onHome
 * @param {boolean}  props.isWide
 */
export function AppHeader({
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
  onDownload,
  onImportFile,
  hasExistingState,
  onHome,
  isWide,
  workflowPhase,
  workflowLoops,
  onStartWorkflow,
  onStopWorkflow,
  onUndo,
  canUndo,
}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importConfirmPending, setImportConfirmPending] = useState(null);
  const [importError, setImportError] = useState(null);

  const doImport = async (file) => {
    try {
      await onImportFile(file);
    } catch (e) {
      setImportError(e.message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };
  const btn = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    padding: "0 12px",
    boxSizing: "border-box",
    borderRadius: 4,
    border: `1px solid ${C.border}`,
    cursor: "pointer",
    fontSize: 12,
    background: active ? C.border : "transparent",
    color: active ? C.text : C.dim,
    fontFamily: "inherit",
  });
  // Classic connected-tab style for the Analyze / Assist meta-tab buttons.
  const metaTabBtn = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    padding: "0 14px",
    boxSizing: "border-box",
    borderRadius: "4px 4px 0 0",
    border: `1px solid ${C.border}`,
    borderBottom: `1px solid ${active ? C.bg : C.border}`,
    marginBottom: active ? -1 : 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? "600" : "normal",
    background: active ? C.border : "transparent",
    color: active ? C.text : C.dim,
    fontFamily: "inherit",
    position: "relative",
    zIndex: active ? 1 : 0,
  });
  const ANALYZE_TABS = [
    "graph",
    "history",
    "clusters",
    ...(LLM_ENABLED | VITE_USE_DUMMY ? ["matrix"] : []),
  ];
  const metaTab = ASSIST_TABS.includes(tab) ? "assist" : "analyze";
  const visibleSubTabs = metaTab === "assist" ? ASSIST_TABS : ANALYZE_TABS;

  const importModals = (
    <>
      {importConfirmPending && (
        <ModalShell
          title="Replace session?"
          subtitle="Importing will replace your current session."
          onCancel={() => setImportConfirmPending(null)}
          onSave={() => {
            const file = importConfirmPending;
            setImportConfirmPending(null);
            doImport(file);
          }}
          saveLabel="Replace"
          saveDisabled={false}
        />
      )}
      {importError && (
        <ModalShell
          title="Import failed"
          subtitle={importError}
          onCancel={() => setImportError(null)}
          onSave={() => setImportError(null)}
          saveLabel="OK"
        />
      )}
    </>
  );

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".md"
      style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (hasExistingState) {
          setImportConfirmPending(file);
        } else {
          doImport(file);
        }
      }}
    />
  );

  // ── Narrow (phone): title + hamburger menu ─────────────────────────────────
  if (!isWide) {
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
        {hiddenInput}
        {importModals}
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
            {LLM_ENABLED | VITE_USE_DUMMY && (
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
                    <span
                      style={{ marginLeft: 6, fontSize: 10, color: C.dim }}
                    >
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
            )}
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

  // ── Wide (desktop): two-row layout ───────────────────────────────────────
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
  return (
    <div>
      {hiddenInput}
      {importModals}
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
              onClick={handleImportClick}
              style={{ marginRight: 2, flexShrink: 0, ...btn(false) }}
            >
              ↑ Import
            </button>
            <button
              onClick={onDownload}
              style={{
                flexShrink: 0,
                ...btn(true),
                background: C.theory.high,
              }}
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
        {LLM_ENABLED | VITE_USE_DUMMY && (
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
        )}
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
