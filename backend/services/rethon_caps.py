"""How large a rethon computation this deployment will take on.

Two limits, because two different things grow. The cost of a computation grows
with the elements its arguments tie together; an element no argument mentions
adds almost nothing to it. So the cap that bounds the cost counts *argued*
elements, and the total gets a looser one of its own. The measurements behind
both numbers are in ``backend/config.py``, at ``_HOSTED_MAX_ARGUED_ELEMENTS``.

Kept apart from ``rethon_simulation`` so the settings can build an
``ElementCaps`` without importing rethon.
"""

from typing import Iterable, NamedTuple

from fastapi import HTTPException

from ..models.re_state import REElement, RERelation

# The relations rethon is given: the four inferential types, single-premise and
# joint alike. The dialectical ones (supports, conflicts, undermines) are left
# out of the dialectical structure, and so cost nothing. Only the joint pair used
# to be given, which dropped every single-premise argument from the simulation.
RETHON_ARGUMENT_TYPES = (
    "entails",
    "precludes",
    "jointly_entails",
    "jointly_precludes",
)

# The two whose conclusion rethon receives negated.
NEGATING_TYPES = ("precludes", "jointly_precludes")


class ElementCaps(NamedTuple):
    """The two limits; 0 in either means that one is off.

    A tuple so it pickles into a worker process as it is.
    """

    total: int = 0
    argued: int = 0


NO_CAPS = ElementCaps()


def rethon_arguments(relations: Iterable[RERelation]) -> list[list[RERelation]]:
    """The arguments rethon is given, each as the relations that make it up.

    A joint argument is its premises' relations, tied by ``argumentId`` — without
    one there is no telling which premises belong together, so it is left out.
    A single-premise argument is its one relation, whether or not it carries an
    ``argumentId``: states written before every argument was given one still
    say plainly what it is.
    """
    grouped: dict[str, list[RERelation]] = {}
    arguments: list[list[RERelation]] = []
    for rel in relations:
        if rel.type not in RETHON_ARGUMENT_TYPES:
            continue
        if rel.argument_id:
            grouped.setdefault(rel.argument_id, []).append(rel)
        elif not rel.type.startswith("jointly_"):
            arguments.append([rel])
    return list(grouped.values()) + arguments


def argued_element_ids(relations: Iterable[RERelation]) -> set[str]:
    """The elements that take part in an argument rethon will be given."""
    ids: set[str] = set()
    for argument in rethon_arguments(relations):
        for rel in argument:
            ids.add(rel.from_id)
            ids.add(rel.to_id)
    return ids


def enforce_element_cap(
    elements: list[REElement],
    relations: Iterable[RERelation],
    caps: ElementCaps,
) -> None:
    """Refuse a request too large to compute over, or return quietly.

    422 rather than 413, because the payload is well-formed and the right size
    for a different deployment — it is this server that cannot answer it.
    Called by every entry point that builds a structure, including the two in
    ``rethon_scoring`` that build their own rather than going through
    ``validate_and_build``.
    """
    n = len(elements)
    if caps.total and n > caps.total:
        raise HTTPException(
            status_code=422,
            detail=(
                f"This instance computes over at most {caps.total} elements; "
                f"the request has {n}. Run the backend locally to lift the cap."
            ),
        )
    if caps.argued:
        argued = len(argued_element_ids(relations))
        if argued > caps.argued:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"This instance computes over at most {caps.argued} elements "
                    f"that take part in arguments; the request has {argued}. "
                    "Run the backend locally to lift the cap."
                ),
            )
