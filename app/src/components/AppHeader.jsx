/**
 * @fileoverview App-level header: navigation tabs, import/export, workflow controls.
 * @module components/AppHeader
 */

import { useState, useRef } from "react";
import { TutorialOverlay } from "./TutorialOverlay.jsx";
import { ModalShell } from "./user_edits/ModalShell.jsx";
import { MergeModal } from "./user_edits/MergeModal.jsx";
import { ExportModal } from "./user_edits/ExportModal.jsx";
import { SampleEditsNotice } from "./app_header/SampleEditsNotice.jsx";
import {
  ASSIST_TABS,
  SIMULATE_TABS,
  tabVisibility,
} from "../constants/tabConstants.jsx";
import { AppHeaderNarrow } from "./app_header/AppHeaderNarrow.jsx";
import { AppHeaderWide } from "./app_header/AppHeaderWide.jsx";

/**
 * @param {Object}   props
 * @param {number}   props.round - The round open now (stateUtils, "Steps and
 *   rounds"), which is not `state.round`: that is the step.
 * @param {number}   props.step
 * @param {function} [props.onCloseRound] - Closes the open round.
 * @param {boolean}  [props.canCloseRound] - Whether it has anything in it.
 * @param {string}   props.topic
 * @param {string}   props.tab
 * @param {function} props.setTab
 * @param {boolean}  props.showWithdrawn
 * @param {function} props.setShowWithdrawn
 * @param {boolean}  props.showRejected
 * @param {function} props.setShowRejected
 * @param {string}   props.assistSidePanel
 * @param {function} props.setAssistSidePanel
 * @param {function(Set<string>): void} props.onDownload - Writes the file, with
 *   the sections chosen in the Export dialog, which this header opens first.
 * @param {Object[]} props.exportSections - The sections the dialog offers for
 *   this process, from `exportSectionsFor`.
 * @param {function(): void} [props.onDownloadArgdown] - Writes the Argdown map
 *   alone as an `.argdown` file, from the same dialog.
 * @param {boolean|null} [props.showProcessTags] - Whether the merged-process
 *   letters are drawn; null before any merge, which leaves the row out.
 * @param {function} [props.setShowProcessTags]
 * @param {function|null} [props.onResetLayout] - Releases every pinned node;
 *   null while none is pinned, which leaves the row out.
 * @param {boolean} [props.hasMerged] - Offers the Merge assist tab.
 * @param {function} props.onImportFile
 * @param {function} [props.onPrepareMerge] - Reads a second exported process and
 *   resolves to what merging it would do; the Merge row is offered only when
 *   there is a non-questionnaire process to merge into.
 * @param {function} [props.onConfirmMerge] - Performs a merge prepared above.
 * @param {boolean} [props.isSample] - Whether the open process is the sample
 *   one, which is what the "Merge (demo)" row is offered on.
 * @param {boolean} [props.showSampleNotice] - Whether to say, under the header,
 *   that edits to the sample are not kept — with the export it owns a press
 *   away. REState decides when: from the first edit until the next.
 * @param {function} [props.onDismissSampleNotice] - The notice's close button.
 * @param {boolean}  props.hasExistingState
 * @param {function} props.onHome
 * @param {boolean}  props.isWide
 * @param {string}   props.workflowPhase
 * @param {number}   props.workflowLoops
 * @param {function} props.onStartWorkflow
 * @param {function} props.onStopWorkflow
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
 * @param {boolean|"settings"} props.tourMenuOpen - The tour walks the ☰
 *   menu's own entries, so it opens and shuts the menu as it goes. Both menus:
 *   the wide header keeps its own, and this one holds the narrow header's.
 *   `"settings"` opens the narrow menu on its Settings view, where the entries
 *   the wide ☰ holds are at that width; the wide menu reads it as `true`.
 */
export function AppHeader({
  round,
  step,
  onCloseRound,
  canCloseRound = false,
  topic,
  model,
  tab,
  setTab,
  assistSidePanel,
  setAssistSidePanel,
  onDownload,
  exportSections = [],
  onDownloadArgdown,
  onImportFile,
  onPrepareMerge,
  onConfirmMerge,
  hasExistingState,
  isSample = false,
  showSampleNotice = false,
  onDismissSampleNotice,
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
  showProcessTags = null,
  setShowProcessTags,
  onResetLayout = null,
  hasMerged = false,
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
  const mergeInputRef = useRef(null);
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
  const [exportOpen, setExportOpen] = useState(false);

  const doImport = async (file) => {
    try {
      await onImportFile(file);
    } catch (e) {
      setImportError(e.message);
    }
  };
  const handleImportClick = () => fileInputRef.current.click();

  // Merging needs a process to merge into, and a questionnaire has no room for
  // a second one — so the row is only offered where it can succeed.
  const canMerge =
    !!onPrepareMerge && hasExistingState && model !== "questionnaire";
  // Reading the file only prepares the merge; nothing changes until the reader
  // has seen what it would do and said so.
  const [pendingMerge, setPendingMerge] = useState(null);
  const doMerge = async (file) => {
    try {
      setPendingMerge(await onPrepareMerge(file));
    } catch (e) {
      setImportError(e.message);
    }
  };
  const handleMergeClick = () => mergeInputRef.current.click();

  // The second sample process, brought in without a trip through the file
  // system. Offered on the sample process only: in someone's own process a
  // demo's judgments are not a merge anyone asked for. Imported on the press
  // rather than with the module, so the fixture stays out of the main bundle.
  const canMergeSample = canMerge && isSample;
  const handleMergeSampleClick = async () => {
    try {
      const { default: text } =
        await import("../sample-data/sample-process-climate-duties.md?raw");
      await doMerge(
        new File([text], "sample-process-climate-duties.md", {
          type: "text/markdown",
        }),
      );
    } catch (e) {
      setImportError(e.message);
    }
  };

  const ANALYZE_TABS = ["graph", "history", "clusters"];
  const metaTab = ASSIST_TABS.includes(tab)
    ? "assist"
    : SIMULATE_TABS.includes(tab)
      ? "simulate"
      : "analyze";
  // The narrow menu lists all three groups at once, so it needs the predicate
  // rather than the flat list the wide bar renders for the current group.
  const isTabVisible = tabVisibility({ model, hideNonEntailsRels, hasMerged });
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
      {pendingMerge && (
        <MergeModal
          preview={pendingMerge.preview}
          onCancel={() => setPendingMerge(null)}
          onConfirm={() => {
            onConfirmMerge(pendingMerge);
            setPendingMerge(null);
          }}
        />
      )}
      {exportOpen && (
        <ExportModal
          sections={exportSections}
          onCancel={() => setExportOpen(false)}
          onExport={(sections) => {
            setExportOpen(false);
            onDownload(sections);
          }}
          onExportArgdown={
            onDownloadArgdown &&
            (() => {
              setExportOpen(false);
              onDownloadArgdown();
            })
          }
        />
      )}
      {importError && (
        <ModalShell
          title="Could not read file"
          subtitle={importError}
          onCancel={() => setImportError(null)}
          onSave={() => setImportError(null)}
          saveLabel="OK"
        />
      )}
    </>
  );

  const hiddenInput = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.argdown,.ad"
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
      {/* Confirmed in MergeModal, which says what the merge would do — not
          the import's "replace?", since a merge replaces nothing. */}
      <input
        ref={mergeInputRef}
        type="file"
        accept=".md,.argdown,.ad"
        data-testid="merge-input"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) doMerge(file);
        }}
      />
    </>
  );

  const shared = {
    round,
    step,
    onCloseRound,
    canCloseRound,
    topic,
    tab,
    setTab,
    showTabNav,
    setShowTabNav,
    allExpanded,
    onExpandAll,
    handleImportClick,
    handleMergeClick: canMerge ? handleMergeClick : null,
    handleMergeSampleClick: canMergeSample ? handleMergeSampleClick : null,
    onDownload: () => setExportOpen(true),
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
    showProcessTags,
    setShowProcessTags,
    onResetLayout,
    verifyArguments,
    setVerifyArguments,
    weights,
    weightsChanged,
    onWeightsChange,
    onResetWeights,
    onStartStepper: onStartTour,
  };

  const sampleNotice = showSampleNotice && (
    <SampleEditsNotice
      onExport={() => setExportOpen(true)}
      onClose={onDismissSampleNotice}
    />
  );

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
          tourMenuView={
            tourMenuOpen
              ? tourMenuOpen === "settings"
                ? "settings"
                : "main"
              : null
          }
        />
        {sampleNotice}
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
      {sampleNotice}
    </>
  );
}
