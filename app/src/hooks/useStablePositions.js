/**
 * @fileoverview Hook that runs a D3 force-directed simulation and returns stable node positions.
 * @module hooks/useStablePositions
 */

/** @import { REState, Dims, PositionMap } from '../types.js' */

import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

/**
 * Runs a D3 force-directed simulation over **all** elements in `state` (including withdrawn
 * ones) and returns stable `{x, y}` positions keyed by element ID.
 *
 * ### Why include withdrawn elements?
 * Keeping withdrawn nodes in the simulation prevents the graph from
 * jumping when the "show withdrawn" toggle is flipped — their positions are
 * simply not rendered at reduced opacity instead.
 *
 * ### Stability across re-renders
 * Positions are stored in `posRef` (a ref, not state).  When the simulation
 * restarts — e.g. because a new element was added — nodes resume from their
 * last known positions rather than random ones, so the layout changes
 * incrementally rather than scrambling entirely.
 *
 * ### Forces applied
 * | Force       | Purpose                                                  |
 * |-------------|----------------------------------------------------------|
 * | `link`      | Pulls connected nodes closer together (distance ≈ 110px) |
 * | `charge`    | Repels all nodes from each other to avoid overlap        |
 * | `center`    | Draws the whole graph toward `dims.w/2, dims.h/2`        |
 * | `collision` | Prevents nodes from overlapping (radius = node r + 12)   |
 * | `x` / `y`  | Weak restoring force to keep nodes on-screen             |
 *
 * The `alphaDecay` is set low (`0.01`) so the simulation runs long enough
 * for the layout to settle smoothly, but `ready` is also set after 1.5 s as
 * a guaranteed minimum so the UI doesn't stay invisible indefinitely.
 *
 * ### When does the simulation restart?
 * The `useEffect` dependency array is `[elements.length, relations.length, dims.w, dims.h]`.
 * The simulation restarts only when the number of elements/relations changes or the
 * panel dimensions change — **not** on every re-render — so performance is not a concern.
 *
 * @param {REState} state - Full RE state; all elements and relations are used for layout.
 * @param {Dims}    dims  - Pixel dimensions of the graph panel. The simulation centre is
 *                          set to `(dims.w / 2, dims.h / 2)` so nodes cluster in the
 *                          visible area rather than the full window.
 *
 * @returns {{ positions: PositionMap, ready: boolean }}
 *   - `positions` — map from element ID to `{x, y}`.  Updated on every simulation tick.
 *   - `ready`     — `false` until the simulation has run long enough; used to fade the
 *                   graph in once layout is stable (avoids a flash of scrambled nodes).
 *
 * @example
 * const { positions, ready } = useStablePositions(state, { w: 800, h: 600 });
 * // positions["J1"] → { x: 412, y: 290 }
 * // ready           → true (after ~1.5 s)
 */
export function useStablePositions(state, dims) {
  /** @type {React.RefObject<PositionMap>} Persists positions across simulation restarts. */
  const posRef = useRef({});
  /** @type {React.RefObject<d3.Simulation|null>} Reference to the running simulation so we can stop it before starting a new one. */
  const simRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!dims.w || !dims.h) return;
    const allEls = state.elements;
    const allRels = state.relations;

    // Build D3 node objects, reusing previous positions where available.
    const nodes = allEls.map((e) => {
      const prev = posRef.current[e.id];
      return {
        id: e.id,
        type: e.type,
        // Node radius used for collision detection — matches the radii in Graph.jsx / HistoryTab.jsx.
        r: e.type === "principle" ? 28 : e.type === "theory" ? 22 : 18,
        x: prev?.x ?? dims.w / 2 + (Math.random() - 0.5) * 200,
        y: prev?.y ?? dims.h / 2 + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
      };
    });

    const links = allRels.map((r) => ({ source: r.from, target: r.to }));

    // Stop any previous simulation before creating a new one.
    if (simRef.current) simRef.current.stop();

    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(110)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => d.r + 12),
      )
      // Weak restoring forces keep isolated nodes from drifting off-screen.
      .force("x", d3.forceX(dims.w / 2).strength(0.04))
      .force("y", d3.forceY(dims.h / 2).strength(0.04))
      .alphaDecay(0.01);

    // On every tick, snapshot positions into both the ref (stable) and state (triggers re-render).
    sim.on("tick", () => {
      const p = {};
      nodes.forEach((n) => {
        p[n.id] = { x: n.x, y: n.y };
      });
      posRef.current = p;
      setPositions({ ...p });
    });

    // Mark ready when the simulation finishes — or after a guaranteed timeout so
    // the UI never stays invisible indefinitely on slow machines or large graphs.
    const READY_TIMEOUT_MS = 1500;
    sim.on("end", () => setReady(true));
    setTimeout(() => setReady(true), READY_TIMEOUT_MS);

    simRef.current = sim;
    return () => sim.stop();
  }, [state.elements.length, state.relations.length, dims.w, dims.h]);

  return { positions, ready };
}
