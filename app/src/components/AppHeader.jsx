/**
 * @fileoverview App-level header: navigation tabs, import/export, workflow controls.
 * @module components/AppHeader
 */

import { useState, useRef } from "react";
import { LLM_ENABLED, VITE_USE_DUMMY } from "../config.js";

const SaveIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    {/* Body with notched top-right corner */}
    <path d="M1.5 1h7l2 2v8a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5V1.5A.5.5 0 011.5 1z" />
    {/* Shutter slot */}
    <rect x="3" y="1" width="3.5" height="3" rx="0.3" />
    {/* Label area */}
    <rect x="2.5" y="6" width="7" height="3.5" rx="0.3" />
  </svg>
);
import { ModalShell } from "./user_edits/ModalShell.jsx";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";
import { AppHeaderNarrow } from "./app_header/AppHeaderNarrow.jsx";
import { AppHeaderWide } from "./app_header/AppHeaderWide.jsx";
import { C } from "../constants/colors.js";

/**
 * @param {Object}   props
 * @param {number}   props.round
 * @param {string}   props.topic
 * @param {string}   props.tab
 * @param {function} props.setTab
 * @param {boolean}  props.showText
 * @param {function} props.setShowText
 * @param {boolean}  props.showWithdrawn
 * @param {function} props.setShowWithdrawn
 * @param {boolean}  props.showRejected
 * @param {function} props.setShowRejected
 * @param {string}   props.assistSidePanel
 * @param {function} props.setAssistSidePanel
 * @param {function} props.onDownload
 * @param {function} props.onImportFile
 * @param {boolean}  props.hasExistingState
 * @param {function} props.onHome
 * @param {boolean}  props.isWide
 * @param {string}   props.workflowPhase
 * @param {number}   props.workflowLoops
 * @param {function} props.onStartWorkflow
 * @param {function} props.onStopWorkflow
 * @param {function} props.onSave
 * @param {function} props.onUndo
 * @param {boolean}  props.canUndo
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
  onSave,
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
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await onSave();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const SAVE_LABEL = {
    idle: <SaveIcon />,
    saving: "…",
    saved: "✓ Saved",
    error: "! Failed",
  };
  const SAVE_COLOR = {
    idle: null,
    saving: null,
    saved: C.supports,
    error: C.conflicts,
  };

  const doImport = async (file) => {
    try {
      await onImportFile(file);
    } catch (e) {
      setImportError(e.message);
    }
  };
  const handleImportClick = () => fileInputRef.current.click();

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

  const shared = {
    round,
    topic,
    tab,
    setTab,
    handleImportClick,
    onDownload,
    onSave: handleSave,
    saveLabel: SAVE_LABEL[saveStatus],
    saveColor: SAVE_COLOR[saveStatus],
    saveBusy: saveStatus === "saving",
    onHome,
    onUndo,
    canUndo,
    workflowPhase,
    workflowLoops,
    onStartWorkflow,
    onStopWorkflow,
    metaTab,
    ANALYZE_TABS,
  };

  if (!isWide) {
    return (
      <>
        {hiddenInput}
        {importModals}
        <AppHeaderNarrow
          {...shared}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          visibleSubTabs={visibleSubTabs}
        />
      </>
    );
  }

  return (
    <>
      {hiddenInput}
      {importModals}
      <AppHeaderWide
        {...shared}
        showText={showText}
        setShowText={setShowText}
        showWithdrawn={showWithdrawn}
        setShowWithdrawn={setShowWithdrawn}
        showRejected={showRejected}
        setShowRejected={setShowRejected}
        assistSidePanel={assistSidePanel}
        setAssistSidePanel={setAssistSidePanel}
        visibleSubTabs={visibleSubTabs}
      />
    </>
  );
}
