// Sample RE state for visualization development
// Topic: obligations to future generations
// 8 rounds, 13 judgments, 6 principles, 2 theories, mix of statuses

import { sampleLog } from "./sampleLog.js";

// No `reviews` here on purpose. A review is something the user accepts, so the
// sample must not open with one already banked — see the note in
// sample-data/sample-review.js, which demonstrates the series through the
// visitor's own two runs instead.
const SAMPLE = {
  topic: "Do we have moral obligations to people who do not yet exist?",
  phase: 3,
  round: 61,
  // Eight rounds, each change its own step, as the app records them: `round`
  // is the last step, `roundEnds` the last step of rounds 1–7, the eighth being
  // the one open now. Within a round, elements came in first, then relations —
  // an argument's premises together, as one step — then revisions and
  // withdrawals. The log has one entry per step, as the app writes them,
  // built from these elements and relations (sampleLog.js). The sample review
  // speaks of rounds, which these are.
  roundEnds: [6, 16, 24, 32, 46, 57, 60],
  elements: [
    // ── Judgments ──
    {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 1.0,
      origin: "user",
      text: "It would be wrong to bury large quantities of radioactive waste without any containment, knowing it will poison groundwater for millennia — long after everyone now living is gone.",
      addedRound: 1,
    },
    {
      id: "J2",
      type: "judgment",
      status: "active",
      confidence: 1.0,
      origin: "user",
      text: "Climate policies should account for the welfare of people living in 2100 and beyond.",
      addedRound: 2,
    },
    {
      id: "J3",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      origin: "user",
      text: "A government that depletes all natural resources for short-term economic gain acts wrongly.",
      addedRound: 3,
    },
    {
      id: "J4",
      type: "judgment",
      status: "revised",
      confidence: 0.67,
      origin: "user",
      text: "We owe future people a liveable environment, but not necessarily the same standard of living we enjoy.",
      previousText:
        "We owe future people exactly the same standard of living we enjoy.",
      addedRound: 7,
      revisedRound: 45,
    },
    {
      id: "J5",
      type: "judgment",
      status: "active",
      confidence: 0.33,
      origin: "user",
      text: "It is permissible to discount future welfare slightly due to genuine uncertainty about whether future people will exist.",
      addedRound: 8,
    },
    {
      id: "J6",
      type: "judgment",
      status: "withdrawn",
      confidence: 0.33,
      origin: "user",
      text: "We have no obligations to people who do not yet exist because they cannot hold rights.",
      reason:
        "The user accepted that obligations need not depend on current rights-holders.",
      addedRound: 4,
      withdrawnRound: 23,
    },
    {
      id: "J7",
      type: "judgment",
      status: "active",
      confidence: 1.0,
      origin: "user",
      text: "Parents have stronger obligations to their future children than to distant future strangers.",
      addedRound: 17,
    },
    {
      id: "J8",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      origin: "claude-fable-5",
      text: "A society that could prevent its own extinction at modest cost but chooses not to acts wrongly.",
      addedRound: 25,
    },
    {
      id: "J9",
      type: "judgment",
      status: "active",
      confidence: 0.33,
      origin: "user",
      text: "The non-identity problem reduces but does not eliminate our obligations to future people.",
      addedRound: 26,
    },
    {
      id: "J10",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      origin: "user",
      text: "Future people's interests should not be discounted merely because of their temporal distance from us.",
      addedRound: 33,
    },
    {
      id: "J11",
      type: "judgment",
      status: "withdrawn",
      confidence: 0.33,
      origin: "claude-fable-5",
      text: "Obligations to future generations are entirely reducible to obligations to currently existing people.",
      reason:
        "Reducing all duties to future people to duties among contemporaries proved too restrictive given J1 and J2.",
      addedRound: 18,
      withdrawnRound: 32,
    },
    {
      id: "J12",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      origin: "user",
      text: "Democratic institutions should include mechanisms for representing the interests of future generations.",
      addedRound: 47,
    },
    {
      id: "J13",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      origin: "user",
      text: "No one is wronged by not being brought into existence: there is no duty to create additional happy people (procreation asymmetry).",
      addedRound: 58,
    },

    // ── Principles ──
    {
      id: "P1",
      type: "principle",
      status: "active",
      confidence: 1.0,
      origin: "user",
      text: "Each generation has a duty not to leave the next generation worse off than it found things (sufficientarian threshold).",
      addedRound: 9,
    },
    {
      id: "P2",
      type: "principle",
      status: "active",
      confidence: 0.67,
      origin: "claude-fable-5",
      text: "Moral obligations can exist toward beings whose existence is probable, even if not certain (probabilistic obligation).",
      addedRound: 19,
    },
    {
      id: "P3",
      type: "principle",
      status: "revised",
      confidence: 0.67,
      origin: "user",
      text: "The strength of our obligations to future people diminishes with uncertainty about their existence, but not with mere temporal distance.",
      previousText:
        "The strength of our obligations to future people diminishes with temporal distance.",
      addedRound: 27,
      revisedRound: 46,
    },
    {
      id: "P4",
      type: "principle",
      status: "withdrawn",
      confidence: 0.33,
      origin: "claude-fable-5",
      text: "Only beings who currently exist can be the subjects of moral obligations.",
      reason:
        "Conflicted with J1, J2 and the user's overall trajectory. Replaced by P2.",
      addedRound: 10,
      withdrawnRound: 24,
    },
    {
      id: "P5",
      type: "principle",
      status: "active",
      confidence: 0.67,
      origin: "claude-fable-5",
      text: "Obligations of justice are owed to all who will be affected by our decisions, regardless of when they come to exist.",
      addedRound: 34,
    },
    {
      id: "P6",
      type: "principle",
      status: "active",
      confidence: 0.33,
      origin: "claude-fable-5",
      text: "Proximity (temporal, social, relational) modulates the strength but not the existence of moral obligations.",
      addedRound: 48,
    },

    // ── Background Theories (from Round 5+) ──
    {
      id: "T1",
      type: "theory",
      status: "active",
      confidence: 0.67,
      origin: "claude-fable-5",
      text: "Personal identity is not required for moral patienthood — what matters is the capacity for well-being, which future people will have.",
      addedRound: 35,
    },
    {
      id: "T2",
      type: "theory",
      status: "active",
      confidence: 0.33,
      origin: "user",
      text: "The non-identity problem shows that specific future individuals are metaphysically indeterminate, but future people as a class are not.",
      addedRound: 49,
    },

    // A judgment the user accepted earlier that is not yet tied into any
    // argument (deliberately left unconnected). Detect Arguments reconstructs
    // P1 + J14 → J1 from it, demonstrating argument detection over existing
    // elements rather than newly proposed premises. Kept last so it occupies
    // positional index 22 in the argument fixture (sample-arguments.js).
    {
      id: "J14",
      type: "judgment",
      status: "active",
      confidence: 1.0,
      origin: "user",
      text: "Burying large quantities of radioactive waste without containment bequeaths the next generation land and groundwater burdened with an uncontained long-term hazard, leaving them worse off than we found things.",
      addedRound: 5,
    },
  ],
  relations: [
    // P1 supports
    {
      from: "P1",
      to: "J1",
      type: "supports",
      explanation:
        "Poisoning groundwater violates the sufficientarian threshold.",
      addedRound: 11,
      origin: "user",
    },
    {
      from: "P1",
      to: "J2",
      type: "supports",
      explanation:
        "Climate policy must ensure future generations aren't worse off.",
      addedRound: 12,
      origin: "user",
    },
    {
      from: "P1",
      to: "J3",
      type: "supports",
      explanation: "Resource depletion leaves the next generation worse off.",
      addedRound: 13,
      origin: "user",
    },
    {
      from: "P1",
      to: "J4",
      type: "supports",
      explanation:
        "Sufficientarianism requires a liveable environment, not identical living standards.",
      addedRound: 36,
      origin: "user",
    },

    // P2 supports
    {
      from: "P2",
      to: "J5",
      type: "supports",
      explanation:
        "If obligation tracks probable existence, genuine existence-uncertainty is the kind of consideration that can bear on its strength.",
      addedRound: 20,
      origin: "user",
    },
    {
      from: "P2",
      to: "J8",
      type: "supports",
      explanation:
        "Probable future people ground the obligation to prevent extinction.",
      addedRound: 28,
      origin: "user",
    },
    {
      from: "P2",
      to: "J9",
      type: "supports",
      explanation:
        "Even under non-identity, probabilistic obligations persist.",
      addedRound: 29,
      origin: "user",
    },

    // P3 supports
    {
      from: "P3",
      to: "J5",
      type: "supports",
      explanation:
        "Uncertainty-based discounting is permitted; temporal discounting is not.",
      addedRound: 37,
      origin: "user",
    },
    {
      from: "P3",
      to: "J10",
      type: "supports",
      explanation:
        "P3 rules out diminution by mere temporal distance, which is exactly the neutrality J10 asserts.",
      addedRound: 38,
      origin: "user",
    },

    // P5 supports
    {
      from: "P5",
      to: "J2",
      type: "supports",
      explanation: "People in 2100 are affected by current climate policy.",
      addedRound: 39,
      origin: "user",
    },
    {
      from: "P5",
      to: "J12",
      type: "supports",
      explanation:
        "If future people are owed justice, institutions should represent them.",
      addedRound: 50,
      origin: "user",
    },
    {
      from: "P5",
      to: "J10",
      type: "supports",
      explanation:
        "If justice is owed to all affected regardless of when they exist, temporal distance alone cannot discount their interests.",
      addedRound: 40,
      origin: "user",
    },

    // P6 supports and tensions
    {
      from: "P6",
      to: "J7",
      type: "supports",
      explanation:
        "Parental proximity strengthens (but doesn't create) the obligation.",
      addedRound: 51,
      origin: "user",
    },
    {
      from: "P6",
      to: "P5",
      type: "undermines",
      explanation:
        "If proximity modulates strength, strict equality across time is weakened.",
      addedRound: 52,
      origin: "user",
    },

    // Conflicts
    {
      from: "P4",
      to: "J1",
      type: "conflicts",
      explanation:
        "If only current beings matter, poisoning groundwater after everyone now living is gone isn't wrong.",
      addedRound: 14,
      origin: "user",
    },
    {
      from: "P4",
      to: "J2",
      type: "conflicts",
      explanation:
        "No obligation to account for people in 2100 if they can't hold rights now.",
      addedRound: 15,
      origin: "user",
    },
    {
      from: "P4",
      to: "P2",
      type: "conflicts",
      explanation:
        "P4 denies obligations to non-existent beings; P2 affirms them.",
      addedRound: 21,
      origin: "user",
    },
    {
      from: "J6",
      to: "P2",
      type: "conflicts",
      explanation:
        "J6 denies obligations to the non-existent; P2 grounds them.",
      addedRound: 22,
      origin: "user",
    },
    {
      from: "P6",
      to: "P3",
      type: "conflicts",
      explanation:
        "P6 counts temporal proximity among the factors that modulate obligation strength; P3 denies that mere temporal distance does. As stated, both cannot be true.",
      addedRound: 61,
      origin: "claude-fable-5",
    },

    // Undermines
    {
      from: "J5",
      to: "J10",
      type: "undermines",
      explanation:
        "Existence-uncertainty tends to grow with temporal distance, so J5's permitted discounting threatens to reintroduce temporal discounting in practice.",
      addedRound: 41,
      origin: "user",
    },
    {
      from: "J9",
      to: "P5",
      type: "undermines",
      explanation:
        "The non-identity problem complicates extending justice to specific future individuals.",
      addedRound: 42,
      origin: "user",
    },
    {
      from: "J13",
      to: "J8",
      type: "undermines",
      explanation:
        "If no one is wronged by not being brought into existence, the wrongness of allowing extinction cannot rest on wrongs to future people.",
      addedRound: 59,
      origin: "user",
    },

    // Theory relations
    {
      from: "T1",
      to: "P2",
      type: "supports",
      explanation:
        "If identity isn't needed for moral patienthood, probable future beings qualify.",
      addedRound: 43,
      origin: "user",
    },
    {
      from: "T1",
      to: "P5",
      type: "supports",
      explanation:
        "Grounds P5's extension of justice to future people: they will have the capacity for well-being.",
      addedRound: 44,
      origin: "user",
    },
    {
      from: "T2",
      to: "J9",
      type: "supports",
      explanation:
        "Explains why non-identity reduces but doesn't eliminate obligations.",
      addedRound: 53,
      origin: "user",
    },
    {
      from: "T2",
      to: "P2",
      type: "supports",
      explanation:
        "Future people as a class are determinate enough for probabilistic obligation.",
      previousText:
        "Future people as a class are determinate enough to be owed something.",
      addedRound: 54,
      revisedRound: 60,
      origin: "user",
    },
    {
      from: "T2",
      to: "T1",
      type: "supports",
      explanation:
        "Class-level determinacy reinforces the claim that identity isn't needed.",
      addedRound: 55,
      origin: "user",
    },

    // J-J supports
    {
      from: "J1",
      to: "J2",
      type: "supports",
      explanation:
        "Both express concern for long-term consequences on future people.",
      addedRound: 6,
      origin: "user",
    },
    {
      from: "J8",
      to: "J1",
      type: "supports",
      explanation:
        "If extinction prevention is obligatory, so is preventing severe environmental harm.",
      addedRound: 30,
      origin: "user",
    },

    // Arguments (entails for single-premise; jointly_entails for multi-premise)
    // arg-sample-3: P2 + P3 → J5  (detected round 4: P3 arrives round 4)
    {
      from: "P2", to: "J5", type: "jointly_entails", argumentId: "arg-sample-3",
      explanation: "Probabilistic obligation (P2) allows uncertain future existence to ground present duties; the diminution principle (P3) says only existence-uncertainty (not temporal distance) may reduce obligation strength; together they permit the slight welfare discounting asserted by J5.",
      addedRound: 31,
      origin: "claude-fable-5",
    },
    {
      from: "P3", to: "J5", type: "jointly_entails", argumentId: "arg-sample-3",
      explanation: "Probabilistic obligation (P2) allows uncertain future existence to ground present duties; the diminution principle (P3) says only existence-uncertainty (not temporal distance) may reduce obligation strength; together they permit the slight welfare discounting asserted by J5.",
      addedRound: 31,
      origin: "claude-fable-5",
    },
    // arg-sample-1: T1 + T2 → P2  (detected round 6: T2 arrives round 6)
    {
      from: "T1", to: "P2", type: "jointly_entails", argumentId: "arg-sample-1",
      explanation: "T1 makes moral patienthood turn on well-being capacity rather than identity or present existence; T2 secures a determinate class of future people to whom obligations could attach; together they remove both standard barriers to obligations toward the not-yet-existing, so such obligations are possible (P2).",
      addedRound: 56,
      origin: "claude-fable-5",
    },
    {
      from: "T2", to: "P2", type: "jointly_entails", argumentId: "arg-sample-1",
      explanation: "T1 makes moral patienthood turn on well-being capacity rather than identity or present existence; T2 secures a determinate class of future people to whom obligations could attach; together they remove both standard barriers to obligations toward the not-yet-existing, so such obligations are possible (P2).",
      addedRound: 56,
      origin: "claude-fable-5",
    },
    // arg-sample-4: P1 → J3
    {
      from: "P1", to: "J3", type: "entails", argumentId: "arg-sample-4",
      explanation: "The sufficientarian threshold directly entails that depleting all natural resources for short-term economic gain is wrong, since it leaves the next generation worse off than it found things.",
      addedRound: 16,
      origin: "claude-fable-5",
    },
    // arg-sample-5: P6 + J7 → ¬J10  (detected round 6: P6 arrives round 6)
    {
      from: "P6", to: "J10", type: "jointly_precludes", argumentId: "arg-sample-5",
      explanation: "P6 counts temporal proximity among the modulators of obligation strength, and J7 fixes the direction of modulation: greater proximity means stronger obligations. Together they imply that obligations weaken across temporal distance, contradicting the temporal neutrality asserted by J10.",
      addedRound: 57,
      origin: "claude-fable-5",
    },
    {
      from: "J7", to: "J10", type: "jointly_precludes", argumentId: "arg-sample-5",
      explanation: "P6 counts temporal proximity among the modulators of obligation strength, and J7 fixes the direction of modulation: greater proximity means stronger obligations. Together they imply that obligations weaken across temporal distance, contradicting the temporal neutrality asserted by J10.",
      addedRound: 57,
      origin: "claude-fable-5",
    },
  ],
  coherence: {
    tensions: [
      "J5 undermines J10: uncertainty-based discounting is permitted while temporal discounting is not, yet existence-uncertainty grows with temporal distance, so J5's discounting threatens to reintroduce temporal discounting in practice. P3 draws the line; whether it can be held is open.",
      "P6 undermines P5: if proximity modulates obligation strength, P5's claim that justice is owed equally to all affected, whenever they exist, is weakened.",
      "J9 undermines P5: the non-identity problem complicates extending justice to specific future individuals.",
      "P6 conflicts with P3: P6 counts temporal proximity among the factors that modulate obligation strength, while P3 denies that mere temporal distance does. Restricting P6 to social and relational proximity would resolve the conflict.",
      "P6 and J7 jointly preclude J10: if proximity modulates obligation strength and parental duties outrank duties to distant strangers, temporal neutrality fails. J10 is now both supported (P3, P5) and precluded — the structure's central instability.",
      "J13 undermines J8: if failing to create people wrongs no one, the wrongness of allowing extinction cannot rest on future people's claims. J8 may need regrounding in duties to present people or in impersonal value.",
    ],
    orphans: [
      "J12 is covered by P5 but has no direct theoretical grounding — it's a political-institutional judgment that may need its own principle about institutional design.",
      "J13 has no principled grounding — no active principle explains the procreation asymmetry, and none of P1–P6 entails or precludes it.",
    ],
    clusters: [
      "Core cluster: J1, J2, J3, J4 unified under P1 (sufficientarian threshold).",
      "Existence cluster: J5, J8, J9 unified under P2 (probabilistic obligation), grounded in T1 and T2.",
      "Temporal-neutrality cluster: J10, J12 unified under P5 (justice owed to all affected), grounded in T1. In tension with P6.",
    ],
  },
};

// One entry per step, as the app writes them: see sampleLog.js.
export default { ...SAMPLE, log: sampleLog(SAMPLE) };
