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
 * One thing that happened to an element or relation, in a given round.
 *
 * Events are the record of how an item got to its current state: `status`,
 * `text`, `previousText` and `reason` are the projection of this list onto
 * "now", and {@link module:utils/stateUtils.asOfRound} projects it onto any
 * earlier round for history playback.
 *
 * - `withdrawn`  — taken out of the equilibrium; carries `reason`
 * - `reinstated` — an earlier withdrawal or rejection undone
 * - `revised`    — text (or, for a relation, explanation) changed; carries the
 *                  wording it had *before* this round, as `previousText`
 * - `rejected`   — a suggestion the user declined
 *
 * @typedef {Object} REHistoryEvent
 * @property {number} round
 * @property {'withdrawn'|'reinstated'|'revised'|'rejected'} type
 * @property {string} [reason]
 * @property {string} [previousText]
 */

/**
 * Lifecycle status of an element.
 * - `active`    — currently in play
 * - `revised`   — text was changed in a later round; `previousText` and `revisedRound` are set
 * - `withdrawn` — removed from the equilibrium; `reason` and `withdrawnRound` are set
 * - `rejected`  — a declined LLM suggestion; `rejectedRound` is set
 *
 * - `possible`  — pre-loaded but not yet affirmed by the user; invisible in graph and text tab
 *
 * Withdrawal and rejection are both reversible: reinstating returns an element to
 * `active`, so a later argument can bring it back into play. `status` is the
 * *current* state only — the round-by-round record lives in `history`.
 *
 * @typedef {'active'|'revised'|'withdrawn'|'rejected'|'possible'} ElementStatus
 */

/**
 * How strongly the user holds an element, as a float in [0, 1].
 * Maps to node fill and size in the graph via {@link module:constants/colors.getColors}
 * and {@link module:utils/graphHelpers.nodeRadius}.
 *
 * @typedef {number} ConfidenceLevel
 */

/**
 * The directional relation types allowed between elements, in two families: the
 * dialectical four, then the inferential four that make up arguments (the set
 * `ARGUMENT_RELATION_TYPES` in utils/stateUtils.js).
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
 * @property {REHistoryEvent[]} [history] - Everything that has happened to this element,
 *   in round order. See {@link module:utils/stateUtils.historyOf}.
 * @property {number}          [withdrawnRound] - Legacy single-round withdrawal, still read
 *   from older saved states. New writes record a `history` event instead.
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
 * @property {string}        [argumentId]    - Set on the inferential relation types only; all premises of the same argument share this ID.
 * @property {ElementStatus} [status]        - Lifecycle status; absence or `"active"` means currently in play.
 * @property {number}        [revisedRound]  - Round in which this relation was last revised.
 * @property {REHistoryEvent[]} [history] - Everything that has happened to this relation,
 *   tracked exactly as for elements.
 * @property {number}        [withdrawnRound] - Legacy single-round withdrawal, still read
 *   from older saved states.
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
 * A set of elements the user has bracketed together to tidy the graph.
 *
 * A view device, not part of the RE process: grouping does not advance the
 * round, appear in the log, or enter the coherence analysis. It is distinct
 * from the *coherent cluster* of {@link module:utils/clusterUtils}, which is
 * computed from the relations rather than chosen.
 *
 * Collapsed, the group is drawn as one node and its members are not drawn at
 * all. Relations between two members go with them; every relation crossing the
 * group's boundary is kept and re-drawn against the group node.
 *
 * An element belongs to at most one group — {@link module:utils/groupUtils.createGroup}
 * merges rather than nests.
 *
 * @typedef {Object} REGroup
 * @property {string}   id        - `"G1"`, `"G2"`, …
 * @property {string}   label     - What the hull and the chip call it.
 * @property {string[]} members   - Element IDs.
 * @property {boolean}  collapsed - Whether it is currently drawn as one node.
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
 * One LLM reading of the process as a whole, as the user accepted it.
 *
 * A review is *about* the process rather than a move in it: accepting one does
 * not advance the round or write a log entry, for the same reason the round it
 * reports on must not change underneath it. Reviews accumulate rather than
 * replace, oldest first, so the series reads as a commentary on the process's
 * own development — a later review is given the earlier ones and asked to say
 * what has moved since.
 *
 * @typedef {Object} REReview
 * @property {string} id        - Unique, from {@link module:utils/stateUtils.newReviewId}.
 * @property {number} round     - The round the process had reached when this was taken.
 * @property {string} headline  - One sentence naming this review's through-line.
 * @property {string} arc       - How the position moved across the rounds.
 * @property {string} surprises - Where the process turned unexpectedly.
 * @property {string} missed    - Coherence that was available and not taken.
 * @property {string} method    - How the process was conducted, not what it concluded.
 * @property {string} model     - The model that produced it, for the AI disclosure.
 * @property {string} origin    - Provenance, per {@link REElement.origin} — the model
 *   name, plus a user-edit marker when the review was modified before acceptance.
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
 * @property {REGroup[]}     [groups]  - The user's graph groups. Absent on every
 *   state written before groups existed; read it through
 *   {@link module:utils/groupUtils.groupsOf} rather than directly.
 * @property {REReview[]}    [reviews] - Accepted process reviews, oldest first. Absent
 *   on every state written before reviews existed; read it through
 *   {@link module:utils/stateUtils.reviewsOf} rather than directly.
 * @property {'questionnaire'} [model] - Present only in questionnaire mode, where the
 *   elements and argument relations are pre-populated and the user works through
 *   questions rather than building the graph themselves.
 * @property {QuestionnaireSpec} [questionnaireSpec] - The questionnaire being worked
 *   through. Present exactly when `model` is `"questionnaire"`.
 */

/**
 * A pre-built argument graph a participant works through by answering questions.
 *
 * Specs live in `src/questionnaires/*.js` and are auto-discovered by
 * {@link module:components/HomePage}. The arrays index a sentence pool: each inner
 * array is one argument, its last entry the conclusion and the rest premises, with
 * a negative number meaning the negation of that sentence.
 *
 * @typedef {Object} QuestionnaireSpec
 * @property {string}   id    - Short identifier, used as the `origin` on generated elements.
 * @property {string}   name
 * @property {QuestionnaireCard} card
 * @property {Array<{question: string, judgments: Array<{index: number, id: string, confidence: ConfidenceLevel, answer: string, text: string}>}>} suggestions
 *   The questions and the answers offered for each. Questions whose text starts
 *   with `"Q"` are the ones put to the participant.
 * @property {number[][]} participantArguments - Arguments the participant's own answers activate.
 * @property {number[][]} furtherArguments     - Arguments in the background graph.
 */

/**
 * The home-page card that offers a questionnaire.
 *
 * @typedef {Object} QuestionnaireCard
 * @property {string} title
 * @property {string|Array<string|{link: string, href: string}>} description
 *   Plain text, or a mixed list where objects render as inline links. Hrefs are
 *   restricted to http(s) on import — see {@link module:utils/importMarkdown}.
 * @property {string} buttonLabel
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
