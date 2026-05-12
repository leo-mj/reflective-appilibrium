/**
 * @fileoverview Detect Arguments tab — runs LLM argument detection, shows arguments
 * with added premises highlighted, and lets the user accept, reject, or modify each.
 * @module components/DetectArgumentsTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useMemo } from "react";
import { C } from "../../constants/colors.js";
import { SpinnerIcon } from "../Icons.jsx";
import { detectArguments } from "../../utils/argumentsClient.js";
import { nextElementId } from "../../utils/stateUtils.js";
import {
  AcceptButton,
  RejectButton,
  ModifyButton,
  CancelButton,
  ModifyTextarea,
  ErrorBanner,
} from "../SuggestionActions.jsx";
import { AddArgumentPanel } from "../user_edits/TextTabAddPanel.jsx";

const ACCENT = C.judgment.high;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elementColor(type) {
  return type === "judgment" ? C.judgment.high
       : type === "principle" ? C.principle.high
       : C.theory.high;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ title, count }) {
  return (
    <div style={{ fontSize: 11, fontWeight: "bold", color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 8px" }}>
      {title}{count != null && <span style={{ fontWeight: "normal" }}> · {count}</span>}
    </div>
  );
}

const BADGE_W = 36;

function IdBadge({ element, isAdded = false }) {
  const color = elementColor(element.type);
  return (
    <span style={{
      fontSize: 11,
      fontWeight: "bold",
      color: isAdded ? C.text : color,
      border: `1px solid ${isAdded ? ACCENT : color}`,
      borderRadius: 4,
      padding: "1px 4px",
      background: isAdded ? ACCENT + "18" : "transparent",
      minWidth: BADGE_W,
      textAlign: "center",
      display: "inline-block",
      flexShrink: 0,
    }}>
      {element.negated ? "¬" : ""}{element.id}
    </span>
  );
}

function ArgumentRow({ element, isAdded, draft, onDraftChange }) {
  const isEditing = isAdded && onDraftChange != null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
      <IdBadge element={element} isAdded={isAdded} />
      {isEditing ? (
        <ModifyTextarea
          value={draft ?? element.text}
          onChange={onDraftChange}
          accentColor={ACCENT}
        />
      ) : (
        <span style={{ color: C.text, fontSize: 11, lineHeight: 1.5, flex: 1 }}>
          {element.negated && (
            <span style={{ color: C.conflicts, fontSize: 10, fontWeight: "bold", fontStyle: "italic", marginRight: 4 }}>
              not
            </span>
          )}
          {draft ?? element.text}
          {isAdded && (
            <span style={{ color: ACCENT, fontSize: 10, fontStyle: "italic", marginLeft: 6 }}>
              added premise
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {Array}    props.argument
 * @param {Set}      props.addedIds
 * @param {{status:'accepted'|'rejected', argumentId?:string}|undefined} props.decision
 * @param {Object|null} props.editingDrafts  Map premiseId→text, or null if not editing.
 * @param {Function} props.onAccept
 * @param {Function} props.onReject
 * @param {Function} props.onModify
 * @param {Function} props.onModifyChange   Called with (premiseId, text).
 * @param {Function} props.onModifyCancel
 * @param {Function} props.onUndo
 */
function ArgumentCard({
  argument, addedIds, decision,
  editingDrafts, onAccept, onReject, onModify, onModifyChange, onModifyCancel, onUndo,
}) {
  const conclusion = argument.at(-1);
  const premises = argument.slice(0, -1);
  const hasAddedPremises = argument.some((el) => addedIds.has(el.id));
  const isEditing = editingDrafts != null;
  const isAccepted = decision?.status === "accepted";
  const isRejected = decision?.status === "rejected";

  return (
    <div style={{
      background: isAccepted ? C.supports + "12" : C.panel,
      border: `1px solid ${isAccepted ? C.supports + "55" : C.border}`,
      borderRadius: 6,
      padding: "8px 10px",
      marginBottom: 6,
      opacity: isRejected ? 0.45 : 1,
      transition: "opacity 0.15s, background 0.15s",
    }}>
      {premises.map((p, i) => (
        <ArgumentRow
          key={i}
          element={p}
          isAdded={addedIds.has(p.id)}
          draft={editingDrafts?.[p.id]}
          onDraftChange={isEditing && addedIds.has(p.id)
            ? (text) => onModifyChange(p.id, text)
            : null}
        />
      ))}
      <div style={{ color: C.dim, fontSize: 11, paddingLeft: BADGE_W / 2 - 3, marginBottom: 4 }}>↓</div>
      <ArgumentRow element={conclusion} isAdded={addedIds.has(conclusion.id)} />

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 8 }}>
        {isAccepted || isRejected ? (
          <>
            <span style={{ fontSize: 10, color: isAccepted ? C.supports : C.dim, marginRight: 4 }}>
              {isAccepted ? "Accepted" : "Rejected"}
            </span>
            <button
              onClick={onUndo}
              style={{ fontSize: 10, color: C.dim, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
            >
              Undo
            </button>
          </>
        ) : isEditing ? (
          <>
            <CancelButton onClick={onModifyCancel} />
            <AcceptButton onClick={() => onAccept(editingDrafts)} accentColor={ACCENT} />
          </>
        ) : (
          <>
            {hasAddedPremises && <ModifyButton onClick={onModify} />}
            <RejectButton onClick={onReject} />
            <AcceptButton onClick={() => onAccept({})} accentColor={ACCENT} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {boolean}  [props.useDummy]
 * @param {Function} [props.onAddElement]
 * @param {Function} [props.onAddRelation]
 * @param {Function} [props.onDeleteRelationsByArgId]
 */
export function DetectArgumentsTab({ state, useDummy = false, onAddElement, onAddRelation, onDeleteRelationsByArgId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [decisions, setDecisions] = useState({});
  // Maps LLM-assigned element id → frontend-assigned id for accepted added premises.
  const [submittedElementIds, setSubmittedElementIds] = useState({});
  // {argIndex, drafts: {[premiseId]: string}}
  const [editing, setEditing] = useState(null);

  const activeCount = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "rejected",
  ).length;

  const originalIds = useMemo(
    () => new Set(state.elements.map((e) => e.id)),
    [state.elements],
  );

  const addedIds = useMemo(() => {
    if (!result) return new Set();
    const seen = new Set();
    for (const arg of result.translated_arguments)
      for (const el of arg)
        if (!originalIds.has(el.id)) seen.add(el.id);
    return seen;
  }, [result, originalIds]);

  const addedElements = useMemo(() => {
    if (!result || addedIds.size === 0) return [];
    const seen = new Map();
    for (const arg of result.translated_arguments)
      for (const el of arg)
        if (addedIds.has(el.id) && !seen.has(el.id)) seen.set(el.id, el);
    return [...seen.values()];
  }, [result, addedIds]);

  const detect = async () => {
    setLoading(true);
    setError(null);
    setDecisions({});
    setSubmittedElementIds({});
    setEditing(null);
    try {
      const data = await detectArguments(state, useDummy);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (argIndex, drafts) => {
    const arg = result.translated_arguments[argIndex];
    const conclusion = arg.at(-1);
    const premises = arg.slice(0, -1);

    // Pre-compute frontend IDs for any added premises being submitted for the first time,
    // simulating the running element list so IDs don't collide when multiple are added at once.
    const newSubmittedIds = { ...submittedElementIds };
    let runningElements = [...state.elements];

    for (const el of arg) {
      if (addedIds.has(el.id) && !(el.id in newSubmittedIds)) {
        const newId = nextElementId(runningElements, el.type);
        runningElements = [...runningElements, { ...el, id: newId }];
        newSubmittedIds[el.id] = newId;
        onAddElement?.({
          id: newId,
          type: el.type,
          text: drafts?.[el.id] ?? el.text,
          confidence: el.confidence,
          origin: el.origin,
        });
      }
    }

    // Resolve the frontend ID for each element (original for existing, assigned for added).
    const resolveId = (el) =>
      addedIds.has(el.id) ? newSubmittedIds[el.id] : el.id;

    // Add one relation per premise → conclusion, grouped by a shared argumentId.
    // Negated conclusions become jointly_precludes; positive conclusions jointly_entails.
    const argumentId = `arg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    if (premises.length > 0) {
      const conclusionId = resolveId(conclusion);
      const relationType = conclusion.negated ? "jointly_precludes" : "jointly_entails";
      for (const premise of premises) {
        onAddRelation?.(
          { from: resolveId(premise), to: conclusionId, type: relationType, argumentId, explanation: "" },
          { select: false, pinRecent: true },
        );
      }
    }

    setSubmittedElementIds(newSubmittedIds);
    setDecisions((prev) => ({ ...prev, [argIndex]: { status: "accepted", argumentId } }));
    setEditing(null);
  };

  const handleReject = (argIndex) => {
    setDecisions((prev) => ({ ...prev, [argIndex]: { status: "rejected" } }));
    setEditing(null);
  };

  const handleUndo = (argIndex) => {
    const dec = decisions[argIndex];
    if (dec?.status === "accepted" && dec.argumentId) {
      onDeleteRelationsByArgId?.(dec.argumentId);
    }
    setDecisions((prev) => { const n = { ...prev }; delete n[argIndex]; return n; });
  };

  const disabled = loading || activeCount < 3;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 14px", gap: 12 }}>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ color: ACCENT, fontWeight: "bold" }}>Detect Arguments</span>
            <span style={{ color: C.dim }}>{" · "}{activeCount} active element{activeCount !== 1 ? "s" : ""}</span>
            {result && <span style={{ color: C.dim }}>{" · "}{result.model}</span>}
          </div>
          <button
            onClick={detect}
            disabled={disabled}
            style={{
              background: "transparent",
              border: `1px solid ${disabled ? C.border : ACCENT}`,
              color: disabled ? C.dim : ACCENT,
              borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: "bold",
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            }}
          >
            {loading ? <SpinnerIcon /> : <span>↺</span>}
            {loading ? "Detecting…" : result ? "Re-detect" : "Detect"}
          </button>
        </div>

        {activeCount < 3 && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least three active elements to detect arguments.
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {result && (
          <>
            {addedElements.length > 0 && (
              <>
                <SectionHead title="Added Premises" count={addedElements.length} />
                {addedElements.map((e) => (
                  <ArgumentRow key={e.id} element={e} isAdded={true} />
                ))}
              </>
            )}

            <SectionHead title="Arguments" count={result.translated_arguments.length} />
            {result.translated_arguments.length === 0
              ? <div style={{ fontSize: 12, color: C.dim }}>No arguments detected.</div>
              : result.translated_arguments.map((arg, i) => (
                  <ArgumentCard
                    key={i}
                    argument={arg}
                    addedIds={addedIds}
                    decision={decisions[i]}
                    editingDrafts={editing?.argIndex === i ? editing.drafts : null}
                    onAccept={(drafts) => handleAccept(i, drafts)}
                    onReject={() => handleReject(i)}
                    onModify={() => setEditing({ argIndex: i, drafts: {} })}
                    onModifyChange={(premiseId, text) =>
                      setEditing((prev) => ({ ...prev, drafts: { ...prev.drafts, [premiseId]: text } }))
                    }
                    onModifyCancel={() => setEditing(null)}
                    onUndo={() => handleUndo(i)}
                  />
                ))
            }
          </>
        )}
      </div>
      <AddArgumentPanel
        elements={state.elements.filter(
          (e) => e.status !== "withdrawn" && e.status !== "rejected",
        )}
        onAddRelation={onAddRelation}
      />
    </div>
  );
}
