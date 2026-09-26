/**
 * @fileoverview One section of the guided tour as the reader sees it: its
 * chapter, title and prose, the elements it quotes, and the explanation of the
 * argument it walks.
 *
 * @module components/tour/TourSection
 */

import { C, typeTokens } from "../../constants/colors.js";

const TYPE_LABEL = {
  judgment: "Judgment",
  principle: "Principle",
  theory: "Background theory",
};

/**
 * An element as the tour quotes it: its own text, pulled from the live state
 * rather than copied into the script, so a section can never describe a node
 * the graph beside it no longer holds.
 */
function QuoteCard({ element }) {
  // The `text` tone, not the fill: this writes the id as type, where the fill
  // tones measure 2.83:1 on the dark panel. It is also mode-independent, which
  // the fills are not.
  const color = typeTokens(element.type).text;
  const gone = element.status === "withdrawn" || element.status === "rejected";
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: C.bg,
        borderRadius: "0 6px 6px 0",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: "bold", color }}>
          {element.id}
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>
          {TYPE_LABEL[element.type] ?? element.type}
          {gone ? ` · ${element.status}` : ""}
        </span>
      </div>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.65,
          color: C.text,
          textDecoration: gone ? "line-through" : "none",
        }}
      >
        {element.text}
      </div>
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {Object}   props.section     - From `tourSections.js`.
 * @param {boolean}  props.isActive    - The one being read.
 * @param {boolean}  props.isLast      - Drawn without a rule under it.
 * @param {boolean}  props.sheet       - The narrow layout, which pads less.
 * @param {Map<string, Object>} props.elementById - What it quotes from.
 * @param {Array}    props.relations   - Where its argument's explanation is.
 * @param {Function} props.sectionRef  - Given the `<section>`, which the tour
 *   measures against its reading line and scrolls to.
 */
export function TourSection({
  section: s,
  isActive,
  isLast,
  sheet,
  elementById,
  relations,
  sectionRef,
}) {
  // The argument's own explanation, written when it was recorded — a better
  // gloss on why these premises give that conclusion than anything the script
  // could say about them from outside.
  const argRel = s.argument
    ? relations.find((r) => r.argumentId === s.argument)
    : null;
  return (
    <section
      ref={sectionRef}
      aria-labelledby={`tour-title-${s.id}`}
      aria-current={isActive ? "step" : undefined}
      style={{
        padding: sheet ? "16px 0" : "24px 0",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        opacity: isActive ? 1 : 0.62,
        transition: "opacity 0.35s ease",
      }}
    >
      {s.chapter && (
        <h2
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.supports,
            margin: "0 0 10px",
          }}
        >
          {s.chapter}
        </h2>
      )}
      <h3
        id={`tour-title-${s.id}`}
        style={{
          fontSize: 16,
          fontWeight: "bold",
          color: C.text,
          margin: "0 0 10px",
        }}
      >
        {s.title}
      </h3>
      {s.body.filter(Boolean).map((paragraph, p) => (
        <p
          key={p}
          style={{
            fontSize: 13.5,
            lineHeight: 1.8,
            color: C.dim,
            margin: "0 0 12px",
          }}
        >
          {paragraph}
        </p>
      ))}
      {s.quote?.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 12,
          }}
        >
          {s.quote.map((id) => {
            const element = elementById.get(id);
            return element ? <QuoteCard key={id} element={element} /> : null;
          })}
        </div>
      )}
      {argRel?.explanation && (
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.75,
            color: C.dim,
            fontStyle: "italic",
            margin: "12px 0 0",
          }}
        >
          {argRel.explanation}
        </p>
      )}
    </section>
  );
}
