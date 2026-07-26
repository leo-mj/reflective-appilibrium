// Sample argument detection for the DetectArgumentsTab.
import { ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";
import { ELICITABLE_ARGUMENT_PREMISES } from "./sample-judgments.js";
// Topic: obligations to future generations (matches sample-state.js).
// Mirrors the Python dummy_detect_arguments logic from backend/services/arguments.py.
//
// Each argument is stored in its FINAL, surfaced form: the postulate-stripped
// output the backend pipeline produces after verify_and_partition. Because the
// numbered sentences are logically independent atoms, every argument relies on
// a meaning postulate (Carnap 1952) that bridges the inferential gap. Those
// postulates are verified and then folded out of the pool on the backend; here
// they are stored directly as `_ARGUMENT_POSTULATES` (parallel to the argument
// list) so the offline demo surfaces the same "Valid given: …" bridge texts
// without re-implementing the checker.
//
// Detection over EXISTING elements vs. newly proposed premises:
//   - Index 22 is J14, a judgment already in the sample state, so P1 + J14 → J1
//     is detected purely from existing elements.
//   - Indices 24 and 29 double as Elicit-Judgments options (their texts live in
//     ELICITABLE_ARGUMENT_PREMISES). If the user accepted one there, getSampleArguments
//     matches it by text in the current pool and reuses it instead of re-proposing it.
//   - The remaining indices (23, 25–28) are genuinely new premises the LLM adds.

// Negative indices represent negations: -n = ¬sentence-n
// Element indices (position in sample-state elements): J1–J13 = 1–13,
// P1–P6 = 14–19, T1 = 20, T2 = 21, J14 = 22.
const _SAMPLE_ARGUMENTS = [
  // Index 22 is J14 (a pool element). Indices 23–29 are added premises:
  // 23:P (well-being capacity grounds justice — bridge for T1→P5)
  // 24:J (people in 2100 causally affected — ELICITABLE — bridge for P5→J2)
  // 25:P (affected but unrepresented, so representation required — bridge for P5→J12)
  // 26:P (person-affecting restriction: wrong only if someone is wronged — shared bridge for P4→¬J1 and J13→¬J8)
  // 27:P (de dicto obligations survive de re indeterminacy — bridge for T2→J9)
  // 28:P (justice gives protected welfare full weight despite uncertainty — bridge for P5→¬J5)
  // 29:J (extinction as mere non-creation — ELICITABLE — bridge for J13→¬J8)
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

// Parallel to _SAMPLE_ARGUMENTS: the meaning-postulate text(s) each argument
// relies on (backend added-premise indices 30–44; each argument uses exactly
// one). Surfaced to the user as the argument's "Valid given: …" bridge.
const _ARGUMENT_POSTULATES = [
  ["An act that does exactly what a generation's standing duty forbids — leaving the next generation worse off — is thereby wrong."],
  ["Interests being discounted for temporal distance just is obligations toward their holders weakening with temporal distance."],
  ["If justice is owed to all who will be affected, and the people of 2100 and beyond will be affected by present climate policy, then climate policy owes their welfare consideration."],
  ["If justice is owed to future generations and can be discharged only through representative mechanisms, then such mechanisms ought to exist."],
  ["Owing justice to people regardless of when they exist just is not discounting their interests for their temporal distance."],
  ["If what matters for moral patienthood is well-being capacity, and those with well-being capacity who are affected are owed justice, then justice is owed to all who will be affected, whenever they exist."],
  ["If obligations attach to future people de dicto though not de re, then the non-identity problem reduces our obligations (the de re loss) but does not eliminate them (the de dicto survival)."],
  ["If moral patienthood needs no identity and future people form a determinate class, then obligations toward merely probable beings are possible."],
  ["If obligations can attach to probable beings and diminish only with existence-uncertainty, then slight discounting for genuine existence-uncertainty is permissible."],
  ["If only presently existing beings can be wronged and wrongness requires a wronged party, then an act harming only the not-yet-existing is not wrong."],
  ["That only currently existing beings can bear obligations directly contradicts obligations existing toward merely probable future beings."],
  ["That obligations can exist toward probable future beings directly contradicts our having no obligations to those who do not yet exist."],
  ["If justice is owed to whoever will be affected and justice demands full weight despite uncertainty, then even slight uncertainty-discounting is impermissible."],
  ["If temporal proximity modulates obligation strength and parental duties outrank duties to distant strangers, then interests may be discounted with temporal distance after all."],
  ["If wronging requires a wronged party, extinction wrongs no one now alive and merely fails to create future people, and non-creation wrongs no one, then allowing extinction is not wrong."],
];

// Added premises the LLM proposes to close each inferential gap. Index 22 is
// omitted: it was promoted into the sample state as J14. Premises 24 and 29 use
// the shared ELICITABLE_ARGUMENT_PREMISES texts so that, if the user accepted
// them in Elicit Judgments, getSampleArguments reuses the accepted element
// instead of re-proposing the premise.
const _ADDED_PREMISES = [
  {
    index: 23,
    type: "principle",
    role: "premise",
    text: "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
  },
  {
    index: 24,
    type: "judgment",
    role: "premise",
    text: ELICITABLE_ARGUMENT_PREMISES.affected2100,
  },
  {
    index: 25,
    type: "principle",
    role: "premise",
    text: "Future generations will be affected by present political decisions but cannot take part in making them; obligations of justice owed to such people can be discharged only through institutional mechanisms that represent their interests.",
  },
  {
    index: 26,
    type: "principle",
    role: "premise",
    text: "An act or omission is wrong only if there is or will be someone whom it wrongs (person-affecting restriction).",
  },
  {
    index: 27,
    type: "principle",
    role: "premise",
    text: "Obligations to future people attach de dicto — to whoever will exist — even when they cannot attach de re to any specific future individual.",
  },
  {
    index: 28,
    type: "principle",
    role: "premise",
    text: "Where obligations of justice are owed, the welfare of those protected must be given its full weight in present deliberation, however uncertain their existence.",
  },
  {
    index: 29,
    type: "judgment",
    role: "premise",
    text: ELICITABLE_ARGUMENT_PREMISES.extinctionNonCreation,
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

// Canonical indices 1–22 refer to the base sample-state elements (J1–J14).
// Indices 23–29 are the added premises above. Keep in sync with sample-state.js.
const BASE_POOL_SIZE = 22;

/**
 * Returns a sample DetectArgumentsResponse for the given elements, round, and existing relations.
 *
 * Canonical argument indices are resolved to actual lookup indices at call time.
 * Base elements (1–22) map to their positions in the current pool. Each added
 * premise maps to an existing element when its text is already present — e.g. a
 * premise the user accepted earlier in Elicit Judgments, which is then NOT
 * re-proposed — otherwise to a fresh index appended after the current pool.
 * Resolving dynamically (rather than at fixed indices 23–29) keeps the fixture
 * correct even after the pool has grown. Arguments already recorded as argument
 * relations in the state are excluded.
 *
 * @param {Array} elements
 * @param {string|number} round
 * @param {Array} [relations=[]]
 * @returns {{ num_arguments: number[][], translated_arguments: Array[], argument_postulates: string[][], lookup: Object, model: string, rejected_count: number, input_tokens: number, output_tokens: number }}
 */
export function getSampleArguments(elements, round, relations = []) {
  const baseLookup = Object.fromEntries(elements.map((e, i) => [i + 1, e]));
  const textToIndex = new Map(elements.map((e, i) => [e.text, i + 1]));

  // Map each canonical index to an actual lookup index.
  const actualIndex = {};
  for (let i = 1; i <= BASE_POOL_SIZE; i += 1) actualIndex[i] = i;
  let nextIndex = elements.length + 1;
  const premisesToInject = [];
  for (const premise of _ADDED_PREMISES) {
    const existing = textToIndex.get(premise.text);
    if (existing != null) {
      actualIndex[premise.index] = existing; // already in the pool — reuse it
    } else {
      actualIndex[premise.index] = nextIndex;
      premisesToInject.push({ ...premise, index: nextIndex });
      nextIndex += 1;
    }
  }

  const lookup = addNewPremisesToLookup(baseLookup, premisesToInject, elements, round, "claude-fable-5");
  const remap = (n) => {
    const mapped = actualIndex[Math.abs(n)];
    return n < 0 ? -mapped : mapped;
  };

  const existingFingerprints = buildExistingArgFingerprints(relations);
  // Remap, then filter arguments and their postulates together so the two stay
  // parallel (mirrors the backend's kept_pairs zip in verify_and_partition).
  const kept = _SAMPLE_ARGUMENTS.map((arg, i) => ({
    arg: arg.map(remap),
    postulates: _ARGUMENT_POSTULATES[i] ?? [],
  })).filter(({ arg }) => {
    const fp = argFingerprint(arg, lookup);
    return fp !== null && !existingFingerprints.has(fp);
  });
  const numArguments = kept.map((k) => k.arg);
  const argumentPostulates = kept.map((k) => k.postulates);
  const translatedArguments = numArguments.map((arg) =>
    arg.map((n) => {
      const el = lookup[Math.abs(n)];
      return n < 0 ? { ...el, negated: true } : el;
    })
  );
  return {
    num_arguments: numArguments,
    translated_arguments: translatedArguments,
    argument_postulates: argumentPostulates,
    lookup,
    model: "claude-fable-5",
    rejected_count: 0,
    input_tokens: 0,
    output_tokens: 0,
  };
}
