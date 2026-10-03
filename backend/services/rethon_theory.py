"""RE processes whose theory is built from principles and background theories only.

In rethon's standard model a theory is any consistent position over the
sentence pool, so a simulation was free to take judgments — or the negation of
anything — into its theory. The app types its elements, and the type is the
user's statement of which elements are general rules: the scoring in
``rethon_scoring`` already evaluates the active principles and background
theories as the theory. These subclasses hold the simulation to the same
vocabulary, so "account" and "systematicity" mean one thing on the Simulate
tab, in History's per-step scores and on the text cards.

A theory may contain only **unnegated** principle and theory sentences — as the
scoring's theory position does. Withdrawing a principle is not asserting its
negation, and a theory asserting ``¬P3`` has no reading in the app.

**The first theory is the one the user holds** — the active and revised
principles and theories, which is exactly the theory the scoring evaluates.
rethon's model instead chooses a first theory for the initial commitments (the
best near the empty position, locally; the best anywhere, globally). Seeding it
continues the user's process rather than restarting its theory: the
commitments are already carried over as they stand now, so a fresh theory was
the one part of the simulation that ignored where the user had got to. Where
the arguments make the held theory inconsistent — a position with open
conflicts, which is most positions worth simulating — the start is **the
largest consistent part of it**, taking the most confident principles first.
Falling back to rethon's own start instead, as it first did, began the demo
from a single principle and withdrew most of the position. Only where nothing
is held does the start fall back to rethon's choice, restricted as everything
else is.

**Ties are broken reproducibly.** rethon picks at random among equally good
candidates, so the same request gave a different result each run — which
elements an equilibrium withdrew changed between presses. These processes pick
with a generator seeded from the request's own inputs, so a position, its
arguments and the settings always give the same result.

Every other part of the model is rethon's own: commitments still range over the
whole pool, the achievement function and the stopping rule are untouched.

``theory_sentences=None`` in :func:`make_re` keeps rethon's unrestricted,
unseeded model, which is what published rethon simulations use; the routes
never pass it.
"""

import hashlib
import random
from typing import FrozenSet, Iterable, Optional, Set, Tuple

from . import rethon_import  # noqa: F401 — must precede rethon; see that module
from theodias import DialecticalStructure, Position, StandardPosition
from rethon import (
    StandardGlobalReflectiveEquilibrium,
    StandardLocalReflectiveEquilibrium,
)

from ..models.re_state import REElement
from .rethon_tasks import (  # noqa: F401 — moved there; re-exported for callers here
    THEORY_TYPES,
    held_theory,
    theory_sentences,
)


def _position_key(position: Position) -> Tuple[int, ...]:
    """A candidate's place in a fixed order, so a seeded pick is the same pick."""
    return tuple(sorted(position.as_set()))


class _TheoryRestriction:
    """What the two restricted processes share: which positions may be a
    theory, which one the process starts from, and how ties are broken."""

    _theory_sentences: FrozenSet[int] = frozenset()
    _held_theory: Tuple[int, ...] = ()
    _rng: random.Random = random.Random(0)

    def _restrict(
        self,
        theory_sentences: Iterable[int],
        held_theory: Iterable[int],
        initial_commitments: Position,
    ) -> None:
        self._theory_sentences = frozenset(theory_sentences)
        self._held_theory = tuple(held_theory)
        # Seeded by what the process is given, not by the clock: the same
        # position and theory always break their ties the same way.
        digest = hashlib.sha256(
            repr(
                (
                    sorted(initial_commitments.as_set()),
                    sorted(self._theory_sentences),
                    self._held_theory,
                )
            ).encode()
        ).hexdigest()
        self._rng = random.Random(int(digest[:16], 16))

    def may_be_theory(self, position: Position) -> bool:
        # Negated sentences appear as negative indices, so they fail this too.
        return position.as_set() <= self._theory_sentences

    def seeded_theory(self) -> Optional[Position]:
        """The first theory: the held theory where the arguments allow holding
        it all, its largest consistent part otherwise — principles taken most
        confident first, each kept if it is consistent with those kept before.
        None where nothing is held, or nothing held is consistent."""
        ds = self.dialectical_structure()
        n = ds.sentence_pool().size()
        held = [i for i in self._held_theory if i in self._theory_sentences]
        if not held:
            return None
        whole = StandardPosition.from_set(set(held), n)
        if ds.is_consistent(whole):
            return whole
        kept: Set[int] = set()
        for index in held:
            if ds.is_consistent(StandardPosition.from_set(kept | {index}, n)):
                kept.add(index)
        return StandardPosition.from_set(kept, n) if kept else None

    def pick_theory_candidate(self, theory_candidates, **kwargs) -> Position:
        """As rethon's, but reproducible: a seeded pick among equals."""
        return self._pick(theory_candidates)

    def pick_commitment_candidate(self, commitments_candidates, **kwargs) -> Position:
        """As rethon's, but reproducible: a seeded pick among equals."""
        return self._pick(commitments_candidates)

    def _pick(self, candidates) -> Position:
        if len(candidates) == 1:
            return next(iter(candidates))
        return self._rng.choice(sorted(candidates, key=_position_key))


class TheoryRestrictedLocalRE(_TheoryRestriction, StandardLocalReflectiveEquilibrium):
    """Local search, with every theory candidate a set of principles and theories.

    rethon's local model takes its candidates from the neighbourhood of the
    current theory (and the first from that of the empty position), keeping
    those of greatest achievement. Both are reimplemented here with the filter
    applied *before* the maximum is taken: filtering rethon's own result would
    leave nothing wherever a judgment scored best.
    """

    def __init__(
        self,
        dialectical_structure: DialecticalStructure,
        initial_commitments: Position,
        theory_sentences: Iterable[int],
        held_theory: Iterable[int] = (),
    ):
        self._restrict(theory_sentences, held_theory, initial_commitments)
        super().__init__(
            dialectical_structure=dialectical_structure,
            initial_commitments=initial_commitments,
            model_name="TheoryRestrictedLocalRE",
        )

    def _best_theories(self, candidates, achievement) -> Set[Position]:
        best: Set[Position] = set()
        max_achievement = 0
        for theory in candidates:
            if not self.may_be_theory(theory):
                continue
            if not self.dialectical_structure().is_consistent(theory):
                continue
            value = achievement(theory)
            if value > max_achievement:
                best, max_achievement = {theory}, value
            elif value == max_achievement:
                best.add(theory)
        return best

    def first_theory(self) -> Position:
        """The held theory; failing that, as rethon's: the best theory near the
        empty position."""
        seed = self.seeded_theory()
        if seed is not None:
            return seed
        initial = self.state().initial_commitments()
        empty = StandardPosition.from_set(
            set(), self.dialectical_structure().sentence_pool().size()
        )
        candidates = self._best_theories(
            empty.neighbours(self.model_parameter("neighbourhood_depth")),
            lambda t: self.achievement(initial, t, initial),
        )
        return self.pick_theory_candidate(candidates)

    def theory_candidates(self, **kwargs) -> Set[Position]:
        """As rethon's: the best theories near the current one, which is kept
        if it is among them."""
        if len(self.state()) <= 1:
            return {self.first_theory()}
        weights = self.model_parameter("weights")
        commitments = self.state().last_commitments()
        last = self.state().last_theory()
        # Faithfulness is fixed while the theory moves, so it is left out, as
        # rethon leaves it out.
        candidates = self._best_theories(
            last.neighbours(self.model_parameter("neighbourhood_depth")),
            lambda t: weights["systematicity"] * self.systematicity(t)
            + weights["account"] * self.account(commitments, t),
        )
        if last in candidates:
            return {last}
        return candidates


class TheoryRestrictedGlobalRE(_TheoryRestriction, StandardGlobalReflectiveEquilibrium):
    """Global search over the positions made of principles and theories.

    rethon's global model groups every consistent position by systematicity in
    ``update`` and searches the groups for theories. The groups are private to
    rethon's class, so they are filtered here by their mangled name; the test
    of this class is what notices if rethon renames them. The app itself
    always asks for local search.
    """

    _GROUPS = "_GlobalReflectiveEquilibrium__systematicity_groups"

    def __init__(
        self,
        dialectical_structure: DialecticalStructure,
        initial_commitments: Position,
        theory_sentences: Iterable[int],
        held_theory: Iterable[int] = (),
    ):
        self._restrict(theory_sentences, held_theory, initial_commitments)
        super().__init__(
            dialectical_structure=dialectical_structure,
            initial_commitments=initial_commitments,
            model_name="TheoryRestrictedGlobalRE",
        )

    def theory_candidates(self, **kwargs) -> Set[Position]:
        """The held theory first, as the local process starts; rethon's global
        search from the second theory on. rethon's global model has no first
        theory of its own — its first step is the same search as every other."""
        if len(self.state()) <= 1:
            seed = self.seeded_theory()
            if seed is not None:
                return {seed}
        return super().theory_candidates(**kwargs)

    def update(self, **kwargs):
        rebuilt = self.is_dirty()
        super().update(**kwargs)
        if not rebuilt:
            return
        groups = getattr(self, self._GROUPS)
        filtered = {
            systematicity: {t for t in theories if self.may_be_theory(t)}
            for systematicity, theories in groups.items()
        }
        setattr(self, self._GROUPS, {s: ts for s, ts in filtered.items() if ts})


def make_re(
    dialectical_structure: DialecticalStructure,
    initial_commitments: Position,
    local: bool,
    theory_sentences: Optional[Iterable[int]],
    held_theory: Iterable[int] = (),
):
    """The RE process every simulation path builds: restricted to the given
    theory sentences and starting from ``held_theory``, or rethon's standard
    model — unrestricted and unseeded — when ``theory_sentences`` is ``None``."""
    if theory_sentences is None:
        cls = (
            StandardLocalReflectiveEquilibrium
            if local
            else StandardGlobalReflectiveEquilibrium
        )
        return cls(
            dialectical_structure=dialectical_structure,
            initial_commitments=initial_commitments,
        )
    cls = TheoryRestrictedLocalRE if local else TheoryRestrictedGlobalRE
    return cls(
        dialectical_structure=dialectical_structure,
        initial_commitments=initial_commitments,
        theory_sentences=theory_sentences,
        held_theory=held_theory,
    )
