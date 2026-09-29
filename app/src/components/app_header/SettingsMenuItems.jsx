/**
 * @fileoverview What the ☰ menu holds besides navigation: Home, the settings,
 * and the session's files.
 *
 * One component for both layouts. The wide header's ☰ is exactly this list; the
 * narrow header's ☰ is the app's navigation, with this list one level down
 * behind its Settings row. Written once so that a setting added to one menu
 * cannot be missing from the other — which is what the narrow menu's own copy
 * of these rows risked every time a row was added.
 *
 * The dialogs the rows open are the headers' own, since each hands the focus
 * back to its own ☰ button; the rows only ask for them.
 *
 * @module components/app_header/SettingsMenuItems
 */

import { C } from "../../constants/colors.js";
import { useTheme } from "../../hooks/useTheme.js";
import { BACKEND_ENABLED, BYOK_ENABLED } from "../../config.js";
import { useLLMSettings } from "../../utils/llmKey.js";
import {
  menuIconStyle,
  menuDividerStyle,
  menuGroupStyle,
  menuHeadingStyle,
} from "./appHeaderStyles.js";
import { MENU_HEADINGS, MENU_LABELS, MENU_TOOLTIPS } from "./menuText.js";
import { MoonIcon, SearchIcon } from "./menuIcons.jsx";
import { MergeIcon } from "../Icons.jsx";
import { MenuToggle } from "./MenuToggle.jsx";
import { Tooltip } from "../Tooltip.jsx";
import {
  WeightTriangle,
  WEIGHT_TRIANGLE_WIDTH,
} from "../workflows/WeightTriangle.jsx";

/** Side padding of the opened weights panel. */
const WEIGHTS_PAD = 8;

/**
 * The width the opened weights panel needs, padding included. The wide menu is
 * at least this wide from the start, so opening the panel does not widen it.
 */
export const WEIGHTS_PANEL_WIDTH = WEIGHT_TRIANGLE_WIDTH + 2 * WEIGHTS_PAD;

/**
 * @param {Object}   props
 * @param {Object}   props.itemStyle - The layout's own menu-row style.
 * @param {function(): void} props.closeMenu - Rows that leave the menu call it.
 * @param {function(): void} props.onOpenLlm
 * @param {function(): void} props.onOpenPrivacy
 * @param {function(): void} props.onOpenFont
 * @param {boolean}  props.weightsOpen - Held by the header, so the weights
 *   stay open across the menu's views.
 * @param {function} props.setWeightsOpen
 * The rest are AppHeader's, passed through unchanged.
 */
export function SettingsMenuItems({
  itemStyle,
  closeMenu,
  onOpenLlm,
  onOpenPrivacy,
  onOpenFont,
  weightsOpen,
  setWeightsOpen,
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
}) {
  const {
    isDark,
    accessible,
    toggle: toggleTheme,
    toggleAccessible,
  } = useTheme();

  // The BYOK_ENABLED test stays here rather than in the store: whether to name
  // the model in the menu is a display question, and llmKey.js does not know
  // which build it is in.
  const settings = useLLMSettings();
  const llmSaved = BYOK_ENABLED && settings?.apiKey ? settings : null;

  /** A row that does its job and takes the menu away with it. */
  const leaving = (fn) => () => {
    closeMenu();
    fn();
  };

  return (
    <>
      <Tooltip text={MENU_TOOLTIPS.home}>
        <button
          data-tutorial="btn-home"
          onClick={leaving(onHome)}
          style={itemStyle}
        >
          <span style={menuIconStyle}>←</span>
          {MENU_LABELS.home}
        </button>
      </Tooltip>

      <div style={menuDividerStyle} />

      {/* One wrapper, four blocks: the tour can ring the settings as a whole.
          Content first: these decide what the app works with — which relations
          exist at all, and whether an argument has to pass the checker to
          become one. The rows that dress a single panel come last. Nothing in
          here closes the menu except the rows that open a dialog: a toggle's
          switch is the only evidence it fired. */}
      <div data-tutorial="menu-settings" style={menuGroupStyle}>
        <div style={menuHeadingStyle}>{MENU_HEADINGS.content}</div>
        {/* The tour used to stop and explain this one. It says so itself now,
            so the tour can stay short. */}
        <MenuToggle
          icon="→"
          label={MENU_LABELS.relations}
          tooltip={MENU_TOOLTIPS.relations}
          on={!hideNonEntailsRels}
          onToggle={() => setHideNonEntailsRels((s) => !s)}
          style={itemStyle}
        />
        {/* Only once there has been a merge: before one, there is nothing it
            could show. */}
        {showProcessTags != null && (
          <MenuToggle
            icon="⊕"
            label={MENU_LABELS.processTags}
            tooltip={MENU_TOOLTIPS.processTags}
            on={showProcessTags}
            onToggle={() => setShowProcessTags((s) => !s)}
            style={itemStyle}
          />
        )}
        {/* Only once something is pinned: before that there is no placement
            of the reader's to let go of. */}
        {onResetLayout && (
          <Tooltip text={MENU_TOOLTIPS.resetLayout}>
            <button onClick={leaving(onResetLayout)} style={itemStyle}>
              <span style={menuIconStyle}>⟲</span>
              {MENU_LABELS.resetLayout}
            </button>
          </Tooltip>
        )}
        {BACKEND_ENABLED && (
          <MenuToggle
            icon="⊨"
            label={MENU_LABELS.checker}
            tooltip={MENU_TOOLTIPS.checker}
            on={verifyArguments}
            onToggle={() => setVerifyArguments((s) => !s)}
            style={itemStyle}
          />
        )}
        {/* Last in Content: they steer what the simulation computes, as the two
            above steer what the app works with — and, being a panel that
            opens in place, they sit where opening it moves nothing below. */}
        {BACKEND_ENABLED && (
          <>
            <Tooltip text={MENU_TOOLTIPS.weights}>
              <button
                onClick={() => setWeightsOpen((o) => !o)}
                aria-expanded={weightsOpen}
                // The override is spread in rather than written as
                // `color: changed ? accent : undefined`: that form overwrites
                // the row's own colour with `undefined`, React then sets no
                // colour at all, and the row falls back to the browser's
                // default button ink — which is how this one row came to be
                // brighter than every other item in the menu.
                style={
                  weightsChanged
                    ? { ...itemStyle, color: C.principle.accent }
                    : itemStyle
                }
              >
                <span style={menuIconStyle}>⚖</span>
                {MENU_LABELS.weights}
                {weightsChanged ? " *" : ""}
                <span style={{ marginLeft: "auto", fontSize: 9, color: C.dim }}>
                  {weightsOpen ? "▲" : "▼"}
                </span>
              </button>
            </Tooltip>
            {weightsOpen && (
              <div
                style={{ padding: `4px ${WEIGHTS_PAD}px 8px ${WEIGHTS_PAD}px` }}
              >
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
        <div style={menuHeadingStyle}>{MENU_HEADINGS.model}</div>
        <Tooltip text={MENU_TOOLTIPS.llm}>
          <button
            data-tutorial="btn-llm"
            onClick={leaving(onOpenLlm)}
            style={itemStyle}
          >
            <span style={menuIconStyle}>⚙</span>
            {llmSaved ? `LLM: ${llmSaved.model}` : MENU_LABELS.llm}
          </button>
        </Tooltip>
        <Tooltip text={MENU_TOOLTIPS.privacy}>
          <button onClick={leaving(onOpenPrivacy)} style={itemStyle}>
            <span style={menuIconStyle}>ⓘ</span>
            {MENU_LABELS.privacy}
          </button>
        </Tooltip>

        <div style={menuDividerStyle} />
        <div style={menuHeadingStyle}>{MENU_HEADINGS.appearance}</div>
        <MenuToggle
          icon={<MoonIcon />}
          label={MENU_LABELS.theme}
          tooltip={MENU_TOOLTIPS.theme}
          on={isDark}
          onToggle={toggleTheme}
          style={itemStyle}
        />
        <MenuToggle
          icon="◐"
          label={MENU_LABELS.contrast}
          tooltip={MENU_TOOLTIPS.contrast}
          on={accessible}
          onToggle={toggleAccessible}
          style={itemStyle}
        />
        <Tooltip text={MENU_TOOLTIPS.font}>
          <button onClick={leaving(onOpenFont)} style={itemStyle}>
            <span style={menuIconStyle}>Aa</span>
            {MENU_LABELS.font}
          </button>
        </Tooltip>

        {/* Both of these reach one panel and nothing else, which is why they
            sit below everything that reaches the whole app. */}
        <div style={menuDividerStyle} />
        <div style={menuHeadingStyle}>{MENU_HEADINGS.text}</div>
        <MenuToggle
          icon={<SearchIcon />}
          label={MENU_LABELS.navBar}
          tooltip={MENU_TOOLTIPS.navBar}
          on={showTabNav}
          onToggle={() => setShowTabNav((s) => !s)}
          style={itemStyle}
        />
        <MenuToggle
          icon="⇅"
          label={MENU_LABELS.cards}
          tooltip={MENU_TOOLTIPS.cards}
          on={allExpanded}
          onToggle={onExpandAll}
          style={itemStyle}
        />
      </div>

      <div style={menuDividerStyle} />

      <div style={menuGroupStyle} data-tutorial="menu-files">
        <div style={menuHeadingStyle}>{MENU_HEADINGS.session}</div>
        <Tooltip text={MENU_TOOLTIPS.import}>
          <button onClick={leaving(handleImportClick)} style={itemStyle}>
            <span style={menuIconStyle}>↑</span>
            {MENU_LABELS.import}
          </button>
        </Tooltip>
        {handleMergeClick && (
          <Tooltip text={MENU_TOOLTIPS.merge}>
            <button onClick={leaving(handleMergeClick)} style={itemStyle}>
              <span style={menuIconStyle}>
                <MergeIcon size={18} />
              </span>
              {MENU_LABELS.merge}
            </button>
          </Tooltip>
        )}
        {handleMergeSampleClick && (
          <Tooltip text={MENU_TOOLTIPS.mergeSample}>
            <button onClick={leaving(handleMergeSampleClick)} style={itemStyle}>
              <span style={menuIconStyle}>
                <MergeIcon size={18} />
              </span>
              {MENU_LABELS.mergeSample}
            </button>
          </Tooltip>
        )}
        <Tooltip text={MENU_TOOLTIPS.export}>
          <button
            onClick={leaving(onDownload)}
            style={{ ...itemStyle, color: C.theory.text }}
          >
            <span style={menuIconStyle}>↓</span>
            {MENU_LABELS.export}
          </button>
        </Tooltip>
      </div>
    </>
  );
}
