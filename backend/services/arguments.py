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
# Full element order (all 20, including withdrawn):
# 1:J1  2:J2  3:J3  4:J4  5:J5  6:J6(w)  7:J7  8:J8  9:J9  10:J10  11:J11(w)  12:J12
# 13:P1  14:P2  15:P3  16:P4(w)  17:P5  18:P6  19:T1  20:T2
# Negative indices represent negations: -n = ¬sentence-n
DUMMY_ARGUMENTS: List[List[int]] = [
    # Suppressed-premise arguments (indices 21–23 added by dummy_detect_arguments):
    # 21:J (radioactive waste leaves future generations worse off — bridge for P1→J1)
    # 22:P (well-being capacity grounds justice obligations — bridge for T1→P5)
    # 23:J (people in 2100 are causally affected by today's climate policy — bridge for P5→J2)
    [
        13,
        21,
        1,
    ],  # P1 + J21 → J1 (sufficientarian + factual bridge → radioactive waste wrong)
    [13, 3],  # P1 → J3 (sufficientarian → resource depletion)
    [13, 4],  # P1 → J4 (sufficientarian → liveable environment)
    [14, 8],  # P2 → J8 (probabilistic obligation → extinction prevention)
    [14, 5],  # P2 → J5 (probabilistic obligation → uncertainty discounting)
    [15, 10],  # P3 → J10 (uncertainty not temporal → equal counting)
    [17, 23, 2],  # P5 + J23 → J2 (Rawlsian + causal bridge → climate policy)
    [17, 12],  # P5 → J12 (Rawlsian → democratic institutions)
    [17, 10],  # P5 → J10 (Rawlsian → equal counting)
    [18, 7],  # P6 → J7 (proximity modulates → parental obligations)
    [
        19,
        22,
        17,
    ],  # T1 + P22 → P5 (well-being capacity + justice bridge → Rawlsian valid)
    [19, 14],  # T1 → P2 (identity not required → probabilistic obligation)
    [20, 14],  # T2 → P2 (class determinacy → probabilistic obligation)
    [19, 20, 14],  # T1 + T2 → P2 (conjunction)
    [13, 17, 10],  # P1 + P5 → J10 (sufficientarian + Rawlsian → equal counting)
    [14, 15, 5],  # P2 + P3 → J5 (probabilistic + uncertainty threshold → discounting)
    # Negation arguments:
    [
        5,
        -10,
    ],  # J5 → ¬J10 (permissible discounting entails rejection of strict equal counting)
    [
        16,
        -1,
    ],  # P4 → ¬J1 (if only current beings matter, radioactive waste is not wrong)
    [
        14,
        -6,
    ],  # P2 → ¬J6 (probabilistic obligation entails rejection of "no obligations to non-existent")
    [
        18,
        7,
        -10,
    ],  # P6 + J7 → ¬J10 (if proximity modulates and parents > strangers, strict equal counting fails)
]


def dummy_detect_arguments(
    n_unnegated_sentence_pool: int, elements: List[REElement], round: str
) -> DetectArgumentsResponse:
    """Return a hard-coded argument set for the sample 'obligations to future generations' RE state.

    Filters ``DUMMY_ARGUMENTS`` to those whose indices fall within the current
    sentence pool size, then adds the three suppressed-premise elements (indices
    21–23) to the lookup.
    """
    initial_lookup = {index + 1: e for index, e in enumerate(elements)}
    added_premises = [
        {
            "index": 21,
            "type": "judgment",
            "text": "Burying large quantities of radioactive waste without containment, knowing it will poison groundwater for millennia, constitutes leaving future generations materially worse off than we found things.",
        },
        {
            "index": 22,
            "type": "principle",
            "text": "Beings who possess or will possess the capacity for well-being and who will be affected by our decisions are owed obligations of justice.",
        },
        {
            "index": 23,
            "type": "judgment",
            "text": "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
        },
    ]
    pool_size = n_unnegated_sentence_pool + len(added_premises)
    num_arguments = [
        arg for arg in DUMMY_ARGUMENTS if all(abs(n) <= pool_size for n in arg)
    ]
    lookup_w_premises = add_new_premises_to_lookup(
        added_premises=added_premises,
        lookup=initial_lookup,
        elements=elements,
        round=round,
        model="sample data model",
    )
    translated = translate_arguments(
        detected_arguments=num_arguments, lookup=lookup_w_premises
    )
    return DetectArgumentsResponse(
        num_arguments=num_arguments,
        translated_arguments=translated,
        lookup=lookup_w_premises,
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
