// Dummy RE state for visualization development
// Topic: obligations to future generations
// 8 rounds, 12 judgments, 6 principles, 2 theories, mix of statuses

export default {
  topic: "Do we have moral obligations to people who do not yet exist?",
  phase: 3,
  round: 8,
  elements: [
    // ── Judgments ──
    {
      id: "J1", type: "judgment", status: "active", confidence: "high", origin: "user",
      text: "It would be wrong to bury large quantities of radioactive waste without any containment, knowing it will poison groundwater for millennia.",
      addedRound: 1
    },
    {
      id: "J2", type: "judgment", status: "active", confidence: "high", origin: "user",
      text: "Climate policies should account for the welfare of people living in 2100 and beyond.",
      addedRound: 1
    },
    {
      id: "J3", type: "judgment", status: "active", confidence: "moderate", origin: "user",
      text: "A government that depletes all natural resources for short-term economic gain acts wrongly.",
      addedRound: 1
    },
    {
      id: "J4", type: "judgment", status: "revised", confidence: "moderate", origin: "user",
      text: "We owe future people a liveable environment, but not necessarily the same standard of living we enjoy.",
      previousText: "We owe future people exactly the same standard of living we enjoy.",
      addedRound: 2, revisedRound: 5
    },
    {
      id: "J5", type: "judgment", status: "active", confidence: "low", origin: "user",
      text: "It is permissible to discount future welfare slightly due to genuine uncertainty about whether future people will exist.",
      addedRound: 2
    },
    {
      id: "J6", type: "judgment", status: "withdrawn", confidence: "low", origin: "user",
      text: "We have no obligations to people who do not yet exist because they cannot hold rights.",
      reason: "Withdrawn after user accepted that obligations need not depend on current rights-holders.",
      addedRound: 1, withdrawnRound: 3
    },
    {
      id: "J7", type: "judgment", status: "active", confidence: "high", origin: "user",
      text: "Parents have stronger obligations to their future children than to distant future strangers.",
      addedRound: 3
    },
    {
      id: "J8", type: "judgment", status: "active", confidence: "moderate", origin: "user",
      text: "A society that could prevent its own extinction at modest cost but chooses not to acts wrongly.",
      addedRound: 4
    },
    {
      id: "J9", type: "judgment", status: "active", confidence: "low", origin: "user",
      text: "The non-identity problem reduces but does not eliminate our obligations to future people.",
      addedRound: 4
    },
    {
      id: "J10", type: "judgment", status: "active", confidence: "moderate", origin: "user",
      text: "Future people's interests should count equally in utilitarian calculations, not be discounted by temporal distance alone.",
      addedRound: 5
    },
    {
      id: "J11", type: "judgment", status: "withdrawn", confidence: "low", origin: "assistant-suggested",
      text: "Obligations to future generations are entirely reducible to obligations to currently existing people.",
      reason: "User rejected: found it too restrictive given J1 and J2.",
      addedRound: 3, withdrawnRound: 4
    },
    {
      id: "J12", type: "judgment", status: "active", confidence: "moderate", origin: "user",
      text: "Democratic institutions should include mechanisms for representing the interests of future generations.",
      addedRound: 6
    },

    // ── Principles ──
    {
      id: "P1", type: "principle", status: "active", confidence: "high", origin: "user",
      text: "Each generation has a duty not to leave the next generation worse off than it found things (sufficientarian threshold).",
      addedRound: 2
    },
    {
      id: "P2", type: "principle", status: "active", confidence: "moderate", origin: "user",
      text: "Moral obligations can exist toward beings whose existence is probable, even if not certain (probabilistic obligation).",
      addedRound: 3
    },
    {
      id: "P3", type: "principle", status: "revised", confidence: "moderate", origin: "user",
      text: "The strength of our obligations to future people diminishes with uncertainty about their existence, but not with mere temporal distance.",
      previousText: "The strength of our obligations to future people diminishes with temporal distance.",
      addedRound: 4, revisedRound: 5
    },
    {
      id: "P4", type: "principle", status: "withdrawn", confidence: "low", origin: "assistant-suggested",
      text: "Only beings who currently exist can be the subjects of moral obligations.",
      reason: "Conflicted with J1, J2, J8 and the user's overall trajectory. Replaced by P2.",
      addedRound: 2, withdrawnRound: 3
    },
    {
      id: "P5", type: "principle", status: "active", confidence: "moderate", origin: "user",
      text: "Obligations of justice are owed to all who will be affected by our decisions, regardless of when they come to exist (Rawlsian extension).",
      addedRound: 5
    },
    {
      id: "P6", type: "principle", status: "active", confidence: "low", origin: "user",
      text: "Proximity (temporal, social, relational) modulates the strength but not the existence of moral obligations.",
      addedRound: 6
    },

    // ── Background Theories (from Round 5+) ──
    {
      id: "T1", type: "theory", status: "active", confidence: "moderate", origin: "user",
      text: "Personal identity is not required for moral patienthood — what matters is the capacity for well-being, which future people will have.",
      addedRound: 5
    },
    {
      id: "T2", type: "theory", status: "active", confidence: "low", origin: "user",
      text: "The non-identity problem shows that specific future individuals are metaphysically indeterminate, but future people as a class are not.",
      addedRound: 6
    },
  ],
  relations: [
    // P1 supports
    { from: "P1", to: "J1", type: "supports", explanation: "Poisoning groundwater violates the sufficientarian threshold.", addedRound: 2 },
    { from: "P1", to: "J2", type: "supports", explanation: "Climate policy must ensure future generations aren't worse off.", addedRound: 2 },
    { from: "P1", to: "J3", type: "supports", explanation: "Resource depletion leaves the next generation worse off.", addedRound: 2 },
    { from: "P1", to: "J4", type: "supports", explanation: "Sufficientarianism requires a liveable environment, not identical living standards.", addedRound: 5 },

    // P2 supports
    { from: "P2", to: "J5", type: "supports", explanation: "Probabilistic obligation allows discounting by existence uncertainty.", addedRound: 3 },
    { from: "P2", to: "J8", type: "supports", explanation: "Probable future people ground the obligation to prevent extinction.", addedRound: 4 },
    { from: "P2", to: "J9", type: "supports", explanation: "Even under non-identity, probabilistic obligations persist.", addedRound: 4 },

    // P3 supports
    { from: "P3", to: "J5", type: "supports", explanation: "Uncertainty-based discounting is permitted; temporal discounting is not.", addedRound: 5 },
    { from: "P3", to: "J10", type: "supports", explanation: "No temporal discounting aligns with equal counting of future interests.", addedRound: 5 },

    // P5 supports
    { from: "P5", to: "J2", type: "supports", explanation: "People in 2100 are affected by current climate policy.", addedRound: 5 },
    { from: "P5", to: "J12", type: "supports", explanation: "If future people are owed justice, institutions should represent them.", addedRound: 6 },
    { from: "P5", to: "J10", type: "supports", explanation: "Rawlsian extension implies equal moral consideration.", addedRound: 5 },

    // P6 supports and tensions
    { from: "P6", to: "J7", type: "supports", explanation: "Parental proximity strengthens (but doesn't create) the obligation.", addedRound: 6 },
    { from: "P6", to: "P5", type: "undermines", explanation: "If proximity modulates strength, strict equality across time is weakened.", addedRound: 6 },

    // Conflicts
    { from: "P4", to: "J1", type: "conflicts", explanation: "If only current beings matter, future groundwater poisoning isn't wrong.", addedRound: 2 },
    { from: "P4", to: "J2", type: "conflicts", explanation: "No obligation to account for people in 2100 if they can't hold rights now.", addedRound: 2 },
    { from: "P4", to: "P2", type: "conflicts", explanation: "P4 denies obligations to non-existent beings; P2 affirms them.", addedRound: 3 },
    { from: "J6", to: "P2", type: "conflicts", explanation: "J6 denies obligations to the non-existent; P2 grounds them.", addedRound: 3 },

    // Undermines
    { from: "J5", to: "J10", type: "undermines", explanation: "If some discounting is permissible, strict equal counting is weakened.", addedRound: 5 },
    { from: "J9", to: "P5", type: "undermines", explanation: "Non-identity complicates the Rawlsian extension to future people.", addedRound: 5 },

    // Theory relations
    { from: "T1", to: "P2", type: "supports", explanation: "If identity isn't needed for moral patienthood, probable future beings qualify.", addedRound: 5 },
    { from: "T1", to: "P5", type: "supports", explanation: "Grounds the Rawlsian extension: future people will have well-being capacities.", addedRound: 5 },
    { from: "T2", to: "J9", type: "supports", explanation: "Explains why non-identity reduces but doesn't eliminate obligations.", addedRound: 6 },
    { from: "T2", to: "P2", type: "supports", explanation: "Future people as a class are determinate enough for probabilistic obligation.", addedRound: 6 },
    { from: "T2", to: "T1", type: "supports", explanation: "Class-level determinacy reinforces the claim that identity isn't needed.", addedRound: 6 },

    // J-J supports
    { from: "J1", to: "J2", type: "supports", explanation: "Both express concern for long-term consequences on future people.", addedRound: 1 },
    { from: "J8", to: "J1", type: "supports", explanation: "If extinction prevention is obligatory, so is preventing severe environmental harm.", addedRound: 4 },

    // Depends
    { from: "P5", to: "T1", type: "depends", explanation: "The Rawlsian extension presupposes that future people qualify as moral patients.", addedRound: 5 },

    // Arguments (jointly_entails)
    // arg-dummy-1: T1 + T2 → P2
    { from: "T1", to: "P2", type: "jointly_entails", argumentId: "arg-dummy-1", explanation: "T1 grounds moral patienthood in well-being capacity; T2 establishes that future people as a class are metaphysically determinate; together they entail probabilistic obligation (P2).", addedRound: 7 },
    { from: "T2", to: "P2", type: "jointly_entails", argumentId: "arg-dummy-1", explanation: "T1 grounds moral patienthood in well-being capacity; T2 establishes that future people as a class are metaphysically determinate; together they entail probabilistic obligation (P2).", addedRound: 7 },
    // arg-dummy-2: P1 + P5 → J10
    { from: "P1", to: "J10", type: "jointly_entails", argumentId: "arg-dummy-2", explanation: "The sufficientarian duty (P1) requires not leaving future generations worse off; the Rawlsian extension (P5) demands equal consideration of all affected parties; together they entail equal temporal counting of future interests (J10).", addedRound: 7 },
    { from: "P5", to: "J10", type: "jointly_entails", argumentId: "arg-dummy-2", explanation: "The sufficientarian duty (P1) requires not leaving future generations worse off; the Rawlsian extension (P5) demands equal consideration of all affected parties; together they entail equal temporal counting of future interests (J10).", addedRound: 7 },
    // arg-dummy-3: P2 + P3 → J5
    { from: "P2", to: "J5", type: "jointly_entails", argumentId: "arg-dummy-3", explanation: "Probabilistic obligation (P2) allows uncertain future existence to ground present duties; the diminution principle (P3) says only existence-uncertainty (not temporal distance) may reduce obligation strength; together they permit the slight welfare discounting asserted by J5.", addedRound: 8 },
    { from: "P3", to: "J5", type: "jointly_entails", argumentId: "arg-dummy-3", explanation: "Probabilistic obligation (P2) allows uncertain future existence to ground present duties; the diminution principle (P3) says only existence-uncertainty (not temporal distance) may reduce obligation strength; together they permit the slight welfare discounting asserted by J5.", addedRound: 8 },
  ],
  coherence: {
    tensions: [
      "J5 undermines J10: permissible discounting vs. strict equal counting. P3 mediates (uncertainty yes, temporal distance no), but the boundary is vague.",
      "P6 undermines P5: if proximity modulates obligation strength, the Rawlsian equal-treatment claim is weakened.",
      "J9 undermines P5: the non-identity problem complicates extending justice to specific future individuals."
    ],
    orphans: [
      "J12 is covered by P5 but has no direct theoretical grounding — it's a political-institutional judgment that may need its own principle about institutional design."
    ],
    clusters: [
      "Core cluster: J1, J2, J3, J4 unified under P1 (sufficientarian threshold).",
      "Existence cluster: J5, J8, J9 unified under P2 (probabilistic obligation), grounded in T1 and T2.",
      "Equality cluster: J10, J12 unified under P5 (Rawlsian extension), grounded in T1. In tension with P6."
    ]
  },
  log: [
    { round: 1, findings: "Initial harvest.", options: "—", decision: "—", changes: "Added J1, J2, J3, J6." },
    { round: 2, findings: "J6 has no principle support. P1 covers J1–J3.", options: "Add P1, also consider P4.", decision: "Adopted P1 and P4 tentatively.", changes: "Added J4, J5, P1, P4." },
    { round: 3, findings: "P4 conflicts with J1, J2. J6 conflicts with emerging P2.", options: "Withdraw P4 and J6, or revise P1.", decision: "Withdrew P4 and J6, adopted P2.", changes: "P4, J6 withdrawn. P2, J7 added. J11 suggested and rejected." },
    { round: 4, findings: "J8 and J9 strengthen P2. J11 rejected.", options: "—", decision: "Adopted J8, J9. Withdrew J11.", changes: "J8, J9 added. J11 withdrawn." },
    { round: 5, findings: "Review round. J4 revised (sufficientarian, not egalitarian). P3 revised (uncertainty not temporal). Introduced T1, P5.", options: "Revise J4 and P3, adopt T1 and P5.", decision: "All adopted.", changes: "J4, P3 revised. J10, T1, P5 added." },
    { round: 6, findings: "J12 and P6 introduced. P6 creates tension with P5.", options: "Revise P5, withdraw P6, or accept tension.", decision: "Accepted P6 tentatively, flagged tension.", changes: "J12, P6, T2 added." },
    { round: 7, findings: "Standard round. No new elements.", options: "—", decision: "—", changes: "Refined relation between T2 and P2." },
    { round: 8, findings: "Review round. Three tensions remain. J12 partially orphaned.", options: "Pending user decision.", decision: "—", changes: "—" }
  ]
};