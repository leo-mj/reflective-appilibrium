/**
 * @fileoverview Inline Q&A panel for discussing a specific suggestion with the LLM.
 * The conversation lives here, for the card's lifetime, and nowhere else: the
 * server keeps nothing, so each question is sent with the whole conversation
 * and the state as it is at that moment.
 * @module components/workflows/ConversationPanel
 */

/** @import { REState } from '../../types.js' */
import { LLM_ENABLED } from "../../config.js";

import { useState } from "react";
import { C } from "../../constants/colors.js";
import {
  askInConversation,
  MAX_EXCHANGES,
} from "../../utils/conversationsClient.js";
import { ErrorBanner, AiTag } from "../SuggestionActions.jsx";
import { Tooltip } from "../Tooltip.jsx";
import { sendsToLlmText } from "../../utils/openaiClient.js";

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Object}   props.suggestion  The suggestion object (any shape — serialised as-is).
 */
export function ConversationPanel({ state, suggestion }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Said before the question is typed, rather than as the server's 422 after.
  const full = messages.length >= 2 * MAX_EXCHANGES;

  const send = async () => {
    if (!LLM_ENABLED) {
      setError("No LLM API connection");
      return;
    }
    const text = input.trim();
    if (!text || loading || full) return;
    const conversation = [...messages, { role: "user", content: text }];
    setInput("");
    setError(null);
    setMessages(conversation);
    setLoading(true);
    try {
      const { reply, model } = await askInConversation(
        state,
        suggestion,
        conversation,
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, model },
      ]);
    } catch (e) {
      setError(e.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        marginBottom: 10,
        borderTop: `1px solid ${C.border}`,
        paddingTop: 8,
      }}
    >
      {messages.map((m, i) => (
        <div
          key={i}
          style={{
            marginBottom: 6,
            fontSize: 11,
            lineHeight: 1.5,
            color: m.role === "user" ? C.text : C.dim,
            paddingLeft: m.role === "assistant" ? 8 : 0,
            borderLeft:
              m.role === "assistant" ? `2px solid ${C.border}` : "none",
          }}
        >
          {m.role === "assistant" && <AiTag model={m.model} />}
          {m.content}
        </div>
      ))}
      {error && <ErrorBanner message={error} />}
      {full && (
        <div style={{ fontSize: 11, color: C.dim, margin: "6px 8px 0" }}>
          This discussion has reached its {MAX_EXCHANGES}-question limit. Close
          it and open it again to start a new one.
        </div>
      )}
      <div
        style={{ display: "flex", gap: 6, marginTop: messages.length ? 6 : 0 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={loading || full}
          placeholder="Ask about this suggestion…"
          style={{
            flex: 1,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "4px 8px",
            marginLeft: "8px",
            fontSize: 11,
            color: C.text,
            outline: "none",
          }}
        />
        <Tooltip text={sendsToLlmText("your current RE state")}>
          <button
            onClick={send}
            disabled={loading || full || !input.trim()}
            style={{
              background: loading || full || !input.trim() ? C.border : C.supports,
              border: "none",
              borderRadius: 4,
              padding: "4px 10px",
              margin: "4px 8px 4px 0",
              fontSize: 11,
              color: C.onFill,
              cursor: loading || full || !input.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {loading ? "…" : "Ask"}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
