"""JSON Schemas constraining LLM output for each RE assist task.

These describe what the *model* should emit, which is deliberately not the same
as the endpoint's response model: ``confidence`` is absent from every schema
here because it records how strongly the user holds an element and is set
server-side (see ``DEFAULT_CONFIDENCE``), even though it appears on the objects
the routers return.  Generating these from the Pydantic response models would
therefore reintroduce the field and force the model to score its own output.

Every schema satisfies OpenAI strict mode, which is stricter than plain JSON
Schema in two ways worth remembering when editing:

* each object must set ``"additionalProperties": false``;
* each object's ``required`` must list *every* property — optionality is
  expressed as a ``["string", "null"]`` type union, not by omission.

The same documents are used as Anthropic tool ``input_schema``, which does not
impose those rules but accepts schemas that follow them.
"""

from ..models.re_state import CitationType, RelationType
from .llm import ResponseSchema
from typing import get_args


# Only the four dialectical relation types belong to relation suggestion; the
# formal-inference types are produced by the argument-reconstruction step, which
# attaches an argument_id the relations path cannot supply.
SUGGESTIBLE_RELATION_TYPES = ["supports", "conflicts", "undermines", "depends"]

assert set(SUGGESTIBLE_RELATION_TYPES) <= set(
    get_args(RelationType)
), "SUGGESTIBLE_RELATION_TYPES must be a subset of the RelationType literal"


RELATIONS_SCHEMA = ResponseSchema(
    name="record_relations",
    description=(
        "Record the directed relations that hold between the listed RE elements."
    ),
    schema={
        "type": "object",
        "properties": {
            "relations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "from": {
                            "type": "string",
                            "description": "Source element ID, e.g. 'J1'.",
                        },
                        "to": {
                            "type": "string",
                            "description": "Target element ID, e.g. 'P2'.",
                        },
                        "type": {
                            "type": "string",
                            "enum": SUGGESTIBLE_RELATION_TYPES,
                        },
                        "explanation": {
                            "type": "string",
                            "description": "One sentence justifying the relation.",
                        },
                    },
                    "required": ["from", "to", "type", "explanation"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["relations"],
        "additionalProperties": False,
    },
)


JUDGMENTS_SCHEMA = ResponseSchema(
    name="record_judgment_questions",
    description=(
        "Record questions or thought experiments, each with the alternative "
        "positions a person might hold in response."
    ),
    schema={
        "type": "object",
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "A brief thought experiment or question.",
                        },
                        "judgments": {
                            "type": "array",
                            "description": (
                                "Mutually exclusive positions in response to the "
                                "question. Do not score or rank them."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "text": {
                                        "type": "string",
                                        "description": "A stand-alone moral verdict.",
                                    }
                                },
                                "required": ["text"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["question", "judgments"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["suggestions"],
        "additionalProperties": False,
    },
)


PRINCIPLES_SCHEMA = ResponseSchema(
    name="record_principles",
    description="Record general moral principles that systematise the given judgments.",
    schema={
        "type": "object",
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "One-sentence statement of the principle.",
                        },
                        "covers": {
                            "type": "array",
                            "description": "IDs of the elements this principle systematises.",
                            "items": {"type": "string"},
                        },
                        "explanation": {
                            "type": "string",
                            "description": (
                                "One sentence on how it systematises the listed elements."
                            ),
                        },
                    },
                    "required": ["text", "covers", "explanation"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["suggestions"],
        "additionalProperties": False,
    },
)


# Bibliographic fields, never a formatted reference: formatting is not knowledge,
# and asking for it makes output quality depend on a model's typography rather
# than on what it knows.  app/src/utils/citation.js renders these.
#
# There is deliberately **no `doi` property**, and no `url`.  A DOI is the field
# a model fabricates most readily — rigid format, high entropy, trivial to
# imitate, impossible to check by eye — and a fabricated one fails quietly by
# resolving to a real but different work.  Leaving it out of the schema means
# there is nowhere for a model to put one; DOIs on surviving references come from
# Crossref, in services/crossref.py.  Do not add it back.
_SOURCE_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {
            "type": "string",
            "enum": list(get_args(CitationType)),
            "description": (
                "'chapter' also covers an entry in an edited reference work."
            ),
        },
        "authors": {
            "type": "array",
            "description": "Surname-first, e.g. 'Parfit, D.'.",
            "items": {"type": "string"},
        },
        "year": {"type": "string", "description": "e.g. '1984', 'n.d.', 'in press'."},
        "title": {
            "type": "string",
            "description": "Title of the work, or of the chapter or article.",
        },
        "container": {
            "type": "string",
            "description": (
                "Book title for a chapter, journal name for an article, "
                "empty for a book."
            ),
        },
        "editors": {
            "type": "array",
            "description": "Initials-first, e.g. 'E. N. Zalta'. Chapters only.",
            "items": {"type": "string"},
        },
        "publisher": {"type": "string", "description": "Books and chapters."},
        "volume": {"type": "string", "description": "Articles."},
        "issue": {"type": "string", "description": "Articles."},
        "pages": {"type": "string", "description": "Chapters and articles."},
    },
    # Strict mode requires every property here, so an inapplicable field is an
    # empty string or array rather than an absent key.
    "required": [
        "type",
        "authors",
        "year",
        "title",
        "container",
        "editors",
        "publisher",
        "volume",
        "issue",
        "pages",
    ],
    "additionalProperties": False,
}


THEORIES_SCHEMA = ResponseSchema(
    name="record_theories",
    description=(
        "Record background theories that bear on the given moral position, with "
        "the works they are developed in."
    ),
    schema={
        "type": "object",
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": (
                                "One-sentence statement of the background theory, "
                                "stated so it can be assessed on its own."
                            ),
                        },
                        "sources": {
                            "type": "array",
                            "description": (
                                "Works where the theory is developed. Return an "
                                "empty array rather than naming a work you are not "
                                "confident exists."
                            ),
                            "items": _SOURCE_SCHEMA,
                        },
                    },
                    "required": ["text", "sources"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["suggestions"],
        "additionalProperties": False,
    },
)


REVIEW_SCHEMA = ResponseSchema(
    name="record_process_review",
    description=(
        "Record a macro-level review of how an RE process developed across its rounds."
    ),
    schema={
        "type": "object",
        "properties": {
            "headline": {
                "type": "string",
                "description": "One sentence naming this review's through-line (~20 words).",
            },
            "arc": {
                "type": "string",
                "description": (
                    "How the position moved: which commitments became load-bearing, "
                    "whether the range of views widened or narrowed (~200 words)."
                ),
            },
            "surprises": {
                "type": "string",
                "description": (
                    "Where the process turned in a way its earlier rounds did not "
                    "predict (~110 words)."
                ),
            },
            "missed": {
                "type": "string",
                "description": (
                    "Where higher coherence was available and not taken (~110 words)."
                ),
            },
            "method": {
                "type": "string",
                "description": (
                    "How the process was conducted rather than what it concluded: "
                    "adding versus revising, and whether suggestions were reworded "
                    "before acceptance (~60 words)."
                ),
            },
        },
        "required": ["headline", "arc", "surprises", "missed", "method"],
        "additionalProperties": False,
    },
)


ARGUMENTS_SCHEMA = ResponseSchema(
    name="record_arguments",
    description=(
        "Record formally valid argument reconstructions over the sentence pool, "
        "with the premises added to close each inferential gap."
    ),
    schema={
        "type": "object",
        "properties": {
            "arguments": {
                "type": "array",
                "description": (
                    "Each argument is a list of sentence indices whose final member "
                    "is the conclusion; a negative index denotes negation."
                ),
                "items": {"type": "array", "items": {"type": "integer"}},
            },
            "added_premises": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "index": {
                            "type": "integer",
                            "description": "Unused sentence index for this premise.",
                        },
                        "type": {
                            "type": "string",
                            "enum": ["judgment", "principle", "theory"],
                        },
                        "role": {
                            "type": "string",
                            "enum": ["premise", "postulate"],
                        },
                        "text": {
                            "type": "string",
                            "description": "The premise in natural language.",
                        },
                        # Strict mode has no way to say "required only when role
                        # is postulate", so the union carries that: a substantive
                        # premise sends null, which the checker treats exactly as
                        # an absent form (an unanalyzed atom).
                        "form": {
                            "type": ["string", "null"],
                            "description": (
                                "Propositional formula over OTHER sentence indices, "
                                "e.g. '(3 & 4) -> 7'. Required when role is "
                                "'postulate'; null when role is 'premise'."
                            ),
                        },
                    },
                    "required": ["index", "type", "role", "text", "form"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["arguments", "added_premises"],
        "additionalProperties": False,
    },
)
