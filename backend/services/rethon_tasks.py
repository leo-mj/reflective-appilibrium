"""What the server process needs from the rethon layer — and none of it imports rethon.

The rethon stack (rethon, theodias, numba, llvmlite, numpy, pandas, pysat, dd)
is most of what a fresh instance reads before it can answer: measured with
``backend/tools/measure_startup.py``, ``import backend.main`` loaded 263 MB of
native libraries when the router imported the computations directly, and a
hosted instance that has scaled to zero takes about 25 seconds to start, most
of it reading those files. The server process never computes with any of it —
every simulation and score runs in a worker (``process_pool.py``) — so it now
imports only this module, and the rethon stack is loaded by the workers alone.

Three kinds of thing live here, each because the server process needs it:

- **Request validation**, which runs in the server process so a refusal is an
  ordinary ``HTTPException`` (one cannot be unpickled out of a worker).
- **What crosses the pipe back.** A worker's result or exception is unpickled
  in the server process, and unpickling imports the module that defines it.
  The results are the light schemas in ``routers/rethon_schemas.py``;
  ``SimulationFinished`` is defined here for the same reason.
- **The worker entry points.** ``run_in_pool`` pickles the function it is given
  by name, and pickling a function needs its module imported — so the router
  hands over these, which import the real computation only when called, which
  is only ever in a worker. Each has the name of the function it stands for.

``test_startup_imports.py`` fails if ``import backend.main`` loads the rethon
stack again: one new import line would bring the start-up cost back unnoticed.
"""

from typing import Dict, FrozenSet, List, Tuple
import logging

from fastapi import HTTPException

from ..models.re_state import REElement, RERelation
from ..routers.arguments_schemas import DetectArgumentsResponse, translate_from_lookup
from .rethon_caps import (
    NEGATING_TYPES,
    NO_CAPS,
    RETHON_ARGUMENT_TYPES,
    ElementCaps,
    enforce_element_cap,
    rethon_arguments,
)

logger = logging.getLogger(__name__)


# ── The theory's sentences ────────────────────────────────────────────────────
#
# Pure functions of the lookup, used by validation here and by the simulation
# in rethon_theory, which re-exports them.

THEORY_TYPES = ("principle", "theory")


def theory_sentences(lookup: dict) -> FrozenSet[int]:
    """Indices of the pool's principles and background theories, whatever their
    status: like the commitments, the theory may take up an element the reader
    has set aside. ``lookup`` maps positive indices to elements; negated keys,
    where present, are ignored."""
    return frozenset(
        index
        for index, el in lookup.items()
        if index > 0 and isinstance(el, REElement) and el.type in THEORY_TYPES
    )


def held_theory(lookup: dict) -> Tuple[int, ...]:
    """Indices of the principles and background theories the user holds now —
    active or revised — which is the theory position the scoring evaluates
    (``_build_type_positions`` in ``rethon_scoring``) and the simulation's
    first theory.

    In the order the start takes them when not all can be held together: most
    confident first, ties by position in the pool."""
    return tuple(
        sorted(
            (
                index
                for index in theory_sentences(lookup)
                if lookup[index].status in ("active", "revised")
            ),
            key=lambda index: (-(lookup[index].confidence or 0), index),
        )
    )


# ── Validating a request ──────────────────────────────────────────────────────


def build_numerical_arguments(
    elements: List[REElement],
    relations: List[RERelation],
) -> DetectArgumentsResponse:
    """Build rethon-compatible lookup and argument lists from frontend relations."""
    lookup: Dict[int, REElement] = {i + 1: el for i, el in enumerate(elements)}
    id_to_index: Dict[str, int] = {el.id: i + 1 for i, el in enumerate(elements)}

    numerical_arguments: List[List[int]] = []
    for arg_rels in rethon_arguments(relations):
        conclusion_idx = id_to_index.get(arg_rels[0].to_id)
        premise_indices = [id_to_index.get(rel.from_id) for rel in arg_rels]
        if conclusion_idx is None or any(idx is None for idx in premise_indices):
            logger.warning("Skipping argument with unknown element IDs.")
            continue
        if arg_rels[0].type in NEGATING_TYPES:
            conclusion_idx = -conclusion_idx
        numerical_arguments.append(
            [idx for idx in premise_indices if idx is not None] + [conclusion_idx]
        )

    translated_arguments = [
        translate_from_lookup(arg, lookup) for arg in numerical_arguments
    ]
    return DetectArgumentsResponse(
        num_arguments=numerical_arguments,
        translated_arguments=translated_arguments,
        lookup=lookup,
    )


def _add_negated_to_lookup(lookup: Dict) -> Dict:
    """Extend the lookup with negated copies of every element (negative key → ``negated=True``)."""
    return {
        **lookup,
        **{-k: e.model_copy(update={"negated": True}) for k, e in lookup.items()},
    }


def validate_and_build(
    elements: List[REElement],
    relations: List[RERelation],
    sentence_pool_minimum: int = 3,
    caps: ElementCaps = NO_CAPS,
) -> tuple[DetectArgumentsResponse, Dict[int, REElement], int]:
    """Validate the request payload and build the numerical argument structures.

    Raises HTTPException on invalid input.  Returns the built arguments, the
    negated lookup, and the sentence pool size.

    ``caps`` is passed in rather than read from settings so this stays a
    pure function of its arguments — which is what lets it be called from a
    worker process without carrying configuration across the pipe.
    """
    n = len(elements)
    enforce_element_cap(elements, relations, caps)
    if n < sentence_pool_minimum:
        raise HTTPException(
            status_code=422,
            detail=f"There are fewer than {sentence_pool_minimum} elements forming the sentence pool.",
        )
    arg_relations = [r for r in relations if r.type in RETHON_ARGUMENT_TYPES]
    if not arg_relations:
        raise HTTPException(
            status_code=422,
            detail="No argument relations found. Accept arguments in the Detect Arguments tab first.",
        )
    built_arguments = build_numerical_arguments(
        elements=elements, relations=arg_relations
    )
    # The theory is made of these (see rethon_theory), so without one there is
    # no theory to find — rethon would fail with no candidates at all.
    if not theory_sentences(built_arguments.lookup):
        raise HTTPException(
            status_code=422,
            detail="Add a principle or background theory first: the simulation builds its theory from them.",
        )
    lookup_w_negated = _add_negated_to_lookup(lookup=built_arguments.lookup)
    return built_arguments, lookup_w_negated, n


# ── What crosses the pipe ─────────────────────────────────────────────────────


class SimulationFinished(Exception):
    """A step was asked of a process that has already reached its fixed point.

    Raised in a worker in place of an ``HTTPException``, which cannot be
    unpickled; the router turns it back into a 400.
    """


# ── Worker entry points ───────────────────────────────────────────────────────
#
# Stand-ins for the computations in rethon_simulation and rethon_scoring, named
# as they are: see the module docstring for why the router hands over these.
# The import inside each runs in a worker, where the initializer has already
# paid for it (process_pool._init_worker), so it costs nothing there.


def simulate_to_fixed_point(*args, **kwargs):
    from .rethon_simulation import simulate_to_fixed_point as compute

    return compute(*args, **kwargs)


def simulate_one_step(*args, **kwargs):
    from .rethon_simulation import simulate_one_step as compute

    return compute(*args, **kwargs)


def compute_quick_score(*args, **kwargs):
    from .rethon_scoring import compute_quick_score as compute

    return compute(*args, **kwargs)


def compute_score_changes(*args, **kwargs):
    from .rethon_scoring import compute_score_changes as compute

    return compute(*args, **kwargs)


def compute_score_per_round(*args, **kwargs):
    from .rethon_scoring import compute_score_per_round as compute

    return compute(*args, **kwargs)
