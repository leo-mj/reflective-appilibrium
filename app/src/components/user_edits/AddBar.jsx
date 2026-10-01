/**
 * @fileoverview Bottom bar for adding elements, relations and arguments.
 * Spans the full width at ~20vh, always visible — or, with `roomy`, laid out
 * for the phone sheet that hosts it there instead.
 *
 * The app's only way in by hand, under every tab. The assist tabs used to carry
 * three cut-down panels of their own — an element panel with the type fixed, a
 * relation panel and an argument panel — which meant four forms for three kinds
 * of thing, and they had already drifted apart in what `+ premise` picked and in
 * how they worded their complaints. What those panels knew that this bar did not
 * is which kind of thing the tab they sat under was about, and that is a preset
 * rather than a component: see `ADD_BAR_PRESETS` and the `preset` prop below.
 *
 * Which link tabs it offers follows the graph: with plain relations hidden —
 * the default — only arguments are on offer, since a relation added there would
 * be a change the view has nowhere to show.
 *
 * This file is the bar itself: its buttons, its layout and its one text field.
 * The forms are held by `useAddBarForms`, each tab's fields are in
 * `AddBarFields.jsx`, and the bar folded away is `CollapsedAddBar`.
 * @module components/user_edits/AddBar
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";

import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { inkWeight } from "../../constants/palettes.js";
import { useAddBarSize } from "../../hooks/useAddBarSize.js";
import { usePalette } from "../../hooks/useTheme.js";
import { elementOptions } from "./ElementOptions.jsx";
import {
  ACCENT_MARKER,
  ADD_BAR_MIN_HEIGHT,
  barLook,
  EXPLANATION_STYLE,
  idOptionChars,
  pickerWidth,
} from "./addPanelShared.js";
import { WrittenArgumentFields } from "./WrittenArgumentFields.jsx";
import { useAddBarForms } from "./useAddBarForms.js";
import {
  ArgumentFields,
  ElementFields,
  RelationFields,
} from "./AddBarFields.jsx";
import { CollapsedAddBar } from "./CollapsedAddBar.jsx";

/**
 * @param {Object}      props
 * @param {REElement[]} props.elements   - Elements that may be referenced; see linkableElements.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 * @param {function}    [props.onAddNewArgument] - Adds an argument whose
 *   premises and conclusion are written out here, elements and relations as
 *   one change. Without it the argument tab offers picking only.
 * @param {string|null} [props.selected] - The node selected in the graph, which
 *   fills the first end of a link.
 * @param {string[]|null} [props.ctrlChain] - A ctrl+click chain in the graph,
 *   read as the canvas reads it: the last is the conclusion and the rest are the
 *   premises. So a bar handed `["P5","P4","P1","J7"]` is holding the argument
 *   the graph's own chip is naming, rather than its two ends.
 * @param {boolean}     [props.hideNonEntailsRels] - When set, the graph is
 *   showing arguments only, so the bar offers those in place of relations:
 *   adding a link the view then hides is a change with nothing to show for it.
 * @param {boolean}     [props.roomy] - Lays the bar out for the phone sheet,
 *   which has height to spare and is worked with a thumb. See {@link barLook}.
 * @param {{tab: "element"|"relation"|"argument", elementType?: string}} [props.preset]
 *   What the tab this bar is under is about, where it is about one of the three
 *   things the bar adds. The bar opens on that tab with the type filled in.
 *   Taken from {@link module:constants/tabConstants.ADD_BAR_PRESETS}, which is
 *   also where the reason it must be a stable object is written down.
 */
export function AddBar({
  elements,
  onAddElement,
  onAddRelation,
  onAddNewArgument,
  selected,
  ctrlChain,
  hideNonEntailsRels,
  roomy = false,
  preset = null,
}) {
  // The strip is the reader's to size — the three tabs want different shapes of
  // it, and only they know which they are about to use. The sheet keeps its own.
  const {
    ref: barRef,
    sizeStyle,
    handleProps,
    collapsed,
    toggleCollapsed,
  } = useAddBarSize(!roomy);
  // The bar's two filled buttons — Add, and whichever tab is lit — are written
  // in the palette's own ink rather than in an ink named here, so that they read
  // as the same object in either viewing mode: white and bold on the teal in the
  // default one, the black the assist headers' badges wear and no weight with it
  // in high-contrast. Weight follows the ink for the reason node ids do, see
  // {@link module:constants/palettes.inkWeight}.
  //
  // White on this teal is 2.43:1, which is the default palette's usual bargain
  // rather than an oversight here: it is judged by eye and high-contrast mode is
  // the compliant path. See {@link ACCENT_MARKER}.
  const palette = usePalette();
  const fillInk = palette.ink;
  const fillWeight = inkWeight(fillInk);
  const look = barLook(roomy);
  /** Width for an element picker: the longest id it can offer, suffix and all. */
  const idLayout = pickerWidth(idOptionChars(elements));
  /** The rows every element picker in the bar offers — id, and what it says. */
  const elementRows = elementOptions(elements);
  const showRelations = !hideNonEntailsRels;
  // Origin and confidence, folded away on a phone. Kept across submissions
  // rather than reset with the form: someone who opened them once is filling
  // them in, and closing them under that reader after every add would be rude.
  const [showMeta, setShowMeta] = useState(false);
  const forms = useAddBarForms({
    elements,
    selected,
    ctrlChain,
    preset,
    showRelations,
    onAddElement,
    onAddRelation,
    onAddNewArgument,
  });
  const { tab, form, canSubmit, generation } = forms;

  /**
   * Everything one of the three tab buttons wears, its handler included — the
   * accent marker goes on the lit one only, so it has to be an attribute rather
   * than part of a style object.
   */
  const tabProps = (t) => {
    const active = tab === t;
    return {
      "aria-pressed": active,
      onClick: () => forms.setActiveTab(t),
      // Only while it is carrying the fill. See {@link ACCENT_MARKER}.
      ...(active ? ACCENT_MARKER : null),
      style: {
        // Small enough that all three sit beside the submit button on one line —
        // including the case that has to fit, with relations on offer — and a
        // clear step under it: they choose what is added, it does the adding.
        padding: roomy ? "8px 11px" : "2px 10px",
        minHeight: roomy ? 38 : undefined,
        borderRadius: 10,
        fontSize: roomy ? 12 : 11,
        cursor: "pointer",
        // Lit in the button colour the bar's own Add wears, so the pair reads as
        // one control: these say what is being added and it does the adding. The
        // submit button beside them carries no type in its label, so which of
        // them is lit is the only thing on screen saying what pressing it would
        // add — hence fill and border together, rather than a tint alone. Weight
        // is not a third statement of it: on a fill it belongs to the ink.
        border: `1px solid ${active ? C.supports : C.border}`,
        fontWeight: active ? fillWeight : "normal",
        background: active ? C.supports : "transparent",
        color: active ? fillInk : C.dim,
      },
    };
  };

  /**
   * One button, put in one of two places: the far end of the tab row on a
   * phone, or past the fields on a wide screen. Either way it ends up as far
   * from Add as the layout allows, which is the point of it.
   */
  const clearButton = (
    <Tooltip text="Start this tab over">
      <button
        onClick={forms.handleClear}
        // Named for what it clears, as the submit button is: which tab is lit is
        // the only thing saying what either of them acts on.
        aria-label={`Clear ${tab}`}
        style={{
          ...look.ghostSmall,
          marginLeft: "auto",
          flexShrink: 0,
          ...(roomy ? { minHeight: 44 } : null),
        }}
      >
        Clear
      </button>
    </Tooltip>
  );

  /**
   * Folds the bar away. A chevron rather than a word: it stands at the end of a
   * row of controls that are all about the form, and it is the one that is not.
   *
   * Not offered on the phone sheet, which is opened and dismissed rather than
   * kept: a sheet minimised to a stub over the tab underneath would be a second,
   * worse way of closing it.
   */
  const minimiseButton = (
    <Tooltip text="Fold the add bar away — whatever is above it takes the room">
      <button
        onClick={toggleCollapsed}
        aria-expanded
        aria-label="Minimise the add bar"
        style={{
          ...look.ghostSmall,
          flexShrink: 0,
          // Squared off: picker padding around a single glyph leaves a sliver.
          padding: "3px 8px",
        }}
      >
        ▾
      </button>
    </Tooltip>
  );

  if (collapsed) {
    return (
      <CollapsedAddBar
        barRef={barRef}
        tab={tab}
        onExpand={toggleCollapsed}
        ghostStyle={look.ghostSmall}
      />
    );
  }

  return (
    <div
      ref={barRef}
      // Ringed by the tour alongside the graph's + buttons: this is the other
      // way in, and the one with a text field rather than a dialog.
      data-tutorial="add-bar"
      style={{
        // The sheet is capped at 85dvh and scrolls past that, so asking for a
        // good share of the screen here is what makes the controls and the text
        // field roomy rather than merely spaced out.
        //
        // The strip's own share is a floor rather than a size: the text field
        // takes whatever the controls leave over, and anyone who wants more of
        // it drags the bar's top edge. See {@link module:hooks/useAddBarSize}.
        // The floor is the assist panels' too — one add bar, one height.
        minHeight: roomy ? "46dvh" : ADD_BAR_MIN_HEIGHT,
        flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
        background: C.panel,
        display: "flex",
        flexDirection: "column",
        padding: roomy ? "12px 14px 16px" : "8px 16px",
        // Last, so a dragged size wins over the floor above.
        ...sizeStyle,
      }}
    >
      {/* Two edges and the corner between them. The bar is anchored at the foot
          of the window and at the left of the row, so those are the two that
          can move. */}
      {!roomy && (
        <>
          <div {...handleProps("height")} />
          <div {...handleProps("width")} />
          <div {...handleProps("both")} />
        </>
      )}

      {/* ── Controls row ── */}
      <div
        style={{
          display: "flex",
          // Not centre: the fields beside these grow taller as an argument
          // takes on premises and its row wraps, and centring made the submit
          // button and the tabs drift down to stay level with the middle of
          // whatever was next to them. They belong to no one tab, so they sit
          // where they sat before it was chosen.
          alignItems: "flex-start",
          gap: 8,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            // Allowed to shrink, so its own flexWrap has a width to wrap at.
            // Held at max-content it could not, and on a phone — where this bar
            // runs inside a sheet the width of the screen — the row ran off the
            // right edge instead of breaking. There is room to spare on a wide
            // screen, where nothing shrinks and nothing changes.
            minWidth: 0,
            flexWrap: "wrap",
            // …on the phone, where it is the only way these fit. On a wide
            // screen there is room, and holding them at their full width is
            // what keeps them the same width on every tab: a tab whose fields
            // outgrew the row would otherwise squeeze the buttons above them.
            //
            // The phone's copy takes the whole row as well, so that Clear's
            // auto margin has the row's far edge to reach for. Sized to its
            // contents it stopped at the end of the buttons, short of the edge.
            ...(roomy ? { flexBasis: "100%" } : { flexShrink: 0 }),
          }}
        >
          <Tooltip text={`Add ${tab} — ⌘/Ctrl + Enter`}>
            <button
              disabled={!canSubmit}
              onClick={forms.handleSubmit}
              // Named in full for anyone who cannot see which tab is lit. The
              // visible "Add" is inside it, as WCAG 2.5.3 asks of any control
              // whose label is shorter than its accessible name.
              aria-label={`Add ${tab}`}
              {...ACCENT_MARKER}
              style={{
                // The auto margin is what holds it to the right of the strip. It
                // leads the row here, so it starts at the left edge everything
                // below it lines up against.
                marginLeft: roomy ? 0 : "auto",
                padding: roomy ? "11px 18px" : "3px 14px",
                minHeight: roomy ? 44 : undefined,
                borderRadius: 4,
                fontSize: roomy ? 15 : 12,
                fontWeight: fillWeight,
                cursor: canSubmit ? "pointer" : "default",
                border: "none",
                background: C.supports,
                color: fillInk,
                opacity: canSubmit ? 1 : 0.4,
              }}
            >
              {/* Just "Add": the lit tab is what says what is being added, so
                repeating it here only costs the tabs room on the line. */}
              Add
            </button>
          </Tooltip>
          {/* On the phone it shares this line, at the far end of it — a row of
              its own for one button was a waste of a screen that has none to
              spare, and opposite ends of a row is distance enough. On a wide
              screen it goes past the fields instead; see below. */}
          {roomy && clearButton}
          {/* Grouped so the three stay together: as loose items they were free
              to wrap apart from one another, which split the set across two
              rows. Grouped, a row too narrow for all four breaks after the
              submit button instead and drops the three intact onto the next. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: roomy ? 6 : 8,
              minWidth: 0,
              flexWrap: "wrap",
              // A line of its own on the phone, which puts Add and Clear
              // together on the one above rather than leaving where the row
              // breaks to whatever the labels happen to measure.
              ...(roomy ? { flexBasis: "100%" } : null),
            }}
          >
            <button {...tabProps("element")}>Element</button>
            {showRelations && (
              <button {...tabProps("relation")}>Relation</button>
            )}
            <button {...tabProps("argument")}>Argument</button>
          </div>
          {/* Separates the tabs from the fields beside them. Stacked, there is
              nothing to its right to separate them from. */}
          {!roomy && (
            <div
              style={{
                width: 1,
                height: 16,
                background: C.border,
                flexShrink: 0,
              }}
            />
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            // Shrinkable for the same reason as the tab row above. This is the
            // group that overflowed worst: an argument's premises, arrow, type
            // and conclusion are half a dozen controls on one line.
            minWidth: 0,
            flexWrap: "wrap",
            // Either way it takes the whole row rather than sizing to its
            // contents. Roomy, because sized to contents, opening the details
            // widened the group — and with it the type picker inside, which
            // grows to fill the group; a picker has no business changing width
            // because something below it appeared. Wide, because origin and
            // confidence are held against the far end of the bar, and there is
            // no far end to hold them against until the group reaches it.
            ...(roomy ? { flexBasis: "100%" } : { flex: 1 }),
          }}
        >
          {tab === "element" ? (
            <ElementFields
              form={forms.elementForm}
              onChange={forms.setEl}
              origin={forms.origin}
              look={look}
              showMeta={showMeta}
              onToggleMeta={() => setShowMeta((s) => !s)}
            />
          ) : tab === "relation" ? (
            <RelationFields
              form={forms.relationForm}
              onChange={forms.setRel}
              elementRows={elementRows}
              idLayout={idLayout}
              look={look}
            />
          ) : (
            <ArgumentFields
              form={forms.argumentForm}
              onChange={forms.setArg}
              canWrite={!!onAddNewArgument}
              mode={forms.argumentMode}
              onModeChange={forms.setArgumentMode}
              writing={forms.writing}
              onSetPremise={forms.setPremise}
              onRemovePremise={forms.removePremise}
              onAddPremise={forms.addPremise}
              canAddPremise={forms.canAddPremise}
              elementRows={elementRows}
              idLayout={idLayout}
              look={look}
            />
          )}
          {/* Why Add is refusing, where that is worth saying. It is the only
              thing that says so, since a disabled button explains nothing. */}
          {form.check.complaint && (
            <span role="status" style={look.complaint}>
              {form.check.complaint}
            </span>
          )}
        </div>
        {/* Past all the fields and against the far edge, which the growing
            fields group is what carries it out to. It undoes the work the rest
            of the row is for, so it wants to be nowhere near the button that
            commits it — beside Add it read as a second way to submit. */}
        {!roomy && clearButton}
        {/* And past Clear, at the very end. Clear is about the form; this is
            about the bar, so it sits outside everything the form owns — and the
            corner is where the reader already reaches to make the bar smaller,
            the drag handle being the other thing there. */}
        {!roomy && minimiseButton}
      </div>

      {/* ── Written argument: premises over conclusion ── */}
      {tab === "argument" && forms.writing && (
        <WrittenArgumentFields
          form={forms.writtenForm}
          onChange={forms.setWrittenForm}
          elements={elements}
          onKeyDown={forms.submitOnCtrlEnter}
          selectStyle={look.sel}
          ghostStyle={look.ghostSmall}
          arrowStyle={look.arrow}
          roomy={roomy}
          generation={generation}
        />
      )}

      {/* ── Text / explanation ── */}
      <textarea
        // Keyed on the tab as well as the generation: each tab's placeholder is
        // a different length, and reusing one node across them left the old
        // string's line breaks behind — "Explanation (optional)…" came out as
        // "Explan". See the generation counter for the rest of why.
        key={`${tab}-${generation}`}
        value={form.text}
        onChange={(e) => form.setText(e.target.value)}
        onKeyDown={forms.submitOnCtrlEnter}
        placeholder={form.placeholder}
        style={{
          // The bar's one field, whichever tab is lit and wherever the bar is
          // drawn — see {@link EXPLANATION_STYLE}, which is where its floor and
          // the two rules that keep a scrollbar off the foot of the window are
          // written down. The phone's copy is the same field with room to
          // breathe: a sheet has the height for it, and a thumb needs the type
          // bigger than a pointer does.
          ...EXPLANATION_STYLE,
          ...(roomy
            ? {
                minHeight: 130,
                marginTop: 12,
                padding: "10px 12px",
                fontSize: 16,
              }
            : null),
        }}
      />
    </div>
  );
}
