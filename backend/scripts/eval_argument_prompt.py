"""How many of a model's proposed arguments the checker rejects, and why.

Runs the Arguments tab's detection on a process exported from the app, several
times, through the same prompt, checker and partitioning the router uses, and
tallies each run's proposals by outcome. For judging a change to the prompt by
what it does rather than by how it reads: run it before and after.

    LLM_API_KEY=... python -m backend.scripts.eval_argument_prompt export.md \\
        --base-url https://api.anthropic.com --model <model> --runs 5

``export.md`` is a Markdown export with its Full history (``re-state``) block.
Every run is a paid model call. Nothing is written anywhere; the tally goes to
standard output.

The reasons are read off the pipeline's own log lines, so they are the
reasons it gave, not a second classification that could disagree with it.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from collections import Counter

from ..models.re_state import REState
from ..services.arguments import get_arguments_from_llm, partition_arguments
from ..services.llm import LLMConfig, LLMService

_REJECTED = re.compile(r"^Rejected argument \[[^\]]*\]: (.+)$")
_DROPPED = re.compile(r"^Dropped (\d+) argument")


class _Tally(logging.Handler):
    """Counts the pipeline's rejection reasons as it logs them."""

    def __init__(self) -> None:
        super().__init__(logging.INFO)
        self.reasons: Counter = Counter()

    def emit(self, record: logging.LogRecord) -> None:
        message = record.getMessage()
        if m := _REJECTED.match(message):
            self.reasons[m.group(1).rstrip(".")] += 1
        elif m := _DROPPED.match(message):
            self.reasons["references an undefined index"] += int(m.group(1))


def read_state(path: str) -> REState:
    """The process in an exported Markdown file's re-state block."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.search(r"```re-state\s*\n(.*?)\n```", text, re.DOTALL)
    if not m:
        sys.exit(f"{path} has no re-state block: export it with Full history.")
    return REState.model_validate(json.loads(m.group(1)))


async def run(args: argparse.Namespace) -> None:
    state = read_state(args.export)
    lookup = {i + 1: e for i, e in enumerate(state.elements)}
    llm = LLMService(
        LLMConfig(
            api_key=os.environ.get("LLM_API_KEY", ""),
            base_url=args.base_url,
            model=args.model,
            max_tokens=args.max_tokens,
        )
    )
    tally = _Tally()
    logger = logging.getLogger("backend.services.arguments")
    logger.addHandler(tally)
    logger.setLevel(logging.INFO)

    proposed = kept = 0
    for i in range(args.runs):
        response = await get_arguments_from_llm(
            lookup, llm, state.relations, state.topic
        )
        survivors, _, _, rejected = partition_arguments(
            response.detected_arguments,
            response.added_premises,
            verify=True,
            pool_indices=lookup.keys(),
            pool_texts={n: e.text for n, e in lookup.items()},
        )
        n = len(response.detected_arguments)
        proposed += n
        kept += len(survivors)
        print(
            f"run {i + 1}: {n} proposed, {len(survivors)} kept, {rejected} rejected "
            f"({response.input_tokens} in / {response.output_tokens} out tokens)"
        )

    print(f"\n{args.runs} runs: {proposed} proposed, {kept} kept", end="")
    print(f" ({kept / proposed:.0%})" if proposed else "")
    for reason, count in tally.reasons.most_common():
        print(f"  {count:4}  {reason}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("export", help="Markdown export with its re-state block")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--max-tokens", type=int, default=8192)
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
