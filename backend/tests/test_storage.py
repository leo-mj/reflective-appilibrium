"""Session storage — the markdown file backend.

Two things are being protected here.

The first is the **cross-boundary contract**: a session written by this store has
to be readable by the frontend's drag-and-drop importer, which is a separate
whitelist validator in another language (app/src/utils/importMarkdown.js).
Nothing else in either suite exercises that seam, and both sides had drifted —
``REElement`` carried no ``history`` field, so the round-by-round record was
silently dropped on save, and optional fields were emitted as explicit ``null``,
which the importer rejects outright.  The fixture below is shared with the
frontend suite so neither side can move without the other noticing.

The second is ``_path``, the guard that keeps a ``session_id`` from addressing a
file outside the sessions directory.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from backend.models.re_state import REState
from backend.storage import (
    MarkdownSessionStore,
    _extract_json,
    _render_markdown,
    _saved_at_from_stem,
    _slugify,
)

# Shared with app/src/utils/importMarkdown.test.js — see FIXTURE_PATH below.
FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "src"
    / "utils"
    / "__fixtures__"
    / "backend-session.md"
)

FIXTURE_SAVED_AT = datetime(2026, 1, 15, 9, 30, 0, tzinfo=timezone.utc)


@pytest.fixture
def store(tmp_path):
    return MarkdownSessionStore(tmp_path)


def a_state(**overrides) -> REState:
    base = {
        "topic": "Autonomy and paternalism",
        "round": 2,
        "elements": [
            {
                "id": "J1",
                "type": "judgment",
                "status": "active",
                "confidence": 0.67,
                "text": "Some verdict.",
                "addedRound": 1,
            }
        ],
        "relations": [],
    }
    return REState.model_validate({**base, **overrides})


# ── The cross-boundary contract ───────────────────────────────────────────────


def test_fixture_matches_what_the_store_writes_today():
    """The fixture the frontend importer is tested against is really our output.

    If this fails the serialisation has changed, and the frontend fixture must be
    regenerated — otherwise the importer is being tested against a file shape the
    backend no longer produces, and the seam silently stops being covered.
    """
    original = FIXTURE_PATH.read_text(encoding="utf-8")
    state = REState.model_validate(json.loads(_extract_json(original)))
    assert _render_markdown(state, FIXTURE_SAVED_AT) == original


def test_fixture_carries_the_shapes_the_two_sides_disagreed_about():
    """Guards the fixture itself: a trivial state would test nothing."""
    state = REState.model_validate(
        json.loads(_extract_json(FIXTURE_PATH.read_text(encoding="utf-8")))
    )
    assert len(state.elements[0].history) >= 3, "needs a multi-event history"
    assert state.relations[0].history, "needs history on a relation too"
    assert any(
        e.previous_text is None for e in state.elements
    ), "needs an unset optional field, the kind that used to serialise as null"
    assert state.reviews, "needs a process review — the newest field across the seam"


def test_written_file_contains_no_explicit_nulls(store):
    """The property that makes a saved session re-importable.

    The frontend validator treats an optional field as absent, not empty, so an
    emitted ``"previousText": null`` fails its string check and the whole file
    refuses to import.
    """
    meta = store.save(a_state())
    text = (Path(store._dir) / f"{meta.session_id}.md").read_text(encoding="utf-8")
    assert ": null" not in text


def test_multi_event_history_survives_a_round_trip(store):
    """Withdraw → reinstate → withdraw must still read back as three events.

    The legacy scalar ``withdrawnRound`` can express only one withdrawal, so if
    ``history`` is dropped the item silently loses every reinstatement and every
    withdrawal after the first.
    """
    events = [
        {"round": 2, "type": "withdrawn", "reason": "Too broad."},
        {"round": 3, "type": "reinstated"},
        {"round": 4, "type": "withdrawn", "reason": "Still too broad."},
    ]
    state = a_state(
        round=4,
        elements=[
            {
                "id": "J1",
                "type": "judgment",
                "status": "withdrawn",
                "confidence": 0.67,
                "text": "Some verdict.",
                "addedRound": 1,
                "history": events,
            }
        ],
        relations=[
            {
                "from": "J1",
                "to": "J1",
                "type": "supports",
                "addedRound": 1,
                "history": [{"round": 2, "type": "withdrawn"}],
            }
        ],
    )

    loaded = store.load(store.save(state).session_id)

    assert [
        e.model_dump(by_alias=True, exclude_none=True)
        for e in loaded.elements[0].history
    ] == events
    assert len(loaded.relations[0].history) == 1


def test_unknown_element_fields_are_rejected_not_dropped():
    """``extra="forbid"`` is what stops the next field from going missing quietly."""
    with pytest.raises(Exception):
        REState.model_validate(
            {
                "topic": "t",
                "round": 1,
                "elements": [
                    {
                        "id": "J1",
                        "type": "judgment",
                        "status": "active",
                        "confidence": 0.5,
                        "text": "x",
                        "addedRound": 1,
                        "somethingNew": 1,
                    }
                ],
            }
        )


# ── _path: the traversal guard ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "session_id",
    [
        "../escaped",
        "../../etc/passwd",
        "sub/../../escaped",
        "/etc/passwd",
    ],
    ids=["parent", "deep-parent", "winding", "absolute"],
)
def test_path_rejects_ids_that_escape_the_sessions_dir(store, session_id):
    with pytest.raises(ValueError):
        store._path(session_id)


def test_load_and_delete_refuse_to_escape(store):
    for op in (store.load, store.delete):
        with pytest.raises(ValueError):
            op("../../etc/passwd")


def test_path_accepts_an_ordinary_id(store):
    assert store._path("20260115_093000_topic").parent == Path(store._dir).resolve()


# ── Naming ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "topic, expected",
    [
        ("Autonomy and Paternalism", "autonomy-and-paternalism"),
        ("  Spaced   out  ", "spaced-out"),
        ("Punctuation!?*()", "punctuation"),
        ("", "untitled"),
        ("!!!", "untitled"),
        ("under_scores", "under-scores"),
        ("a" * 80, "a" * 40),
    ],
    ids=[
        "plain",
        "collapses-space",
        "strips-punctuation",
        "empty",
        "punctuation-only",
        "underscores",
        "truncated",
    ],
)
def test_slugify(topic, expected):
    assert _slugify(topic) == expected


def test_ids_collide_into_numeric_suffixes(store, monkeypatch):
    """Two saves in the same UTC second must not overwrite each other."""
    fixed = datetime(2026, 1, 15, 9, 30, 0, tzinfo=timezone.utc)

    class _FixedClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed

    monkeypatch.setattr("backend.storage.datetime", _FixedClock)

    ids = [store.save(a_state()).session_id for _ in range(3)]
    assert ids == [
        "20260115_093000_autonomy-and-paternalism",
        "20260115_093000_autonomy-and-paternalism_2",
        "20260115_093000_autonomy-and-paternalism_3",
    ]


def test_saved_at_from_stem():
    assert _saved_at_from_stem("20260115_093000_a-topic") == datetime(
        2026, 1, 15, 9, 30, 0, tzinfo=timezone.utc
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────


def test_save_then_load_returns_an_equal_state(store):
    state = a_state()
    assert store.load(store.save(state).session_id) == state


def test_save_leaves_no_temp_file_behind(store):
    """Writes are atomic: content goes to .tmp and is renamed into place."""
    store.save(a_state())
    assert list(Path(store._dir).glob("*.tmp")) == []


def test_load_missing_raises_keyerror(store):
    with pytest.raises(KeyError):
        store.load("20260115_093000_nope")


def test_delete_removes_the_file(store):
    session_id = store.save(a_state()).session_id
    store.delete(session_id)
    with pytest.raises(KeyError):
        store.load(session_id)


def test_delete_missing_raises_keyerror(store):
    with pytest.raises(KeyError):
        store.delete("20260115_093000_nope")


def test_list_sessions_is_newest_first(store, monkeypatch):
    stamps = [
        datetime(2026, 1, 15, 9, 30, 0, tzinfo=timezone.utc),
        datetime(2026, 1, 16, 9, 30, 0, tzinfo=timezone.utc),
    ]

    for stamp in stamps:

        class _FixedClock(datetime):
            @classmethod
            def now(cls, tz=None, _s=stamp):
                return _s

        monkeypatch.setattr("backend.storage.datetime", _FixedClock)
        store.save(a_state())

    listed = store.list_sessions()
    assert [m.saved_at for m in listed] == sorted(stamps, reverse=True)
    assert all(m.topic == "Autonomy and paternalism" for m in listed)


def test_list_sessions_skips_a_corrupt_file(store):
    good = store.save(a_state()).session_id
    (Path(store._dir) / "20260115_093000_broken.md").write_text(
        "# Broken\n\nno re-state block here\n", encoding="utf-8"
    )
    assert [m.session_id for m in store.list_sessions()] == [good]
