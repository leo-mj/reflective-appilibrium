/**
 * @fileoverview Narrow (mobile) layout for AppHeader: title + hamburger menu.
 * @module components/app_header/AppHeaderNarrow
 */

import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { C } from "../../constants/colors.js";
import { BACKEND_ENABLED } from "../../config.js";
import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { useLLMSettingsRequested } from "../../utils/llmKey.js";
import { useMenuEscape } from "../../hooks/useMenuEscape.js";
import { FontSettingsModal } from "./FontSettingsModal.jsx";
import { PrivacyModal } from "./PrivacyModal.jsx";
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
import { MENU_LABELS, MENU_TOOLTIPS } from "./menuText.js";
import { SettingsMenuItems } from "./SettingsMenuItems.jsx";
import { Tooltip } from "../Tooltip.jsx";
import { TopicLabel } from "./TopicLabel.jsx";
import { TOUR_Z } from "../tour/tourZ.js";
import { MergeIcon } from "../Icons.jsx";

/**
 * What sits above the ☰ menu — the app's padding, the round, the topic — and so
 * has to come off the height the menu is allowed, until the header has been
 * measured (`headerBottom`). Deliberately generous: too much only makes the
 * menu start scrolling a little early, while too little puts its last entry
 * back off the bottom of the screen.
 */
const MENU_TOP_ALLOWANCE = 96;

/**
 * Clear space above the menu card, between it and the topic, and below it,
 * between it and the bottom of the screen — which the height cap keeps free.
 */
const MENU_MARGIN = 14;

export function AppHeaderNarrow({
  round,
  step,
  onCloseRound,
  canCloseRound,
  topic,
  tab,
  setTab,
  menuOpen,
  setMenuOpen,
  ANALYZE_TABS,
  isTabVisible,
  handleImportClick,
  handleMergeClick,
  handleMergeSampleClick,
  onDownload,
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
  showProcessTags,
  setShowProcessTags,
  onResetLayout,
  verifyArguments,
  setVerifyArguments,
  weights,
  weightsChanged,
  onWeightsChange,
  onResetWeights,
  onStartStepper,
  tourActive,
  tourMenuView = null,
}) {
  const [llmOpen, setLlmOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [weightsOpen, setWeightsOpen] = useState(false);

  // As in the wide header: Escape and the menu's dialogs hand the focus back to ☰.
  const menuButtonRef = useRef(null);
  useMenuEscape({
    open: menuOpen,
    onClose: () => setMenuOpen(false),
    buttonRef: menuButtonRef,
    enabled: !tourActive,
  });

  // The wide header's, line for line — see the comment there.
  const llmRequests = useLLMSettingsRequested();
  const [seenLlmRequest, setSeenLlmRequest] = useState(llmRequests);
  if (seenLlmRequest !== llmRequests) {
    setSeenLlmRequest(llmRequests);
    setLlmOpen(true);
  }

  // `flexShrink: 0` because the menu is a column with a capped height: the rows
  // standing in it directly were squeezed to the height of their text, about
  // 18px, while the rows inside a section kept theirs. 44px is the touch target
  // a finger wants, which the menu can afford since the settings moved one
  // level down.
  const menuBtn = (active = false) => ({
    ...btn(active),
    width: "100%",
    height: 44,
    justifyContent: "flex-start",
    gap: 8,
    flexShrink: 0,
  });
  const close = (fn) => () => {
    fn();
    setMenuOpen(false);
  };

  // The menu has two views: the app's navigation, and — behind its Settings
  // row — everything the wide header's ☰ holds. One list of both did not fit a
  // phone at a size a finger can use. A menu that closes comes back on the
  // navigation, which is what it is mostly opened for.
  const [view, setView] = useState(tourMenuView ?? "main");
  const [wasOpen, setWasOpen] = useState(menuOpen);
  if (wasOpen !== menuOpen) {
    setWasOpen(menuOpen);
    if (!menuOpen) setView("main");
  }
  // The tour rings entries in both views, so it says which it wants. Only as it
  // crosses from one section to another, as with opening the menu at all: a
  // reader moving between the views mid-section is left where they went.
  const [seenTourView, setSeenTourView] = useState(tourMenuView);
  if (seenTourView !== tourMenuView) {
    setSeenTourView(tourMenuView);
    if (tourMenuView) setView(tourMenuView);
  }

  // The bottom of the header row, measured as the menu opens — before it
  // paints, so nothing jumps — and again if the window changes size under it
  // (a phone turned on its side). The backdrop starts there, and the card's
  // height is what is left below it: a fixed allowance for the header left
  // the bottom of the screen empty whenever the topic took fewer lines than
  // assumed, while the card scrolled.
  const headerRowRef = useRef(null);
  const [headerBottom, setHeaderBottom] = useState(0);
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const measure = () =>
      setHeaderBottom(
        headerRowRef.current?.getBoundingClientRect().bottom ?? 0,
      );
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [menuOpen]);

  // Switching views replaces the rows under the finger, so the list starts from
  // its top, and the focus goes to the row that leads back — Back into
  // Settings, the Settings row out of it — where a keyboard would look for it.
  const menuRef = useRef(null);
  const backRef = useRef(null);
  const settingsRowRef = useRef(null);
  const focusOnSwitch = useRef(false);
  useEffect(() => {
    if (menuRef.current) menuRef.current.scrollTop = 0;
    if (!focusOnSwitch.current) return;
    focusOnSwitch.current = false;
    const row = view === "settings" ? backRef : settingsRowRef;
    row.current?.focus({ preventScroll: true });
  }, [view]);
  const switchTo = (next) => {
    focusOnSwitch.current = true;
    setView(next);
  };

  /**
   * A view, as a tile: its icon over its name. The views are most of what this
   * menu is opened for, and as rows at a finger's height they ran past the
   * bottom of the screen; three to a line, they fit with room to spare, each a
   * bigger target than a row was. The current one is filled, which says where
   * the reader is at a glance.
   */
  const tile = ({ key, icon, label, current, onClick, ...rest }) => (
    <button
      key={key}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      style={{ ...btn(current), ...TILE_STYLE, height: tileHeight }}
      {...rest}
    >
      <span aria-hidden="true" style={TILE_ICON_STYLE}>
        {icon}
      </span>
      {label}
    </button>
  );
  // Tab icons default to 2em; a tile asks for a size of its own.
  const tabTile = (t) =>
    tile({
      key: t,
      // Same id the wide tab bar gives the same tab, so the guided tour can
      // ring a view here without a second route.
      "data-tutorial": `tab-${t}`,
      icon: cloneElement(TAB_ICONS[t], { size: TILE_ICON }),
      label: TILE_LABELS[t] ?? TAB_LABELS[t],
      current: tab === t,
      onClick: close(() => setTab(t)),
    });

  // Merging another process in, as a tile among the Analyze views rather than
  // only a row under Settings → Session. Offered where Settings offers it. On
  // the sample process that is the demo merge — the second sample process, the
  // one merge a reader there has to hand — as "Merge (demo)" is under Settings.
  // One word either way, so the name stays on one line of its tile; the
  // tooltip says which merge it is.
  const mergeAction = handleMergeSampleClick
    ? {
        label: MENU_LABELS.merge,
        tooltip: MENU_TOOLTIPS.mergeSample,
        run: handleMergeSampleClick,
      }
    : handleMergeClick
      ? {
          label: MENU_LABELS.merge,
          tooltip: MENU_TOOLTIPS.merge,
          run: handleMergeClick,
        }
      : null;
  // How many lines of tiles the first view holds, three to a line, which is
  // what the tiles are sized by.
  const analyzeTiles =
    1 +
    ANALYZE_TABS.filter(isTabVisible).length +
    (BACKEND_ENABLED ? SIMULATE_TABS.filter(isTabVisible).length : 0) +
    (mergeAction ? 1 : 0);
  const tileHeight = tileHeightFor(
    Math.ceil(ASSIST_TABS.filter(isTabVisible).length / 3) +
      Math.ceil(analyzeTiles / 3),
  );

  const mergeTile = mergeAction && (
    <Tooltip key="merge" text={mergeAction.tooltip}>
      {tile({
        icon: <MergeIcon size={TILE_ICON} />,
        label: mergeAction.label,
        current: false,
        onClick: close(mergeAction.run),
      })}
    </Tooltip>
  );

  /**
   * One of the four actions the wide header keeps beside its ☰, in a strip
   * across the top: an icon over a short name, since Undo and Redo as bare
   * arrows are too easily read the wrong way round.
   */
  const action = ({ icon, label, onClick, disabled, ...rest }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...btn(false), ...ACTION_STYLE, opacity: disabled ? 0.4 : 1 }}
      {...rest}
    >
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <div
        ref={headerRowRef}
        style={{
          display: "flex",
          // Top, not centre: the topic wraps to as many lines as it needs, and
          // the menu button should stay put rather than drift down beside it.
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div data-tutorial="topic" style={{ minWidth: 0 }}>
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
            Round {round} · Step {step}
          </h1>
          <TopicLabel
            topic={topic}
            style={{ fontSize: 12, color: C.dim }}
            wrap
          />
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
          <button
            ref={menuButtonRef}
            data-tutorial="btn-menu"
            onClick={() => setMenuOpen((m) => !m)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            // The one way into everything at this width, so a finger's size:
            // 44px square, and a glyph big enough to read as the menu.
            style={{
              ...btn(menuOpen),
              border: `1px solid ${C.text}`,
              width: 44,
              height: 44,
              padding: 0,
              fontSize: 20,
            }}
          >
            ☰
          </button>
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
      {/* Behind the card, over everything below the header: a tap on it
          closes the menu, and dimming and blurring set the card apart from the
          graph under it — which through the gap above the card showed as stray
          outlines. From the header down rather than over it, so the round, the
          topic and ☰ stay on their own ground and legible in either theme.
          Not while the tour walks the menu: the tour has a dim of its own, and
          this would swallow every tap meant for it. */}
      {menuOpen && !tourActive && (
        <div
          data-testid="menu-backdrop"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            top: headerBottom,
            zIndex: 99,
            background: "rgba(0, 0, 0, 0.5)",
            // Blurred as well as dimmed: on the dark canvas a dim alone left
            // the controls under the gap crisp enough to read as part of the
            // menu.
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
        />
      )}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            marginTop: MENU_MARGIN,
            // The tour walks this menu section by section, so while it runs the
            // menu has to sit above the tour's dim rather than under it. The
            // ring draws higher still, and dims everything it does not enclose.
            zIndex: tourActive ? TOUR_Z.menu : 100,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            // Room inside the card, most of it above the first line of targets
            // and below the last, where they otherwise sat against the edge.
            padding: "12px 8px",
            display: "flex",
            flexDirection: "column",
            // The navigation spreads out to use the height a phone has; the
            // Settings view is a list, spaced as the wide menu's is.
            gap: view === "settings" ? 2 : NAV_GAP,
            width: "100%",
            // This menu is longer than a phone is tall, and `overflowY` has
            // nothing to do until something bounds it — so the last entries ran
            // off the bottom of the screen with no way to reach them. The tour
            // needs them worse than anyone: it rings them one at a time, and
            // scrolls this box to bring each one out from behind its sheet,
            // whose height it publishes on <html> for exactly that.
            maxHeight: `calc(100dvh - var(--tour-sheet-h, 0px) - ${(headerBottom || MENU_TOP_ALLOWANCE) + 2 * MENU_MARGIN}px)`,
            overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {view === "settings" ? (
            <>
              <button
                ref={backRef}
                onClick={() => switchTo("main")}
                style={menuBtn()}
              >
                <span style={menuIconStyle}>‹</span>
                {MENU_LABELS.back}
              </button>
              <div style={menuDividerStyle} />
              <SettingsMenuItems
                itemStyle={menuBtn()}
                closeMenu={() => setMenuOpen(false)}
                onOpenLlm={() => setLlmOpen(true)}
                onOpenPrivacy={() => setPrivacyOpen(true)}
                onOpenFont={() => setFontOpen(true)}
                weightsOpen={weightsOpen}
                setWeightsOpen={setWeightsOpen}
                onHome={onHome}
                hideNonEntailsRels={hideNonEntailsRels}
                setHideNonEntailsRels={setHideNonEntailsRels}
                showProcessTags={showProcessTags}
                setShowProcessTags={setShowProcessTags}
                onResetLayout={onResetLayout}
                verifyArguments={verifyArguments}
                setVerifyArguments={setVerifyArguments}
                weights={weights}
                weightsChanged={weightsChanged}
                onWeightsChange={onWeightsChange}
                onResetWeights={onResetWeights}
                showTabNav={showTabNav}
                setShowTabNav={setShowTabNav}
                allExpanded={allExpanded}
                onExpandAll={onExpandAll}
                handleImportClick={handleImportClick}
                handleMergeClick={handleMergeClick}
                handleMergeSampleClick={handleMergeSampleClick}
                onDownload={onDownload}
              />
            </>
          ) : (
            <>
              <div style={ACTION_STRIP_STYLE}>
                {/* First, where the wide header keeps its ☰: everything that
                    menu holds is behind this one. */}
                <Tooltip text={MENU_TOOLTIPS.settings}>
                  {action({
                    ref: settingsRowRef,
                    "data-tutorial": "menu-open-settings",
                    icon: "⚙",
                    label: MENU_LABELS.settings,
                    onClick: () => switchTo("settings"),
                  })}
                </Tooltip>
                {action({
                  "data-tutorial": "menu-undo",
                  icon: "↩",
                  label: "Undo",
                  onClick: close(onUndo),
                  disabled: !canUndo,
                })}
                {action({
                  icon: "↪",
                  label: "Redo",
                  onClick: close(onRedo),
                  disabled: !canRedo,
                })}
                {/* The wide layout's ? button. Without it the tour had no entry
                    point at this width. */}
                {action({
                  icon: "?",
                  label: "Tour",
                  "aria-label": "Guided tour",
                  onClick: close(onStartStepper),
                })}
              </div>
              {/* The wide header's Close round, which has no room beside the
                  heading here; offered while the round has anything in it, and
                  full width rather than a fifth action, so the strip does not
                  change shape as a round fills. */}
              {onCloseRound && canCloseRound && (
                <button onClick={close(onCloseRound)} style={menuBtn()}>
                  <span style={menuIconStyle}>⏹</span>
                  {MENU_LABELS.closeRound} {round}
                </button>
              )}
              <div style={menuDividerStyle} />
              <div data-tutorial="menu-assist" style={NAV_GROUP_STYLE}>
                <div style={menuHeadingStyle}>Assist</div>
                {/* Ahead of the views it runs through, and a row rather than a
                    tile: starting the loop is the section's main act, the tiles
                    are where it goes. */}
                {workflowPhase ? (
                  <button
                    data-tutorial="btn-workflow"
                    onClick={close(onStopWorkflow)}
                    style={{
                      ...menuBtn(),
                      ...WORKFLOW_STYLE,
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
                    data-tutorial="btn-workflow"
                    onClick={close(onStartWorkflow)}
                    style={{
                      ...menuBtn(),
                      ...WORKFLOW_STYLE,
                      color: C.supports,
                    }}
                  >
                    <span style={menuIconStyle}>▶</span>Start Workflow
                  </button>
                )}
                <div style={tileGrid(3)}>
                  {ASSIST_TABS.filter(isTabVisible).map(tabTile)}
                </div>
              </div>
              <div style={menuDividerStyle} />
              <div data-tutorial="menu-analyze" style={NAV_GROUP_STYLE}>
                <div style={menuHeadingStyle}>Analyze</div>
                {/* Simulate joins the views here rather than heading a line of
                    its own: three to a line, the group is two full-width rows
                    at most, and no name is squeezed into a quarter of the menu
                    ("Cluster/s") to fit four across. */}
                <div style={tileGrid(3)}>
                  {/* Text is a tab of its own at this width, not the side
                      panel the wide layout toggles, so it belongs beside the
                      other views. */}
                  {tile({
                    key: "text",
                    icon: <span style={{ fontSize: 26 }}>≡</span>,
                    label: "Text",
                    current: tab === "text",
                    onClick: close(() => setTab("text")),
                  })}
                  {ANALYZE_TABS.filter(isTabVisible).map(tabTile)}
                  {BACKEND_ENABLED &&
                    SIMULATE_TABS.filter(isTabVisible).map(tabTile)}
                  {mergeTile}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Where a tile names a view differently from the wide tab bar: a tile's name
 * has to fit one line of it, and "Merge Elements" broke onto two — and beside
 * the Merge tile read as a second way of doing the same thing. What that view
 * finds is pairs of elements making the same claim, so it is named for them.
 */
const TILE_LABELS = { mergeElements: "Duplicates" };

/**
 * The navigation's sizes follow the screen's height, between a floor that is
 * still a finger's target and a ceiling past which bigger is only emptier. On
 * an iPhone 13 that fills most of the height below the header; on a shorter
 * phone it shrinks back towards the floor rather than making the menu scroll.
 */
const NAV_GAP = 8;
const TILE_ICON = 28;

const NAV_GROUP_STYLE = { ...menuGroupStyle, gap: NAV_GAP };

/** Three to a line: at four, names like "Clusters" broke across two lines. */
const tileGrid = (columns) => ({
  display: "grid",
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  gap: NAV_GAP,
});

/**
 * A tile's height, for a first view holding `rows` lines of tiles.
 *
 * Steeper than a plain share of the screen's height: an SE-sized screen
 * (667px) has room for the usual four lines, and the card's margins, at about
 * their floor, a taller one for tiles much bigger — about 57px there, about
 * 96px at 844. A fifth line — "All relations" on after a merge puts seven
 * tiles in Assist — shrinks every tile in proportion, down to a lower floor
 * that is still a finger's target, rather than making the menu scroll.
 *
 * @param {number} rows
 * @returns {string} A CSS height.
 */
function tileHeightFor(rows) {
  const share = Math.min(1, 4 / rows);
  const floor = rows > 4 ? 48 : 56;
  return `clamp(${floor}px, calc((22dvh - 90px) * ${share}), 100px)`;
}

const TILE_STYLE = {
  flexDirection: "column",
  justifyContent: "center",
  gap: 6,
  padding: "4px 2px",
  fontSize: 13,
  lineHeight: 1.2,
  textAlign: "center",
  whiteSpace: "normal",
  // A long name ("Merge Elements") wraps rather than widening its column.
  overflowWrap: "anywhere",
};

const TILE_ICON_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: TILE_ICON,
};

const ACTION_STRIP_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: NAV_GAP,
  flexShrink: 0,
};

const ACTION_STYLE = {
  flexDirection: "column",
  gap: 4,
  width: "100%",
  // Steeper than a plain share, as the tiles are: 48px on an SE-sized screen,
  // which the card's padding needs, and about 69px at 844.
  height: "clamp(48px, calc(12dvh - 32px), 72px)",
  padding: "4px 2px",
  fontSize: 12,
};

const WORKFLOW_STYLE = { height: "clamp(44px, 7dvh, 60px)", fontSize: 13 };
