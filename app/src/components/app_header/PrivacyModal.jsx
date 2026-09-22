/**
 * @fileoverview What leaves the browser, where it goes, and what is kept.
 *
 * A reader's RE process is their moral reasoning, and on a hosted instance it
 * passes through a server run by someone they do not know, and on to an LLM
 * provider. That deserves plainer words than a developer comment, and it is a
 * separate matter from the AI Act notice on suggestion cards, which says who
 * wrote a suggestion rather than where the reader's own words went.
 *
 * Every sentence here has to be true of the build and server the reader is
 * actually using, so the wording follows what can be known: whether this build
 * has a backend at all, and — from the health check — whether that backend is
 * answering. Where the check has not answered, it says so rather than guessing
 * in the reassuring direction.
 *
 * "Nothing on disk" is unconditional because the server has no route that
 * writes one: session storage was removed rather than switched off. If
 * anything on the server ever does persist, this is the sentence that has to
 * change first.
 *
 * Kept in step with the backend by hand. If a claim below stops being true —
 * a new log line with content, a new third party, a longer retention — this is
 * the place to change, and backend/tests/test_log_privacy.py is what pins the
 * logging one.
 *
 * @module components/app_header/PrivacyModal
 */

import { C } from "../../constants/colors.js";
import { BACKEND_ENABLED } from "../../config.js";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities.js";
import { btn } from "./appHeaderStyles.js";

const BROWSER =
  "Your work is autosaved in this browser, so a closed tab can be resumed. On a shared computer, discard it from the start screen when you are done.";

/**
 * @param {{ backend: boolean, capabilities: import("../../hooks/useBackendCapabilities.js").BackendCapabilities }} args
 * @returns {Array<{ heading: string, text: string }>}
 */
function privacySections({ backend, capabilities }) {
  if (!backend) {
    return [
      {
        heading: "Nothing leaves this browser",
        text: "This build has no server and makes no AI requests. What you enter stays on this device.",
      },
      { heading: "In this browser", text: BROWSER },
    ];
  }

  let kept;
  if (!capabilities.loaded) {
    kept = "Checking what this server keeps…";
  } else if (!capabilities.reachable) {
    kept = "The server could not be reached, so what it keeps could not be checked.";
  } else {
    kept =
      "Nothing on disk. " +
      "A discussion is not kept either: this page sends it whole with each question. " +
      "Where rate limits are on, the address or access token you connect from is counted for a minute. " +
      "Its logs record counts, ids and model names, never what you wrote. " +
      "The service hosting it may keep its own connection logs.";
  }

  return [
    {
      heading: "Your API key",
      // Not "forgotten when the tab closes": browsers restore sessionStorage
      // with a reopened tab or a restored session, and copy it into a
      // duplicated one. On a shared computer that is the difference that
      // matters, so the text says what to do about it.
      text: "Kept in this browser tab rather than saved permanently. Closing the tab usually forgets it, but reopening a closed tab or restoring a browser session can bring it back — on a shared computer, press Clear in LLM settings when you are done. It is sent to this app's server with each AI request and passed straight on to the provider you chose. The server does not store it or log it. Use a key with a spending limit, which your provider lets you set, and revoke it if you think it has leaked.",
    },
    {
      heading: "Your reasoning",
      text: "When you ask for a suggestion, a review or a discussion, the parts of your process that request needs — topic, elements, relations, history — go to the server and on to your provider inside the prompt, under that provider's own terms. Scores and simulations are computed on the server and go nowhere else.",
    },
    {
      heading: "References",
      text: "Checking the references of a suggested background theory sends their bibliographic details — title, authors, year — to Crossref. Nothing else from your process goes with them.",
    },
    { heading: "What the server keeps", text: kept },
    { heading: "In this browser", text: BROWSER },
  ];
}

/** @param {{ open: boolean, onClose: () => void }} props */
export function PrivacyModal({ open, onClose }) {
  const capabilities = useBackendCapabilities();
  if (!open) return null;

  const sections = privacySections({ backend: BACKEND_ENABLED, capabilities });

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 199 }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="privacy-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 200,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100svh - 32px)",
          overflowY: "auto",
          boxSizing: "border-box",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <h2
          id="privacy-title"
          style={{
            fontWeight: "bold",
            margin: "0 0 12px",
            color: C.text,
            fontSize: 14,
          }}
        >
          Where your data goes
        </h2>
        {sections.map(({ heading, text }) => (
          <section key={heading} style={{ marginBottom: 12 }}>
            <h3
              style={{
                margin: "0 0 3px",
                fontSize: 12,
                fontWeight: "bold",
                color: C.text,
              }}
            >
              {heading}
            </h3>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: C.dim }}>
              {text}
            </p>
          </section>
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={onClose} style={{ ...btn(false), color: C.dim }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
