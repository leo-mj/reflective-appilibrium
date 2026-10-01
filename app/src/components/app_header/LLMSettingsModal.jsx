/**
 * @fileoverview BYOK settings modal — lets the user supply their own API key,
 * provider, and model. Values are stored in sessionStorage only (cleared on
 * tab close, but restored with a reopened tab or session) and sent as request headers; the backend never persists them.
 * The modal says so to the reader beside the key field, and PrivacyModal says
 * the rest of what leaves the browser.
 * @module components/app_header/LLMSettingsModal
 */

import { useState, useEffect, useId } from "react";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import {
  LLM_PROVIDERS,
  offeredProviders,
} from "../../constants/llmProviders.js";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities.js";
import { BYOK_ENABLED, BACKEND_URL } from "../../config.js";
import { btn } from "./appHeaderStyles.js";
import {
  getSessionUsage,
  clearSessionUsage,
} from "../../utils/openaiClient.js";
import {
  readLLMSettings,
  useHasLLMKey,
  notifyLLMKeyChanged,
} from "../../utils/llmKey.js";
import { unwrapDetail } from "../../utils/backendError.js";
import { useDialog } from "../../hooks/useDialog.js";

/** Why the inert controls are inert, for hover and assistive technology. */
const DEMO_REASON = "Unavailable in the demo — this build has no backend.";

function getInitialProvider() {
  const saved = readLLMSettings();
  if (saved) {
    return (
      LLM_PROVIDERS.find((p) => p.baseUrl === saved.baseUrl) ?? LLM_PROVIDERS[0]
    );
  }
  const defaultId = import.meta.env.VITE_DEFAULT_PROVIDER;
  return LLM_PROVIDERS.find((p) => p.id === defaultId) ?? LLM_PROVIDERS[0];
}

/**
 * The model last saved for `provider`, else the build's default where it is
 * this provider's, else none: the app does not pick a model for a key it does
 * not pay for. See {@link module:constants/llmProviders}.
 */
function getInitialModel(provider) {
  const saved = readLLMSettings();
  if (saved?.baseUrl === provider.baseUrl && saved.model) return saved.model;
  const env = import.meta.env;
  const forThisProvider =
    !env.VITE_DEFAULT_PROVIDER || env.VITE_DEFAULT_PROVIDER === provider.id;
  return (forThisProvider && env.VITE_DEFAULT_MODEL) || "";
}

/** The key this tab holds for `provider`, if the last save was for it. */
function savedKeyFor(provider) {
  const saved = readLLMSettings();
  return saved?.baseUrl === provider.baseUrl ? (saved.apiKey ?? "") : "";
}

/**
 * Asks the provider, through the backend, which models `key` can use.
 *
 * @returns {Promise<{ ok: true, models: string[] } | { ok: false, message: string }>}
 */
async function requestModels(provider, key) {
  const headers = { "x-base-url": provider.baseUrl };
  if (key) headers["x-api-key"] = key;
  try {
    const res = await fetch(`${BACKEND_URL}/api/llm/models`, { headers });
    if (res.ok) return { ok: true, models: (await res.json()).models ?? [] };
    // The provider's own words, as for the connection test below.
    return { ok: false, message: unwrapDetail(await res.text()) || `Error ${res.status}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * @param {{ open: boolean, onClose: () => void, returnFocusTo?: { current: HTMLElement|null } }} props
 */
/** Added to a failed test that was not the key being refused. */
const NOT_A_CHAT_MODEL =
  "If the key is right, this model may not be one that chats: the list shows everything the key can use, embeddings and image models included. Try another.";

export function LLMSettingsModal({ open, onClose, returnFocusTo }) {
  // The demo build has no backend to relay a key to, but the modal is still
  // shown so visitors can see what configuring a provider involves. Everything
  // that would reach the network, or bank a key for a request that cannot be
  // made, is inert.
  const demo = !BYOK_ENABLED;
  const [provider, setProvider] = useState(getInitialProvider);
  const [model, setModel] = useState(() =>
    getInitialModel(getInitialProvider()),
  );
  const [apiKey, setApiKey] = useState("");
  // null | { ok: boolean, message: string, note?: boolean } — a note is
  // neither success nor failure: the key works, but there is no model yet.
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [serverKeyUrls, setServerKeyUrls] = useState(new Set());
  const [usage, setUsage] = useState({ input: 0, output: 0 });
  // Tagged with the provider asked, so a list that arrives after the reader
  // has moved to another provider is not offered under it.
  const [listed, setListed] = useState({ baseUrl: null, models: [] });
  const models = listed.baseUrl === provider.baseUrl ? listed.models : [];
  const titleId = useId();
  const { dialogProps } = useDialog({ open, onClose, returnFocusTo });

  // Only what this backend will relay to: a hosted one refuses Ollama, whose
  // "localhost" would be the server. A saved or default choice it refuses gives
  // way to the first it accepts, adjusted during render as the add bar's presets
  // are, so the form never shows a provider the list does not.
  const { deployment } = useBackendCapabilities();
  const providers = offeredProviders(deployment);
  if (!providers.includes(provider)) {
    setProvider(providers[0]);
    setModel(getInitialModel(providers[0]));
    setTestStatus(null);
  }

  useEffect(() => {
    if (!open) return;
    setUsage(getSessionUsage());
    if (demo) return;
    fetch(`${BACKEND_URL}/api/llm/configured-providers`)
      .then((r) => r.json())
      .then((data) => setServerKeyUrls(new Set(data.base_urls)))
      .catch(() => {});
  }, [open, demo]);

  // With a key already saved for this provider, the list can be had without
  // asking the reader to test first. Otherwise Test connection fetches it.
  useEffect(() => {
    const key = savedKeyFor(provider);
    if (!open || demo || !key) return;
    requestModels(provider, key).then((r) => {
      if (r.ok) setListed({ baseUrl: provider.baseUrl, models: r.models });
    });
  }, [open, demo, provider]);

  // Subscribed rather than read once: Clear writes and closes, and the "· Key
  // saved" line beside the field has to have moved by the time it reopens.
  const hasSessionKey = useHasLLMKey();
  const hasSavedKey = hasSessionKey || serverKeyUrls.has(provider.baseUrl);

  // The saved key counts when the field is left empty: changing only the model
  // used to save an empty key over it.
  const effectiveApiKey =
    apiKey || savedKeyFor(provider) || provider.defaultApiKey || "";
  // Save is enabled if: last test succeeded OR a key is already saved (model-only change)
  const saveEnabled = testStatus?.ok || (hasSavedKey && testStatus === null);
  const canSave = saveEnabled && !demo && model.trim() !== "";

  function handleProviderChange(e) {
    const next = providers.find((p) => p.id === e.target.value);
    setProvider(next);
    setModel(getInitialModel(next));
    setTestStatus(null);
  }

  function handleModelChange(e) {
    setModel(e.target.value);
    setTestStatus(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestStatus(null);
    // The listing needs only the key, so it is also the test of the key when
    // no model has been chosen yet — which, with no default, is the first visit.
    const listing = await requestModels(provider, effectiveApiKey);
    if (listing.ok)
      setListed({ baseUrl: provider.baseUrl, models: listing.models });
    if (!model.trim()) {
      setTestStatus(
        listing.ok
          ? {
              ok: false,
              note: true,
              message: `Key accepted. Choose one of the ${listing.models.length} models this key can use, then test again.`,
            }
          : { ok: false, message: listing.message },
      );
      setTesting(false);
      return;
    }
    // With a model, the completion below is the test; a provider that lists no
    // models can still pass it.
    try {
      const headers = { "x-model": model, "x-base-url": provider.baseUrl };
      if (effectiveApiKey) headers["x-api-key"] = effectiveApiKey;
      const res = await fetch(`${BACKEND_URL}/api/llm/test`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setTestStatus({
          ok: true,
          message: `Connected — model: ${data.model}`,
        });
      } else {
        // This is a connection test, so it is the one place that *should* show
        // the server's own words — "Unsupported provider URL" is the answer the
        // reader is looking for. backendError's friendlier rewording would be
        // wrong here; only the envelope-unwrapping is wanted.
        const raw = await res.text();
        const message = unwrapDetail(raw) || `Error ${res.status}`;
        // A key's model list is the provider's, unfiltered, and includes
        // models that cannot chat — embeddings, images, audio — whose refusal
        // does not always say so. Unless the key itself was refused (the
        // provider's 401 or 403, which the backend puts first), say that the
        // model may be one of those.
        const keyRefused = /^(401|403):/.test(message);
        setTestStatus({
          ok: false,
          message,
          hint: keyRefused ? null : NOT_A_CHAT_MODEL,
        });
      }
    } catch (err) {
      setTestStatus({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    sessionStorage.setItem(
      "llmSettings",
      JSON.stringify({
        apiKey: effectiveApiKey,
        baseUrl: provider.baseUrl,
        model,
      }),
    );
    notifyLLMKeyChanged();
    onClose();
  }

  function handleClear() {
    sessionStorage.removeItem("llmSettings");
    notifyLLMKeyChanged();
    clearSessionUsage();
    setApiKey("");
    setTestStatus(null);
    onClose();
  }

  if (!open) return null;

  const inputStyle = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    fontSize: 12,
    padding: "0 8px",
    height: 32,
    width: "100%",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 11,
    color: C.dim,
    marginBottom: 4,
    display: "block",
  };

  const fieldStyle = { marginBottom: 14 };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 200 }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        {...dialogProps}
        aria-labelledby={titleId}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 201,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          width: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id={titleId}
          style={{
            fontSize: 14,
            fontWeight: "bold",
            marginBottom: 16,
            color: C.text,
          }}
        >
          LLM Settings
        </div>

        {demo && (
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: C.text,
              background: C.bg,
              border: `1px solid ${C.theory.accent}`,
              borderRadius: 4,
              padding: "8px 10px",
              marginBottom: 16,
            }}
          >
            <strong style={{ color: C.theory.text }}>Demo only.</strong> This
            build has no backend, so no key can be sent and nothing here is
            saved. The form is shown to illustrate how a provider is configured.
          </div>
        )}

        {/* Provider */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Provider</label>
          <select
            value={provider.id}
            onChange={handleProviderChange}
            style={inputStyle}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Model</label>
          <input
            type="text"
            list="llm-model-suggestions"
            value={model}
            onChange={handleModelChange}
            // No model is named here. The list is the provider's, newest
            // first, and the newest is often not a chat model at all; picking
            // one out as the example recommended it (issue #41).
            placeholder={
              models.length
                ? "Choose from the list, or type a model id"
                : "Test connection to list this key's models"
            }
            style={inputStyle}
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id="llm-model-suggestions">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {/* API key */}
        {provider.defaultApiKey ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>API key</label>
            <div
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                color: C.dim,
                fontStyle: "italic",
              }}
            >
              No key required — Ollama runs locally
            </div>
          </div>
        ) : (
          <div style={fieldStyle}>
            <label style={labelStyle}>
              API key
              <span
                style={{
                  marginLeft: 8,
                  color: hasSavedKey ? C.supports : C.dim,
                }}
              >
                {hasSavedKey ? "· Key saved" : "· No key saved"}
              </span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestStatus(null);
              }}
              disabled={demo}
              placeholder={
                demo
                  ? "Unavailable in the demo"
                  : hasSavedKey
                    ? "Enter new key to replace"
                    : "sk-…"
              }
              style={{
                ...inputStyle,
                ...(demo ? { opacity: 0.5, cursor: "not-allowed" } : {}),
              }}
              autoComplete="off"
            />
            {/* Where the key goes, said where it is typed. Not in the demo,
                where no key can be entered at all. */}
            {!demo && (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: C.dim,
                  marginTop: 6,
                }}
              >
                Kept in this browser tab, not saved permanently — though
                reopening a closed tab can bring it back, so press Clear when
                you are done. Sent to this app&apos;s server with each AI
                request and passed on to {provider.label}; the server does not
                store or log it. Use a key with a spending limit. See Privacy in
                the menu for what else is sent.
              </div>
            )}
          </div>
        )}

        {/* Test status */}
        {testStatus && (
          <div
            style={{
              fontSize: 11,
              color: testStatus.note
                ? C.dim
                : testStatus.ok
                  ? C.supports
                  : C.conflicts,
              marginBottom: 12,
              wordBreak: "break-word",
            }}
          >
            {testStatus.message}
            {testStatus.hint && (
              <div style={{ color: C.dim, marginTop: 4 }}>{testStatus.hint}</div>
            )}
          </div>
        )}

        {/* Session usage */}
        {(usage.input > 0 || usage.output > 0) && (
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
            Session: {usage.input.toLocaleString()} in ·{" "}
            {usage.output.toLocaleString()} out tokens
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button
            onClick={handleClear}
            style={{
              ...btn(false),
              color: C.conflicts,
              borderColor: C.conflicts,
            }}
          >
            Clear
          </button>
          <Tooltip text={demo ? DEMO_REASON : ""} wrap>
            <button
              onClick={handleTest}
              disabled={testing || demo}
              style={{
                ...btn(false),
                opacity: testing || demo ? 0.4 : 1,
              }}
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
          </Tooltip>
          <Tooltip text={demo ? DEMO_REASON : ""} wrap>
            <button
              onClick={handleSave}
              disabled={!canSave}
              // The accent is spread in, not written as `canSave ? … :
              // undefined`: that form overwrites `btn()`'s own colour and border
              // with `undefined`, and a disabled Save then takes the browser's
              // default button ink instead of the dim one.
              style={{
                ...btn(false),
                opacity: canSave ? 1 : 0.4,
                ...(canSave
                  ? { color: C.supports, borderColor: C.supports }
                  : null),
              }}
            >
              Save
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
