"""Reference checking against Crossref.

Three properties are what this module is for, and each has a test that fails
loudly if it erodes:

* it never raises — verification decorates a suggestion and must not be able to
  fail one;
* "not found" and "not checked" stay distinct, because a UI that shows them the
  same way is lying about one of them;
* confirmation is our own deterministic check rather than a threshold on
  Crossref's relevance score.
"""

import httpx
import pytest

from backend.config import Settings
from backend.models.re_state import RESource
from backend.services import crossref
from backend.services.crossref import verify


def settings(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        crossref_base_url="https://crossref.test/works",
        **overrides,
    )


def source(**overrides) -> RESource:
    return RESource(
        **{
            "type": "book",
            "authors": ["Parfit, D."],
            "year": "1984",
            "title": "Reasons and persons",
            "publisher": "Oxford University Press",
            **overrides,
        }
    )


def item(**overrides) -> dict:
    return {
        "DOI": "10.1093/019824908x.001.0001",
        "score": 90.0,
        "title": ["Reasons and Persons"],
        "author": [{"family": "Parfit", "given": "Derek"}],
        "issued": {"date-parts": [[1984]]},
        **overrides,
    }


@pytest.fixture(autouse=True)
def empty_cache():
    """The cache is process-global, so tests would otherwise answer each other."""
    crossref._cache.clear()
    yield
    crossref._cache.clear()


@pytest.fixture
def stub(monkeypatch):
    """Answer requests from a handler, through a real client.

    The real ``AsyncClient`` is captured *before* patching and then built with a
    ``MockTransport``: the service calls ``httpx.AsyncClient`` by module
    attribute, so a factory that reached for it again would call itself. Going
    through the real client also means the timeouts and headers production
    constructs are the ones under test.
    """
    real_client = httpx.AsyncClient
    calls = []

    def install(handler):
        def factory(*args, **kwargs):
            def track(request):
                calls.append(request)
                return handler(request)

            return real_client(*args, transport=httpx.MockTransport(track), **kwargs)

        monkeypatch.setattr(httpx, "AsyncClient", factory)
        return calls

    return install


def answering(*items):
    return lambda request: httpx.Response(200, json={"message": {"items": list(items)}})


# ── Matching ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_confirmed_hit_is_matched_and_carries_crossrefs_doi(stub):
    stub(answering(item()))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "matched"
    assert verdict.doi == "10.1093/019824908x.001.0001"


@pytest.mark.asyncio
async def test_a_tie_on_the_top_two_scores_is_inconclusive(stub):
    """Crossref's own advice: two results at the same score is not a match.

    Both entries here would pass our field checks — the point is that when the
    index cannot separate them, neither is taken.
    """
    stub(answering(item(score=50.0), item(score=50.0)))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "not_found"


@pytest.mark.asyncio
async def test_a_different_title_is_not_matched(stub):
    stub(answering(item(title=["Reasons and Rationality"])))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "not_found"


@pytest.mark.asyncio
async def test_a_subtitle_the_reference_omits_still_matches(stub):
    """Containment, not similarity: Crossref records carry subtitles citations drop."""
    stub(answering(item(title=["Reasons and Persons: A Study in Ethics"])))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "matched"


@pytest.mark.asyncio
async def test_a_two_word_title_must_match_exactly(stub):
    """Short titles are too easy to contain, which is how a check confirms everything."""
    stub(answering(item(title=["On Liberty and Other Essays"])))
    [verdict] = await verify([source(title="On Liberty")], settings())
    assert verdict.state == "not_found"


@pytest.mark.asyncio
async def test_a_missing_first_author_is_not_matched(stub):
    stub(answering(item(author=[{"family": "Singer", "given": "Peter"}])))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "not_found"


@pytest.mark.asyncio
async def test_a_record_with_no_authors_is_not_matched_on_title_alone(stub):
    stub(answering(item(author=[])))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "not_found"


@pytest.mark.asyncio
async def test_a_year_one_out_still_matches(stub):
    """Online-first, an issue dated forward, a reprint — all legitimately differ by one."""
    stub(answering(item(issued={"date-parts": [[1985]]})))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "matched"


@pytest.mark.asyncio
async def test_a_year_two_out_is_not_matched(stub):
    stub(answering(item(issued={"date-parts": [[1986]]})))
    [verdict] = await verify([source()], settings())
    assert verdict.state == "not_found"


@pytest.mark.asyncio
async def test_an_undated_reference_is_judged_on_the_other_two_checks(stub):
    """ "n.d." cannot be checked on year, so the year test abstains rather than fails."""
    stub(answering(item(issued={"date-parts": [[2011]]})))
    [verdict] = await verify([source(year="n.d.")], settings())
    assert verdict.state == "matched"


@pytest.mark.asyncio
async def test_accents_and_punctuation_do_not_decide_a_match(stub):
    stub(answering(item(title=["Sur l'éthique — et la raison"])))
    [verdict] = await verify([source(title="Sur l ethique et la raison")], settings())
    assert verdict.state == "matched"


@pytest.mark.asyncio
async def test_no_results_is_not_found(stub):
    stub(answering())
    [verdict] = await verify([source()], settings())
    assert verdict.state == "not_found"


# ── Failure is never fatal ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "handler",
    [
        pytest.param(
            lambda r: (_ for _ in ()).throw(httpx.ConnectError("refused")),
            id="connection refused",
        ),
        pytest.param(
            lambda r: (_ for _ in ()).throw(httpx.ReadTimeout("slow")),
            id="timeout",
        ),
        pytest.param(lambda r: httpx.Response(503), id="service unavailable"),
        pytest.param(lambda r: httpx.Response(200, text="not json"), id="junk body"),
        pytest.param(
            lambda r: httpx.Response(200, json={"unexpected": "shape"}),
            id="changed response shape",
        ),
    ],
)
@pytest.mark.asyncio
async def test_every_failure_reads_as_unchecked_and_never_raises(stub, handler):
    """A Crossref problem must not become the user's problem.

    "not checked" rather than "not found": we did not look, so we have nothing to
    report about whether the work exists. Collapsing the two would let an outage
    read as evidence against every reference in the reply.
    """
    stub(handler)
    verdicts = await verify([source(), source(title="On what matters")], settings())
    assert [v.state for v in verdicts] == ["unchecked", "unchecked"]
    assert all(v.doi == "" for v in verdicts)


@pytest.mark.asyncio
async def test_one_bad_lookup_does_not_lose_the_others(stub):
    """Verdicts are positional, so a failure in the middle must not shift them."""

    def handler(request):
        if "matters" in str(request.url):
            raise httpx.ConnectError("refused")
        return httpx.Response(200, json={"message": {"items": [item()]}})

    stub(handler)
    verdicts = await verify(
        [source(), source(title="On what matters"), source()], settings()
    )
    assert [v.state for v in verdicts] == ["matched", "unchecked", "matched"]


# ── Configuration and traffic ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_disabled_returns_unchecked_without_calling_out(stub):
    calls = stub(answering(item()))
    verdicts = await verify([source()], settings(crossref_enabled=False))
    assert [v.state for v in verdicts] == ["unchecked"]
    assert calls == [], "a disabled check must make no request at all"


@pytest.mark.asyncio
async def test_repeated_references_are_looked_up_once(stub):
    calls = stub(answering(item()))
    verdicts = await verify([source(), source(), source()], settings())
    assert [v.state for v in verdicts] == ["matched"] * 3
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_a_transient_failure_is_not_cached(stub):
    """Caching an outage would make one bad minute persist for the whole session."""
    attempts = []

    def handler(request):
        attempts.append(request)
        if len(attempts) == 1:
            raise httpx.ConnectError("refused")
        return httpx.Response(200, json={"message": {"items": [item()]}})

    stub(handler)
    assert (await verify([source()], settings()))[0].state == "unchecked"
    assert (await verify([source()], settings()))[0].state == "matched"


@pytest.mark.asyncio
async def test_the_polite_pool_address_is_sent_only_when_configured(stub):
    calls = stub(answering(item()))
    await verify([source()], settings())
    assert "mailto" not in calls[0].headers["user-agent"]

    crossref._cache.clear()
    await verify([source()], settings(crossref_mailto="ops@example.org"))
    assert "mailto:ops@example.org" in calls[1].headers["user-agent"]


@pytest.mark.asyncio
async def test_the_query_is_bibliographic_and_asks_for_two_rows(stub):
    """Both are Crossref's own guidance — the second is what the tie test needs."""
    calls = stub(answering(item()))
    await verify([source()], settings())
    assert calls[0].url.params["rows"] == "2"
    assert "parfit" in calls[0].url.params["query.bibliographic"]


@pytest.mark.asyncio
async def test_an_empty_list_makes_no_request(stub):
    calls = stub(answering(item()))
    assert await verify([], settings()) == []
    assert calls == []
