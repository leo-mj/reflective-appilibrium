/**
 * @fileoverview Inline Q&A panel for discussing a specific suggestion with the LLM.
 * Manages its own session; conversation is scoped to the card's lifetime.
 * @module components/workflows/ConversationPanel
 */

/** @import { REState } from '../../types.js' */
import { LLM_ENABLED } from "../../config.js";

import { useState } from "react";
import { C } from "../../constants/colors.js";
import {
  startConversation,
  sendConversationMessage,
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
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!LLM_ENABLED) {
      setError("No LLM API connection");
      return;
    }
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      let reply, sid, model;
      if (sessionId) {
        ({ reply, model } = await sendConversationMessage(sessionId, text));
      } else {
        ({
          reply,
          session_id: sid,
          model,
        } = await startConversation(state, suggestion, text));
        setSessionId(sid);
      }
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
          disabled={loading}
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
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? C.border : C.supports,
              border: "none",
              borderRadius: 4,
              padding: "4px 10px",
              margin: "4px 8px 4px 0",
              fontSize: 11,
              color: C.onFill,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
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
