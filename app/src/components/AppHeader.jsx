/**
 * @fileoverview App-level header: navigation tabs, import/export, workflow controls.
 * @module components/AppHeader
 */

import { useState, useRef } from "react";
import { LLM_ENABLED, VITE_USE_DUMMY } from "../config.js";
import { ModalShell } from "./user_edits/ModalShell.jsx";
import { ASSIST_TABS } from "../constants/tabConstants.jsx";
import { AppHeaderNarrow } from "./app_header/AppHeaderNarrow.jsx";
import { AppHeaderWide } from "./app_header/AppHeaderWide.jsx";

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
