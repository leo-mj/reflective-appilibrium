"""
Helpers shared by the LLM-backed assist routers (judgments, principles,
relations, matrix).

These endpoints all have the same shape: build a prompt, call the model, parse
the reply as JSON, and read named keys off it.  The parsing step is the one that
fails in production — a model can stop mid-object at the output cap, wrap the
reply in prose, or return a top-level array — so it lives here rather than being
re-implemented per router.
"""

import json
import logging
import re
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Provider keys as they appear in error text. OpenAI and Anthropic 401s quote
# the key back — usually partly masked, but the masking is theirs, not ours, and
# it varies by endpoint and by proxy.
_KEY_PATTERN = re.compile(r"\b(sk|pk|api)[-_][A-Za-z0-9\-_]{8,}", re.IGNORECASE)

_MAX_PROVIDER_ERROR = 400


def scrub_provider_error(message: str) -> str:
    """Make a provider's error safe to hand back to the caller.

    The connection-test endpoint reports provider failures verbatim so the
    settings modal can say what actually went wrong rather than "500". That is
    worth keeping, but the raw text is written by a third party and can quote
    the credential it just rejected, so redact anything key-shaped and cap the
    length rather than relaying an arbitrary payload.
    """
    return _KEY_PATTERN.sub("[redacted]", message)[:_MAX_PROVIDER_ERROR]


def parse_json_object(text: str, model: str) -> dict[str, Any]:
    """Parse an LLM reply that is required to be a JSON object.

    Raises 502 rather than letting the error surface as a 500: a malformed reply
    is the upstream model failing us, not the request being wrong, and the
    distinction is what tells a user to retry or raise ``LLM_MAX_TOKENS`` rather
    than to change their input.  ``services.llm._extract_json`` has already
    stripped fences and reasoning blocks by this point, so reaching here means
    the reply was genuinely unusable.

    The dict check is not redundant with the ``json.loads`` guard: a model that
    returns a bare list parses fine and then fails on ``.get`` with an
    ``AttributeError`` several lines later, where the cause is much less obvious.
    """
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error(f"Model '{model}' returned unparseable JSON: {text!r}")
        raise HTTPException(
            status_code=502,
            detail=(
                f"The model ({model}) did not return valid JSON. It may have been "
                "cut off at the output limit — try again, or raise LLM_MAX_TOKENS."
            ),
        ) from exc

    if not isinstance(data, dict):
        logger.error(
            f"Model '{model}' returned a JSON {type(data).__name__}, expected an object."
        )
        raise HTTPException(
            status_code=502,
            detail=(
                f"The model ({model}) returned a JSON {type(data).__name__} where an "
                "object was expected. Try again."
            ),
        )
    return data
