/**
 * @fileoverview The Graph tab's add dialogs — element, relation, argument —
 * and the half-written forms they leave behind.
 * @module components/graph/GraphModals
 */

import { useCallback, useState } from "react";

import {
  argumentRelationType,
  newArgumentId,
} from "../../utils/stateUtils.js";
import { AddElementModal } from "../user_edits/AddElementModal.jsx";
import { AddRelationModal } from "../user_edits/AddRelationModal.jsx";
import { AddArgumentModal } from "../user_edits/AddArgumentModal.jsx";

export function GraphModals({
  addingElType,
  setAddingElType,
  addingRel,
  setAddingRel,
  addingRelPrefill,
  addingArg,
  setAddingArg,
  addingArgPrefill,
  linkableEls,
  round,
  onAddElement,
  onAddRelation,
}) {
  // Half-written forms, kept for as long as the graph is on screen. The dialogs
  // themselves unmount when dismissed, so their own state cannot survive it —
  // and a modal is easy to close by accident. This component is never
  // unmounted, and it is below the graph, so keeping them here costs a render
  // of the open dialog per keystroke and nothing above it.
  const [drafts, setDrafts] = useState({
    element: null,
    relation: null,
    argument: null,
  });
  // Stable per kind: the dialogs report their form from an effect keyed on this
  // callback, and a fresh function each render would set it running in a loop.
  const keepElement = useCallback(
    (v) => setDrafts((d) => ({ ...d, element: v })),
    [],
  );
  const keepRelation = useCallback(
    (v) => setDrafts((d) => ({ ...d, relation: v })),
    [],
  );
  const keepArgument = useCallback(
    (v) => setDrafts((d) => ({ ...d, argument: v })),
    [],
  );
  // Committed work is not a draft. Without this the next dialog would open on
  // the form that was just submitted.
  const forget = (which) => setDrafts((d) => ({ ...d, [which]: null }));

  return (
    <>
      {addingElType && (
        <AddElementModal
          initialType={addingElType}
          currentRound={round}
          draft={drafts.element}
          onDraftChange={keepElement}
          onSave={(formData) => {
            onAddElement(formData);
            forget("element");
            setAddingElType(null);
          }}
          onCancel={() => setAddingElType(null)}
        />
      )}
      {addingRel && (
        <AddRelationModal
          elements={linkableEls}
          currentRound={round}
          initialFrom={addingRelPrefill?.from}
          initialTo={addingRelPrefill?.to}
          draft={drafts.relation}
          onDraftChange={keepRelation}
          onSave={(formData) => {
            onAddRelation(formData);
            forget("relation");
            setAddingRel(false);
          }}
          onCancel={() => setAddingRel(false)}
        />
      )}
      {addingArg && (
        <AddArgumentModal
          elements={linkableEls}
          currentRound={round}
          initialPremises={addingArgPrefill?.premises}
          initialConclusion={addingArgPrefill?.conclusion}
          draft={drafts.argument}
          onDraftChange={keepArgument}
          onSave={({ premises, conclusion, negated, explanation }) => {
            const argumentId = newArgumentId();
            const type = argumentRelationType(premises.length, negated);
            premises.forEach((premise, i) => {
              onAddRelation(
                {
                  from: premise,
                  to: conclusion,
                  type,
                  argumentId,
                  explanation,
                },
                { select: false, pinRecent: i === premises.length - 1 },
              );
            });
            forget("argument");
            setAddingArg(false);
          }}
          onCancel={() => setAddingArg(false)}
        />
      )}
    </>
  );
}
