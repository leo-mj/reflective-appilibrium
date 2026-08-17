/**
 * @fileoverview Questionnaire tab — presents answer options for pre-set questions.
 * Selecting an answer activates that element and withdraws the siblings,
 * filtering the pre-populated argument graph down to the user's chosen path.
 * @module components/QuestionnaireTab
 */

import { C } from "../../constants/colors.js";

/** The judgment accent as type — the fill tone does not clear AA on the panel. */
const ACCENT_TEXT = C.judgment.text;

function QuestionCard({ suggestion, elByIndex, onSelectAnswer }) {
  const selectedJudgment = suggestion.judgments.find(
    (j) => elByIndex[j.index]?.status === "active"
  );
  const isAnswered = selectedJudgment != null;

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${isAnswered ? C.supports + "55" : C.border}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: "bold",
          color: C.text,
          marginBottom: 8,
          lineHeight: 1.4,
        }}
      >
        {suggestion.question}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {suggestion.judgments.map((judgment) => {
          const el = elByIndex[judgment.index];
          const isSelected = isAnswered && judgment === selectedJudgment;
          const isDimmed = isAnswered && !isSelected;

          return (
            <button
              key={judgment.index}
              onClick={() => {
                if (!el) return;
                const siblingIds = suggestion.judgments
                  .filter((j) => j.index !== judgment.index)
                  .map((j) => elByIndex[j.index]?.id)
                  .filter(Boolean);
                onSelectAnswer(el.id, siblingIds);
              }}
              style={{
                textAlign: "left",
                background: isSelected ? C.supports + "20" : "transparent",
                border: `1px solid ${isSelected ? C.supports + "88" : C.border}`,
                borderRadius: 4,
                padding: "6px 10px",
                cursor: "pointer",
                opacity: isDimmed ? 0.38 : 1,
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  fontSize: 11,
                  color: isSelected ? C.supports : C.text,
                  display: "block",
                  marginBottom: 2,
                }}
              >
                {judgment.answer}
              </span>
              <span style={{ fontSize: 10, color: C.dim, lineHeight: 1.4 }}>
                {judgment.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {import('../../types.js').REState} props.state
 * @param {Function} props.onSelectAnswer  Called with (selectedId, siblingIds[])
 */
export function QuestionnaireTab({ state, onSelectAnswer }) {
  const participantQuestions = state.questionnaireSpec.suggestions.filter((s) =>
    s.question.startsWith("Q")
  );

  const elByIndex = {};
  for (const el of state.elements) {
    if (el.questionnaireIndex != null) elByIndex[el.questionnaireIndex] = el;
  }

  const answeredCount = participantQuestions.filter((s) =>
    s.judgments.some((j) => elByIndex[j.index]?.status === "active")
  ).length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0 14px",
          }}
        >
          <span style={{ color: ACCENT_TEXT, fontWeight: "bold", fontSize: 12 }}>
            {state.questionnaireSpec.name}
          </span>
          <span style={{ fontSize: 11, color: C.dim }}>
            {answeredCount} / {participantQuestions.length} answered
          </span>
        </div>

        {participantQuestions.map((suggestion, qi) => (
          <QuestionCard
            key={qi}
            suggestion={suggestion}
            elByIndex={elByIndex}
            onSelectAnswer={onSelectAnswer}
          />
        ))}
      </div>
    </div>
  );
}
