/**
 * @fileoverview Wide (desktop) two-row layout for AppHeader.
 * @module components/app_header/AppHeaderWide
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { TOUR_Z } from "../tour/tourZ.js";
import { useTheme } from "../../hooks/useTheme.js";
import { BACKEND_ENABLED, BYOK_ENABLED } from "../../config.js";
import { WORKFLOW_PHASE_LABELS } from "../../utils/workflowUtils.js";
import {
  TAB_ICONS,
  TAB_LABELS,
  TAB_TOOLTIPS,
} from "../../constants/tabConstants.jsx";
import {
  btn,
  metaTabBtn,
  menuIconStyle,
  menuDividerStyle,
  inlineDividerStyle,
} from "./appHeaderStyles.js";
import { Tooltip } from "../Tooltip.jsx";
import { TopicLabel } from "./TopicLabel.jsx";
import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { FontSettingsModal } from "./FontSettingsModal.jsx";
import { WeightTriangle } from "../workflows/WeightTriangle.jsx";

/**
 * Two-row desktop header: title row + tab bar. Props mirror AppHeader.
 *
 * `hideTabBar` drops the second row: the guided tour opens on the graph alone,
 * and a bar of tabs it has not introduced yet is noise on top of the one thing
 * it is asking the reader to look at.
 */
export function AppHeaderWide({
  round,
  topic,
  tab,
  setTab,
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
  const [llmOpen, setLlmOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();

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

  const llmSaved = (() => {
    if (!BYOK_ENABLED) return null;
    try {
      const s = JSON.parse(sessionStorage.getItem("llmSettings") ?? "{}");
      return s?.apiKey ? s : null;
    } catch {
      return null;
    }
  })();

  const menuItem = {
    ...btn(false),
    width: "100%",
    justifyContent: "flex-start",
    height: 32,
    padding: "0 10px",
    borderRadius: 4,
    border: "none",
  };
  // Wrapper for the import/export pair, which the tour rings as one. Reproduces
  // the column the menu lays its buttons out in, so wrapping changes nothing.
  const menuGroup = { display: "flex", flexDirection: "column", gap: 2 };
  const close = (fn) => () => {
    fn();
    setMenuOpen(false);
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
            rel="noreferrer"
          >
            <img
              src="ieit_logo.svg"
              alt="Institute for Ethics in IT, TU Hamburg"
              style={{ height: 36 }}
            />
          </a>
          {/* Decorative: the app is already named in the heading beside it. */}
          <img src="favicon.svg" alt="" style={{ height: 36 }} />
          <div>
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
              Reflective Equilibrium — Round {round}
            </h1>
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

          <Tooltip text="Undo the last change. Keyboard shortcut: Ctrl+Z.">
            <button
              data-tutorial="btn-undo"
              onClick={onUndo}
              disabled={!canUndo}
              style={{ ...btn(false), opacity: canUndo ? 1 : 0.4 }}
            >
              ↩ Undo
            </button>
          </Tooltip>

          <div style={inlineDividerStyle} />

          <Tooltip text="Start the step-by-step tour.">
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
            <Tooltip text="Settings — theme, font, import, export, and LLM configuration.">
              <button
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
                    minWidth: weightsOpen ? 248 : 180,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  <Tooltip text="Return to the home screen. Unsaved changes will be lost.">
                    <button
                      data-tutorial="btn-home"
                      onClick={close(onHome)}
                      style={menuItem}
                    >
                      <span style={menuIconStyle}>←</span>Home
                    </button>
                  </Tooltip>

                  <div style={menuDividerStyle} />

                  <Tooltip text="Configure your LLM provider, model name, and API key.">
                    <button
                      data-tutorial="btn-llm"
                      onClick={() => {
                        setMenuOpen(false);
                        setLlmOpen(true);
                      }}
                      style={menuItem}
                    >
                      <span style={menuIconStyle}>⚙</span>
                      {llmSaved ? `LLM: ${llmSaved.model}` : "LLM settings"}
                    </button>
                  </Tooltip>
                  <div style={menuDividerStyle} />

                  {/* The settings from here down flip in place and say so in
                      their own label — "Hide nav bar" becomes "Show nav bar".
                      Closing the menu fired the change and then hid the only
                      evidence of it, so these stay open; only the rows that
                      navigate or open a modal close it. */}
                  <Tooltip text="Hide the text panel's section nav bar, which also carries its search box.">
                    <button
                      onClick={() => setShowTabNav((s) => !s)}
                      style={menuItem}
                    >
                      <span style={menuIconStyle}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ display: "block" }}
                        >
                          <circle cx="11" cy="11" r="7" />
                          <line x1="16.5" y1="16.5" x2="22" y2="22" />
                        </svg>
                      </span>
                      {showTabNav ? "Hide nav bar" : "Show nav bar"}
                    </button>
                  </Tooltip>

                  <Tooltip text="Expand or collapse every card in the text panel at once.">
                    <button onClick={onExpandAll} style={menuItem}>
                      <span style={menuIconStyle}>⇅</span>
                      {allExpanded ? "Minimize toggles" : "Expand toggles"}
                    </button>
                  </Tooltip>

                  {/* The tour used to stop and explain this one. It says so
                      itself now, so the tour can stay short. */}
                  <Tooltip text="The graph shows arguments by default — the entailments and preclusions that carry the weight. Switch this on and the softer links appear too: one element supporting, conflicting with, undermining, or presupposing another. It also adds a step to the Assist cycle, where the model proposes them.">
                    <button
                      onClick={() => setHideNonEntailsRels((s) => !s)}
                      style={{ ...menuItem, textAlign: "left " }}
                    >
                      <span style={menuIconStyle}>→</span>
                      {hideNonEntailsRels
                        ? "Show all relations"
                        : "Arguments only"}
                    </button>
                  </Tooltip>

                  {BACKEND_ENABLED && (
                    <Tooltip text="When on, detected arguments are verified for formal validity, auto-trimmed, and stripped of meaning postulates. When off, the model's raw arguments are surfaced unchecked.">
                      <button
                        onClick={() => setVerifyArguments((s) => !s)}
                        style={{ ...menuItem, textAlign: "left" }}
                      >
                        <span style={menuIconStyle}>
                          {verifyArguments ? "✓" : "✗"}
                        </span>
                        Argument checker: {verifyArguments ? "on" : "off"}
                      </button>
                    </Tooltip>
                  )}

                  {BACKEND_ENABLED && (
                    <>
                      <div style={menuDividerStyle} />

                      <button
                        onClick={() => setWeightsOpen((o) => !o)}
                        style={{
                          ...menuItem,
                          color: weightsChanged ? C.principle.high : undefined,
                        }}
                      >
                        <span style={menuIconStyle}>⚖</span>
                        Model weights{weightsChanged ? " *" : ""}
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 9,
                            color: C.dim,
                          }}
                        >
                          {weightsOpen ? "▲" : "▼"}
                        </span>
                      </button>
                      {weightsOpen && (
                        <div style={{ padding: "4px 8px 8px 8px" }}>
                          <WeightTriangle
                            weights={weights}
                            onChange={onWeightsChange}
                            weightsChanged={weightsChanged}
                          />
                          {weightsChanged && (
                            <button
                              onClick={onResetWeights}
                              style={{
                                marginTop: 4,
                                background: "transparent",
                                border: `1px solid ${C.border}`,
                                color: C.dim,
                                borderRadius: 4,
                                padding: "2px 8px",
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div style={menuDividerStyle} />

                  <Tooltip text="Pick a font, including one drawn for dyslexic readers.">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setFontOpen(true);
                      }}
                      style={menuItem}
                    >
                      <span style={menuIconStyle}>Aa</span>Select Font
                    </button>
                  </Tooltip>

                  <Tooltip text="Switch between the dark and light themes.">
                    <button onClick={toggleTheme} style={menuItem}>
                      <span style={menuIconStyle}>
                        {isDark ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: "block" }}
                          >
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                          </svg>
                        ) : (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: "block" }}
                          >
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                          </svg>
                        )}
                      </span>
                      {isDark ? "Light mode" : "Dark mode"}
                    </button>
                  </Tooltip>

                  <div style={menuDividerStyle} />

                  <div style={menuGroup} data-tutorial="menu-files">
                    <Tooltip text="Import a previously exported JSON file to restore an RE state.">
                      <button
                        onClick={() => {
                          handleImportClick();
                          setMenuOpen(false);
                        }}
                        style={menuItem}
                      >
                        <span style={menuIconStyle}>↑</span>Import
                      </button>
                    </Tooltip>
                    <Tooltip text="Export the current RE state as a JSON file you can re-import later.">
                      <button
                        onClick={close(onDownload)}
                        style={{ ...menuItem, color: C.theory.high }}
                      >
                        <span style={menuIconStyle}>↓</span>Export
                      </button>
                    </Tooltip>
                    {BACKEND_ENABLED && (
                      <Tooltip text="Save session to the backend server. Reload it from the home screen.">
                        <button
                          onClick={close(onSave)}
                          disabled={saveBusy}
                          style={{
                            ...menuItem,
                            ...(saveColor
                              ? { color: saveColor, borderColor: saveColor }
                              : {}),
                          }}
                        >
                          <span style={menuIconStyle}>{saveLabel}</span>Save
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <LLMSettingsModal open={llmOpen} onClose={() => setLlmOpen(false)} />
      <FontSettingsModal open={fontOpen} onClose={() => setFontOpen(false)} />

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
          <Tooltip text="AI-guided mode — elicit judgments, suggest principles and relations.">
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
          <Tooltip text="View your RE state — switch between graph, text, coherence and history.">
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
            <Tooltip text="Run the formal rethon RE simulation on your active elements.">
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
