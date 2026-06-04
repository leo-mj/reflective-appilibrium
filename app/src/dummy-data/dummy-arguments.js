// Dummy argument detection for the DetectArgumentsTab.
// Topic: obligations to future generations (matches dummy-state.js).
// Mirrors the Python _dummy_detect_arguments logic from backend/routers/arguments.py.

// Negative indices represent negations: -n = ¬sentence-n
const _DUMMY_ARGUMENTS = [
  // Indices 21–23 are added premises:
  // 21:J (radioactive waste bridge for P1→J1)
  // 22:P (well-being capacity grounds justice — bridge for T1→P5)
  // 23:J (people in 2100 causally affected — bridge for P5→J2)
  [13, 21, 1],
  [13, 3],
  [13, 4],
  [14, 8],
  [14, 5],
  [15, 10],
  [17, 23, 2],
  [17, 12],
  [17, 10],
  [18, 7],
  [19, 22, 17],
  [19, 14],
  [20, 14],
  [19, 20, 14],
  [13, 17, 10],
  [14, 15, 5],
  // Negation arguments:
  [5, -10],      // J5 → ¬J10 (permissible discounting entails rejection of strict equal counting)
  [16, -1],      // P4 → ¬J1 (if only current beings matter, radioactive waste is not wrong)
  [14, -6],      // P2 → ¬J6 (probabilistic obligation entails rejection of "no obligations to non-existent")
  [18, 7, -10],  // P6 + J7 → ¬J10 (if proximity modulates and parents > strangers, strict equal counting fails)
];

const _ADDED_PREMISES = [
  {
    index: 21,
    type: "judgment",
    text: "Burying large quantities of radioactive waste without containment, knowing it will poison groundwater for millennia, constitutes leaving future generations materially worse off than we found things.",
  },
  {
    index: 22,
    type: "principle",
    text: "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
  },
  {
    index: 23,
    type: "judgment",
    text: "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
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
    if ((r.type !== "jointly_entails" && r.type !== "jointly_precludes") || !r.argumentId) continue;
    if (!groups[r.argumentId]) groups[r.argumentId] = { froms: [], to: r.to };
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
 * Returns a dummy DetectArgumentsResponse for the given elements, round, and existing relations.
 * Arguments already present as jointly_entails groups in the state are excluded.
 *
 * @param {Array} elements
 * @param {string|number} round
 * @param {Array} [relations=[]]
 * @returns {{ num_arguments: number[][], translated_arguments: Array[], lookup: Object, model: string, input_tokens: number, output_tokens: number }}
 */
export function getDummyArguments(elements, round, relations = []) {
  const initialLookup = Object.fromEntries(elements.map((e, i) => [i + 1, e]));
  const poolSize = elements.length + _ADDED_PREMISES.length;
  const lookup = addNewPremisesToLookup(initialLookup, _ADDED_PREMISES, elements, round, "dummy");
  const existingFingerprints = buildExistingArgFingerprints(relations);
  const numArguments = _DUMMY_ARGUMENTS.filter(
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
    model: "dummy",
    input_tokens: 0,
    output_tokens: 0,
  };
}
