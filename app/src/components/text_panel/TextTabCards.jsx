/**
 * @fileoverview Card components for the TextTab: ElementCard, ArgumentCard,
 * RelationCard, and their helpers. Building-block atoms live in
 * TextTabPrimitives.jsx; layout orchestrators live in TextTabSections.jsx.
 * @module components/TextTabCards
 */

import { useContext } from "react";
import { C } from "../../constants/colors.js";
import {
  CARD_STYLE,
  META_LABEL_STYLE,
  CONTENT_FONT_SIZE,
  cardHeader,
  cardIdentity,
  cardChips,
  cardStats,
  cardDivider,
  cardActions,
} from "../../constants/textTabStyles.js";
import { relationTypeLabel, statusTag } from "../../utils/stateUtils.js";
import { groupOfElement } from "../../utils/groupUtils.js";
import { processesOf, processesOfElement } from "../../utils/mergeStates.js";
import { confidenceLabel } from "../../utils/confidenceLabel.js";
import { withdrawalScale as scaleOf } from "../../utils/withdrawalScale.js";
import { Ctx } from "./TextTabContext.js";
import { useCardDetails, setCardDetails } from "./cardDetails.js";
import { Citation, CITATION_CAVEAT } from "../Citation.jsx";
import { Tooltip } from "../Tooltip.jsx";
import {
  MetaChip,
  Badge,
  StatusLabel,
  StatusField,
  StatField,
  StatSection,
  DeltaBar,
  DetailsToggle,
  PreviousWording,
  ActionButtons,
  Highlight,
} from "./TextTabPrimitives.jsx";

// Re-export primitives so existing callers keep working without import-site changes.
export {
  Highlight,
  Badge,
  SectionHeader,
  StatusLabel,
  ActionButtons,
  CoherenceGroup,
} from "./TextTabPrimitives.jsx";

// ─── Element card ─────────────────────────────────────────────────────────────

export function ElementCard({ e, dim }) {
  const {
    state,
    pCovers,
    groups,
    onEditRequest,
    onWithdrawRequest,
    onReinstate,
    onSelect,
    badgeColor,
    search,
    withdrawalDeltas,
    withdrawalScale,
    isWide,
  } = useContext(Ctx);
  // Which group holds it, if any. On the canvas a collapsed group is the reason
  // an element is not drawn at all, so a card that said nothing about it left
  // the panel and the graph looking like they disagreed.
  const inGroup = groupOfElement(groups ?? [], e.id);
  const isW = e.status === "withdrawn";
  const isR = e.status === "rejected";
  const isActive = e.status === "active" || e.status === "revised";
  const withdrawalDelta =
    isActive && withdrawalDeltas ? (withdrawalDeltas[e.id] ?? null) : null;
  const color = badgeColor(e.id);
  const tag = statusTag(e, state.round);
  // A revision is announced by the previous-wording panel, whose heading names
  // the round — so a `Status: Revised` field beside it would say it twice.
  const revisionShown = tag?.type === "revised" && !!e.previousText;
  // One answer for the whole panel: see {@link module:components/text_panel/cardDetails}.
  const showDetails = useCardDetails();
  const detailsId = `element-details-${e.id}`;
  return (
    <div
      // The one hook the e2e helpers have on a card: they used to climb the DOM
      // counting "Confidence:" labels, which the details fold can now hide.
      data-card="element"
      style={{
        ...CARD_STYLE,
        opacity: dim ? 0.4 : isW || isR ? 0.55 : 1,
        borderLeft: `3px solid ${color}`,
        paddingLeft: 10,
      }}
    >
      <div style={{ ...cardHeader, gap: 6, marginBottom: 6 }}>
        <Badge id={e.id} />
        <div style={cardActions}>
          <ActionButtons
            compact={isWide}
            onRevise={() => onEditRequest(e.id)}
            onWithdraw={!isW && !isR ? () => onWithdrawRequest(e.id) : null}
            onReinstate={isW || isR ? () => onReinstate(e.id) : null}
          />
        </div>
      </div>
      <div
        style={{
          fontSize: CONTENT_FONT_SIZE,
          color: isW || isR ? C.dim : C.text,
          lineHeight: 1.65,
          textDecoration: isW || isR ? "line-through" : "none",
        }}
      >
        <Highlight text={e.text} query={search} />
      </div>
      {/* Kept on the element after reinstatement as history, but only shown
          while it is actually withdrawn. Above the rule rather than in the
          details, since it is the prose explaining the struck-through claim
          it sits under. */}
      {isW && e.reason && (
        <div style={{ ...META_LABEL_STYLE, color: C.dim }}>
          Withdrawn: {e.reason}
        </div>
      )}
      <div style={cardDivider}>
        <DetailsToggle
          open={showDetails}
          onToggle={() => setCardDetails(!showDetails)}
          controls={detailsId}
        />
      </div>
      {/* Always rendered, hidden with `display` rather than unmounted: a folded
          card is one the reader is coming back to, and unmounting would drop
          what is inside it — the citation links among other things. */}
      <div id={detailsId} style={{ display: showDetails ? "block" : "none" }}>
        <div style={cardStats}>
          <StatField
            label="Confidence"
            title={confidenceLabel(e.confidence).title}
          >
            {confidenceLabel(e.confidence).text}
          </StatField>
          {e.origin && (
            <StatField label="Origin" title={e.origin}>
              {e.origin}
            </StatField>
          )}
          {/* After a merge, the process it came from — both, if it was fused.
              The same letter the node wears, with the process's own name on
              hover: the name is whatever topic the process ran under, and
              spelled out in full it was several times the width of a column. */}
          {processesOfElement(processesOf(state), e.id).map((p) => (
            <StatField key={p.id} label={`Process ${p.id}`} title={p.label}>
              {p.label}
            </StatField>
          ))}
          {e.addedRound && (
            <StatField label="Added">Round {e.addedRound}</StatField>
          )}
          {!revisionShown && <StatusField tag={tag} />}
          {pCovers[e.id]?.length > 0 && (
            // Two columns and wrapping: the ids are the content, so this is the
            // one field that must not lose its tail to an ellipsis.
            <StatField
              label="Covers"
              wrap
              span={2}
              title={`Covers ${pCovers[e.id].join(", ")}`}
            >
              {pCovers[e.id].map((id) => (
                // The panel's own ink, not the dim of a caption: these are the
                // field's value, and each is bordered because there are several
                // and an unbordered run of ids reads as one string.
                <MetaChip key={id} color={C.text}>
                  {id}
                </MetaChip>
              ))}
            </StatField>
          )}
          {inGroup && (
            <StatField label="Group" title={inGroup.label}>
              <button
                type="button"
                onClick={() =>
                  onSelect((prev) => (prev === inGroup.id ? null : inGroup.id))
                }
                aria-label={`Select group ${inGroup.label}`}
                // The value itself is the control. Able to be narrower than its
                // text, so a long group name is cut rather than escaping the
                // column.
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  textAlign: "left",
                  textDecoration: `underline dotted ${C.border}`,
                  minWidth: 0,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {inGroup.label}
              </button>
            </StatField>
          )}
        </div>
        {withdrawalDelta != null &&
          (() => {
            const { delta_account: dA, delta_systematicity: dS } =
              withdrawalDelta;
            const fmt = (v) => `${v > 0 ? "+" : ""}${v.toFixed(3)}`;
            const col = (v) =>
              v < -0.001 ? C.supports : v > 0.001 ? C.conflicts : C.dim;
            // The teal is a graph hue and illegible as type on the light panel,
            // so the bar takes it and the number takes its foreground tone.
            const ink = (v) => (v < -0.001 ? C.supportsText : col(v));
            // Every card in the panel is drawn to the same maximum, so the
            // lengths compare one element with the next. A host that hands the
            // cards deltas but no scale gets one derived from them, rather than
            // a bar drawn to nothing.
            const scale = withdrawalScale ?? scaleOf(withdrawalDeltas);
            // The bar has no visible axis, so the scale is named here rather
            // than left to be inferred from a length.
            const axis = `bar drawn to ±${scale}`;
            return (
              <StatSection label="If withdrawn">
                <DeltaBar
                  label="Account"
                  value={dA}
                  text={fmt(dA)}
                  scale={scale}
                  color={col(dA)}
                  textColor={ink(dA)}
                  title={`Account change if withdrawn (${axis})`}
                />
                {dS !== 0 && (
                  <DeltaBar
                    label="Systematicity"
                    value={dS}
                    text={fmt(dS)}
                    scale={scale}
                    color={col(dS)}
                    textColor={ink(dS)}
                    title={`Systematicity change if withdrawn (${axis})`}
                  />
                )}
              </StatSection>
            );
          })()}
        {e.previousText && (
          <PreviousWording
            text={e.previousText}
            round={tag?.type === "revised" ? tag.round : e.revisedRound}
          />
        )}
        {/* Without this the reference is invisible between accepting a
            suggestion and exporting it, which is most of the time the user
            spends with it. The label is the same caveat the suggestion carried:
            the works were named by a model, and a confirmed one exists without
            that confirming it says what the element claims. */}
        {e.sources?.length > 0 && (
          <div style={{ ...META_LABEL_STYLE, color: C.dim }}>
            <Tooltip text={CITATION_CAVEAT}>
              <span>Sources (AI-generated):</span>
            </Tooltip>
            {e.sources.map((source, i) => (
              <div key={i} style={{ paddingLeft: 8 }}>
                <Citation source={source} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Argument card (grouped jointly_entails) ──────────────────────────────────

export function ArgumentCard({ rels, dim }) {
  const {
    state,
    selectedRel,
    onSelectRel,
    onSelect,
    onEditRelRequest,
    onWithdrawRelRequest,
    onReinstateRel,
    badgeColor,
    search,
    isWide,
  } = useContext(Ctx);
  const isSel = rels.some((r) => r === selectedRel);
  const conclusionId = rels[0].to;
  const allNodeIds = [...new Set([...rels.map((r) => r.from), conclusionId])];

  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
      {rels.map((r) => (
        <div
          key={r.from}
          // Deliberately swallows the badges inside it: the click bubbles up
          // here and clears the element selection they just made, so pressing
          // one in a relation row does nothing. The row is about the relation,
          // and selecting one of its ends from here would say the wrong thing.
          onClick={() => {
            onSelectRel((prev) => (rels.includes(prev) ? null : r));
            onSelect(() => null);
          }}
          style={{
            ...cardHeader,
            gap: 5,
            cursor: "pointer",
            borderRadius: 4,
            padding: "2px 4px",
            margin: "0 -4px 4px",
            background: isSel ? `${C.border}44` : "transparent",
          }}
        >
          <div style={cardIdentity}>
            <Badge id={r.from} />
            <span
              style={{
                color: C[rels[0].type] ?? C.jointly_entails,
                fontSize: 11,
                fontWeight: "bold",
              }}
            >
              {rels[0].type === "precludes"
                ? "⇒ precludes ⇒"
                : rels[0].type === "jointly_precludes"
                  ? "⇒ jointly precludes ⇒"
                  : rels[0].type === "entails"
                    ? "→ entails →"
                    : "→ jointly entails →"}
            </span>
            <Badge id={r.to} />
          </div>
          <div style={cardChips(isWide)}>
            <StatusLabel tag={statusTag(r, state.round)} />
          </div>
          <div onClick={(e) => e.stopPropagation()} style={cardActions}>
            <ActionButtons
              compact={isWide}
              onRevise={() => onEditRelRequest(r)}
              onWithdraw={
                r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null
              }
              onReinstate={
                r.status === "withdrawn" ? () => onReinstateRel(r) : null
              }
            />
          </div>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        {allNodeIds.map((id, index) => {
          const el = state.elements.find((e) => e.id === id);
          if (!el) return null;
          return (
            <div
              key={id}
              style={{
                fontSize: CONTENT_FONT_SIZE,
                color: C.text,
                lineHeight: 1.5,
              }}
            >
              <div>
                {index == allNodeIds.length - 1 && (
                  <b>
                    Therefore
                    {(rels[0].type === "precludes" ||
                      rels[0].type === "jointly_precludes") && (
                      <span
                        style={{
                          color: C.jointly_precludes,
                          fontStyle: "italic",
                          fontWeight: "normal",
                        }}
                      >
                        {" "}
                        not
                      </span>
                    )}
                    :
                  </b>
                )}
              </div>
              <span
                style={{
                  color: badgeColor(id),
                  fontWeight: "bold",
                  marginRight: 6,
                }}
              >
                {id}:
              </span>
              <Highlight text={el.text} query={search} />
            </div>
          );
        })}
      </div>
      {rels[0].explanation && (
        <div
          style={{
            fontSize: CONTENT_FONT_SIZE,
            color: C.dim,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          <Highlight text={rels[0].explanation} query={search} />
        </div>
      )}
      <div style={{ ...cardDivider, ...cardStats }}>
        {rels[0].origin && (
          <StatField label="Origin" title={rels[0].origin}>
            {rels[0].origin}
          </StatField>
        )}
        {/* One round for the whole argument: its relations are added together. */}
        {rels[0].addedRound && (
          <StatField label="Added">Round {rels[0].addedRound}</StatField>
        )}
      </div>
    </div>
  );
}

// ─── Relation card ────────────────────────────────────────────────────────────

export function RelationCard({ r, dim }) {
  const {
    state,
    selectedRel,
    onSelectRel,
    onSelect,
    onEditRelRequest,
    onWithdrawRelRequest,
    onReinstateRel,
    badgeColor,
    search,
    isWide,
  } = useContext(Ctx);
  const fromEl = state.elements.find((e) => e.id === r.from);
  const toEl = state.elements.find((e) => e.id === r.to);
  const isSel = r === selectedRel;
  return (
    <div style={{ ...CARD_STYLE, opacity: dim ? 0.4 : 1 }}>
      <div
        // As in ArgumentCard above: the badges inside are inert here on purpose.
        onClick={() => {
          onSelectRel((prev) => (prev === r ? null : r));
          onSelect(() => null);
        }}
        style={{
          ...cardHeader,
          gap: 5,
          cursor: "pointer",
          borderRadius: 4,
          padding: "2px 4px",
          margin: "0 -4px 8px",
          background: isSel ? `${C.border}44` : "transparent",
        }}
      >
        <div style={cardIdentity}>
          <Badge id={r.from} />
          <span style={{ color: C[r.type], fontSize: 11, fontWeight: "bold" }}>
            → {relationTypeLabel(r.type)} →
          </span>
          <Badge id={r.to} />
        </div>
        <div onClick={(e) => e.stopPropagation()} style={cardActions}>
          <ActionButtons
            compact={isWide}
            onRevise={() => onEditRelRequest(r)}
            onWithdraw={
              r.status !== "withdrawn" ? () => onWithdrawRelRequest(r) : null
            }
            onReinstate={
              r.status === "withdrawn" ? () => onReinstateRel(r) : null
            }
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        {[fromEl && r.from, toEl && r.to].filter(Boolean).map((id) => {
          const el = state.elements.find((e) => e.id === id);
          return (
            <div
              key={id}
              style={{
                fontSize: CONTENT_FONT_SIZE,
                color: C.text,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  color: badgeColor(id),
                  fontWeight: "bold",
                  marginRight: 6,
                }}
              >
                {id}:
              </span>
              <Highlight text={el.text} query={search} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          fontSize: CONTENT_FONT_SIZE,
          color: C.dim,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        <Highlight text={r.explanation} query={search} />
      </div>
      <div style={{ ...cardDivider, ...cardStats }}>
        {r.origin && (
          <StatField label="Origin" title={r.origin}>
            {r.origin}
          </StatField>
        )}
        {r.addedRound && (
          <StatField label="Added">Round {r.addedRound}</StatField>
        )}
        <StatusField tag={statusTag(r, state.round)} />
      </div>
    </div>
  );
}

// ─── Element cards list ───────────────────────────────────────────────────────

/** Renders elements grouped by type (judgment → principle → theory). */
export function ElementCards({ els, dim }) {
  return (
    <>
      {["judgment", "principle", "theory"].flatMap((type) =>
        els
          .filter((e) => e.type === type)
          .map((e) => <ElementCard key={e.id} e={e} dim={dim} />),
      )}
    </>
  );
}
