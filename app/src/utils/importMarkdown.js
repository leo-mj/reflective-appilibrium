/**
 * @fileoverview Parses and validates an RE state from an exported markdown file.
 *
 * Security measures:
 * - File size capped at 500 KB before reading.
 * - The `re-state` block is located with plain string search (no regex backtracking).
 * - `JSON.parse` is used for deserialization (no eval).
 * - Every field is whitelisted and type-checked; the parsed object is never spread
 *   directly into state, preventing prototype pollution.
 * - String and array lengths are bounded to prevent memory exhaustion.
 *
 * @module utils/importMarkdown
 */

/** @import { REState } from '../types.js' */

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 500_000; // 500 KB
const ELEMENT_TYPES = new Set(["judgment", "principle", "theory"]);
const STATUSES = new Set(["active", "revised", "withdrawn", "rejected", "possible"]);
const LEGACY_CONFIDENCE = { high: 1.0, moderate: 0.67, low: 0.33 };
const RELATION_TYPES = new Set([
  "supports",
  "conflicts",
  "undermines",
  "depends",
  "entails",
  "precludes",
  "jointly_entails",
  "jointly_precludes",
]);

// ─── Field validators ─────────────────────────────────────────────────────────

function str(v, field, max = 10_000) {
  if (typeof v !== "string")
    throw new Error(`"${field}" must be a string, got ${typeof v}`);
  if (v.length > max) throw new Error(`"${field}" exceeds ${max} characters`);
  return v;
}

function num(v, field) {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error(`"${field}" must be a finite number, got ${typeof v}`);
  return v;
}

function arr(v, field, max = 1_000) {
  if (!Array.isArray(v))
    throw new Error(`"${field}" must be an array, got ${typeof v}`);
  if (v.length > max) throw new Error(`"${field}" exceeds ${max} items`);
  return v;
}

function bool(v, field) {
  if (typeof v !== "boolean")
    throw new Error(`"${field}" must be a boolean, got ${typeof v}`);
  return v;
}

// ─── Questionnaire spec validator ─────────────────────────────────────────────

function validateQuestionnaireJudgment(j, ctx) {
  let confidence;
  if (typeof j.confidence === "string") {
    if (!(j.confidence in LEGACY_CONFIDENCE))
      throw new Error(`${ctx}.confidence "${j.confidence}" is not valid`);
    confidence = LEGACY_CONFIDENCE[j.confidence];
  } else {
    confidence = num(j.confidence, `${ctx}.confidence`);
    if (confidence < 0 || confidence > 1)
      throw new Error(`${ctx}.confidence must be in [0, 1], got ${confidence}`);
  }
  return {
    index: num(j.index, `${ctx}.index`),
    id: str(j.id, `${ctx}.id`, 10),
    confidence,
    answer: str(j.answer, `${ctx}.answer`, 200),
    text: str(j.text, `${ctx}.text`, 10_000),
  };
}

function validateQuestionnaireSuggestion(s, i) {
  const ctx = `questionnaireSpec.suggestions[${i}]`;
  return {
    question: str(s.question, `${ctx}.question`, 1_000),
    judgments: arr(s.judgments, `${ctx}.judgments`, 20).map((j, ji) =>
      validateQuestionnaireJudgment(j, `${ctx}.judgments[${ji}]`),
    ),
  };
}

function validateArgArrays(raw, field) {
  return arr(raw ?? [], field, 100).map((inner, i) =>
    arr(inner, `${field}[${i}]`, 50).map((n, ni) =>
      num(n, `${field}[${i}][${ni}]`),
    ),
  );
}

function validateQuestionnaireSpec(spec) {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec))
    throw new Error("questionnaireSpec must be a JSON object");

  const cardRaw = spec.card ?? {};
  let cardDescription;
  if (typeof cardRaw.description === "string") {
    cardDescription = str(
      cardRaw.description,
      "questionnaireSpec.card.description",
      5_000,
    );
  } else if (Array.isArray(cardRaw.description)) {
    cardDescription = arr(
      cardRaw.description,
      "questionnaireSpec.card.description",
      50,
    ).map((item, i) => {
      if (typeof item === "string")
        return str(
          item,
          `questionnaireSpec.card.description[${i}]`,
          2_000,
        );
      if (typeof item === "object" && item !== null && !Array.isArray(item))
        return {
          link: str(item.link ?? "", `questionnaireSpec.card.description[${i}].link`, 200),
          href: str(item.href ?? "", `questionnaireSpec.card.description[${i}].href`, 500),
        };
      throw new Error(
        `questionnaireSpec.card.description[${i}] must be a string or link object`,
      );
    });
  } else {
    cardDescription = "";
  }

  return {
    id: str(spec.id ?? "", "questionnaireSpec.id", 100),
    name: str(spec.name ?? "", "questionnaireSpec.name", 500),
    model: str(spec.model ?? "", "questionnaireSpec.model", 100),
    card: {
      title: str(cardRaw.title ?? "", "questionnaireSpec.card.title", 500),
      description: cardDescription,
      buttonLabel: str(
        cardRaw.buttonLabel ?? "",
        "questionnaireSpec.card.buttonLabel",
        200,
      ),
    },
    suggestions: arr(
      spec.suggestions ?? [],
      "questionnaireSpec.suggestions",
      100,
    ).map(validateQuestionnaireSuggestion),
    participantArguments: validateArgArrays(
      spec.participantArguments,
      "questionnaireSpec.participantArguments",
    ),
    furtherArguments: validateArgArrays(
      spec.furtherArguments,
      "questionnaireSpec.furtherArguments",
    ),
  };
}

// ─── Object validators (whitelist only known fields) ──────────────────────────

function validateElement(e, i) {
  const ctx = `elements[${i}]`;
  const id = str(e.id, `${ctx}.id`, 10);
  if (!/^[JPT]\d+$/.test(id))
    throw new Error(`${ctx}.id "${id}" is not a valid element ID`);

  const type = str(e.type, `${ctx}.type`, 20);
  if (!ELEMENT_TYPES.has(type))
    throw new Error(`${ctx}.type "${type}" is not valid`);

  const status = str(e.status, `${ctx}.status`, 20);
  if (!STATUSES.has(status))
    throw new Error(`${ctx}.status "${status}" is not valid`);

  let confidence;
  if (typeof e.confidence === "string") {
    if (!(e.confidence in LEGACY_CONFIDENCE))
      throw new Error(`${ctx}.confidence "${e.confidence}" is not valid`);
    confidence = LEGACY_CONFIDENCE[e.confidence];
  } else {
    confidence = num(e.confidence, `${ctx}.confidence`);
    if (confidence < 0 || confidence > 1)
      throw new Error(`${ctx}.confidence must be in [0, 1], got ${confidence}`);
  }

  const result = {
    id,
    type,
    status,
    confidence,
    origin: str(e.origin ?? "", `${ctx}.origin`, 200),
    text: str(e.text, `${ctx}.text`, 10_000),
    addedRound: num(e.addedRound, `${ctx}.addedRound`),
  };

  if (e.previousText !== undefined)
    result.previousText = str(e.previousText, `${ctx}.previousText`, 10_000);
  if (e.revisedRound !== undefined)
    result.revisedRound = num(e.revisedRound, `${ctx}.revisedRound`);
  if (e.reason !== undefined)
    result.reason = str(e.reason, `${ctx}.reason`, 2_000);
  if (e.withdrawnRound !== undefined)
    result.withdrawnRound = num(e.withdrawnRound, `${ctx}.withdrawnRound`);
  if (e.rejectedRound !== undefined)
    result.rejectedRound = num(e.rejectedRound, `${ctx}.rejectedRound`);
  if (e.negated !== undefined)
    result.negated = bool(e.negated, `${ctx}.negated`);
  if (e.questionnaireIndex !== undefined)
    result.questionnaireIndex = num(e.questionnaireIndex, `${ctx}.questionnaireIndex`);

  return result;
}

function validateRelation(r, i) {
  const ctx = `relations[${i}]`;
  const type = str(r.type, `${ctx}.type`, 20);
  if (!RELATION_TYPES.has(type))
    throw new Error(`${ctx}.type "${type}" is not valid`);

  const result = {
    from: str(r.from, `${ctx}.from`, 10),
    to: str(r.to, `${ctx}.to`, 10),
    type,
    explanation: str(r.explanation ?? "", `${ctx}.explanation`, 2_000),
    addedRound: num(r.addedRound, `${ctx}.addedRound`),
  };

  if (r.status !== undefined) {
    const s = str(r.status, `${ctx}.status`, 20);
    if (!STATUSES.has(s)) throw new Error(`${ctx}.status "${s}" is not valid`);
    result.status = s;
  }
  if (r.revisedRound !== undefined)
    result.revisedRound = num(r.revisedRound, `${ctx}.revisedRound`);
  if (r.withdrawnRound !== undefined)
    result.withdrawnRound = num(r.withdrawnRound, `${ctx}.withdrawnRound`);
  if (r.rejectedRound !== undefined)
    result.rejectedRound = num(r.rejectedRound, `${ctx}.rejectedRound`);
  if (r.argumentId !== undefined)
    result.argumentId = str(r.argumentId, `${ctx}.argumentId`, 200);

  return result;
}

function validateLogEntry(l, i) {
  const ctx = `log[${i}]`;
  return {
    round: num(l.round, `${ctx}.round`),
    findings: str(l.findings ?? "", `${ctx}.findings`, 5_000),
    options: str(l.options ?? "", `${ctx}.options`, 5_000),
    decision: str(l.decision ?? "", `${ctx}.decision`, 5_000),
    changes: str(l.changes ?? "", `${ctx}.changes`, 5_000),
  };
}

/**
 * Validates and whitelists a raw parsed object as a complete REState.
 * Throws a descriptive Error for any structural or type violation.
 *
 * @param {unknown} raw
 * @returns {REState}
 */
function validateState(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error("State must be a JSON object");

  const coherenceRaw = raw.coherence ?? {};
  const result = {
    topic: str(raw.topic ?? "", "topic", 500),
    phase: typeof raw.phase === "number" ? num(raw.phase, "phase") : 2,
    round: num(raw.round, "round"),
    elements: arr(raw.elements, "elements", 1_000).map(validateElement),
    relations: arr(raw.relations, "relations", 5_000).map(validateRelation),
    coherence: {
      tensions: arr(coherenceRaw.tensions ?? [], "coherence.tensions", 200).map(
        (s, i) => str(s, `coherence.tensions[${i}]`, 500),
      ),
      orphans: arr(coherenceRaw.orphans ?? [], "coherence.orphans", 200).map(
        (s, i) => str(s, `coherence.orphans[${i}]`, 500),
      ),
      clusters: arr(coherenceRaw.clusters ?? [], "coherence.clusters", 200).map(
        (s, i) => str(s, `coherence.clusters[${i}]`, 500),
      ),
    },
    log: arr(raw.log ?? [], "log", 1_000).map(validateLogEntry),
  };

  if (raw.model !== undefined) {
    if (raw.model !== "questionnaire")
      throw new Error(`"model" must be "questionnaire" if present, got "${raw.model}"`);
    result.model = "questionnaire";
  }
  if (raw.questionnaireSpec !== undefined)
    result.questionnaireSpec = validateQuestionnaireSpec(raw.questionnaireSpec);

  return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Reads a markdown File, extracts its `re-state` JSON block, validates the
 * content, and returns a clean REState object ready to replace app state.
 *
 * @param {File} file
 * @returns {Promise<REState>}
 * @throws {Error} With a user-readable message on any failure.
 */
export async function importStateFromFile(file) {
  if (file.size > MAX_FILE_SIZE)
    throw new Error(
      `File too large (max 500 KB, got ${Math.round(file.size / 1024)} KB).`,
    );

  const text = await file.text();

  // Locate the re-state block using plain string search — no regex, no backtracking.
  const OPEN = "```re-state";
  const CLOSE = "```";
  const openIdx = text.indexOf(OPEN);
  if (openIdx === -1)
    throw new Error(
      "No re-state block found. Make sure the file was exported from this app.",
    );
  const lineEnd = text.indexOf("\n", openIdx + OPEN.length);
  if (lineEnd === -1)
    throw new Error(
      "Malformed re-state block (no newline after opening fence).",
    );
  const closeIdx = text.indexOf(CLOSE, lineEnd + 1);
  if (closeIdx === -1)
    throw new Error("Malformed re-state block (missing closing fence).");

  const json = text.slice(lineEnd + 1, closeIdx).trim();

  let raw;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON in re-state block: ${e.message}`);
  }

  return validateState(raw);
}
