"""The warm-up must leave a worker nothing to compile.

A new worker's first score or simulation compiles theodias's numba functions —
seconds, against milliseconds for every call after — and ``/warm`` runs a small
process to get that done on the start page (``services/rethon_warmup.py``).
numba compiles once per type signature, so a small process covers a large one
only while both reach the same signatures. This counts them: after the warm-up,
a larger process with joint arguments, a preclusion, a theory and withdrawn and
revised elements must compile nothing more.

Run in a fresh process, since this one may have compiled them long since.
"""

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

_SCRIPT = r"""
import json, sys
from numba.core.registry import CPUDispatcher
from backend.services import rethon_warmup
from backend.services.rethon_caps import NO_CAPS
from backend.services.rethon_scoring import compute_quick_score
from backend.services.rethon_simulation import simulate_to_fixed_point
from backend.services.rethon_tasks import validate_and_build
from backend.models.re_state import REElement, RERelation

def compiled():
    return sum(
        len(v.signatures)
        for name, mod in list(sys.modules.items())
        if name.split(".")[0] in ("rethon", "theodias")
        for v in vars(mod).values()
        if isinstance(v, CPUDispatcher)
    )

before = compiled()
rethon_warmup.warm_scoring()
rethon_warmup.warm_simulation()
warmed = compiled()

def el(i, t, status="active"):
    return REElement(id=i, type=t, status=status, confidence=0.6, text=i, addedRound=1)

def rel(f, t, ty, a):
    return RERelation(**{"from": f, "to": t, "type": ty, "explanation": "",
                         "addedRound": 1, "argumentId": a})

els = [el("J1", "judgment"), el("J2", "judgment"), el("J3", "judgment"),
       el("J4", "judgment", "withdrawn"), el("J5", "judgment"),
       el("P1", "principle"), el("P2", "principle"), el("T1", "theory"),
       el("P3", "principle", "revised")]
rels = [rel("P1", "J1", "jointly_entails", "a1"), rel("T1", "J1", "jointly_entails", "a1"),
        rel("P2", "J2", "entails", "a2"), rel("P3", "J3", "precludes", "a3"),
        rel("J4", "P1", "jointly_precludes", "a4"), rel("J5", "P1", "jointly_precludes", "a4"),
        rel("T1", "J5", "entails", "a5")]
compute_quick_score(els, rels)
built, lookup, n = validate_and_build(els, rels, 3, NO_CAPS)
simulate_to_fixed_point(built, lookup, n, els, None)
print(json.dumps({"before": before, "warmed": warmed, "after": compiled()}))
"""


def test_the_warm_up_compiles_what_a_larger_process_needs():
    out = subprocess.run(
        [sys.executable, "-c", _SCRIPT],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
        timeout=300,
    )
    counts = json.loads(out.stdout.strip().splitlines()[-1])
    assert counts["warmed"] > counts["before"], "the warm-up compiled nothing"
    assert counts["after"] == counts["warmed"], counts
