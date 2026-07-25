"""Arguments service — LLM argument detection, deduplication, and prompt building."""

from typing import List, Dict, Tuple, Set
import json
import logging

from ..models.re_state import REElement, RERelation
from ..services.llm import LLMService
from ..services.argument_checker import verify_argument
from ..routers.arguments_schemas import (
    AddedPremise,
    DetectArgumentsResponse,
    LLMArgumentsResponse,
    translate_from_lookup,
)

logger = logging.getLogger(__name__)


def arg_fingerprint(arg: List[int]) -> Tuple:
    """Canonical key for an argument: (sorted premises, conclusion).

    Used to detect duplicates — two arguments are identical regardless of the
    order in which their premises are listed.
    """
    return (tuple(sorted(arg[:-1])), arg[-1])


ARGUMENT_RELATION_TYPES = (
    "entails",
    "precludes",
    "jointly_entails",
    "jointly_precludes",
)


def existing_arg_fingerprints(
    relations: List[RERelation], reverse_lookup: Dict[str, int]
) -> Set[Tuple]:
    """Return fingerprints of all argument groups already in the state.

    Covers single-premise (``entails``/``precludes``) as well as multi-premise
    (``jointly_*``) argument relations.  Groups are reconstructed from relations
    that share an ``argument_id``.  Only complete groups (all premise IDs present
    in ``reverse_lookup``) are included.  Precludes-type conclusions use a
    negative index, mirroring the ¬-notation of detected arguments.
    """
    groups: Dict[str, Dict] = {}
    for r in relations:
        if r.type not in ARGUMENT_RELATION_TYPES or not r.argument_id:
            continue
        if r.argument_id not in groups:
            groups[r.argument_id] = {"froms": [], "to": r.to_id, "type": r.type}
        groups[r.argument_id]["froms"].append(r.from_id)

    fingerprints: Set[Tuple] = set()
    for group in groups.values():
        premise_indices = [
            reverse_lookup[eid] for eid in group["froms"] if eid in reverse_lookup
        ]
        conclusion_index = reverse_lookup.get(group["to"])
        if conclusion_index is not None and len(premise_indices) == len(group["froms"]):
            if group["type"] in ("precludes", "jointly_precludes"):
                conclusion_index = -conclusion_index
            fingerprints.add(
                arg_fingerprint(sorted(premise_indices) + [conclusion_index])
            )
    return fingerprints


def filter_existing_arguments(
    num_arguments: List[List[int]],
    relations: List[RERelation],
    lookup: Dict[int, REElement],
) -> List[List[int]]:
    """Remove arguments from ``num_arguments`` whose fingerprint already exists in the state."""
    reverse_lookup = {e.id: n for n, e in lookup.items()}
    existing = existing_arg_fingerprints(relations, reverse_lookup)
    filtered = [arg for arg in num_arguments if arg_fingerprint(arg) not in existing]
    removed = len(num_arguments) - len(filtered)
    if removed:
        logger.info(f"Filtered out {removed} argument(s) already present in the state.")
    return filtered


def format_existing_args_for_prompt(
    relations: List[RERelation], reverse_lookup: Dict[str, int]
) -> str:
    """Format already-accepted argument groups as a human-readable string for the LLM prompt.

    The output is injected into the prompt so the LLM does not re-suggest
    arguments already present in the state.
    """
    groups: Dict[str, Dict] = {}
    for r in relations:
        if r.type not in ARGUMENT_RELATION_TYPES or not r.argument_id:
            continue
        if r.argument_id not in groups:
            groups[r.argument_id] = {"froms": [], "to": r.to_id, "type": r.type}
        groups[r.argument_id]["froms"].append(r.from_id)

    lines = []
    for group in groups.values():
        premise_indices = [
            reverse_lookup[eid] for eid in group["froms"] if eid in reverse_lookup
        ]
        conclusion_index = reverse_lookup.get(group["to"])
        if conclusion_index is not None and len(premise_indices) == len(group["froms"]):
            negated = group["type"] in ("precludes", "jointly_precludes")
            if negated:
                conclusion_index = -conclusion_index
            arg = sorted(premise_indices) + [conclusion_index]
            premise_ids = ", ".join(group["froms"])
            conclusion_label = ("¬" if negated else "") + group["to"]
            lines.append(f"  {arg}  ({premise_ids} → {conclusion_label})")
    return "\n".join(lines)


def build_prompt(
    lookup: Dict[int, REElement],
    relations: List[RERelation] = [],
    topic: str = "",
) -> str:
    """Build the LLM prompt requesting formally valid argument reconstructions.

    The sentence pool is presented as logically independent atoms, so every
    substantive argument requires added premises that close the inferential
    gap.  Each added premise carries its logical ``form`` (verified by
    ``services.argument_checker``) and a ``role``: substantive ``"premise"``
    or meaning ``"postulate"``.  Existing arguments (from ``relations``) are
    injected so the model does not reproduce them.
    """
    element_lines = "\n".join(f"  {n} [{e.type}]: {e.text}" for n, e in lookup.items())
    next_index = max(lookup) + 1 if lookup else 1

    reverse_lookup = {e.id: n for n, e in lookup.items()}
    existing_str = format_existing_args_for_prompt(relations, reverse_lookup)
    existing_section = (
        f"\nAlready accepted arguments — do not reproduce these:\n{existing_str}\n"
        if existing_str
        else ""
    )
    topic_line = (
        f'\nThe sentences belong to a reflective-equilibrium analysis of the topic: "{topic}"\n'
        if topic
        else ""
    )

    return f"""\
You are an expert in philosophical logic and argument reconstruction.
{topic_line}
Sentence pool:
{element_lines}
Each sentence is treated as an atomic proposition, identified by its integer key. The negation of sentence n is written -n (e.g. -3 means "it is not the case that [sentence 3]").
{existing_section}
Task:
Identify the substantive arguments that can be reconstructed from these sentences — arguments a philosopher would recognize as worth recording, not trivial logical manipulations.

Every reconstructed argument must be STRICTLY FORMALLY VALID. Because the numbered sentences are logically independent atoms, this means every argument needs at least one added premise that closes the inferential gap. For each added premise, supply:
- "index": an unused integer. Number added premises consecutively upward starting at {next_index} (the sentence indices up to {next_index - 1} are taken; never reuse them).
- "type": "judgment", "principle", or "theory" (a background theory).
- "text": the premise in natural language.
- "form": its logical content as a propositional formula over sentence keys, using ~ (not), & (and), | (or), -> (if-then). Example: "(3 & 4) -> 7". The form must not mention the premise's own index — it states the premise's content in terms of the other sentences.
- "role": one of:
  - "postulate" — a meaning postulate: true solely in virtue of what the sentences mean. Rejecting it while accepting the argument's other premises would show a misunderstanding of the words, not a substantive position (e.g. a bridge between two formulations of the same thought, or the incompatibility of two directly contradictory claims).
  - "premise" — a claim with normative or empirical content of its own, which a competent, informed speaker could reject as a substantive position.
  When in doubt, use "premise".

Constraints:
- At most 3 pool sentences as premises per argument.
- The conclusion must be a pool sentence or its negation, and must not appear among the premises.
- No redundant premises: every premise must be needed for validity.
- Premises must be jointly consistent (no arguments from contradiction).
- An added premise with role "premise" must be an independently contentful general claim — not a mere restatement of the argument as a conditional. If the only bridge you can find merely restates the inference and is not true in virtue of meaning, omit the argument.

Output: each argument is a list of integers whose final member is the conclusion and all previous members are premises. For example, in [14, {next_index}, 1], the conclusion is sentence 1 and the premises are sentence 14 and added premise {next_index}. In [3, {next_index + 1}, -7], the conclusion is ¬sentence-7. Premises may also be negated (e.g. -3).

Respond with valid JSON only, in exactly this format:
{{
  "arguments": [
        [14, {next_index}, 1],
        [3, {next_index + 1}, -7]
  ],
  "added_premises": [
    {{
      "index": {next_index},
      "type": "principle",
      "text": "A general, independently contentful claim connecting sentence 14 to sentence 1.",
      "form": "14 -> 1",
      "role": "premise"
    }},
    {{
      "index": {next_index + 1},
      "type": "principle",
      "text": "A statement true in virtue of the meanings of sentences 3 and 7.",
      "form": "3 -> ~7",
      "role": "postulate"
    }}
  ]
}}

If no substantive arguments can be reconstructed, return {{"arguments": [], "added_premises": []}}."""


def add_new_premises_to_lookup(
    lookup: Dict[int, REElement],
    added_premises: List[Dict],
    elements: List[REElement],
    round: str,
    model: str,
) -> Dict:
    """Add LLM-supplied suppressed premises to the lookup, assigning fresh element IDs.

    New elements are assigned IDs of the form ``J<n>``, ``P<n>``, or ``T<n>``
    based on their type, counting up from the existing maximum for that type.
    Returns the extended lookup (original is not mutated).
    """
    if not added_premises:
        logger.info("No new premises to add to lookup.")
        return lookup
    logger.info(f"Adding {len(added_premises)} to lookup.")
    updated_lookup = {**lookup}
    max_ids_dict = {
        "J": len([e for e in elements if e.type == "judgment"]),
        "P": len([e for e in elements if e.type == "principle"]),
        "T": len([e for e in elements if e.type == "theory"]),
    }

    for premise in added_premises:
        id_type = premise["type"][0].upper()
        id_int = max_ids_dict[id_type] + 1
        new_element = REElement(
            id=id_type + str(id_int),
            text=premise["text"],
            type=premise["type"],
            addedRound=int(round) + 1,
            status="active",
            confidence=0.67,
            origin=model,
            previousText=None,
            reason=None,
            withdrawnRound=None,
            rejectedRound=None,
            revisedRound=None,
            questionnaireIndex=None,
        )
        updated_lookup[premise["index"]] = new_element
        max_ids_dict[id_type] += 1
    logger.info("Completed adding premises to lookup.")
    return updated_lookup


def translate_arguments(
    detected_arguments: List[List[int]], lookup: Dict[int, REElement]
) -> List[List[REElement]]:
    """Translate a list of numeric argument lists to lists of REElements via the lookup."""
    logger.info("Translating arguments.")
    result = [translate_from_lookup(arg, lookup) for arg in detected_arguments]
    logger.info("Completed translating arguments.")
    return result


# Sample arguments keyed to the sample RE state (obligations to future generations).
# Mirrors app/src/sample-data/sample-arguments.js, but stores each argument as its
# FULL formal reconstruction: substantive added premises (22–29) are unanalyzed
# sentences, and every inferential step is closed by a meaning postulate (30–44)
# carrying its logical form.  The dummy path runs these through the same
# verify_and_partition pipeline as live LLM output, so the fixture is formally
# verified on every request and postulates are stripped from the surfaced
# arguments exactly as in production.
#
# Element indices (position in sample-state elements, including withdrawn):
# 1:J1 … 13:J13, 14:P1 … 19:P6, 20:T1, 21:T2.  Negative indices: -n = ¬sentence-n.
DUMMY_ADDED_PREMISES: List[Dict] = [
    # ── Substantive premises (surfaced as elements when their argument is accepted) ──
    {
        "index": 22,
        "type": "judgment",
        "role": "premise",
        "text": "Burying large quantities of radioactive waste without containment bequeaths the next generation land and groundwater burdened with an uncontained long-term hazard, leaving them worse off than we found things.",
    },
    {
        "index": 23,
        "type": "principle",
        "role": "premise",
        "text": "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
    },
    {
        "index": 24,
        "type": "judgment",
        "role": "premise",
        "text": "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
    },
    {
        "index": 25,
        "type": "principle",
        "role": "premise",
        "text": "Future generations will be affected by present political decisions but cannot take part in making them; obligations of justice owed to such people can be discharged only through institutional mechanisms that represent their interests.",
    },
    {
        "index": 26,
        "type": "principle",
        "role": "premise",
        "text": "An act or omission is wrong only if there is or will be someone whom it wrongs (person-affecting restriction).",
    },
    {
        "index": 27,
        "type": "principle",
        "role": "premise",
        "text": "Obligations to future people attach de dicto — to whoever will exist — even when they cannot attach de re to any specific future individual.",
    },
    {
        "index": 28,
        "type": "principle",
        "role": "premise",
        "text": "Where obligations of justice are owed, the welfare of those protected must be given its full weight in present deliberation, however uncertain their existence.",
    },
    {
        "index": 29,
        "type": "judgment",
        "role": "premise",
        "text": "A society's failure to prevent its own distant extinction wrongs no one now alive and, with respect to future people, merely fails to bring them into existence.",
    },
    # ── Meaning postulates (verified, then folded into relation explanations) ──
    {
        "index": 30,
        "type": "principle",
        "role": "postulate",
        "form": "(14 & 22) -> 1",
        "text": "An act that does exactly what a generation's standing duty forbids — leaving the next generation worse off — is thereby wrong.",
    },
    {
        "index": 31,
        "type": "principle",
        "role": "postulate",
        "form": "16 -> 10",
        "text": "Interests being discounted for temporal distance just is obligations toward their holders weakening with temporal distance.",
    },
    {
        "index": 32,
        "type": "principle",
        "role": "postulate",
        "form": "(18 & 24) -> 2",
        "text": "If justice is owed to all who will be affected, and the people of 2100 and beyond will be affected by present climate policy, then climate policy owes their welfare consideration.",
    },
    {
        "index": 33,
        "type": "principle",
        "role": "postulate",
        "form": "(18 & 25) -> 12",
        "text": "If justice is owed to future generations and can be discharged only through representative mechanisms, then such mechanisms ought to exist.",
    },
    {
        "index": 34,
        "type": "principle",
        "role": "postulate",
        "form": "18 -> 10",
        "text": "Owing justice to people regardless of when they exist just is not discounting their interests for their temporal distance.",
    },
    {
        "index": 35,
        "type": "principle",
        "role": "postulate",
        "form": "(20 & 23) -> 18",
        "text": "If what matters for moral patienthood is well-being capacity, and those with well-being capacity who are affected are owed justice, then justice is owed to all who will be affected, whenever they exist.",
    },
    {
        "index": 36,
        "type": "principle",
        "role": "postulate",
        "form": "(21 & 27) -> 9",
        "text": "If obligations attach to future people de dicto though not de re, then the non-identity problem reduces our obligations (the de re loss) but does not eliminate them (the de dicto survival).",
    },
    {
        "index": 37,
        "type": "principle",
        "role": "postulate",
        "form": "(20 & 21) -> 15",
        "text": "If moral patienthood needs no identity and future people form a determinate class, then obligations toward merely probable beings are possible.",
    },
    {
        "index": 38,
        "type": "principle",
        "role": "postulate",
        "form": "(15 & 16) -> 5",
        "text": "If obligations can attach to probable beings and diminish only with existence-uncertainty, then slight discounting for genuine existence-uncertainty is permissible.",
    },
    {
        "index": 39,
        "type": "principle",
        "role": "postulate",
        "form": "(17 & 26) -> ~1",
        "text": "If only presently existing beings can be wronged and wrongness requires a wronged party, then an act harming only the not-yet-existing is not wrong.",
    },
    {
        "index": 40,
        "type": "principle",
        "role": "postulate",
        "form": "17 -> ~15",
        "text": "That only currently existing beings can bear obligations directly contradicts obligations existing toward merely probable future beings.",
    },
    {
        "index": 41,
        "type": "principle",
        "role": "postulate",
        "form": "15 -> ~6",
        "text": "That obligations can exist toward probable future beings directly contradicts our having no obligations to those who do not yet exist.",
    },
    {
        "index": 42,
        "type": "principle",
        "role": "postulate",
        "form": "(18 & 28) -> ~5",
        "text": "If justice is owed to whoever will be affected and justice demands full weight despite uncertainty, then even slight uncertainty-discounting is impermissible.",
    },
    {
        "index": 43,
        "type": "principle",
        "role": "postulate",
        "form": "(19 & 7) -> ~10",
        "text": "If temporal proximity modulates obligation strength and parental duties outrank duties to distant strangers, then interests may be discounted with temporal distance after all.",
    },
    {
        "index": 44,
        "type": "principle",
        "role": "postulate",
        "form": "(13 & 29 & 26) -> ~8",
        "text": "If wronging requires a wronged party, extinction wrongs no one now alive and merely fails to create future people, and non-creation wrongs no one, then allowing extinction is not wrong.",
    },
]

DUMMY_ARGUMENTS: List[List[int]] = [
    [14, 22, 30, 1],  # P1 + waste-inheritance → J1
    [16, 31, 10],  # P3 → J10
    [18, 24, 32, 2],  # P5 + 2100-affected → J2
    [18, 25, 33, 12],  # P5 + representation → J12
    [18, 34, 10],  # P5 → J10
    [20, 23, 35, 18],  # T1 + well-being-grounds-justice → P5
    [21, 27, 36, 9],  # T2 + de-dicto → J9
    [20, 21, 37, 15],  # T1 + T2 → P2 (in sample state as arg-sample-1)
    [15, 16, 38, 5],  # P2 + P3 → J5 (in sample state as arg-sample-3)
    [17, 26, 39, -1],  # P4 + person-affecting → ¬J1
    [17, 40, -15],  # P4 → ¬P2
    [15, 41, -6],  # P2 → ¬J6
    [18, 28, 42, -5],  # P5 + full-weight → ¬J5
    [19, 7, 43, -10],  # P6 + J7 → ¬J10 (in sample state as arg-sample-5)
    [13, 29, 26, 44, -8],  # J13 + extinction-as-non-creation + person-affecting → ¬J8
]


def dummy_detect_arguments(
    elements: List[REElement],
    round: str,
    relations: List[RERelation] = [],
) -> DetectArgumentsResponse:
    """Return the sample argument set, run through the production pipeline.

    Uses the same verification, postulate-stripping, and state-deduplication
    steps as the live LLM path, so the fixture doubles as an end-to-end check
    of the checker: every sample argument must verify with zero rejections.
    Arguments referencing elements missing from the current (possibly
    truncated) state are skipped.
    """
    initial_lookup = {index + 1: e for index, e in enumerate(elements)}
    premises = [AddedPremise(**p) for p in DUMMY_ADDED_PREMISES]
    premise_indices = {p.index for p in premises}
    candidates = [
        arg
        for arg in DUMMY_ARGUMENTS
        if all(abs(n) in initial_lookup or abs(n) in premise_indices for n in arg)
    ]

    verified, postulates, used_premises, rejected = verify_and_partition(
        candidates, premises
    )
    lookup_w_premises = add_new_premises_to_lookup(
        added_premises=[p.model_dump() for p in used_premises],
        lookup=initial_lookup,
        elements=elements,
        round=round,
        model="claude-fable-5",
    )

    reverse_lookup = {e.id: n for n, e in lookup_w_premises.items()}
    existing = existing_arg_fingerprints(relations, reverse_lookup)
    kept_pairs = [
        (arg, post)
        for arg, post in zip(verified, postulates)
        if arg_fingerprint(arg) not in existing
    ]
    num_arguments = [arg for arg, _ in kept_pairs]
    argument_postulates = [post for _, post in kept_pairs]

    translated = translate_arguments(
        detected_arguments=num_arguments, lookup=lookup_w_premises
    )
    return DetectArgumentsResponse(
        num_arguments=num_arguments,
        translated_arguments=translated,
        lookup=lookup_w_premises,
        argument_postulates=argument_postulates,
        rejected_count=rejected,
    )


def verify_and_partition(
    detected: List[List[int]],
    added_premises: List[AddedPremise],
) -> Tuple[List[List[int]], List[List[str]], List[AddedPremise], int]:
    """Formally verify each detected argument and separate meaning postulates from premises.

    Each argument is checked by ``services.argument_checker`` (using the added
    premises' ``form`` strings), auto-trimmed of redundant premises, and then
    stripped of meaning-postulate indices — a postulate licenses the inference
    but does not enter the element pool, so the surfaced argument runs directly
    from its substantive premises to its conclusion, with the postulate texts
    reported separately.

    Returns ``(kept_args, postulates_per_arg, used_premises, rejected_count)``:
    the verified numeric arguments (postulates stripped), the parallel list of
    postulate texts each argument relies on, the ``role="premise"`` added
    premises actually used by a kept argument, and the number of proposals
    rejected as formally invalid (or as resting on postulates alone).
    """
    forms = {p.index: p.form for p in added_premises if p.form}
    by_index = {p.index: p for p in added_premises}
    # Trim preference: when a postulate and a substantive premise are
    # interchangeable, drop the postulate — keeping the substantive version
    # keeps the contestable commitment visible as a rejectable element (the
    # "when in doubt, premise" asymmetry).  Pool sentences are dropped last.
    trim_priority = {
        p.index: (0 if p.role == "postulate" else 1) for p in added_premises
    }

    kept_args: List[List[int]] = []
    postulates_per_arg: List[List[str]] = []
    used_premise_indices: Set[int] = set()
    rejected = 0

    for arg in detected:
        result = verify_argument(arg, forms, trim_priority)
        if not result.accepted:
            logger.info(f"Rejected argument {arg}: {result.reason}")
            rejected += 1
            continue
        trimmed = result.argument
        if trimmed != arg:
            logger.info(f"Auto-trimmed argument {arg} to {trimmed}.")

        postulate_texts = [
            by_index[abs(n)].text
            for n in trimmed[:-1]
            if abs(n) in by_index and by_index[abs(n)].role == "postulate"
        ]
        stripped = [
            n
            for n in trimmed[:-1]
            if not (abs(n) in by_index and by_index[abs(n)].role == "postulate")
        ] + [trimmed[-1]]
        if len(stripped) < 2:
            logger.info(f"Rejected argument {arg}: rests on meaning postulates alone.")
            rejected += 1
            continue

        kept_args.append(stripped)
        postulates_per_arg.append(postulate_texts)
        used_premise_indices |= {abs(n) for n in stripped[:-1] if abs(n) in by_index}

    used_premises = [by_index[i] for i in sorted(used_premise_indices)]
    return kept_args, postulates_per_arg, used_premises, rejected


async def get_arguments_from_llm(
    lookup: Dict[int, REElement],
    llm: LLMService,
    relations: List[RERelation] = [],
    topic: str = "",
) -> LLMArgumentsResponse:
    """Send the element lookup to the LLM and parse the JSON argument response."""
    prompt = build_prompt(lookup, relations, topic)
    result = await llm.complete_with_usage(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        json_mode=True,
    )
    data = json.loads(result.text)
    return LLMArgumentsResponse(
        detected_arguments=data.get("arguments", []),
        added_premises=data.get("added_premises", []),
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
    )
