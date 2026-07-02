"""Tests for neighbourhood_depth validation and pass-through in the simulate_rethon router and service."""

import pytest
from unittest.mock import MagicMock, patch, call
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import get_settings, Settings
from backend.services.rethon_simulation import get_rethon_final_state, build_re
from backend.models.re_state import REElement


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def client():
    settings = Settings(llm_api_keys={}, default_model="gpt-4o-mini")
    app.dependency_overrides[get_settings] = lambda: settings
    yield TestClient(app)
    app.dependency_overrides.clear()


def _simulate_payload(**overrides):
    """Minimal valid simulate request payload."""
    payload = {
        "round": "1",
        "elements": [
            {
                "id": "J1",
                "type": "judgment",
                "status": "active",
                "confidence": "high",
                "text": "J1",
                "addedRound": 1,
            },
            {
                "id": "J2",
                "type": "judgment",
                "status": "active",
                "confidence": "high",
                "text": "J2",
                "addedRound": 1,
            },
            {
                "id": "J3",
                "type": "judgment",
                "status": "active",
                "confidence": "high",
                "text": "J3",
                "addedRound": 1,
            },
            {
                "id": "P1",
                "type": "principle",
                "status": "active",
                "confidence": "high",
                "text": "P1",
                "addedRound": 1,
            },
        ],
        "relations": [
            {
                "from": "J1",
                "to": "P1",
                "type": "entails",
                "explanation": "",
                "addedRound": 1,
                "argumentId": "a1",
            },
        ],
        "local": True,
        "neighbourhood_depth": 1,
    }
    payload.update(overrides)
    return payload


# ── Router: neighbourhood_depth schema validation ──────────────────────────────


@pytest.mark.parametrize("depth", [0, 5, -1])
def test_simulate_rejects_invalid_depth(client, depth):
    res = client.post(
        "/api/simulate_rethon/simulate",
        json=_simulate_payload(neighbourhood_depth=depth),
    )
    assert res.status_code == 422


@pytest.mark.parametrize("depth", [0, 5, -1])
def test_step_rejects_invalid_depth(client, depth):
    res = client.post(
        "/api/simulate_rethon/step", json=_simulate_payload(neighbourhood_depth=depth)
    )
    assert res.status_code == 422


# ── Service: neighbourhood_depth reaches set_model_parameters ─────────────────


def _make_mock_element(status="active"):
    el = MagicMock(spec=REElement)
    el.status = status
    return el


@pytest.fixture
def mock_rethon():
    """Patch BDDDialecticalStructure and both RE classes so no real rethon runs."""
    mock_re = MagicMock()
    mock_ds = MagicMock()
    with (
        patch("backend.services.rethon_simulation.BDDDialecticalStructure") as mock_bdd,
        patch(
            "backend.services.rethon_simulation.StandardLocalReflectiveEquilibrium",
            return_value=mock_re,
        ),
        patch("backend.services.rethon_simulation.StandardPosition") as mock_pos,
    ):
        mock_bdd.from_arguments.return_value = mock_ds
        mock_pos.from_set.return_value = MagicMock()
        yield mock_re


def test_get_rethon_final_state_passes_depth(mock_rethon):
    lookup = {1: _make_mock_element("active")}
    get_rethon_final_state(
        numerical_arguments=[[1]],
        n_unnegated_sentence_pool=1,
        lookup=lookup,
        neighbourhood_depth=3,
    )
    mock_rethon.set_model_parameters.assert_any_call(neighbourhood_depth=3)


def test_get_rethon_final_state_default_depth_is_one(mock_rethon):
    lookup = {1: _make_mock_element("active")}
    get_rethon_final_state(
        numerical_arguments=[[1]],
        n_unnegated_sentence_pool=1,
        lookup=lookup,
    )
    mock_rethon.set_model_parameters.assert_any_call(neighbourhood_depth=1)


def test_build_re_passes_depth(mock_rethon):
    init_coms = MagicMock()
    build_re(
        numerical_arguments=[[1]],
        n_unnegated_sentence_pool=1,
        init_coms=init_coms,
        neighbourhood_depth=4,
    )
    mock_rethon.set_model_parameters.assert_any_call(neighbourhood_depth=4)


def test_build_re_default_depth_is_one(mock_rethon):
    init_coms = MagicMock()
    build_re(
        numerical_arguments=[[1]],
        n_unnegated_sentence_pool=1,
        init_coms=init_coms,
    )
    mock_rethon.set_model_parameters.assert_any_call(neighbourhood_depth=1)
