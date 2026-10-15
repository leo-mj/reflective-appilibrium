"""The prompt-evaluation script, run on the sample export with a canned model reply."""

import argparse
import asyncio
from pathlib import Path

from backend.routers.arguments_schemas import AddedPremise, LLMArgumentsResponse
from backend.scripts import eval_argument_prompt as script

EXPORT = (
    Path(__file__).parents[2] / "app/src/sample-data/sample-process-climate-duties.md"
)


def test_tallies_proposals_by_outcome(monkeypatch, capsys):
    async def canned(lookup, llm, relations, topic):
        bridge = AddedPremise(
            index=len(lookup) + 1,
            type="principle",
            role="postulate",
            text="A bridge.",
            form="1 -> 2",
        )
        return LLMArgumentsResponse(
            detected_arguments=[
                [1, bridge.index, 2],  # passes
                [1, bridge.index, 3],  # not formally valid
                [1, 999, 2],  # undefined index: dropped
            ],
            added_premises=[bridge],
            input_tokens=10,
            output_tokens=5,
        )

    monkeypatch.setattr(script, "get_arguments_from_llm", canned)
    args = argparse.Namespace(
        export=str(EXPORT),
        base_url="https://api.anthropic.com",
        model="m",
        max_tokens=100,
        runs=2,
    )
    asyncio.run(script.run(args))
    out = capsys.readouterr().out
    assert "run 1: 3 proposed, 1 passed, 1 failed, 1 dropped" in out
    assert "2 runs: 6 proposed, 2 passed (33%)" in out
    assert "2  invalid" in out
    assert "2  dropped: no premise, or an undefined index" in out
