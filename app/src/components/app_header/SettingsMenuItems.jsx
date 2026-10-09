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

/**
 * @param {Object}   props
 * @param {Object}   props.itemStyle - The layout's own menu-row style.
 * @param {function(): void} props.closeMenu - Rows that leave the menu call it.
 * @param {function(): void} props.onOpenLlm
 * @param {function(): void} props.onOpenPrivacy
 * @param {function(): void} props.onOpenFont
 * The rest are AppHeader's, passed through unchanged.
 */
export function SettingsMenuItems({
  itemStyle,
  closeMenu,
  onOpenLlm,
  onOpenPrivacy,
  onOpenFont,
  onHome,
  hideNonEntailsRels,
  setHideNonEntailsRels,
  showProcessTags,
  setShowProcessTags,
  onResetLayout,
  verifyArguments,
  setVerifyArguments,
  showTabNav,
  setShowTabNav,
  allExpanded,
  onExpandAll,
  handleImportClick,
  handleTextImportClick,
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
        {/* Ringed by the tour, which says what the three hidden types are:
            the graph opens on arguments alone, and nothing on it hints that
            anything else exists. */}
        <MenuToggle
          data-tutorial="menu-relations"
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
        {/* The simulation weights used to sit here. They steer the Simulate
            tab alone, and are set there now, beside the result they shape. */}

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
        <Tooltip text={MENU_TOOLTIPS.textImport}>
          <button onClick={leaving(handleTextImportClick)} style={itemStyle}>
            <span style={menuIconStyle}>¶</span>
            {MENU_LABELS.textImport}
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
            <button
              // Ringed by the tour; the narrow menu's Merge tile carries it too.
              data-tutorial="menu-merge"
              onClick={leaving(handleMergeSampleClick)}
              style={itemStyle}
            >
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
