/**
 * @fileoverview Texts the sample state and the Arguments tab's sample
 * suggestions share: the premises detection adds, and the meaning postulates
 * each argument is valid given.
 *
 * Six of the arguments the Arguments tab offered on the demo are now part of
 * the demo from the start (sample-state.js, round 8). Before, nine of its
 * nineteen active elements sat in no argument, which rethon — reading only
 * arguments — could not account for, so Equilibrate on the worked example
 * advised withdrawing most of it. The Arguments tab still offers the other six.
 *
 * One copy of each text, because the two files meet on it: the tab recognises
 * an argument the state already holds by its elements, and an added premise the
 * state already holds by its wording (`getSampleArguments`), so a text that
 * drifted would be offered again as a new premise.
 *
 * @module sample-data/sample-argument-texts
 */

/** Premises the Arguments tab adds to close an argument's gap, by what they say. */
export const ARGUMENT_PREMISES = {
  wellBeingJustice:
    "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
  representation:
    "Future generations will be affected by present political decisions but cannot take part in making them; obligations of justice owed to such people can be discharged only through institutional mechanisms that represent their interests.",
  personAffecting:
    "An act or omission is wrong only if there is or will be someone whom it wrongs (person-affecting restriction).",
  deDicto:
    "Obligations to future people attach de dicto — to whoever will exist — even when they cannot attach de re to any specific future individual.",
  fullWeight:
    "Where obligations of justice are owed, the welfare of those protected must be given its full weight in present deliberation, however uncertain their existence.",
  // Empirical, so a background theory — and offered by the Theories tab too
  // (sample-theories.js). Accepted there, the Arguments tab finds it in the
  // pool by this wording and reuses it rather than proposing it again. It was a
  // Judgments-tab option until empirical premises were typed as theories: a
  // judgment cannot be in the simulation's theory, so P5 + it → J2 could never
  // let the theory account for J2.
  affected2100:
    "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
};

/** The meaning postulate each of the six arguments now in the state is valid given. */
export const PROMOTED_POSTULATES = {
  // P1 + T3 → J1
  sufficiencyWrong:
    "An act that does exactly what a generation's standing duty forbids — leaving the next generation worse off — is thereby wrong.",
  // P3 → J10
  temporalDiscounting:
    "Interests being discounted for temporal distance just is obligations toward their holders weakening with temporal distance.",
  // P5 + P8 → J12
  representation:
    "If justice is owed to future generations and can be discharged only through representative mechanisms, then such mechanisms ought to exist.",
  // T1 + P7 → P5
  wellBeingJustice:
    "If what matters for moral patienthood is well-being capacity, and those with well-being capacity who are affected are owed justice, then justice is owed to all who will be affected, whenever they exist.",
  // T2 + P9 → J9
  deDicto:
    "If obligations attach to future people de dicto though not de re, then the non-identity problem reduces our obligations (the de re loss) but does not eliminate them (the de dicto survival).",
  // P5 + P10 → ¬J5
  fullWeight:
    "If justice is owed to whoever will be affected and justice demands full weight despite uncertainty, then even slight uncertainty-discounting is impermissible.",
};
