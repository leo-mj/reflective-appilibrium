"""The demo's sample process must pass the backend's state model.

The sample (app/src/sample-data/sample-state.js) is what a visitor to the
backend build works on until they start their own, and Review sends it whole.
The state model forbids unknown fields, so a field the app never writes but the
sample carries — a relation's top-level ``previousText`` once did — turns every
request made from the demo into a 422, while users' own processes are fine.

The sample is a JS module that builds its log at import time, so it is read by
running it under node rather than by parsing the file.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from backend.models.re_state import REState
from backend.routers.rethon_schemas import QuickScoreRequest

APP = Path(__file__).resolve().parents[2] / "app"
SAMPLE = "./src/sample-data/sample-state.js"


@pytest.fixture(scope="module")
def sample() -> dict:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is needed to load the sample state")
    out = subprocess.run(
        [
            node,
            "--input-type=module",
            "-e",
            f"import s from {json.dumps(SAMPLE)};"
            "process.stdout.write(JSON.stringify(s));",
        ],
        cwd=APP,
        capture_output=True,
        text=True,
        check=True,
        timeout=30,
    )
    return json.loads(out.stdout)


def test_the_sample_validates_as_a_state(sample):
    REState.model_validate(sample)


def test_the_sample_validates_as_a_quick_score_request(sample):
    QuickScoreRequest.model_validate(
        {"elements": sample["elements"], "relations": sample["relations"]}
    )


def test_the_samples_account_responds_to_its_judgments(sample):
    # The sample's principles conflict (P2 + P3 → J5, P5 + P10 → ¬J5), which
    # once made the scored theory inconsistent: account 0, and every card's
    # "if withdrawn" bar 0.000. P1 entails J3, so withdrawing J3 must cost.
    from backend.services.rethon_scoring import (
        compute_quick_score,
        compute_score_changes,
    )

    req = QuickScoreRequest.model_validate(
        {"elements": sample["elements"], "relations": sample["relations"]}
    )
    assert compute_quick_score(req.elements, req.relations).account > 0
    deltas = {
        d.element_id: d.delta_account
        for d in compute_score_changes(req.elements, req.relations).withdrawal_deltas
    }
    assert deltas["J3"] < 0
