"""The merge-pairs endpoint: what reaches the model, and what reaches the user.

A model's say-so is never enough to put a pair in front of the user — the
router re-checks every pair against the rules the prompt states.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_llm_service
from backend.main import app
from backend.services.llm import CompletionResult, LLMConfig, LLMService
from backend.services.prompts import DATA_FENCE


class StubLLM(LLMService):
    """Returns a canned payload and remembers the prompt it was sent."""

    def __init__(self, payload):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))
        self._payload = payload
        self.prompts: list[str] = []

    async def complete_with_usage(self, *args, **kwargs):
        self.prompts.append(kwargs["messages"][0]["content"])
        return CompletionResult(
            text=json.dumps(self._payload), input_tokens=7, output_tokens=3
        )


@pytest.fixture
def llm_client():
    def build(payload):
        stub = StubLLM(payload)
        app.dependency_overrides[get_llm_service] = lambda: stub
        return TestClient(app), stub

    yield build
    app.dependency_overrides.clear()


def el(id_, text="some text", type_="judgment", status="active"):
    return {
        "id": id_,
        "type": type_,
        "status": status,
        "confidence": 0.7,
        "text": text,
        "addedRound": 1,
        "origin": "",
    }


# A: J1, J2, P1.  B: J3, P2.  J4 fused from both.  J5 added after the merge.
BODY = {
    "topic": "Honesty",
    "elements": [
        el("J1", "Lying to a friend is wrong."),
        el("J2", "Secrets can be fine."),
        el("P1", "Never deceive.", "principle"),
        el("J3", "It is wrong to lie to friends."),
        el("P2", "Never deceive anyone.", "principle"),
        el("J4", "Honesty matters."),
        el("J5", "Added later."),
        el("J6", "An unaffirmed option.", status="possible"),
    ],
    "processes": [
        {"id": "A", "label": "Lying", "members": ["J1", "J2", "P1", "J4", "J6"]},
        {"id": "B", "label": "Promises", "members": ["J3", "P2", "J4"]},
    ],
}


def post(client, body=BODY):
    return client.post("/api/merge/pairs", json=body)


def test_keeps_only_pairs_that_may_be_merged(llm_client):
    client, _ = llm_client(
        {
            "pairs": [
                {"a": "J1", "b": "J3", "reason": "Same claim."},
                {"a": "J3", "b": "J1", "reason": "Repeat, reversed."},
                {"a": "J1", "b": "J2", "reason": "Same process."},
                {"a": "J1", "b": "P2", "reason": "Across types."},
                {"a": "J4", "b": "J3", "reason": "J4 is in B already."},
                {"a": "J1", "b": "J5", "reason": "J5 is in no process."},
                {"a": "J6", "b": "J3", "reason": "J6 is only possible."},
                {"a": "J1", "b": "J99", "reason": "Unknown."},
                {"a": "P1", "b": "P2", "reason": "Same principle."},
            ]
        }
    )
    res = post(client)
    assert res.status_code == 200
    data = res.json()
    assert data["suggestions"] == [
        {"a": "J1", "b": "J3", "reason": "Same claim."},
        {"a": "P1", "b": "P2", "reason": "Same principle."},
    ]
    assert data["model"] == "stub-model"
    assert (data["input_tokens"], data["output_tokens"]) == (7, 3)


def test_prompt_lists_the_pool_by_process_inside_the_data_fence(llm_client):
    client, stub = llm_client({"pairs": []})
    assert post(client).status_code == 200
    prompt = stub.prompts[0]
    assert "J1 [process A] (judgment): Lying to a friend is wrong." in prompt
    assert "J4 [process A+B] (judgment): Honesty matters." in prompt
    assert "P2 [process B] (principle)" in prompt
    # Added since the merge, or never affirmed: not candidates.
    assert "J5" not in prompt.split("Statements:")[1]
    assert "J6" not in prompt.split("Statements:")[1]
    # User-authored labels and statements are data, not instruction: each block
    # opens with the fence right after its heading and closes with it.
    for heading, needle in (
        ("Processes:", "A: Lying"),
        ("Statements:", "Lying to a friend"),
    ):
        block = prompt.split(f"{heading}\n{DATA_FENCE}\n")[1].split(DATA_FENCE)[0]
        assert needle in block


def test_empty_reply_is_no_pairs(llm_client):
    client, _ = llm_client({"pairs": []})
    assert post(client).json()["suggestions"] == []


def test_a_reply_without_a_list_is_no_pairs(llm_client):
    client, _ = llm_client({"pairs": "none"})
    assert post(client).json()["suggestions"] == []


def test_caps_the_number_of_pairs(llm_client):
    elements = [el(f"J{i}", f"a{i}") for i in range(1, 61)]
    processes = [
        {"id": "A", "label": "", "members": [f"J{i}" for i in range(1, 31)]},
        {"id": "B", "label": "", "members": [f"J{i}" for i in range(31, 61)]},
    ]
    client, _ = llm_client(
        {
            "pairs": [
                {"a": f"J{i}", "b": f"J{i + 30}", "reason": ""} for i in range(1, 31)
            ]
        }
    )
    res = post(client, {"topic": "t", "elements": elements, "processes": processes})
    assert len(res.json()["suggestions"]) == 20


def test_needs_two_processes(llm_client):
    client, _ = llm_client({"pairs": []})
    body = {**BODY, "processes": BODY["processes"][:1]}
    assert post(client, body).status_code == 422
