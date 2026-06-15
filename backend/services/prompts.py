"""LLM prompt builders for all RE analysis tasks."""

import json
from typing import Any

from ..models.re_state import REElement, RERelation, RELogEntry, REState


RELATION_RULES = """\
Relation types (all are directional — check both A→B and B→A):
- supports: A provides positive reason for B (evidential, explanatory, or logical)
- conflicts: A and B are incompatible; holding both generates contradiction or incoherence
- undermines: A weakens B without flatly contradicting it; reduces plausibility or confidence
- depends: A presupposes B; A cannot hold (or loses its grounding) if B is withdrawn

A single pair can have multiple relations (e.g. P supports J in one respect but undermines it in another). Record each separately.
When in doubt whether a relation exists, include it — the user can reject it. Missing connections degrade coherence evaluation."""


def build_matrix_prompt(topic: str, elements: list[REElement]) -> str:
    """Build the LLM prompt for relatedness matrix computation.

    The prompt instructs the model to produce a symmetric matrix with
    diagonal 1.0 entries and a ``pairDescriptions`` dict keyed by
    ``"A→B"`` in JavaScript sort order (to match the frontend).
    """
    element_list = "\n".join(f"{e.id} [{e.type}]: {e.text}" for e in elements)
    ids = [e.id for e in elements]
    example_ids = ids[:3] if len(ids) >= 3 else ids

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Elements (judgments and principles):
{element_list}

Task: compute a symmetric relatedness matrix.
- Score each ordered pair (including diagonal) from 0.0 (completely unrelated) to 1.0 (identical or directly equivalent).
- Diagonal entries must be 1.0.
- For each off-diagonal unordered pair, provide a one-sentence description. \
Use the key "A→B" where A and B are sorted by JavaScript string sort order \
(e.g. ["J12","J10","J1","J3"].sort() → ["J1","J10","J12","J3"]).
- Write a 2–3 sentence overview of the overall element landscape.

Respond with valid JSON only, in exactly this format:
{{
  "overview": "...",
  "matrix": {{ {", ".join(f'"{i}": {{...}}' for i in example_ids)} }},
  "pairDescriptions": {{ "{example_ids[0]}→{example_ids[1]}": "Brief description." }}
}}"""


def build_relations_prompt(
    topic: str,
    elements: list[REElement],
    existing_relations: list[RERelation],
) -> str:
    """Build the LLM prompt for relation suggestion.

    Already-recorded directed pairs are extracted from ``existing_relations``
    and injected into the prompt as a skip list.  The model is instructed to
    check both directions for every element pair and to err on the side of
    inclusion — the user can reject spurious suggestions in the UI.
    """
    element_lines = "\n".join(f"{e.id} [{e.type}]: {e.text}" for e in elements)

    skip_pairs: set[tuple[str, str]] = set()
    for r in existing_relations:
        skip_pairs.add((r.from_id, r.to_id))

    if skip_pairs:
        skip_lines = "\n".join(f"  {a} → {b}" for a, b in sorted(skip_pairs))
        skip_section = f"\nAlready recorded (do not re-suggest these directed pairs):\n{skip_lines}\n"
    else:
        skip_section = ""

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Elements:
{element_lines}
{skip_section}
{RELATION_RULES}

Task: identify ALL relations that hold between any two elements above (both directions), \
excluding already-recorded pairs listed above.

Respond with valid JSON only, in exactly this format:
{{
  "relations": [
    {{"from": "J1", "to": "P2", "type": "supports", "explanation": "One sentence."}}
  ]
}}

If no new relations are found, return {{"relations": []}}."""


def build_judgments_prompt(
    topic: str,
    elements: list[REElement],
    log: list[RELogEntry],
) -> str:
    """Build the LLM prompt for judgment elicitation.

    Active and withdrawn elements are listed separately so the model can
    target genuine gaps rather than re-eliciting already-recorded positions.
    Only the five most recent log entries are included to stay within token limits.
    """
    active = [e for e in elements if e.status not in {"withdrawn", "rejected"}]
    withdrawn = [e for e in elements if e.status == "withdrawn"]

    active_lines = (
        "\n".join(f"  {e.id} [{e.type}]: {e.text}" for e in active)
        if active
        else "  (none)"
    )
    withdrawn_lines = (
        "\n".join(f"  {e.id}: {e.text}" for e in withdrawn) if withdrawn else "  (none)"
    )
    log_lines = (
        "\n".join(
            f"  Round {entry.round}: {entry.findings}"
            for entry in log[-5:]
            if entry.findings
        )
        if log
        else "  (none)"
    )

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Current elements (active):
{active_lines}

Previously withdrawn elements (for context — these were reconsidered):
{withdrawn_lines}

Recent round notes:
{log_lines}

Task: identify 3–5 moral questions or thought experiments that are relevant \
to the topic and may prompt the user to articulate judgments they have not yet \
recorded.

For each question, provide 2–4 possible positions that together cover the main \
stances a person might hold in response to that question (jointly exhaustive \
alternatives). The user will accept the positions they agree with and reject the rest.

Guidelines:
- Target gaps: aspects of the topic the existing judgments do not yet address.
- Vary the angle: use cases from different ethical traditions, edge cases, \
near-miss scenarios, or analogies from other domains.
- Do not re-elicit judgments already present or withdrawn.
- Keep questions concise (1–2 sentences) and concrete.
- Each position should be a stand-alone moral verdict (not a rephrasing of the question).
- Positions within one question should be mutually exclusive — a user should be \
able to hold at most one without contradiction.

Respond with valid JSON only, in exactly this format:
{{
  "suggestions": [
    {{
      "question": "A brief thought experiment or question.",
      "judgments": [
        {{"text": "One plausible position in response to the question.", "confidence": 1.0}},
        {{"text": "Another plausible position.", "confidence": 0.67}},
        {{"text": "A more cautious or defeasible position.", "confidence": 0.33}}
      ]
    }}
  ]
}}"""


def build_principles_prompt(
    topic: str,
    judgments: list[REElement],
    existing_principles: list[REElement],
) -> str:
    """Build the LLM prompt for principle suggestion.

    Both active judgments and existing principles are included so the model
    can avoid redundant proposals and estimate how many new principles are
    warranted (target: roughly one per three elements).
    """
    judgment_lines = "\n".join(f"  {e.id}: {e.text}" for e in judgments)
    principle_lines = (
        "\n".join(f"  {e.id}: {e.text}" for e in existing_principles)
        if existing_principles
        else "  (none)"
    )

    return f"""\
You are assisting a reflective equilibrium (RE) analysis in ethics.
Topic: "{topic}"

Existing judgments and principles to systematise:
{judgment_lines}
{principle_lines}

Task: propose at least 2 and up to {(len(judgments) + len(existing_principles))/3} \
NEW principles that would systematise as many of the judgments
and/or principles above as possible. Each principle should:
- Be a general moral rule or norm (not a particular verdict).
- Cover several judgments (list their IDs in "covers").
- Not duplicate any already-recorded principle.

Respond with valid JSON only, in exactly this format:
{{
  "suggestions": [
    {{
      "text": "One-sentence statement of the principle.",
      "confidence": 1.0,
      "covers": ["J1", "J3"],
      "explanation": "One sentence explaining how this principle systematises the listed judgments."
    }}
  ]
}}

If the existing principles already cover all judgments well, return {{"suggestions": []}}."""


def build_conversation_system(state: REState, suggestion: dict[str, Any]) -> str:
    """Build the system prompt for a per-suggestion conversation session.

    Injects the full RE state (active elements, relations, recent log) and the
    suggestion under discussion so the LLM has full context without needing it
    repeated in the conversation history.
    """
    active = [e for e in state.elements if e.status not in ("withdrawn", "rejected")]
    active_rels = [
        r for r in state.relations if r.status not in ("withdrawn", "rejected")
    ]

    elements_text = (
        "\n".join(f"  [{e.id}] ({e.type}, {e.confidence}) {e.text}" for e in active)
        or "  (none)"
    )
    relations_text = (
        "\n".join(
            f"  {r.from_id} --{r.type}--> {r.to_id}: {r.explanation}"
            for r in active_rels
        )
        or "  (none)"
    )
    log_text = (
        "\n".join(
            f"  Round {e.round}: {e.findings}" for e in state.log[-5:] if e.findings
        )
        or "  (none)"
    )
    suggestion_block = "```json\n" + json.dumps(suggestion, indent=2) + "\n```"

    return (
        "You are assisting a user conducting wide reflective equilibrium (RE) in ethics.\n"
        "Help them think through the suggestion below in the context of their RE position. "
        "Reference elements by ID (J1, P2, etc.) where relevant. Do not impose moral views.\n\n"
        f"## RE state — topic: {state.topic or '(unspecified)'}, round {state.round}\n\n"
        f"### Elements\n{elements_text}\n\n"
        f"### Relations\n{relations_text}\n\n"
        f"### Recent log\n{log_text}\n\n"
        f"## Suggestion under discussion\n{suggestion_block}"
    )
