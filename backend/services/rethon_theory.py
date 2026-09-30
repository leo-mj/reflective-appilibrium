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
the held theory is not a theory rethon can take — empty, or made inconsistent
by the arguments — the start falls back to rethon's own choice, restricted as
everything else is.

Every other part of the model is rethon's own: commitments still range over the
whole pool, the achievement function and the stopping rule are untouched.

``theory_sentences=None`` in :func:`make_re` keeps rethon's unrestricted,
unseeded model, which is what published rethon simulations use; the routes
never pass it.
"""

from typing import FrozenSet, Iterable, Optional, Set

from theodias import DialecticalStructure, Position, StandardPosition
from rethon import (
    StandardGlobalReflectiveEquilibrium,
    StandardLocalReflectiveEquilibrium,
)

from ..models.re_state import REElement

THEORY_TYPES = ("principle", "theory")


def theory_sentences(lookup: dict) -> FrozenSet[int]:
    """Indices of the pool's principles and background theories, whatever their
    status: like the commitments, the theory may take up an element the reader
    has set aside. ``lookup`` maps positive indices to elements; negated keys,
    where present, are ignored."""
    return frozenset(
        index
        for index, el in lookup.items()
        if index > 0 and isinstance(el, REElement) and el.type in THEORY_TYPES
    )


def held_theory(lookup: dict) -> FrozenSet[int]:
    """Indices of the principles and background theories the user holds now —
    active or revised — which is the theory position the scoring evaluates
    (``_build_type_positions`` in ``rethon_scoring``) and the simulation's
    first theory."""
    return frozenset(
        index
        for index in theory_sentences(lookup)
        if lookup[index].status in ("active", "revised")
    )


class _TheoryRestriction:
    """What the two restricted processes share: which positions may be a
    theory, and which one the process starts from."""

    _theory_sentences: FrozenSet[int] = frozenset()
    _held_theory: FrozenSet[int] = frozenset()

    def may_be_theory(self, position: Position) -> bool:
        # Negated sentences appear as negative indices, so they fail this too.
        return position.as_set() <= self._theory_sentences

    def seeded_theory(self) -> Optional[Position]:
        """The held theory as the first theory, or None where rethon cannot
        take it: nothing held, or held principles the arguments make
        inconsistent together."""
        if not self._held_theory:
            return None
        seed = StandardPosition.from_set(
            set(self._held_theory),
            self.dialectical_structure().sentence_pool().size(),
        )
        if self.may_be_theory(seed) and self.dialectical_structure().is_consistent(
            seed
        ):
            return seed
        return None


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
        self._theory_sentences = frozenset(theory_sentences)
        self._held_theory = frozenset(held_theory)
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
        self._theory_sentences = frozenset(theory_sentences)
        self._held_theory = frozenset(held_theory)
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
