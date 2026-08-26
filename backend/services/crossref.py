"""
Reference checking against Crossref's public REST API.

A model that proposes background theories also proposes the works they are
developed in, and a fabricated reference is the characteristic failure: models
are reliably good at bibliographic *form* and unreliably good at whether a work
exists, so a well-formatted invention reads as more authoritative than a sloppy
real one. This module is what turns a blanket warning into a measured one.

Three properties matter, and each is a decision rather than an implementation
detail:

* **It never raises.** Verification is enrichment on top of a suggestion, not a
  precondition for one. A Crossref outage must leave the user with suggestions
  marked "not checked", never with an error where their suggestions should be.
* **"Not found" is not "fabricated".** Crossref's coverage of philosophy
  monographs is patchy — a 1971 book may simply not be indexed — so the three
  states are kept distinct and the wording of the negative one is deliberately
  flat. See ``Verdict``.
* **The relevance score is not thresholded.** See ``_confirms``.
"""

from __future__ import annotations

import asyncio
import logging
import re
import unicodedata
from typing import Any, Literal, NamedTuple, Optional

import httpx

from ..config import Settings
from ..models.re_state import RESource

logger = logging.getLogger(__name__)

VerificationState = Literal["matched", "not_found", "unchecked"]


class Verdict(NamedTuple):
    """What the check concluded about one reference.

    ``state`` distinguishes three outcomes that must never be collapsed into two:

    * ``matched``    — a record was found and confirmed; ``doi`` is Crossref's.
    * ``not_found``  — the check ran and nothing confirmed it. **Not** a claim
      that the work is invented; Crossref does not index everything, least of
      all older philosophy books.
    * ``unchecked``  — the check could not run: disabled, unreachable, timed
      out. "We could not look" is a different thing from "we looked and found
      nothing", and a UI that shows them the same way is lying about one of them.
    """

    state: VerificationState
    doi: str = ""


UNCHECKED = Verdict("unchecked")

# Crossref rate-limits per IP. Suggestions arrive in small batches, so a modest
# cap keeps a single run well inside any published limit without bookkeeping.
_MAX_CONCURRENT = 4

# Bounded so a long session cannot grow it without limit. Keyed on the normalised
# query, so asking a tab to re-run — the common case — costs no requests at all.
_CACHE_MAX = 512
_cache: dict[str, Verdict] = {}


# ── Normalisation ─────────────────────────────────────────────────────────────


def _fold(text: str) -> str:
    """Lowercase, strip diacritics and punctuation, collapse whitespace.

    Comparing "Sur l'éthique" to "Sur l ethique" as strings fails on nothing that
    matters. Decomposing first (NFKD) then dropping combining marks handles the
    accent; everything non-alphanumeric becomes a space so hyphenation and
    subtitle punctuation cannot decide a match.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", stripped.lower()).strip()


def _tokens(text: str) -> set[str]:
    return set(_fold(text).split())


def _surname(author: str) -> str:
    """The family name from an APA-style "Surname, X. Y." string.

    Falls back to the last whitespace-separated word when there is no comma, so a
    model that returns "Derek Parfit" is still checkable rather than silently
    unmatchable.
    """
    head = author.split(",")[0] if "," in author else author.split(" ")[-1]
    return _fold(head)


def _query_for(source: RESource) -> str:
    """The bibliographic query string, in Crossref's preferred free-text form.

    Crossref's own guidance is that ``query.bibliographic`` on a plain
    author/year/title string ranks the best match first — better than assembling
    field-specific queries, which is what one reaches for first and which matches
    worse.
    """
    parts = [*source.authors[:3], source.year, source.title, source.container]
    return " ".join(p for p in parts if p).strip()


# ── Matching ──────────────────────────────────────────────────────────────────


def _titles_agree(ours: str, theirs: str) -> bool:
    """Whether a returned title is the one we asked for.

    Containment rather than symmetric similarity: Crossref records routinely
    carry a subtitle the citing reference omits, so *our* tokens appearing in
    *theirs* is the relation that actually holds for a correct match, and a
    Jaccard score would punish it.

    Titles of one or two words are required to match exactly. "Justice" as a
    containment test would accept a large fraction of the corpus, which is how a
    check like this comes to confirm everything it is shown.
    """
    mine, other = _tokens(ours), _tokens(theirs)
    if not mine or not other:
        return False
    if len(mine) <= 2:
        return mine == other
    return len(mine & other) / len(mine) >= 0.8


def _years_agree(ours: str, item: dict[str, Any]) -> bool:
    """Year within one.

    A reference's year and the year Crossref records legitimately differ by one:
    online-first publication, an issue dated to the following year, a reprint.
    Requiring equality would reject correct references; allowing more would stop
    the year discriminating at all.

    A reference with a non-numeric year ("n.d.", "in press") cannot be checked on
    this axis, so the test abstains rather than failing it.
    """
    if not ours.strip().isdigit():
        return True
    parts = (item.get("issued") or {}).get("date-parts") or [[]]
    if not parts[0]:
        return False
    return abs(int(parts[0][0]) - int(ours.strip())) <= 1


def _authors_agree(source: RESource, item: dict[str, Any]) -> bool:
    """Whether the first author's surname appears among the record's authors.

    Only the first: middle authors drop out of references, orderings differ, and
    a record with no author list at all (some book records) should not be
    confirmed on title alone.
    """
    if not source.authors:
        return False
    wanted = _surname(source.authors[0])
    if not wanted:
        return False
    theirs = item.get("author") or []
    return any(_fold(a.get("family", "")) == wanted for a in theirs)


def _confirms(source: RESource, items: list[dict[str, Any]]) -> Verdict:
    """Decide a verdict from the top two Crossref results.

    **The relevance score is not thresholded.** It is an unnormalised Lucene
    score that is not comparable between queries; published acceptance thresholds
    for it range from about 26 to about 35 depending on the corpus and the
    quality of the metadata, and a constant tuned on someone else's data would
    not survive a philosophy bibliography. The score is used for exactly one
    thing, which is what Crossref advises it be used for: if the top two results
    score the same, the match is inconclusive and is not taken.

    Confirmation is otherwise ours, and deterministic: the title must be the one
    we asked for, the first author's surname must be present, and the year must
    be within one. Each is a sentence a reader can check; a score threshold is a
    number nobody can defend.
    """
    if not items:
        return Verdict("not_found")

    if len(items) > 1:
        top, second = items[0].get("score"), items[1].get("score")
        if top is not None and top == second:
            logger.info(
                f"Crossref match inconclusive for {source.title!r}: "
                f"top two results tie at score {top}."
            )
            return Verdict("not_found")

    best = items[0]
    title = " ".join(best.get("title") or [])
    if (
        _titles_agree(source.title, title)
        and _authors_agree(source, best)
        and _years_agree(source.year, best)
    ):
        return Verdict("matched", str(best.get("DOI", "")))
    return Verdict("not_found")


# ── The call ──────────────────────────────────────────────────────────────────


def _headers(settings: Settings) -> dict[str, str]:
    """Identify the client, and join the polite pool when configured.

    The mailto is the operator's, from ``.env``. Nothing here reaches for the
    address of whoever happens to be using the app.
    """
    agent = "ReflectiveAppilibrium"
    if settings.crossref_mailto:
        agent += f" (mailto:{settings.crossref_mailto})"
    return {"User-Agent": agent}


async def _lookup(
    client: httpx.AsyncClient, source: RESource, settings: Settings
) -> Verdict:
    query = _fold(_query_for(source))
    if not query:
        return Verdict("not_found")
    if query in _cache:
        return _cache[query]

    try:
        response = await client.get(
            settings.crossref_base_url,
            params={"query.bibliographic": query, "rows": 2},
            headers=_headers(settings),
        )
        response.raise_for_status()
        body = response.json()
        # A search response always carries message.items, empty when nothing
        # matched. Its absence means we did not get an answer to the question we
        # asked — a service malfunction or a changed contract — and that is
        # "unchecked", not "nothing found". Reading it as the latter would let a
        # broken upstream read as evidence against every reference in the reply.
        if "items" not in (body.get("message") or {}):
            logger.warning(
                f"Crossref returned an unrecognised response shape for {source.title!r}."
            )
            return UNCHECKED
        verdict = _confirms(source, body["message"]["items"] or [])
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        # Deliberately broad on the parsing side too: a third party changing its
        # response shape is a reason to say "not checked", never a reason to fail
        # the suggestion request this is decorating.
        logger.warning(f"Crossref check failed for {source.title!r}: {exc!r}")
        return UNCHECKED

    if len(_cache) < _CACHE_MAX:
        _cache[query] = verdict
    return verdict


async def verify(sources: list[RESource], settings: Settings) -> list[Verdict]:
    """Check each reference against Crossref, one verdict per source, in order.

    Never raises. Returns all-``unchecked`` when the check is disabled or the
    service cannot be reached, so a caller can render the result without
    handling failure as a separate case.
    """
    if not sources:
        return []
    if not settings.crossref_enabled:
        return [UNCHECKED] * len(sources)

    limit = asyncio.Semaphore(_MAX_CONCURRENT)
    timeout = httpx.Timeout(settings.crossref_timeout_seconds, connect=3.0)

    async def one(client: httpx.AsyncClient, source: RESource) -> Verdict:
        async with limit:
            return await _lookup(client, source, settings)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            verdicts = await asyncio.gather(
                *(one(client, s) for s in sources), return_exceptions=True
            )
    except Exception as exc:  # pragma: no cover - client construction only
        logger.warning(f"Crossref unavailable: {exc!r}")
        return [UNCHECKED] * len(sources)

    # gather(return_exceptions=True) keeps one failing lookup from losing the
    # verdicts of the others, which matters because they are positional.
    out: list[Verdict] = []
    for verdict in verdicts:
        if isinstance(verdict, BaseException):
            logger.warning(f"Crossref lookup raised: {verdict!r}")
            out.append(UNCHECKED)
        else:
            out.append(verdict)

    matched = sum(1 for v in out if v.state == "matched")
    logger.info(f"Crossref: {matched}/{len(out)} references confirmed.")
    return out
