"""A worker's first score and first simulation, run before anyone asks for one.

Imported in the workers only, through the stand-ins in ``rethon_tasks``: it
loads the rethon stack, which the server process keeps out.

Starting a worker is not all of the wait before its first computation. theodias
computes positions with numba-compiled functions, declared without ``cache=True``,
so every new worker compiles them on the first call — about 2s for a score and
1s for a simulation, measured in a fresh process, against a few milliseconds for
every call after. ``/warm`` runs these so that the compiling happens while the
reader is still on the start page.

The process is the smallest one the simulation accepts. numba compiles per type
signature, not per size, so a small one compiles what a large one would; a test
holds that (``test_rethon_warmup.py``).
"""

from ..models.re_state import REElement, RERelation
from .rethon_caps import NO_CAPS
from .rethon_scoring import compute_quick_score
from .rethon_simulation import simulate_to_fixed_point
from .rethon_tasks import validate_and_build

_ELEMENTS = [
    REElement(
        id=i, type=t, status="active", confidence=0.8, text=i, addedRound=1
    )
    for i, t in [
        ("J1", "judgment"),
        ("J2", "judgment"),
        ("J3", "judgment"),
        ("P1", "principle"),
    ]
]
_RELATIONS = [
    RERelation(
        **{
            "from": "J1",
            "to": "P1",
            "type": "entails",
            "explanation": "",
            "addedRound": 1,
            "argumentId": "a1",
        }
    )
]


def warm_scoring() -> None:
    """Score the small process once, compiling what scoring compiles."""
    compute_quick_score(_ELEMENTS, _RELATIONS)


def warm_simulation() -> None:
    """Simulate the small process once, compiling what simulating compiles."""
    built, lookup, n = validate_and_build(_ELEMENTS, _RELATIONS, 3, NO_CAPS)
    simulate_to_fixed_point(built, lookup, n, _ELEMENTS, None)
