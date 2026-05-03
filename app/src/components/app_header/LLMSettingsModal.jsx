/**
 * @fileoverview BYOK settings modal — lets the user supply their own API key,
 * provider, and model. Values are stored in sessionStorage only (cleared on
 * tab close) and sent as request headers; the backend never persists them.
 * @module components/app_header/LLMSettingsModal
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { LLM_PROVIDERS } from "../../constants/llmProviders.js";
import { btn } from "./appHeaderStyles.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function getInitialProvider() {
  const raw = sessionStorage.getItem("llmSettings");
  if (raw) {
    const { baseUrl } = JSON.parse(raw);
    return LLM_PROVIDERS.find((p) => p.baseUrl === baseUrl) ?? LLM_PROVIDERS[0];
  }
  const defaultId = import.meta.env.VITE_DEFAULT_PROVIDER;
  return LLM_PROVIDERS.find((p) => p.id === defaultId) ?? LLM_PROVIDERS[0];
}

function getInitialModel(provider) {
  const raw = sessionStorage.getItem("llmSettings");
  if (raw) {
    const { model } = JSON.parse(raw);
    if (model) return model;
  }
  const defaultModel = import.meta.env.VITE_DEFAULT_MODEL;
  if (defaultModel) return defaultModel;
  return provider.models[0];
}

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function LLMSettingsModal({ open, onClose }) {
  const [provider, setProvider] = useState(getInitialProvider);
  const [model, setModel] = useState(() => getInitialModel(getInitialProvider()));
  const [apiKey, setApiKey] = useState("");
  const [testStatus, setTestStatus] = useState(null); // null | { ok: boolean, message: string }
  const [testing, setTesting] = useState(false);

  const hasSavedKey = Boolean(
    (() => {
      try {
        return JSON.parse(sessionStorage.getItem("llmSettings") ?? "{}")?.apiKey;
      } catch {
        return false;
      }
    })()
  );

  const effectiveApiKey = apiKey || provider.defaultApiKey || "";
  // Save is enabled if: last test succeeded OR a key is already saved (model-only change)
  const saveEnabled = testStatus?.ok || (hasSavedKey && testStatus === null);

  function handleProviderChange(e) {
    const next = LLM_PROVIDERS.find((p) => p.id === e.target.value);
    setProvider(next);
    setModel(next.models[0]);
    setTestStatus(null);
  }

  function handleModelChange(e) {
    setModel(e.target.value);
    setTestStatus(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestStatus(null);
    try {
      const headers = { "x-model": model, "x-base-url": provider.baseUrl };
      if (effectiveApiKey) headers["x-api-key"] = effectiveApiKey;
      const res = await fetch(`${BACKEND_URL}/api/llm/test`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setTestStatus({ ok: true, message: `Connected — model: ${data.model}` });
      } else {
        const text = await res.text();
        setTestStatus({ ok: false, message: text || `Error ${res.status}` });
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
      JSON.stringify({ apiKey: effectiveApiKey, baseUrl: provider.baseUrl, model })
    );
    onClose();
  }

  function handleClear() {
    sessionStorage.removeItem("llmSettings");
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
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
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
          style={{
            fontSize: 14,
            fontWeight: "bold",
            marginBottom: 16,
            color: C.text,
          }}
        >
          LLM Settings
        </div>

        {/* Provider */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Provider</label>
          <select
            value={provider.id}
            onChange={handleProviderChange}
            style={inputStyle}
          >
            {LLM_PROVIDERS.map((p) => (
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
            placeholder={provider.models[0]}
            style={inputStyle}
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id="llm-model-suggestions">
            {provider.models.map((m) => (
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
              placeholder={hasSavedKey ? "Enter new key to replace" : "sk-…"}
              style={inputStyle}
              autoComplete="off"
            />
          </div>
        )}

        {/* Test status */}
        {testStatus && (
          <div
            style={{
              fontSize: 11,
              color: testStatus.ok ? C.supports : C.conflicts,
              marginBottom: 12,
              wordBreak: "break-word",
            }}
          >
            {testStatus.message}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button
            onClick={handleClear}
            style={{ ...btn(false), color: C.conflicts, borderColor: C.conflicts }}
          >
            Clear
          </button>
          <button
            onClick={handleTest}
            disabled={testing || (!effectiveApiKey && !hasSavedKey)}
            style={{
              ...btn(false),
              opacity: testing || (!apiKey && !hasSavedKey) ? 0.4 : 1,
            }}
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button
            onClick={handleSave}
            disabled={!saveEnabled}
            style={{
              ...btn(false),
              opacity: saveEnabled ? 1 : 0.4,
              color: saveEnabled ? C.supports : undefined,
              borderColor: saveEnabled ? C.supports : undefined,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
