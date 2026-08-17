/**
 * @fileoverview Narrow (mobile) layout for AppHeader: title + hamburger menu.
 * @module components/app_header/AppHeaderNarrow
 */

import { cloneElement, useState } from "react";
import { C } from "../../constants/colors.js";
import { useTheme } from "../../hooks/useTheme.js";
import { BACKEND_ENABLED, BYOK_ENABLED } from "../../config.js";
import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { FontSettingsModal } from "./FontSettingsModal.jsx";
import { WORKFLOW_PHASE_LABELS } from "../../utils/workflowUtils.js";
import {
  ASSIST_TABS,
  SIMULATE_TABS,
  TAB_ICONS,
  TAB_LABELS,
} from "../../constants/tabConstants.jsx";
import {
  btn,
  menuIconStyle,
  menuDividerStyle,
  menuGroupStyle,
  menuHeadingStyle,
} from "./appHeaderStyles.js";
import { MENU_HEADINGS, MENU_LABELS, MENU_TOOLTIPS } from "./menuText.js";
import { MoonIcon, SearchIcon } from "./menuIcons.jsx";
import { MenuToggle } from "./MenuToggle.jsx";
import { TopicLabel } from "./TopicLabel.jsx";
import { WeightTriangle } from "../workflows/WeightTriangle.jsx";
import { TOUR_Z } from "../TutorialStepper.jsx";

export function AppHeaderNarrow({
  round,
  topic,
  tab,
  setTab,
  menuOpen,
  setMenuOpen,
  ANALYZE_TABS,
  isTabVisible,
  handleImportClick,
  onDownload,
  onSave,
  canSaveToServer,
  saveLabel,
  saveColor,
  saveBusy,
  onHome,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  workflowPhase,
  workflowLoops,
  onStartWorkflow,
  onStopWorkflow,
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
  onStartStepper,
  tourActive,
}) {
  const [llmOpen, setLlmOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const {
    isDark,
    accessible,
    toggle: toggleTheme,
    toggleAccessible,
  } = useTheme();

  const llmSaved = (() => {
    if (!BYOK_ENABLED) return null;
    try {
      const s = JSON.parse(sessionStorage.getItem("llmSettings") ?? "{}");
      return s?.apiKey ? s : null;
    } catch {
      return null;
    }
  })();

  const menuBtn = (active = false) => ({
    ...btn(active),
    width: "100%",
    justifyContent: "flex-start",
    gap: 8,
  });
  const close = (fn) => () => {
    fn();
    setMenuOpen(false);
  };
  // Every row puts its symbol in the same box so the labels all start at the
  // same x. Tab icons default to 2em, which is wider than that box, so they are
  // asked for the box's size instead.
  const tabIcon = (t) => (
    <span style={menuIconStyle}>
      {cloneElement(TAB_ICONS[t], { size: 20 })}
    </span>
  );

  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <div
        style={{
          display: "flex",
          // Top, not centre: the topic wraps to as many lines as it needs, and
          // the menu button should stay put rather than drift down beside it.
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 14,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              margin: 0,
            }}
          >
            Round {round}
          </h1>
          <TopicLabel
            topic={topic}
            style={{ fontSize: 12, color: C.dim }}
            wrap
          />
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          <button
            data-tutorial="btn-menu"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            style={{ ...btn(menuOpen), border: `1px solid ${C.text}` }}
          >
            ☰
          </button>
        </div>
      </div>
      <LLMSettingsModal open={llmOpen} onClose={() => setLlmOpen(false)} />
      <FontSettingsModal open={fontOpen} onClose={() => setFontOpen(false)} />
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            // The tour walks this menu section by section, so while it runs the
            // menu has to sit above the tour's dim rather than under it. The
            // ring draws higher still, and dims everything it does not enclose.
            zIndex: tourActive ? TOUR_Z.menu : 100,
            // Display only for the duration: a tap during the tour falls
            // through to the dim, which is what closes the tour, rather than
            // firing a menu item the card is in the middle of explaining.
            pointerEvents: tourActive ? "none" : undefined,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            width: "100%",
            overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <button onClick={close(onHome)} style={menuBtn()}>
            <span style={menuIconStyle}>←</span>
            {MENU_LABELS.home}
          </button>
          <button
            data-tutorial="menu-undo"
            onClick={close(onUndo)}
            disabled={!canUndo}
            style={{ ...menuBtn(), opacity: canUndo ? 1 : 0.4 }}
          >
            <span style={menuIconStyle}>↩</span>Undo
          </button>
          <button
            onClick={close(onRedo)}
            disabled={!canRedo}
            style={{ ...menuBtn(), opacity: canRedo ? 1 : 0.4 }}
          >
            <span style={menuIconStyle}>↪</span>Redo
          </button>
          {/* Same place the wide layout keeps its ? button — right after Undo.
              Without it the tour had no entry point at this width at all. */}
          <button onClick={close(onStartStepper)} style={menuBtn()}>
            <span style={menuIconStyle}>?</span>Guided tour
          </button>
          <div style={menuDividerStyle} />
          <div data-tutorial="menu-assist" style={menuGroupStyle}>
            <div style={menuHeadingStyle}>Assist</div>
            {ASSIST_TABS.filter(isTabVisible).map((t) => (
              <button
                key={t}
                onClick={close(() => setTab(t))}
                style={menuBtn(tab === t)}
              >
                {tabIcon(t)}
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
                <span style={menuIconStyle}>✕</span>Stop Workflow
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
                <span style={menuIconStyle}>▶</span>Start Workflow
              </button>
            )}
          </div>
          <div style={menuDividerStyle} />
          <div data-tutorial="menu-analyze" style={menuGroupStyle}>
            <div style={menuHeadingStyle}>Analyze</div>
            {/* Text is a tab of its own at this width, not the side panel the
                wide layout toggles, so it belongs beside the other views. */}
            <button
              onClick={close(() => setTab("text"))}
              style={menuBtn(tab === "text")}
            >
              <span style={menuIconStyle}>≡</span>
              Text
            </button>
            {ANALYZE_TABS.filter(isTabVisible).map((t) => (
              <button
                key={t}
                onClick={close(() => setTab(t))}
                style={menuBtn(tab === t)}
              >
                {tabIcon(t)}
                {TAB_LABELS[t]}
              </button>
            ))}
            {BACKEND_ENABLED && (
              <>
                <div style={menuHeadingStyle}>Simulate</div>
                {SIMULATE_TABS.filter(isTabVisible).map((t) => (
                  <button
                    key={t}
                    onClick={close(() => setTab(t))}
                    style={menuBtn(tab === t)}
                  >
                    {tabIcon(t)}
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </>
            )}
          </div>
          <div style={menuDividerStyle} />
          {/* One wrapper, four blocks: the tour rings the settings as a whole,
              and the headings inside it are the same ones, in the same order,
              as the wide menu's — content first, the panel-deep rows last.
              Nothing here closes the menu except the two rows that open a
              modal: a toggle's switch is the only evidence it fired. */}
          <div data-tutorial="menu-settings" style={menuGroupStyle}>
            <div style={menuHeadingStyle}>{MENU_HEADINGS.content}</div>
            <MenuToggle
              icon="→"
              label={MENU_LABELS.relations}
              tooltip={MENU_TOOLTIPS.relations}
              on={!hideNonEntailsRels}
              onToggle={() => setHideNonEntailsRels((s) => !s)}
              style={menuBtn()}
            />
            {BACKEND_ENABLED && (
              <MenuToggle
                icon="⊨"
                label={MENU_LABELS.checker}
                tooltip={MENU_TOOLTIPS.checker}
                on={verifyArguments}
                onToggle={() => setVerifyArguments((s) => !s)}
                style={menuBtn()}
              />
            )}

            <div style={menuDividerStyle} />
            <div style={menuHeadingStyle}>{MENU_HEADINGS.model}</div>
            <button
              onClick={() => {
                setMenuOpen(false);
                setLlmOpen(true);
              }}
              style={menuBtn()}
            >
              <span style={menuIconStyle}>⚙</span>
              {llmSaved ? `LLM: ${llmSaved.model}` : MENU_LABELS.llm}
            </button>
            {BACKEND_ENABLED && (
              <>
                <button
                  onClick={() => setWeightsOpen((o) => !o)}
                  aria-expanded={weightsOpen}
                  style={{
                    ...menuBtn(),
                    color: weightsChanged ? C.principle.accent : undefined,
                  }}
                >
                  <span style={menuIconStyle}>⚖</span>
                  {MENU_LABELS.weights}
                  {weightsChanged ? " *" : ""}
                  <span
                    style={{ marginLeft: "auto", fontSize: 9, color: C.dim }}
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
            <div style={menuHeadingStyle}>{MENU_HEADINGS.appearance}</div>
            <MenuToggle
              icon={<MoonIcon />}
              label={MENU_LABELS.theme}
              tooltip={MENU_TOOLTIPS.theme}
              on={isDark}
              onToggle={toggleTheme}
              style={menuBtn()}
            />
            <MenuToggle
              icon="◐"
              label={MENU_LABELS.contrast}
              tooltip={MENU_TOOLTIPS.contrast}
              on={accessible}
              onToggle={toggleAccessible}
              style={menuBtn()}
            />
            <button
              onClick={() => {
                setMenuOpen(false);
                setFontOpen(true);
              }}
              style={menuBtn()}
            >
              <span style={menuIconStyle}>Aa</span>
              {MENU_LABELS.font}
            </button>

            <div style={menuDividerStyle} />
            <div style={menuHeadingStyle}>{MENU_HEADINGS.text}</div>
            <MenuToggle
              icon={<SearchIcon />}
              label={MENU_LABELS.navBar}
              tooltip={MENU_TOOLTIPS.navBar}
              on={showTabNav}
              onToggle={() => setShowTabNav((s) => !s)}
              style={menuBtn()}
            />
            <MenuToggle
              icon="⇅"
              label={MENU_LABELS.cards}
              tooltip={MENU_TOOLTIPS.cards}
              on={allExpanded}
              onToggle={onExpandAll}
              style={menuBtn()}
            />
          </div>
          <div style={menuDividerStyle} />
          <div data-tutorial="menu-files" style={menuGroupStyle}>
            <div style={menuHeadingStyle}>{MENU_HEADINGS.session}</div>
            <button
              onClick={() => {
                handleImportClick();
                setMenuOpen(false);
              }}
              style={menuBtn()}
            >
              <span style={menuIconStyle}>↑</span>
              {MENU_LABELS.import}
            </button>
            <button
              onClick={close(onDownload)}
              style={{ ...menuBtn(), color: C.theory.text }}
            >
              <span style={menuIconStyle}>↓</span>
              {MENU_LABELS.export}
            </button>
            {BACKEND_ENABLED && canSaveToServer && (
              <button
                onClick={close(onSave)}
                disabled={saveBusy}
                style={{
                  ...menuBtn(),
                  ...(saveColor
                    ? { color: saveColor, borderColor: saveColor }
                    : {}),
                }}
              >
                <span style={menuIconStyle}>{saveLabel}</span>
                {MENU_LABELS.save}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
