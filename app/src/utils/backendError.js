/**
 * @fileoverview Turns a failed backend response into a sentence a person can act
 * on, and a failed `fetch` into one that names what actually went wrong.
 *
 * Every client in this directory used to throw the same line —
 * `Backend error 429: {"detail":"Rate limit exceeded (5 requests per minute)."}`
 * — straight into a banner. The status code and the JSON envelope are the
 * server's vocabulary, not the reader's, and the one piece of genuinely useful
 * information the server sends with a 429, the `Retry-After` header, was read by
 * nobody at all.
 *
 * **The message stays a string.** No consumer renders differently per status —
 * `ErrorBanner` takes `message` and eight components pass it — so returning a
 * structured error would mean threading a shape through `useSuggestionWorkflow`,
 * `ErrorBanner` and all of them for no gain. The status, retry time and endpoint
 * are attached to the Error as properties instead: one line here, nothing to
 * change downstream, and a future consumer that does want to branch has the data
 * without a refactor.
 *
 * @module utils/backendError
 */

/**
 * FastAPI wraps its messages in `{"detail": ...}`, where the value is a string
 * for a raised HTTPException and an array of per-field objects for a validation
 * failure. Anything else — a proxy's HTML error page, an empty body — comes back
 * as-is.
 *
 * @param {string} raw  The response body.
 * @returns {string} The human-readable part, or "" if there is none.
 */
export function unwrapDetail(raw) {
  if (!raw) return "";
  try {
    const { detail } = JSON.parse(raw);
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // A 422 from request validation. `msg` alone reads as "Field required"
      // with no hint which field, so the location is worth keeping.
      return detail
        .map((d) => {
          const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .filter(Boolean)
        .join("; ");
    }
    if (detail) return JSON.stringify(detail);
    return "";
  } catch {
    // Not JSON. A plain string is worth showing; a proxy's HTML error page is
    // not — pasting `<html>502 Bad Gateway</html>` into a banner is worse than
    // saying nothing and letting the status-based wording stand.
    const text = raw.trim();
    return text.startsWith("<") ? "" : text;
  }
}

/** Whole seconds from a `Retry-After` header, or null if absent or malformed. */
function parseRetryAfter(res) {
  const raw = res.headers?.get?.("Retry-After");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/**
 * The sentence to show for a failed response.
 *
 * @param {number} status
 * @param {string} detail        Already unwrapped.
 * @param {number|null} retryAfter
 * @returns {string}
 */
function messageFor(status, detail, retryAfter) {
  if (status === 429) {
    return retryAfter
      ? `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`
      : "Too many requests. Try again in a moment.";
  }
  // 403 is a server that lends no keys; a 400 naming the header is a request
  // that carried none. Both mean the same thing to the reader, and neither is
  // improved by repeating the server's wording.
  if (status === 403 || (status === 400 && /x-base-url|x-api-key/i.test(detail))) {
    return "No API key configured. Add one in LLM Settings to use this feature.";
  }
  if (status === 401) return "This instance requires an access token.";
  if (status === 404) return detail || "The backend does not have that.";
  if (status >= 500) {
    return detail
      ? `The backend failed: ${detail}`
      : "The backend failed while handling that request.";
  }
  return detail || `The backend refused that request (${status}).`;
}

/**
 * Builds the Error to throw for a response that came back not-ok.
 *
 * Reads the body, so call it once and only on a failed response.
 *
 * @param {Response} res
 * @param {string} [endpoint]  For `err.endpoint`; deliberately not in the text.
 * @returns {Promise<Error>}
 */
export async function backendError(res, endpoint = "") {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    // A body that cannot be read is not worth failing over; the status is
    // enough to say something useful.
  }
  const detail = unwrapDetail(raw);
  const retryAfter = parseRetryAfter(res);
  const err = new Error(messageFor(res.status, detail, retryAfter));
  err.status = res.status;
  err.retryAfter = retryAfter;
  err.endpoint = endpoint;
  err.detail = detail;
  return err;
}

/**
 * Wraps a `fetch` so that a transport failure says what happened.
 *
 * On a public site the likeliest failure is not a 500 but no response at all: a
 * backend asleep on its free tier, a CORS origin that does not match, a DNS name
 * that does not resolve. All three surface as `TypeError: Failed to fetch`,
 * which tells the reader nothing and sends them looking at their own state.
 *
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {string} [endpoint]
 * @returns {Promise<Response>}
 */
export async function fetchBackend(url, init, endpoint = "") {
  try {
    // Called with the same arity the caller used: `fetch(url, undefined)` and
    // `fetch(url)` behave identically in a browser but are distinguishable to a
    // mock, and a GET here should look like a GET to anything watching.
    return init === undefined ? await fetch(url) : await fetch(url, init);
  } catch (cause) {
    const err = new Error(
      "Could not reach the backend. It may be starting up, or unavailable.",
    );
    err.endpoint = endpoint;
    err.cause = cause;
    throw err;
  }
}

/**
 * `fetchBackend` plus the not-ok check, which is what every caller here wants.
 *
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {string} [endpoint]
 * @returns {Promise<Response>} Always ok.
 */
export async function fetchOk(url, init, endpoint = "") {
  const res = await fetchBackend(url, init, endpoint);
  if (!res.ok) throw await backendError(res, endpoint);
  return res;
}
