/**
 * @fileoverview Central JSDoc type definitions for the RE (Reflective Equilibrium) app.
 *
 * This file contains no runtime code — it exists solely to document the shared data
 * shapes used throughout the application. Import it in an IDE that supports JSDoc
 * to get autocomplete and type-checking across all modules.
 *
 * @module types
 */

export {};

// ─── Primitive unions ────────────────────────────────────────────────────────

/**
 * The three kinds of element that can appear in an RE process.
 * - `judgment`  — a moral verdict at any level of generality (circle in the graph)
 * - `principle` — a general rule that systematises judgments (rounded rectangle)
 * - `theory`    — a broader empirical, philosophical, or meta-ethical commitment (diamond)
 *
 * @typedef {'judgment'|'principle'|'theory'} ElementType
 */

/**
 * Lifecycle status of an element.
 * - `active`    — currently in play
 * - `revised`   — text was changed in a later round; `previousText` and `revisedRound` are set
 * - `withdrawn` — removed from the equilibrium; `reason` and `withdrawnRound` are set
 * - `rejected`  — a declined LLM suggestion; `rejectedRound` is set
 *
 * Withdrawal and rejection are both reversible: reinstating returns an element to
 * `active`, so a later argument can bring it back into play.
 * - `possible`  — pre-loaded but not yet affirmed by the user; invisible in graph and text tab
 *
 * @typedef {'active'|'revised'|'withdrawn'|'rejected'|'possible'} ElementStatus
 */

/**
 * How strongly the user holds an element, as a float in [0, 1].
 * Maps to node opacity and size in the graph via {@link module:constants/colors.confOp}
 * and {@link module:utils/graphHelpers.nodeRadius}.
 *
 * @typedef {number} ConfidenceLevel
 */

/**
 * The four directional relation types allowed between elements.
 * See `skill/re-relations-reference.md` for the full matrix of which pairs are legal.
 * - `supports`  — source provides a positive reason for target (teal arrow)
 * - `conflicts` — source and target are incompatible (orange dashed arrow)
 * - `undermines` — source weakens target without flat contradiction (amber dashed arrow)
 * - `depends`   — source presupposes target (grey arrow)
 * - `entails`          — single premise entails conclusion (green arrow)
 * - `precludes`        — single premise entails negation of conclusion (rose arrow)
 * - `jointly_entails`  — multiple premises jointly entail conclusion (green arrow)
 * - `jointly_precludes` — multiple premises jointly preclude conclusion, i.e. entail its negation (rose arrow)
 *
 * @typedef {'supports'|'conflicts'|'undermines'|'depends'|'entails'|'precludes'|'jointly_entails'|'jointly_precludes'} RelationType
 */

// ─── Domain objects ───────────────────────────────────────────────────────────

/**
 * A single moral element: judgment, principle, or background theory.
 *
 * @typedef {Object} REElement
 * @property {string}          id            - Unique identifier, e.g. `"J1"`, `"P3"`, `"T2"`.
 * @property {ElementType}     type          - Element category.
 * @property {ElementStatus}   status        - Current lifecycle status.
 * @property {ConfidenceLevel} confidence    - How strongly the user holds this element (0–1).
 * @property {string}          origin        - Who introduced it: `"user"` (manually added);
 *                                            the specific model name, e.g. `"gpt-4o"` (accepted
 *                                            from an LLM suggestion unedited, model known), or
 *                                            `"LLM"` if the model wasn't known; or that value
 *                                            plus `"+user"`, e.g. `"gpt-4o+user"` (an LLM
 *                                            suggestion the user edited before accepting, or
 *                                            later revised). See {@link module:utils/stateUtils.llmOrigin}.
 * @property {string}          text          - The moral claim or principle statement.
 * @property {number}          addedRound    - Round number in which this element first appeared.
 * @property {string}          [previousText]  - Original wording before revision (revised only).
 * @property {number}          [revisedRound]  - Round in which text was revised (revised only).
 * @property {string}          [reason]        - Explanation for withdrawal (withdrawn only).
 * @property {number}          [withdrawnRound] - Round in which element was withdrawn (withdrawn only).
 * @property {number}          [reinstatedRound] - Round in which a withdrawal was undone. Paired
 *   with `withdrawnRound` it marks the rounds the element was absent. Only the most
 *   recent withdrawal is tracked; earlier cycles remain in the log alone.
 * @property {number}          [rejectedRound]  - Round in which element was rejected (rejected only).
 * @property {boolean}         [negated]        - True when this element appears as a negated sentence in a rethon position (simulation only; defaults to false).
 */

/**
 * A directional relation between two elements.
 *
 * @typedef {Object} RERelation
 * @property {string}        from           - ID of the source element.
 * @property {string}        to             - ID of the target element.
 * @property {RelationType}  type           - The kind of relation.
 * @property {string}        explanation    - Human-readable justification of why this relation holds.
 * @property {number}        addedRound     - Round number in which this relation was first recorded.
 * @property {string}        [origin]       - Who introduced it — see {@link REElement.origin} for the
 *                                           value convention. Absent on relations added before this
 *                                           field existed.
 * @property {string}        [argumentId]    - Set on `entails` relations only; all premises of the same detected argument share this ID.
 * @property {ElementStatus} [status]        - Lifecycle status; absence or `"active"` means currently in play.
 * @property {number}        [revisedRound]  - Round in which this relation was last revised.
 * @property {number}        [withdrawnRound] - Round in which this relation was withdrawn.
 * @property {number}        [rejectedRound]  - Round in which this relation was rejected.
 */

/**
 * Output of the coherence checker, updated on every review round.
 *
 * @typedef {Object} RECoherence
 * @property {string[]} tensions - Descriptions of incompatibilities or conflicts between elements.
 * @property {string[]} orphans  - IDs or descriptions of elements with no relations to others.
 * @property {string[]} clusters - Descriptions of coherent sub-groups of mutually supporting elements.
 */

/**
 * A single entry in the round-by-round audit log.
 *
 * @typedef {Object} RELogEntry
 * @property {number} round    - The round this entry documents.
 * @property {string} findings - What tensions or observations the facilitator noted.
 * @property {string} options  - Adjustment options that were considered.
 * @property {string} decision - Which option the user chose.
 * @property {string} changes  - Summary of elements or relations added, revised, or withdrawn.
 */

/**
 * The complete RE process state.  This is the single source of truth passed down
 * through the component tree.  In Phase 1 it is produced by Claude and pasted in;
 * in Phase 2 it will be maintained live by the app.
 *
 * @typedef {Object} REState
 * @property {string}        topic     - Short description of the ethical question being explored.
 * @property {number}        phase     - Application phase: `1` = Claude Skill, `2` = Standalone app.
 * @property {number}        round     - Current (latest) round number.
 * @property {REElement[]}   elements  - All elements across all rounds (including withdrawn).
 * @property {RERelation[]}  relations - All relations across all rounds.
 * @property {RECoherence}   coherence - Most recent coherence analysis.
 * @property {RELogEntry[]}  log       - Ordered list of round log entries.
 */

// ─── Utility / rendering types ────────────────────────────────────────────────

/**
 * Width/height pair used throughout for container and simulation dimensions.
 *
 * @typedef {Object} Dims
 * @property {number} w - Width in pixels.
 * @property {number} h - Height in pixels.
 */

/**
 * An {x, y} coordinate in SVG / force-simulation space.
 *
 * @typedef {Object} Position
 * @property {number} x - Horizontal coordinate.
 * @property {number} y - Vertical coordinate.
 */

/**
 * Maps element IDs to their positions from the force simulation.
 *
 * @typedef {Object.<string, Position>} PositionMap
 */

/**
 * Fill and stroke colours resolved for a single node.
 *
 * @typedef {Object} NodeColors
 * @property {string} fill   - CSS hex colour for the node body.
 * @property {string} stroke - CSS hex colour for the node border (always the "high" shade).
 */
