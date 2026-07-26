"""Propositional validity checker for detected arguments.

Terminology
-----------
Every element in the pool is a **sentence**, referred to by its positive
integer index.  The checker treats each sentence as *unanalyzed* — it cannot
see inside it (what logicians call an atomic proposition).  Sentences are
therefore logically independent: no pool sentence entails another by
structure alone.

What bridges that independence is the **logical form** of an added premise:
its propositional content expressed over the indices of the *other*
sentences, e.g. ``"(3 & 4) -> 7"``.  A logical form is what lets the checker
reason about a premise whose job is to connect sentences — it plays the role
of a Carnapian meaning postulate (Carnap 1952) when the premise's ``role``
is ``"postulate"``, licensing an inference the unanalyzed representation
cannot express on its own.

How logical forms are written
-----------------------------
A form combines sentence indices with four operators, listed here from
tightest-binding to loosest-binding, plus parentheses to override the order:

    ~   not       (a leading "-" also works, matching the -n notation)
    &   and
    |   or
    ->  if-then   (nested conditionals group to the right)

Whitespace is ignored.  Binding order means ``1 & 2 -> 3`` is read as
``(1 & 2) -> 3`` — "if 1 and 2, then 3" — not as ``1 & (2 -> 3)``; and
``1 -> 2 -> 3`` is read as ``1 -> (2 -> 3)``.  Typical bridge premise:
``"(3 & 4) -> 7"``.  (The exact accepted syntax is documented in
``parse_form``.)

Verification applies two distinct filters:

1. **Validity** — the premises must formally entail the conclusion
   (truth-table refutation search).
2. **Informativeness** — circular arguments (conclusion among premises) and
   ex falso arguments (jointly inconsistent premises) are *valid* but
   dialectically inert: they exclude no position a minimally consistent
   agent could hold, so they are rejected as uninformative rather than as
   invalid.  Redundant premises are likewise valid (monotonicity) but weaken
   the argument's dialectical constraint — each extra premise shrinks the
   set of positions the argument excludes — so they are auto-trimmed:
   minimality maximizes an argument's dialectical content.
"""

import re
from dataclasses import dataclass
from itertools import product
from typing import Dict, List, Optional, Tuple

# Logical forms are nested tuples: ("sentence", n) | ("not", f)
# | ("and", f, g) | ("or", f, g) | ("imp", f, g).
LogicalForm = Tuple

# Refuse to enumerate truth assignments beyond this many distinct sentences
# (2^16 rows).
MAX_SENTENCES = 16

_TOKEN_RE = re.compile(r"\s*(->|[()&|~-]|\d+)")


class FormParseError(ValueError):
    """Raised when an added premise's ``form`` string cannot be parsed."""


def parse_form(text: str) -> LogicalForm:
    """Parse a logical-form string into a LogicalForm tuple.

    Implemented as a recursive-descent parser: each nested function below is
    one rule of the grammar, in BNF (each line reads "the thing on the left
    consists of the pattern on the right"; ``?`` = optional, ``*`` = zero or
    more repetitions)::

        form        := implication
        implication := disjunction ("->" implication)?      right-associative
        disjunction := conjunction ("|" conjunction)*
        conjunction := unary ("&" unary)*
        unary       := ("~" | "-") unary | sentence | "(" form ")"
        sentence    := positive integer (the index of a pool sentence)

    The rule names denote precedence *levels*, not required operators: each
    rule passes through to the next when its operator is absent, so a bare
    ``5`` counts as a disjunction, a conjunction, and an implication with
    zero operators.  Putting the tighter level on the left of ``->`` and the
    recursion on the right is what makes ``&``/``|`` bind before ``->`` and
    makes ``->`` group to the right.
    """
    tokens: List[str] = []
    pos = 0
    while pos < len(text):
        m = _TOKEN_RE.match(text, pos)
        if not m:
            if text[pos:].strip():
                raise FormParseError(f"Unexpected character in form: {text[pos:]!r}")
            break
        tokens.append(m.group(1))
        pos = m.end()

    def peek() -> Optional[str]:
        return tokens[0] if tokens else None

    def take(expected: Optional[str] = None) -> str:
        if not tokens:
            raise FormParseError(f"Unexpected end of form: {text!r}")
        tok = tokens.pop(0)
        if expected is not None and tok != expected:
            raise FormParseError(f"Expected {expected!r}, got {tok!r} in {text!r}")
        return tok

    def implication() -> LogicalForm:
        left = disjunction()
        if peek() == "->":
            take()
            return ("imp", left, implication())
        return left

    def disjunction() -> LogicalForm:
        left = conjunction()
        while peek() == "|":
            take()
            left = ("or", left, conjunction())
        return left

    def conjunction() -> LogicalForm:
        left = unary()
        while peek() == "&":
            take()
            left = ("and", left, unary())
        return left

    def unary() -> LogicalForm:
        tok = peek()
        if tok in ("~", "-"):
            take()
            return ("not", unary())
        if tok == "(":
            take()
            inner = implication()
            take(")")
            return inner
        if tok is not None and tok.isdigit():
            take()
            n = int(tok)
            if n <= 0:
                raise FormParseError(f"Sentence index must be positive: {tok}")
            return ("sentence", n)
        raise FormParseError(f"Unexpected token {tok!r} in {text!r}")

    result = implication()
    if tokens:
        raise FormParseError(f"Trailing tokens {tokens!r} in {text!r}")
    return result


def _sentence_indices(f: LogicalForm) -> set:
    """The set of pool-sentence indices occurring in a logical form."""
    if f[0] == "sentence":
        return {f[1]}
    return set().union(*(_sentence_indices(sub) for sub in f[1:]))


def _eval(f: LogicalForm, assignment: Dict[int, bool]) -> bool:
    op = f[0]
    if op == "sentence":
        return assignment[f[1]]
    if op == "not":
        return not _eval(f[1], assignment)
    if op == "and":
        return _eval(f[1], assignment) and _eval(f[2], assignment)
    if op == "or":
        return _eval(f[1], assignment) or _eval(f[2], assignment)
    if op == "imp":
        return (not _eval(f[1], assignment)) or _eval(f[2], assignment)
    raise ValueError(f"Unknown operator {op!r}")


def _satisfiable(forms: List[LogicalForm]) -> bool:
    """True if some truth assignment over the sentences makes every form true."""
    indices = sorted(
        set().union(*(_sentence_indices(f) for f in forms)) if forms else set()
    )
    if len(indices) > MAX_SENTENCES:
        raise FormParseError(
            f"Form too large: {len(indices)} sentences (max {MAX_SENTENCES})"
        )
    for values in product((True, False), repeat=len(indices)):
        assignment = dict(zip(indices, values))
        if all(_eval(f, assignment) for f in forms):
            return True
    return False


def entails(premises: List[LogicalForm], conclusion: LogicalForm) -> bool:
    """True iff the premises formally entail the conclusion (premises ∧ ¬conclusion unsatisfiable)."""
    return not _satisfiable(premises + [("not", conclusion)])


@dataclass
class VerificationResult:
    """Outcome of verifying one numeric argument.

    ``accepted`` means the argument is both formally valid and informative;
    ``argument`` is then the (possibly auto-trimmed) argument, otherwise the
    original input.  ``reason`` is set on rejection and distinguishes genuine
    invalidity from valid-but-uninformative rejections.
    """

    accepted: bool
    argument: List[int]
    reason: Optional[str] = None


def _form_for_index(n: int, parsed_forms: Dict[int, LogicalForm]) -> LogicalForm:
    """Logical form for a signed sentence index.

    An added premise contributes its parsed form; a pool sentence stays an
    unanalyzed sentence reference.  A negative index wraps the result in a
    negation.
    """
    base = parsed_forms.get(abs(n), ("sentence", abs(n)))
    return ("not", base) if n < 0 else base


def verify_argument(
    arg: List[int],
    forms: Dict[int, str],
    trim_priority: Optional[Dict[int, int]] = None,
) -> VerificationResult:
    """Verify one numeric argument for formal validity and informativeness.

    ``forms`` maps added-premise indices to their logical-form strings; pool
    indices absent from ``forms`` are treated as unanalyzed sentences.  Only
    the forms of indices occurring in ``arg`` are parsed, so a malformed form
    cannot reject arguments that do not use it.

    Redundant premises are auto-trimmed rather than causing rejection.  When
    several premises are individually removable, ``trim_priority`` decides
    which is dropped first (lower value = dropped earlier; indices absent
    from the mapping are dropped last).
    """
    if len(arg) < 2:
        return VerificationResult(False, arg, "argument needs at least one premise")

    premises, conclusion = arg[:-1], arg[-1]
    if conclusion in premises:
        return VerificationResult(
            False,
            arg,
            "circular: the conclusion appears among the premises "
            "(valid, but excludes no position — uninformative)",
        )

    try:
        used_indices = {abs(n) for n in arg}
        parsed_forms = {
            i: parse_form(s) for i, s in forms.items() if s and i in used_indices
        }
        for i, f in parsed_forms.items():
            if i in _sentence_indices(f):
                return VerificationResult(
                    False,
                    arg,
                    f"form of premise {i} references its own index — "
                    "a form must state the premise's content in terms of the other sentences",
                )
        premise_forms = [_form_for_index(n, parsed_forms) for n in premises]
        conclusion_form = _form_for_index(conclusion, parsed_forms)

        if not _satisfiable(premise_forms):
            return VerificationResult(
                False,
                arg,
                "ex falso: the premises are jointly inconsistent "
                "(valid, but excludes no minimally consistent position — uninformative)",
            )
        if not entails(premise_forms, conclusion_form):
            return VerificationResult(False, arg, "not formally valid")

        # Auto-trim: drop premises not needed for validity, until minimal.
        # Removal candidates are tried in trim_priority order so that, when
        # premises are interchangeable, the caller controls which survives.
        kept = list(zip(premises, premise_forms))

        def removal_order() -> List[int]:
            def rank(j: int) -> Tuple[int, int]:
                n = kept[j][0]
                priority = trim_priority.get(abs(n), 99) if trim_priority else 99
                return (priority, j)

            return sorted(range(len(kept)), key=rank)

        changed = True
        while changed:
            changed = False
            for i in removal_order():
                rest = [f for j, (_, f) in enumerate(kept) if j != i]
                if rest and entails(rest, conclusion_form):
                    del kept[i]
                    changed = True
                    break
    except FormParseError as e:
        return VerificationResult(False, arg, f"unparseable form: {e}")

    return VerificationResult(True, [n for n, _ in kept] + [conclusion])
