/**
 * @fileoverview App-level header: navigation tabs, import/export, workflow controls.
 * @module components/AppHeader
 */

import { useState, useRef } from "react";
import { TutorialOverlay } from "./TutorialOverlay.jsx";

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
import {
  ASSIST_TABS,
  SIMULATE_TABS,
  tabVisibility,
} from "../constants/tabConstants.jsx";
import { AppHeaderNarrow } from "./app_header/AppHeaderNarrow.jsx";
import { AppHeaderWide } from "./app_header/AppHeaderWide.jsx";
import { C } from "../constants/colors.js";

/**
 * @param {Object}   props
 * @param {number}   props.round
 * @param {string}   props.topic
 * @param {string}   props.tab
 * @param {function} props.setTab
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
 * @param {boolean}  props.canSaveToServer - Whether this backend actually stores
 *   sessions. Off for a hosted instance, where the browser keeps the state
 *   instead; the Save control is hidden rather than offered and refused.
 * @param {function} props.onUndo
 * @param {boolean}  props.canUndo
 * @param {function} props.onRedo
 * @param {boolean}  props.canRedo
 * @param {boolean}  props.tourActive  - Whether the guided tour is running. Held
 *   by REState because the tour drives the graph, not just the header — at
 *   either width. All this header does with it is lift the ☰ menu over the
 *   tour's dim while the tour is describing what is inside it.
 * @param {function} props.onStartTour - Behind the header's ? button, and the
 *   matching ☰ entry at narrow widths.
 * @param {boolean}  props.hideTabBar  - Set while the wide tour's opening
 *   chapters read against a bare graph. There is no tab bar to hide at narrow
 *   widths, where the same chapters are read against the ☰ menu staying shut.
 * @param {boolean}  props.tourMenuOpen - The tour walks the ☰ menu's own
 *   entries, so it opens and shuts the menu as it goes. Both menus: the wide
 *   header keeps its own, and this one holds the narrow header's.
 */
export function AppHeader({
  round,
  topic,
  model,
  tab,
  setTab,
  assistSidePanel,
  setAssistSidePanel,
  onDownload,
  onSave,
  canSaveToServer = false,
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
  onRedo,
  canRedo,
  showTabNav,
  setShowTabNav,
  allExpanded,
  onExpandAll,
  hideNonEntailsRels,
  setHideNonEntailsRels,
  verifyArguments,
  setVerifyArguments,
  weights,
  weightsChanged,
  onWeightsChange,
  onResetWeights,
  tourActive,
  onStartTour,
  hideTabBar,
  tourMenuOpen,
}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The narrow tour walks the ☰ menu's own entries, so it opens and shuts the
  // menu as it goes — but only as it crosses into and out of those sections,
  // which is what tracking the last value it asked for gives us. Left as a
  // plain effect it would slam the menu shut again every time the reader opened
  // it themselves mid-tour. (The wide header does the same for its own menu.)
  const [tourWantedMenu, setTourWantedMenu] = useState(!!tourMenuOpen);
  if (tourWantedMenu !== !!tourMenuOpen) {
    setTourWantedMenu(!!tourMenuOpen);
    setMenuOpen(!!tourMenuOpen);
  }
  const [tutorialMode] = useState(false);
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

  const ANALYZE_TABS = ["graph", "history", "clusters"];
  const metaTab = ASSIST_TABS.includes(tab)
    ? "assist"
    : SIMULATE_TABS.includes(tab)
      ? "simulate"
      : "analyze";
  // The narrow menu lists all three groups at once, so it needs the predicate
  // rather than the flat list the wide bar renders for the current group.
  const isTabVisible = tabVisibility({ model, hideNonEntailsRels });
  const visibleSubTabs = (
    metaTab === "assist"
      ? ASSIST_TABS
      : metaTab === "simulate"
        ? SIMULATE_TABS
        : ANALYZE_TABS
  ).filter(isTabVisible);

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
    showTabNav,
    setShowTabNav,
    allExpanded,
    onExpandAll,
    handleImportClick,
    onDownload,
    onSave: handleSave,
    canSaveToServer,
    saveLabel: SAVE_LABEL[saveStatus],
    saveColor: SAVE_COLOR[saveStatus],
    saveBusy: saveStatus === "saving",
    onHome,
    onUndo,
    canUndo,
    onRedo,
    canRedo,
    workflowPhase,
    workflowLoops,
    onStartWorkflow,
    onStopWorkflow,
    metaTab,
    ANALYZE_TABS,
    isTabVisible,
    hideNonEntailsRels,
    setHideNonEntailsRels,
    verifyArguments,
    setVerifyArguments,
    weights,
    weightsChanged,
    onWeightsChange,
    onResetWeights,
    onStartStepper: onStartTour,
  };

  if (!isWide) {
    // Both tours are mounted by REState — they read the demo graph, so they
    // need the selection and the framing only that component holds. What the
    // header owns at this width is the ☰ menu the tour walks, which it opens
    // and shuts on the tour's behalf.
    return (
      <>
        {hiddenInput}
        {importModals}
        <TutorialOverlay active={tutorialMode} />
        <AppHeaderNarrow
          {...shared}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          visibleSubTabs={visibleSubTabs}
          tourActive={tourActive}
        />
      </>
    );
  }

  return (
    <>
      {hiddenInput}
      {importModals}
      <TutorialOverlay active={tutorialMode} />
      <AppHeaderWide
        {...shared}
        assistSidePanel={assistSidePanel}
        setAssistSidePanel={setAssistSidePanel}
        visibleSubTabs={visibleSubTabs}
        hideTabBar={hideTabBar}
        tourMenuOpen={tourMenuOpen}
      />
    </>
  );
}
