/**
 * @fileoverview The Merge assist tab: pairs of elements, one from each merged
 * process, that a model thinks make the same claim — and the reader's decision
 * on each.
 *
 * Offered only after a process merge. Accepting a pair removes one element and
 * keeps the other (`utils/elementMerge.js`); the reader picks which wording
 * stays, may reword it, and sets its confidence. Dismissing records nothing:
 * "these are different claims" is the state of affairs already.
 *
 * @module components/workflows/ElementMergeTab
 */

/** @import { REState } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { fetchMergePairs } from "../../utils/elementMergeClient.js";
import { isMergeablePair, mergePool } from "../../utils/elementMerge.js";
import { useSuggestionWorkflow } from "../../hooks/useSuggestionWorkflow.js";
import {
  AcceptButton,
  RejectButton,
  ModifyTextarea,
  ErrorBanner,
  NeedsKeyNotice,
  AiDisclosureBanner,
} from "../SuggestionActions.jsx";
import { ConfidenceInput } from "../user_edits/ConfidenceInput.jsx";
import { SuggestionToolbar } from "./workflowComponents.jsx";

const MUTED = { fontSize: 12, color: C.dim };

/**
 * One side of a pair, as a choice of which wording to keep.
 *
 * @param {Object} props
 * @param {import('../../types.js').REElement} props.element
 * @param {string} props.letters - Its process letters.
 * @param {boolean} props.chosen
 * @param {Function} props.onChoose
 * @param {string} props.name - Radio group name, one per card.
 */
function Side({ element, letters, chosen, onChoose, name }) {
  return (
    <label
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 10px",
        borderRadius: 6,
        border: `1px solid ${chosen ? C.supports : C.border}`,
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        name={name}
        checked={chosen}
        onChange={onChoose}
        style={{ accentColor: C.supports, marginTop: 2 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: "bold", color: C.text }}>{element.id}</span>
        <span style={{ ...MUTED, marginLeft: 6 }}>process {letters}</span>
        <span style={{ display: "block", color: C.text, lineHeight: 1.5 }}>
          {element.text}
        </span>
        <span style={MUTED}>Confidence {element.confidence}</span>
      </span>
    </label>
  );
}

/**
 * @param {Object} props
 * @param {{ a: string, b: string, reason: string }} props.pair
 * @param {REState} props.state
 * @param {Map<string, string>} props.lettersOf - Element id → process letters.
 * @param {string} props.defaultKeep - Which side to offer as kept first.
 * @param {Function} props.onMerge  - Called with `{ keepId, removeId, text, confidence }`.
 * @param {Function} props.onDismiss
 */
function PairCard({ pair, state, lettersOf, defaultKeep, onMerge, onDismiss }) {
  const byId = (id) => state.elements.find((e) => e.id === id);
  const [keepId, setKeepId] = useState(defaultKeep);
  const kept = byId(keepId);
  const [text, setText] = useState(kept.text);
  const [confidence, setConfidence] = useState(kept.confidence);
  const removeId = keepId === pair.a ? pair.b : pair.a;

  // Choosing the other side starts from its wording and confidence.
  const choose = (id) => {
    const el = byId(id);
    setKeepId(id);
    setText(el.text);
    setConfidence(el.confidence);
  };

  return (
    <div
      data-testid="merge-pair"
      style={{
        borderLeft: `3px solid ${C.dim}`,
        background: C.panel,
        borderRadius: "0 6px 6px 0",
        padding: "10px 14px",
        marginBottom: 10,
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: C.text, fontWeight: "bold" }}>
          Same claim? {pair.a} · {pair.b}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <AcceptButton
            onClick={() => onMerge({ keepId, removeId, text, confidence })}
          />
          <RejectButton onClick={onDismiss} />
        </div>
      </div>
      {pair.reason && (
        <div style={{ ...MUTED, lineHeight: 1.5, marginBottom: 8 }}>{pair.reason}</div>
      )}
      <div style={{ ...MUTED, marginBottom: 4 }}>
        Keep the wording of — the other is removed and its relations move here:
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {[pair.a, pair.b].map((id) => (
          <Side
            key={id}
            element={byId(id)}
            letters={lettersOf.get(id) ?? ""}
            chosen={keepId === id}
            onChoose={() => choose(id)}
            name={`keep-${pair.a}-${pair.b}`}
          />
        ))}
      </div>
      <ModifyTextarea value={text} onChange={setText} accentColor={C.supports} />
      <ConfidenceInput value={confidence} onChange={setConfidence} />
    </div>
  );
}

/**
 * @param {Object} props
 * @param {REState} props.state
 * @param {{ id: string, label: string, members: string[] }[]} props.processes -
 *   The merged processes, from the state itself rather than the view of it the
 *   panel is otherwise drawn from: hiding the process tags must not hide this.
 * @param {Function} props.onMergeElements
 * @param {boolean} [props.useDummy]
 * @param {boolean} [props.suggestionsDisabled]
 */
export function ElementMergeTab({
  state,
  processes,
  onMergeElements,
  useDummy = false,
  suggestionsDisabled = false,
}) {
  const {
    suggestions,
    setSuggestions,
    loading,
    error,
    model,
    hasResult,
    run,
  } = useSuggestionWorkflow((s, dummy) =>
    fetchMergePairs({ ...s, processes }, dummy),
  );

  const lettersOf = new Map();
  for (const p of processes)
    for (const m of p.members)
      lettersOf.set(m, lettersOf.has(m) ? `${lettersOf.get(m)}+${p.id}` : p.id);
  const order = new Map(processes.map((p, i) => [p.id, i]));
  // The side from the earliest process is offered as the one kept: it is the
  // one that was on the board first.
  const earliest = (id) =>
    Math.min(...(lettersOf.get(id) ?? "").split("+").map((l) => order.get(l) ?? Infinity));
  const defaultKeep = (pair) => (earliest(pair.b) < earliest(pair.a) ? pair.b : pair.a);

  // A merge can make other pairs moot — one of their elements is gone, or both
  // now share a process — so what is shown is re-checked against the state.
  const shown = (suggestions ?? []).filter((p) =>
    isMergeablePair(state, processes, p.a, p.b),
  );

  const drop = (pair) => setSuggestions((prev) => prev.filter((p) => p !== pair));
  const poolSize = mergePool(state, processes).length;
  const needs = !processes.length
    ? "Merge another process first."
    : poolSize < 2
      ? "The merged processes have too few elements to compare."
      : undefined;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <SuggestionToolbar
          tab="mergeElements"
          title="Merge Elements"
          actionLabel="Find pairs"
          rerunLabel="Find again"
          suggestionCount={hasResult ? shown.length : null}
          loading={loading}
          hasResult={hasResult}
          onRun={() => run(state, useDummy)}
          model={model}
          disabled={suggestionsDisabled}
          needs={needs}
          disclosure={
            hasResult &&
            shown.length > 0 && (
              <AiDisclosureBanner
                model={model}
                note="Whether two statements make the same claim is your call."
              />
            )
          }
        />

        <NeedsKeyNotice />
        {error && <ErrorBanner message={error} />}

        <div style={{ ...MUTED, lineHeight: 1.5, marginBottom: 10 }}>
          Pairs of elements, one from each merged process, that may say the same
          thing in different words. Merging keeps one and removes the other.
        </div>

        {hasResult && shown.length === 0 && (
          <div style={MUTED}>No pairs to review.</div>
        )}

        {shown.map((pair) => (
          <PairCard
            key={`${pair.a}|${pair.b}`}
            pair={pair}
            state={state}
            lettersOf={lettersOf}
            defaultKeep={defaultKeep(pair)}
            onMerge={(choice) => {
              onMergeElements({ ...choice, reason: pair.reason });
              drop(pair);
            }}
            onDismiss={() => drop(pair)}
          />
        ))}
      </div>
    </div>
  );
}
