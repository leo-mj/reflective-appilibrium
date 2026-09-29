/**
 * @fileoverview Wide (desktop) two-row layout for AppHeader.
 * @module components/app_header/AppHeaderWide
 */

import { useRef, useState } from "react";
import { C } from "../../constants/colors.js";
import { TOUR_Z } from "../tour/tourZ.js";
import { BACKEND_ENABLED } from "../../config.js";
import { WORKFLOW_PHASE_LABELS } from "../../utils/workflowUtils.js";
import {
  TAB_ICONS,
  TAB_LABELS,
  TAB_TOOLTIPS,
} from "../../constants/tabConstants.jsx";
import { btn, metaTabBtn, inlineDividerStyle } from "./appHeaderStyles.js";
import { SettingsMenuItems } from "./SettingsMenuItems.jsx";
import { Tooltip } from "../Tooltip.jsx";
import { TopicLabel } from "./TopicLabel.jsx";
import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { useLLMSettingsRequested } from "../../utils/llmKey.js";
import { useMenuEscape } from "../../hooks/useMenuEscape.js";
import { CloseRoundButton } from "./CloseRoundButton.jsx";
import { FontSettingsModal } from "./FontSettingsModal.jsx";
import { PrivacyModal } from "./PrivacyModal.jsx";

/**
 * Two-row desktop header: title row + tab bar. Props mirror AppHeader.
 *
 * `hideTabBar` drops the second row: the guided tour opens on the graph alone,
 * and a bar of tabs it has not introduced yet is noise on top of the one thing
 * it is asking the reader to look at.
 */
export function AppHeaderWide({
  round,
  step,
  onCloseRound,
  canCloseRound,
  topic,
  tab,
  setTab,
  assistSidePanel,
  setAssistSidePanel,
  handleImportClick,
  handleMergeClick,
  handleMergeSampleClick,
  onDownload,
  onHome,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  metaTab,
  visibleSubTabs,
  workflowPhase,
  workflowLoops,
  onStartWorkflow,
  onStopWorkflow,
  onStartStepper,
  showTabNav,
  setShowTabNav,
  allExpanded,
  onExpandAll,
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
  hideTabBar,
  tourMenuOpen,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Where the focus goes back to when the menu, or a dialog opened from it,
  // closes: the item that was pressed is gone with the menu.
  const menuButtonRef = useRef(null);
  useMenuEscape({
    open: menuOpen,
    onClose: () => setMenuOpen(false),
    buttonRef: menuButtonRef,
    enabled: !tourMenuOpen,
  });
  const [llmOpen, setLlmOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);

  // The tour walks the menu, so it opens and shuts it as it goes. It drives the
  // header's own state rather than overriding it, so a reader who closes the
  // menu gets it closed — until the tour moves to a section that wants it open
  // again. Adjusted during render rather than in an effect: an effect would
  // open the menu one paint after the section it belongs to, which is one paint
  // after the tour measured where to ring.
  const [tourWantedMenu, setTourWantedMenu] = useState(!!tourMenuOpen);
  if (tourWantedMenu !== !!tourMenuOpen) {
    setTourWantedMenu(!!tourMenuOpen);
    setMenuOpen(!!tourMenuOpen);
  }

  // A tab that needs a key asks for this modal rather than having `llmOpen`
  // lifted out through ten components. Adjusted during render, as the tour's
  // menu above is and for the same reason — an effect would open it a paint
  // later than the press that asked for it.
  const llmRequests = useLLMSettingsRequested();
  const [seenLlmRequest, setSeenLlmRequest] = useState(llmRequests);
  if (seenLlmRequest !== llmRequests) {
    setSeenLlmRequest(llmRequests);
    setLlmOpen(true);
  }

  const menuItem = {
    ...btn(false),
    width: "100%",
    justifyContent: "flex-start",
    height: 32,
    padding: "0 10px",
    borderRadius: 4,
    border: "none",
  };
  // Everything the ☰ holds, which the narrow header offers under Settings.
  const settingsProps = {
    onHome,
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
    showTabNav,
    setShowTabNav,
    allExpanded,
    onExpandAll,
    handleImportClick,
    handleMergeClick,
    handleMergeSampleClick,
    onDownload,
  };

  return (
    <div>
      {/* Row 1: title left, controls + burger right */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div
          style={{ minWidth: 0, display: "flex", alignItems: "centre", gap: 5 }}
        >
          <a
            href="https://www.tuhh.de/ethics/welcome"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="ieit_logo.svg"
              alt="Institute for Ethics in IT, TU Hamburg"
              style={{ height: 36 }}
            />
          </a>
          {/* Decorative: the app is already named in the heading beside it. */}
          <img src="favicon.svg" alt="" style={{ height: 36 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  margin: 0,
                }}
              >
                {/* Round first: it is the unit of the method. The step counts
                    changes, and is what History and the cards are stamped in. */}
                Reflective Equilibrium — Round {round} · Step {step}
              </h1>
              {onCloseRound && (
                <CloseRoundButton
                  round={round}
                  enabled={canCloseRound}
                  onClose={onCloseRound}
                />
              )}
            </div>
            {/* Ringed by the tour when it introduces the question. */}
            <div data-tutorial="topic">
              <TopicLabel
                topic={topic}
                style={{ fontSize: 14, color: C.dim, marginTop: 2 }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {/* Side-panel toggle (assist and simulate modes) */}
          {(metaTab === "assist" || metaTab === "simulate") && (
            <div
              style={{
                display: "flex",
                gap: 0,
                flexShrink: 0,
              }}
            >
              {[
                { value: "text", label: "Text" },
                { value: "graph", label: "Graph" },
                { value: "focus", label: "Focus" },
              ].map(({ value, label }, i, arr) => (
                <button
                  key={value}
                  onClick={() => setAssistSidePanel(value)}
                  style={{
                    // "graphFull" is the graph's own full-screen state. It is
                    // still the graph, so Graph stays lit — and clicking it is
                    // a second way back out of full screen.
                    ...btn(
                      assistSidePanel === value ||
                        (value === "graph" && assistSidePanel === "graphFull"),
                    ),
                    borderRadius:
                      i === 0
                        ? "4px 0 0 4px"
                        : i === arr.length - 1
                          ? "0 4px 4px 0"
                          : "0",
                    ...(i > 0 && { borderLeft: "none" }),
                    fontSize: 11,
                    padding: "0 10px",
                  }}
                >
                  {label}
                </button>
              ))}
              <div style={inlineDividerStyle} />
            </div>
          )}

          <Tooltip text="Undo the last change. Ctrl+Z.">
            <button
              data-tutorial="btn-undo"
              onClick={onUndo}
              disabled={!canUndo}
              style={{ ...btn(false), opacity: canUndo ? 1 : 0.4 }}
            >
              ↩ Undo
            </button>
          </Tooltip>

          {/* Icon-only: the pair is read together, and spelling out "Redo"
              beside "Undo" costs more of the bar than it earns. The label the
              screen reader gets is on aria-label. */}
          <Tooltip text="Redo the undone change. Ctrl+Shift+Z.">
            <button
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              style={{ ...btn(false), opacity: canRedo ? 1 : 0.4 }}
            >
              ↪
            </button>
          </Tooltip>

          <div style={inlineDividerStyle} />

          <Tooltip text="Start the guided tour.">
            <button
              onClick={onStartStepper}
              aria-label="Start the step-by-step tour"
              style={{
                ...btn(false),
                color: C.dim,
                fontWeight: "bold",
                fontSize: 13,
              }}
            >
              ?
            </button>
          </Tooltip>

          <div style={inlineDividerStyle} />

          {/* Burger menu */}
          <div style={{ position: "relative" }}>
            <Tooltip text="Settings, import and export.">
              <button
                ref={menuButtonRef}
                data-tutorial="btn-menu"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Settings menu"
                aria-expanded={menuOpen}
                style={{ ...btn(menuOpen), border: `1px solid ${C.text}` }}
              >
                ☰
              </button>
            </Tooltip>

            {menuOpen && (
              <>
                {/* Click-away, but not while the tour is walking the menu: it
                    would swallow every click meant for the app behind it. */}
                {!tourMenuOpen && (
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 99 }}
                    onClick={() => setMenuOpen(false)}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    // Lifted over the tour's spotlight, which otherwise paints
                    // the menu as dark as the app behind it. The ring sits one
                    // layer up and its shadow leaves a hole, so the entry being
                    // described stays bright while the rest of the menu dims.
                    zIndex: tourMenuOpen ? TOUR_Z.menu : 100,
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 6,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: weightsOpen ? 248 : 200,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  <SettingsMenuItems
                    {...settingsProps}
                    itemStyle={menuItem}
                    closeMenu={() => setMenuOpen(false)}
                    onOpenLlm={() => setLlmOpen(true)}
                    onOpenPrivacy={() => setPrivacyOpen(true)}
                    onOpenFont={() => setFontOpen(true)}
                    weightsOpen={weightsOpen}
                    setWeightsOpen={setWeightsOpen}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <LLMSettingsModal
        open={llmOpen}
        onClose={() => setLlmOpen(false)}
        returnFocusTo={menuButtonRef}
      />
      <FontSettingsModal
        open={fontOpen}
        onClose={() => setFontOpen(false)}
        returnFocusTo={menuButtonRef}
      />
      <PrivacyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        returnFocusTo={menuButtonRef}
      />

      {/* Row 2: tab bar */}
      {!hideTabBar && (
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
          <Tooltip text="AI proposes judgments, principles, background theories and arguments, and reviews the process.">
            <button
              data-tutorial="meta-assist"
              style={metaTabBtn(metaTab === "assist")}
              onClick={() => {
                if (metaTab !== "assist") setTab("elicitJudgments");
              }}
            >
              Assist
            </button>
          </Tooltip>
          <Tooltip text="Your position as graph, text, clusters or history.">
            <button
              data-tutorial="meta-analyze"
              style={metaTabBtn(metaTab === "analyze")}
              onClick={() => {
                if (metaTab !== "analyze") setTab("graph");
              }}
            >
              Analyze
            </button>
          </Tooltip>
          {BACKEND_ENABLED && (
            <Tooltip text="Run the formal rethon simulation on your position.">
              <button
                style={metaTabBtn(metaTab === "simulate")}
                onClick={() => {
                  if (metaTab !== "simulate") setTab("simulateRethon");
                }}
              >
                Simulate
              </button>
            </Tooltip>
          )}
          <div style={inlineDividerStyle} />
          {visibleSubTabs.map((t) => (
            <Tooltip key={t} text={TAB_TOOLTIPS[t]}>
              <button
                data-tutorial={`tab-${t}`}
                onClick={() => setTab(t)}
                style={btn(tab === t)}
              >
                {TAB_ICONS[t]}
                {TAB_LABELS[t]}
              </button>
            </Tooltip>
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
                  data-tutorial="btn-workflow"
                  onClick={onStartWorkflow}
                  style={{ ...btn(false), color: C.supports }}
                >
                  ▶ Start Workflow
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
