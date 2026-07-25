// Sample argument detection for the DetectArgumentsTab.
import { ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";
// Topic: obligations to future generations (matches sample-state.js).
// Mirrors the Python dummy_detect_arguments logic from backend/services/arguments.py.

// Negative indices represent negations: -n = ¬sentence-n
// Element indices (position in sample-state elements): J1–J13 = 1–13,
// P1–P6 = 14–19, T1 = 20, T2 = 21.
const _SAMPLE_ARGUMENTS = [
  // Indices 22–29 are added premises:
  // 22:J (next generation inherits the waste hazard — bridge for P1→J1)
  // 23:P (well-being capacity grounds justice — bridge for T1→P5)
  // 24:J (people in 2100 causally affected — bridge for P5→J2)
  // 25:P (affected but unrepresented, so representation required — bridge for P5→J12)
  // 26:P (person-affecting restriction: wrong only if someone is wronged — shared bridge for P4→¬J1 and J13→¬J8)
  // 27:P (de dicto obligations survive de re indeterminacy — bridge for T2→J9)
  // 28:P (justice gives protected welfare full weight despite uncertainty — bridge for P5→¬J5)
  // 29:J (extinction as mere non-creation — bridge for J13→¬J8)
  [14, 22, 1],
  [16, 10],
  [18, 24, 2],
  [18, 25, 12],
  [18, 10],
  [20, 23, 18],
  [21, 27, 9],
  [20, 21, 15],     // T1 + T2 → P2 (already in state as arg-sample-1; filtered at runtime)
  [15, 16, 5],      // P2 + P3 → J5 (already in state as arg-sample-3; filtered at runtime)
  // Negation arguments:
  [17, 26, -1],     // P4 + P26 → ¬J1 (only future people are affected, they cannot be wronged, and wrongness requires a wronged party)
  [17, -15],        // P4 → ¬P2 (presentism directly contradicts probabilistic obligation)
  [15, -6],         // P2 → ¬J6 (J6 claims obligations to the non-existent are impossible in principle; P2 asserts their possibility)
  [18, 28, -5],     // P5 + P28 → ¬J5 (justice owed to future people gives their welfare full weight despite uncertainty — counterpoint to P2 + P3 → J5)
  [19, 7, -10],     // P6 + J7 → ¬J10 (already in state as arg-sample-5; filtered at runtime)
  [13, 29, 26, -8], // J13 + J29 + P26 → ¬J8 (allowing extinction wrongs no one now alive or future, and wrongness requires a wronged party)
];

const _ADDED_PREMISES = [
  {
    index: 22,
    type: "judgment",
    text: "Burying large quantities of radioactive waste without containment bequeaths the next generation land and groundwater burdened with an uncontained long-term hazard, leaving them worse off than we found things.",
  },
  {
    index: 23,
    type: "principle",
    text: "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
  },
  {
    index: 24,
    type: "judgment",
    text: "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
  },
  {
    index: 25,
    type: "principle",
    text: "Future generations will be affected by present political decisions but cannot take part in making them; obligations of justice owed to such people can be discharged only through institutional mechanisms that represent their interests.",
  },
  {
    index: 26,
    type: "principle",
    text: "An act or omission is wrong only if there is or will be someone whom it wrongs (person-affecting restriction).",
  },
  {
    index: 27,
    type: "principle",
    text: "Obligations to future people attach de dicto — to whoever will exist — even when they cannot attach de re to any specific future individual.",
  },
  {
    index: 28,
    type: "principle",
    text: "Where obligations of justice are owed, the welfare of those protected must be given its full weight in present deliberation, however uncertain their existence.",
  },
  {
    index: 29,
    type: "judgment",
    text: "A society's failure to prevent its own distant extinction wrongs no one now alive and, with respect to future people, merely fails to bring them into existence.",
  },
];

function addNewPremisesToLookup(lookup, addedPremises, elements, round, model) {
  const updated = { ...lookup };
  const maxIds = {
    J: elements.filter((e) => e.type === "judgment").length,
    P: elements.filter((e) => e.type === "principle").length,
    T: elements.filter((e) => e.type === "theory").length,
  };
  for (const premise of addedPremises) {
    const idType = premise.type[0].toUpperCase();
    const idInt = maxIds[idType] + 1;
    updated[premise.index] = {
      id: idType + idInt,
      text: premise.text,
      type: premise.type,
      addedRound: parseInt(round) + 1,
      status: "active",
      confidence: 0.67,
      origin: model,
      previousText: null,
      reason: null,
      withdrawnRound: null,
      rejectedRound: null,
      revisedRound: null,
    };
    maxIds[idType] += 1;
  }
  return updated;
}

export function buildExistingArgFingerprints(relations) {
  const groups = {};
  for (const r of relations) {
    if (!ARGUMENT_RELATION_TYPES.has(r.type) || !r.argumentId) continue;
    // Precludes-type relations conclude the *negation* of `to`; mirror the
    // ¬-prefix used by argFingerprint so they match.
    const negated = r.type === "precludes" || r.type === "jointly_precludes";
    if (!groups[r.argumentId])
      groups[r.argumentId] = { froms: [], to: (negated ? "¬" : "") + r.to };
    groups[r.argumentId].froms.push(r.from);
  }
  return new Set(
    Object.values(groups).map((g) => `${[...g.froms].sort().join(",")}->${g.to}`)
  );
}

export function argFingerprint(arg, lookup) {
  const ids = arg.map((n) => {
    const el = lookup[Math.abs(n)];
    if (!el) return null;
    return (n < 0 ? "¬" : "") + el.id;
  });
  if (ids.some((id) => !id)) return null;
  const premises = ids.slice(0, -1).sort();
  const conclusion = ids.at(-1);
  return `${premises.join(",")}->${conclusion}`;
}

/**
 * Returns a sample DetectArgumentsResponse for the given elements, round, and existing relations.
 * Arguments already present as jointly_entails groups in the state are excluded.
 *
 * @param {Array} elements
 * @param {string|number} round
 * @param {Array} [relations=[]]
 * @returns {{ num_arguments: number[][], translated_arguments: Array[], lookup: Object, model: string, input_tokens: number, output_tokens: number }}
 */
export function getSampleArguments(elements, round, relations = []) {
  const initialLookup = Object.fromEntries(elements.map((e, i) => [i + 1, e]));
  const poolSize = elements.length + _ADDED_PREMISES.length;
  const lookup = addNewPremisesToLookup(initialLookup, _ADDED_PREMISES, elements, round, "claude-fable-5");
  const existingFingerprints = buildExistingArgFingerprints(relations);
  const numArguments = _SAMPLE_ARGUMENTS.filter(
    (arg) =>
      arg.every((n) => Math.abs(n) <= poolSize) &&
      argFingerprint(arg, lookup) !== null &&
      !existingFingerprints.has(argFingerprint(arg, lookup))
  );
  const translatedArguments = numArguments.map((arg) =>
    arg.map((n) => {
      const el = lookup[Math.abs(n)];
      return n < 0 ? { ...el, negated: true } : el;
    })
  );
  return {
    num_arguments: numArguments,
    translated_arguments: translatedArguments,
    lookup,
    model: "claude-fable-5",
    input_tokens: 0,
    output_tokens: 0,
  };
}
