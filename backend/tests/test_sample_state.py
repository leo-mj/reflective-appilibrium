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
