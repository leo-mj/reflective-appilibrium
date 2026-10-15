/**
 * @fileoverview Simulate tab — runs the rethon RE simulation, says what its
 * equilibrium would change, and plays its steps on the graph.
 *
 * **Changes, not positions.** A result is an evolution of full positions, each
 * repeating nearly all of the one before; listed as such, the reader had to
 * find the differences themselves. The tab now says what accepting would
 * withdraw, take up again and reject, and each step as what it brought in and
 * dropped — `utils/simulationDiff.js`, which the graph's preview and Accept
 * read too, so the three cannot disagree.
 *
 * **Played, not jumped to.** A result arrives at its first step and plays
 * through to the equilibrium, the graph's preview following, so the reader
 * sees the theory and the commitments take turns; the slider and the step
 * list move it by hand. `prefers-reduced-motion` starts at the end.
 *
 * There used to be a Step button beside Equilibrate. It computed the same
 * steps one request at a time, and its Accept and Reject only paced them:
 * rejecting a step and stepping again recomputed the same step, and nothing
 * reached the position before the last. Playback shows the same thing without
 * implying a choice the reader did not have.
 *
 * @module components/SimulateRethonTab
 */

/** @import { REState } from '../../types.js' */

import { useState, useMemo, useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { SpinnerIcon } from "../Icons.jsx";
import { quickScore, simulateRethon } from "../../utils/simulateRethonClient.js";
import { ErrorBanner } from "../SuggestionActions.jsx";
import { ARGUMENT_RELATION_TYPES } from "../../utils/stateUtils.js";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities.js";
import { useBackendWake, wakeBackend } from "../../utils/wakeBackend.js";
import { usePlayback } from "../../hooks/usePlayback.js";
import { usePalette } from "../../hooks/useTheme.js";
import { inkWeight } from "../../constants/palettes.js";
import { ACCENT_MARKER } from "../user_edits/addPanelShared.js";
import { WeightTriangle } from "./WeightTriangle.jsx";
import { DEFAULT_WEIGHTS } from "../../constants/simulationWeights.js";
import { SCORE_MEASURES } from "../../constants/scoreMeasures.js";
import { SpeedButtons } from "../SpeedButtons.jsx";
import {
  changesNothing,
  heldTheoryOf,
  positionAt,
  positionChanges,
  previewOf,
  simulationInputKey,
  stepChanges,
  stepLog,
} from "../../utils/simulationDiff.js";
import {
  SectionHead,
  ArgumentCard,
  ScoreRow,
  ChangeList,
  StepRow,
} from "./SimulateRethonCards.jsx";
import { SimulateScoresChart } from "../graphs_shared/SimulateScoresChart.jsx";

const ACCENT = C.principle.accent;
/** The same accent where it is type rather than a shape — see index.css. */
const ACCENT_TEXT = C.principle.text;

/** rethon's homepage, as its package metadata gives it. */
const RETHON_HOMEPAGE = "https://github.com/re-models/rethon";

/** The depths the request schema accepts. */
const DEPTHS = [1, 2, 3, 4];

const DEPTH_LABEL_STYLE = {
  fontSize: 11,
  color: C.dim,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const outlineBtn = (color, enabled = true) => ({
  background: "transparent",
  border: `1px solid ${enabled ? color : C.border}`,
  color: enabled ? color : C.dim,
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: "bold",
  cursor: enabled ? "pointer" : "not-allowed",
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
});


const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const idsOf = (els) => els.map((e) => e.id);

/** The weights in a toolbar's width: "A .35 · S .55 · F .10". */
const weightsSummary = ({ account, systematicity, faithfulness }) => {
  const w = (x) => x.toFixed(2).replace(/^0/, "");
  return `A ${w(account)} · S ${w(systematicity)} · F ${w(faithfulness)}`;
};

/**
 * @param {Object}   props
 * @param {REState}  props.state
 * @param {Function} [props.onApplyRethonEquilibrium] - Takes
 *   `{ withdraw, takeUp, reject }`, each a list of ids.
 * @param {Function} [props.onSetEquilibriumPreview] - Takes what the graph
 *   shows of the step on screen — `{ withdrawn, takenUp, theory }` sets, and
 *   the `log` and `step` for its log box — or null.
 * @param {Object|null} [props.weights] - What the request sends: null while
 *   they are the defaults, so the server uses its own.
 * @param {{ weights: Object, weightsChanged: boolean, onWeightsChange: Function,
 *   onResetWeights: Function }} [props.weightControl] - The weights as set,
 *   for the toolbar's readout and triangle — the ☰ menu's own state.
 */
export function SimulateRethonTab({
  state,
  onApplyRethonEquilibrium,
  onSetEquilibriumPreview,
  weights = null,
  weightControl,
}) {
  const [result, setResult] = useState(null);
  // What the shown result was computed from (`simulationInputKey`), and the
  // run's settings for the log. A result whose key no longer matches is stale.
  const [resultKey, setResultKey] = useState(null);
  const [run, setRun] = useState(null);
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stopped, setStopped] = useState(false);
  // What became of the last result: "accepted" | "rejected" | null. The result
  // itself is cleared either way — see handleAccept.
  const [outcome, setOutcome] = useState(null);
  const [argumentsOpen, setArgumentsOpen] = useState(false);
  const [chosenDepth, setNeighbourhoodDepth] = useState(3);
  // A server with a depth limit (/api/health) searches at that limit, and the
  // tab offers no choice there. Hosted it is 2 — depth 3 took the merged demo
  // past its 60s limit — and depth 1 finds too little to be worth offering, so
  // a choice between them would be a choice of nothing.
  //
  // Until the server has answered, its limit is unknown, so there is neither a
  // choice nor a run: a health check that failed while the server was starting
  // used to read as "no limit", and the tab offered depths the server refused.
  const { maxDepth, loaded, reachable } = useBackendCapabilities();
  const serverAnswered = loaded && reachable;
  const neighbourhoodDepth = maxDepth || chosenDepth;
  // And no run until the wake-up has finished: the workers warmed, so the
  // first simulation does not wait behind their start. Woken here too, in case
  // the editor was reached without the start page; a no-op otherwise.
  const { phase } = useBackendWake();
  useEffect(() => {
    wakeBackend();
  }, []);
  const serverReady = serverAnswered && phase === "ready";

  const activeCount = state.elements.filter((e) =>
    ["active", "revised"].includes(e.status),
  ).length;
  const atLeastOneArgument = state.relations.some((r) =>
    ARGUMENT_RELATION_TYPES.has(r.type),
  );
  // The simulation's theory is made of principles and background theories
  // (backend/services/rethon_theory.py), whatever their status — the server
  // refuses a process with none, so the button says so first.
  const hasTheorySentence = state.elements.some(
    (e) => e.type === "principle" || e.type === "theory",
  );
  const cannotRun = activeCount < 3 || !atLeastOneArgument || !hasTheorySentence;

  const evolution = result?.translated_re_state.evolution ?? null;
  const last = evolution ? evolution.length - 1 : 0;
  const scores = result?.translated_re_state.scores ?? [];
  const finalScore = scores.findLast((s) => s != null) ?? null;
  // Step 1 is the first theory with the commitments held: the position as it
  // stands, whenever the simulation could start from the held theory.
  const startScore = scores[1] ?? null;

  // Anything the simulation reads changing under a result — an element
  // withdrawn from the text panel, an argument added on the graph, the
  // weights moved — leaves it describing a position that is gone.
  const inputKey = simulationInputKey(state, weights, neighbourhoodDepth);
  const stale = !!result && resultKey !== inputKey;
  const heldWeights = weightControl?.weights ?? DEFAULT_WEIGHTS;

  // Which step the graph shows, played as History plays — `usePlayback`, at
  // the same pace and speeds — but without its glide: a simulation's steps
  // are discrete positions, and gliding between them only delayed each one.
  const playback = usePlayback(last, { ease: false });
  const frame = playback.snappedRound;
  // Derived rather than read off the hook, which notices the end only on its
  // next tick: at the last step there is nothing left to play.
  const isPlaying = playback.playing && frame < last;

  const steps = useMemo(
    () => (evolution ? stepChanges(evolution, heldTheoryOf(state.elements)) : []),
    [evolution, state.elements],
  );
  const finalChanges = useMemo(
    () =>
      evolution ? positionChanges(state.elements, positionAt(evolution, last)) : null,
    [evolution, last, state.elements],
  );

  // What the log box over the graph says, one entry per step.
  const log = useMemo(() => stepLog(steps), [steps]);

  // The theory the scores are taken against — the held principles and
  // theories' largest consistent part, which is also the simulation's first
  // theory (backend/services/rethon_theory.py). Ringed on the graph until
  // there is a result, so a principle left out of it is visibly left out.
  // The weights do not move it, so they are not sent. Gated where it is read
  // rather than cleared when it cannot be asked for, so the effect only ever
  // sets it from the answer.
  const [fetchedTheory, setFetchedTheory] = useState(null);
  const scoredTheory = serverReady && !cannotRun ? fetchedTheory : null;
  useEffect(() => {
    if (!serverReady || cannotRun) return;
    let cancelled = false;
    quickScore(state.elements, state.relations).then((scores) => {
      if (!cancelled) setFetchedTheory(scores?.theory ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [serverReady, cannotRun, state.elements, state.relations]);

  // The graph shows the position at the step on screen, and the log up to it,
  // for as long as there is a result; the scored theory otherwise.
  useEffect(() => {
    if (!evolution)
      return onSetEquilibriumPreview?.(
        scoredTheory ? { theory: new Set(scoredTheory) } : null,
      );
    const position = positionAt(evolution, frame);
    onSetEquilibriumPreview?.({
      ...previewOf(positionChanges(state.elements, position)),
      theory: position.theory,
      log,
      step: frame,
    });
  }, [evolution, frame, log, scoredTheory, state.elements, onSetEquilibriumPreview]);
  useEffect(
    () => () => onSetEquilibriumPreview?.(null),
    [onSetEquilibriumPreview],
  );

  // The request in flight, so Stop can abort it. Aborting is also what stops the
  // computation on the server, which notices the dropped connection and kills
  // the worker — without that a stopped simulation would go on holding the only
  // worker for whoever runs one next.
  const controllerRef = useRef(null);

  // Leaving the tab abandons the result, so it abandons the computation too.
  useEffect(() => () => controllerRef.current?.abort(), []);

  /**
   * Runs the simulation, and shows its result only if it succeeded.
   *
   * The previous result stays on screen until then, so Stop returns the tab to
   * exactly where it was. Everything is checked against the controller still
   * being this run's: a stopped request settles after the next one may already
   * have started, and must not clear that one's spinner or overwrite its result.
   */
  const simulate = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    const current = () => controllerRef.current === controller;
    setLoading(true);
    setError(null);
    setStopped(false);
    setOutcome(null);
    // Taken now, from what is sent: the position may move while it runs.
    const key = inputKey;
    const settings = { depth: neighbourhoodDepth, weights: heldWeights };
    try {
      const data = await simulateRethon(
        state,
        true,
        null,
        weights,
        neighbourhoodDepth,
        { signal: controller.signal },
      );
      if (!current()) return;
      const reduce = prefersReducedMotion();
      setResult(data);
      setResultKey(key);
      setRun(settings);
      setArgumentsOpen(false);
      playback.jumpTo(reduce ? data.translated_re_state.evolution.length - 1 : 0);
      if (!reduce) playback.setPlaying(true);
    } catch (e) {
      if (!current()) return;
      if (controller.signal.aborted) setStopped(true);
      else setError(e.message);
    } finally {
      if (current()) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const stop = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    setStopped(true);
  };

  const showStep = (index) => playback.jumpTo(index);
  const togglePlay = () => {
    if (isPlaying) return playback.setPlaying(false);
    if (frame >= last) playback.jumpTo(0);
    playback.setPlaying(true);
  };

  /**
   * Accepting or rejecting ends the result, and the tab clears it. Kept, its
   * steps and chart went on offering a Play that moved nothing on the graph —
   * and after Accept its changes were read against a position that had already
   * taken them.
   */
  const conclude = (how) => {
    playback.setPlaying(false);
    setResult(null);
    setOutcome(how);
  };
  const handleAccept = () => {
    if (stale) return;
    onApplyRethonEquilibrium?.({
      withdraw: idsOf(finalChanges.withdraw),
      takeUp: idsOf(finalChanges.takeUp),
      reject: idsOf(finalChanges.reject),
      run: { ...run, from: startScore?.z, to: finalScore?.z },
    });
    conclude("accepted");
  };
  const handleReject = () => conclude("rejected");

  const baseDisabled = loading || cannotRun || !serverReady;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 4px 24px" }}>
        {/* Toolbar. Wraps rather than running under the divider beside it. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            padding: "10px 0 14px",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ color: ACCENT_TEXT, fontWeight: "bold" }}>
              Simulate RE
            </span>
            <span style={{ color: C.dim }}>
              {" · "}
              {activeCount} active element{activeCount !== 1 ? "s" : ""}
            </span>
            {result && (
              <span
                style={{
                  color: result.translated_re_state.finished
                    ? C.supportsText
                    : C.conflicts,
                }}
              >
                {" · "}
                {result.translated_re_state.finished
                  ? "Equilibrium reached"
                  : "Equilibrium not reached yet"}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Here and nowhere else: they steer this tab alone, and a result
                is read against the weights that made it. They were in the ☰
                menu too until that became a second way to the same state. */}
            <Tooltip text="Simulation weights: how much account, systematicity and faithfulness count towards achievement (Z). Open to set them.">
              <button
                onClick={() => setWeightsOpen((o) => !o)}
                aria-expanded={weightsOpen}
                style={{
                  ...outlineBtn(C.border),
                  color: weightControl?.weightsChanged ? ACCENT_TEXT : C.dim,
                  fontWeight: "normal",
                  fontSize: 11,
                  padding: "3px 8px",
                }}
              >
                ⚖ {weightsSummary(heldWeights)}
                {weightControl?.weightsChanged ? " *" : ""}
              </button>
            </Tooltip>
            {maxDepth ? (
              // Fixed, but said: the result depends on it, and a reader
              // comparing it with a local run has to know which depth this was.
              <Tooltip
                text={`How far from the current position each step looks. This server always searches to a depth of ${maxDepth}; run the backend locally to choose.`}
              >
                <span style={DEPTH_LABEL_STYLE}>Depth {maxDepth}</span>
              </Tooltip>
            ) : !serverAnswered ? null : (
              <Tooltip text="How far from the current position each step looks. Deeper finds more, and takes much longer.">
                <label style={DEPTH_LABEL_STYLE}>
                  Depth
                  <select
                    value={neighbourhoodDepth}
                    onChange={(e) =>
                      setNeighbourhoodDepth(Number(e.target.value))
                    }
                    disabled={loading}
                    style={{
                      fontSize: 11,
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      color: C.text,
                      padding: "2px 4px",
                    }}
                  >
                    {DEPTHS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </Tooltip>
            )}
            <button
              onClick={simulate}
              disabled={baseDisabled}
              style={{
                ...outlineBtn(ACCENT, !baseDisabled),
                color: baseDisabled ? C.dim : ACCENT_TEXT,
                gap: 2,
              }}
            >
              {loading ? <SpinnerIcon /> : <span>↺</span>}
              {loading ? "Equilibrating..." : "Equilibrate"}
            </button>
            {loading && (
              <button
                onClick={stop}
                style={{
                  ...outlineBtn(C.border),
                  color: C.text,
                  fontWeight: "normal",
                }}
              >
                <span aria-hidden="true">■</span>
                Stop
              </button>
            )}
          </div>
        </div>

        {weightsOpen && weightControl && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <WeightTriangle
              weights={weightControl.weights}
              onChange={weightControl.onWeightsChange}
              weightsChanged={weightControl.weightsChanged}
            />
            {weightControl.weightsChanged && (
              <button
                onClick={weightControl.onResetWeights}
                style={{
                  ...outlineBtn(C.border),
                  color: C.dim,
                  fontWeight: "normal",
                  fontSize: 11,
                  padding: "2px 8px",
                }}
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* What the tab is for, until there is a result to show it. */}
        {!result && !loading && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: C.dim,
              marginBottom: 10,
            }}
          >
            Simulate hands your position to{" "}
            {/* The package's own homepage (its metadata's Home-page). */}
            <a
              href={RETHON_HOMEPAGE}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.dim }}
            >
              rethon
            </a>
, a formal model of reflective equilibrium. rethon calls a consistent set
            of principles and background theories a <em>theory</em>. Starting
            from yours, it takes turns: it picks the theory that best balances
            account and systematicity, then changes which elements you accept or
            reject — judgments, principles and background theories alike — to
            best balance account and faithfulness, and repeats until neither
            turn changes anything. Withdrawn elements stay in play, so a turn
            can take one up again.
            <ul style={{ margin: "6px 0", paddingLeft: 18 }}>
              <li>
                <strong style={{ color: C.text }}>Account</strong>: how closely
                what the theory implies matches the elements you accept and
                reject.
              </li>
              <li>
                <strong style={{ color: C.text }}>Systematicity</strong>: how
                much the theory implies for how few principles and background
                theories it has.
              </li>
              <li>
                <strong style={{ color: C.text }}>Faithfulness</strong>: how
                much of what you accepted and rejected at the start is kept.
              </li>
            </ul>
            The ⚖ weights set how much each counts. Each turn plays on the
            graph, and nothing in your position changes until you accept.
          </div>
        )}

        {!result && !loading && scoredTheory && (
          <ScoredTheory
            theory={scoredTheory}
            held={heldTheoryOf(state.elements)}
          />
        )}

        {cannotRun && (
          <div style={{ fontSize: 12, color: C.dim }}>
            Add at least three active elements, one argument, and a principle
            or background theory to run the simulation — rethon builds its
            theory only from principles and background theories.
          </div>
        )}

        {!serverReady && (
          <div role="status" style={{ fontSize: 12, color: C.dim }}>
            {phase === "unavailable" || (loaded && !reachable)
              ? "Server unreachable."
              : "Available once the server is ready."}
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {stopped && (
          <div role="status" style={{ fontSize: 12, color: C.dim }}>
            Stopped. Nothing was changed.
          </div>
        )}

        {outcome && (
          <div
            role="status"
            style={{
              fontSize: 12,
              color: outcome === "accepted" ? C.supportsText : C.dim,
            }}
          >
            {outcome === "accepted"
              ? "✓ Applied to your position, as one step."
              : "Result discarded. Nothing was changed."}
          </div>
        )}

        {result && (
          <>
            {/* The controls first, and held at the top of the panel while it
                scrolls: the graph moves with them, and a slider scrolled out
                of view left it moving for no visible reason. */}
            <SectionHead title="Simulation history" count={`${last} steps`} />
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: C.bg,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                padding: "4px 0 8px",
              }}
            >
              <button
                onClick={togglePlay}
                style={{
                  ...outlineBtn(C.border),
                  color: C.text,
                  fontWeight: "normal",
                  padding: "3px 10px",
                }}
              >
                {isPlaying ? "❚❚ Pause" : frame >= last ? "↺ Replay" : "▶ Play"}
              </button>
              <SpeedButtons
                speed={playback.speed}
                setSpeed={playback.setSpeed}
                compact
              />
              <input
                type="range"
                min={0}
                max={last}
                value={frame}
                onChange={(e) => showStep(Number(e.target.value))}
                aria-label="Step shown on the graph"
                style={{ flex: 1, minWidth: 120 }}
              />
              <span style={{ fontSize: 11, color: C.dim, flexShrink: 0 }}>
                Step {frame} of {last}
              </span>
            </div>
            <RingKey />
            <SimulateScoresChart scores={scores} current={frame} />

            <SectionHead title="If you accept" />
            {changesNothing(finalChanges) ? (
              <div style={{ fontSize: 12, color: C.dim }}>
                Your position is already in equilibrium: accepting would change
                nothing.
              </div>
            ) : (
              <>
                <ChangeList
                  title="Withdrawn"
                  elements={finalChanges.withdraw}
                  color={C.conflicts}
                />
                <ChangeList
                  title="Taken up again"
                  elements={finalChanges.takeUp}
                  color={C.supportsText}
                />
                <ChangeList
                  title="Rejected"
                  hint="the equilibrium holds its negation"
                  elements={finalChanges.reject}
                  color={C.conflicts}
                />
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>
                  Everything else stays as it is.
                </div>
              </>
            )}
            {finalScore && (
              <div style={{ marginTop: 10 }}>
                <ScoreRow scores={finalScore} highlight />
              </div>
            )}

            <SectionHead title="Steps" />
            <div role="list" aria-label="Steps">
              {steps.map((step) => (
                <StepRow
                  key={step.index}
                  step={step}
                  score={scores[step.index] ?? null}
                  current={step.index === frame}
                  onSelect={() => showStep(step.index)}
                />
              ))}
            </div>

            <button
              onClick={() => setArgumentsOpen((o) => !o)}
              aria-expanded={argumentsOpen}
              style={{
                background: "transparent",
                border: "none",
                color: C.dim,
                fontSize: 11,
                padding: "12px 0 6px",
                cursor: "pointer",
              }}
            >
              {argumentsOpen ? "▾" : "▸"} Arguments used ·{" "}
              {result.translated_arguments.length}
            </button>
            {argumentsOpen &&
              (result.translated_arguments.length === 0 ? (
                <div style={{ fontSize: 12, color: C.dim }}>
                  No arguments detected.
                </div>
              ) : (
                result.translated_arguments.map((arg, i) => (
                  <ArgumentCard key={i} argument={arg} />
                ))
              ))}
          </>
        )}
      </div>

      {/* The decision, pinned under the panel rather than inside it: it is
          what the whole result asks of the reader, and in the list it
          scrolled away with the steps. */}
      {result && (
        <DecisionBar
          changes={finalChanges}
          stale={stale}
          from={startScore?.z}
          to={finalScore?.z}
          fromIsHeld={!steps[1]?.joined.length && !steps[1]?.left.length}
          onAccept={handleAccept}
          onReject={handleReject}
          onRunAgain={baseDisabled ? null : simulate}
        />
      )}
    </div>
  );
}

/** A graph ring as `graphNodeVisuals` draws it: solid, or dashed for a change. */
const ring = (stroke, dash) => (
  <svg width={14} height={14} aria-hidden="true" style={{ flexShrink: 0 }}>
    <circle
      cx={7}
      cy={7}
      r={5}
      fill="none"
      stroke={stroke}
      strokeWidth={dash ? 1.5 : 2}
      strokeDasharray={dash ? "3 2" : undefined}
    />
  </svg>
);

/**
 * Which theory the scores are taken against, ringed on the graph until there
 * is a result: the largest consistent set of the active principles and
 * background theories (`largest_consistent_part` in the backend), confidence
 * deciding only between equally large sets. Without this, a principle in open
 * conflict counted for nothing and nothing said so.
 *
 * @param {Object}   props
 * @param {string[]} props.theory - The scored theory's ids.
 * @param {Object[]} props.held - The held principles and theories.
 */
function ScoredTheory({ theory, held }) {
  const scored = new Set(theory);
  const leftOut = held.filter((e) => !scored.has(e.id)).map((e) => e.id);
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        fontSize: 12,
        lineHeight: 1.6,
        color: C.dim,
        marginBottom: 10,
      }}
    >
      <span style={{ alignSelf: "center", display: "inline-flex" }}>
        {ring(C.principle.accent, false)}
      </span>
      <span>
        Ringed on the graph: the theory your scores are measured against, and
        the one the simulation starts from — the largest set of your active
        principles and background theories that your arguments allow holding
        together.
        {leftOut.length > 0 && (
          <>
            {" "}
            Left out: <strong style={{ color: C.text }}>{leftOut.join(", ")}</strong>
            . Keeping {leftOut.length > 1 ? "them" : "it"} would mean dropping
            at least as many others; between equally large sets, the more
            confident elements are kept.
          </>
        )}
      </span>
    </div>
  );
}

/**
 * What the rings on the graph mean while a result plays — drawn as
 * `graphNodeVisuals` draws them, since nothing else on screen names them.
 */
function RingKey() {
  const item = (icon, label) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {icon}
      {label}
    </span>
  );
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        fontSize: 11,
        color: C.dim,
        marginBottom: 6,
      }}
    >
      <span>On the graph:</span>
      {item(ring(C.principle.accent, false), "in the theory")}
      {item(ring(C.conflicts, true), "withdrawn or rejected")}
      {item(ring(C.supports, true), "taken up again")}
    </div>
  );
}

/**
 * What accepting would do, in one line, and the buttons that decide it.
 *
 * Accept is the add bar's filled button — the graph teal in the palette's own
 * ink, `ACCENT_MARKER` for the audit — since it is the tab's one act that
 * changes the position. Where nothing would change there is nothing to accept,
 * and the bar offers only to put the result away.
 *
 * **Stale** — the position changed after the run — there is nothing honest to
 * accept either: the lists would be this position read against another's
 * equilibrium. Run again takes Accept's place.
 *
 * @param {Object} props
 * @param {ReturnType<typeof positionChanges>} props.changes
 * @param {boolean} props.stale
 * @param {number|undefined} props.from - Achievement where the run started.
 * @param {number|undefined} props.to   - Achievement at the equilibrium.
 * @param {boolean} props.fromIsHeld    - Whether the start is the position
 *   held; it is not where rethon could not take the held theory.
 * @param {() => void} props.onAccept
 * @param {() => void} props.onReject
 * @param {(() => void)|null} props.onRunAgain - Null while a run cannot start.
 */
function DecisionBar({
  changes,
  stale,
  from,
  to,
  fromIsHeld,
  onAccept,
  onReject,
  onRunAgain,
}) {
  const palette = usePalette();
  const nothing = changesNothing(changes);
  const primary = {
    background: C.supports,
    color: palette.ink,
    fontWeight: inkWeight(palette.ink),
    border: "none",
    borderRadius: 6,
    padding: "7px 18px",
    fontSize: 13,
    cursor: "pointer",
  };
  const bar = {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: "10px 4px",
    borderTop: `1px solid ${C.border}`,
    background: C.bg,
  };
  const secondary = { ...outlineBtn(C.border), color: C.text, fontWeight: "normal" };

  if (stale)
    return (
      <div role="region" aria-label="Decide on the result" style={bar}>
        <div
          role="status"
          style={{ flex: 1, minWidth: 160, fontSize: 12, color: C.conflicts }}
        >
          Your position has changed since this ran, so this result no longer
          applies to it.
        </div>
        {onRunAgain && (
          <button onClick={onRunAgain} {...ACCENT_MARKER} style={primary}>
            Run again
          </button>
        )}
        <button onClick={onReject} style={secondary}>
          Dismiss
        </button>
      </div>
    );

  const counts = [
    [changes.withdraw.length, "withdraw"],
    [changes.takeUp.length, "take up again"],
    [changes.reject.length, "reject"],
  ]
    .filter(([n]) => n)
    .map(([n, verb]) => `${verb} ${n}`);
  return (
    <div role="region" aria-label="Decide on the result" style={bar}>
      <div style={{ flex: 1, minWidth: 160, fontSize: 12, color: C.dim }}>
        <div>
          {nothing
            ? "Nothing to accept."
            : `Accepting would ${counts.join(", ")} — as one step.`}
        </div>
        {/* What accepting buys, in the measure the simulation maximises. */}
        {from != null && to != null && (
          <Tooltip text={SCORE_MEASURES.z.tooltip}>
            <div style={{ marginTop: 2 }}>
              Achievement{" "}
              <span style={{ color: C.text }}>
                {from.toFixed(3)} → {to.toFixed(3)}
              </span>
              {fromIsHeld ? "" : " (from the ringed theory, not all you hold)"}
            </div>
          </Tooltip>
        )}
      </div>
      {!nothing && (
        <button onClick={onAccept} {...ACCENT_MARKER} style={primary}>
          Accept
        </button>
      )}
      <button onClick={onReject} style={secondary}>
        {nothing ? "Dismiss" : "Reject"}
      </button>
    </div>
  );
}
