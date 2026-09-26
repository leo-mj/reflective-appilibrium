/**
 * @fileoverview Hook that runs a D3 force-directed simulation and returns stable node positions.
 * @module hooks/useStablePositions
 */

/** @import { REState, Dims, PositionMap } from '../types.js' */

import { useState, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { nodeRadius } from "../utils/graphHelpers.js";
import { groupsOf } from "../utils/groupUtils.js";
import { pinsOf } from "../utils/pinUtils.js";

/**
 * How hard a group pulls its members together, as a fraction of the distance
 * to their centroid per tick.
 *
 * An expanded group only wants to be *drawable*: its hull is the bounding box
 * of its members, so members strewn across the canvas would box in half the
 * graph. A gentle pull is enough, and anything stronger would override the
 * link and charge forces that are saying something about the argument rather
 * than about the user's filing.
 *
 * A collapsed group is drawn as a single node, so its members have to actually
 * converge — otherwise collapsing hides them without reclaiming the space they
 * were using, which is the entire point of collapsing.
 */
const EXPANDED_PULL = 0.09;
const COLLAPSED_PULL = 0.6;
/**
 * A D3 force pulling the members of each group toward their common centroid.
 *
 * @param {import('../types.js').REGroup[]} groups
 * @returns {Function} A force with the `initialize` hook D3 calls on start.
 */
function groupingForce(groups) {
  let members = [];
  const force = (alpha) => {
    for (const { nodes, collapsed } of members) {
      const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
      const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
      const k = (collapsed ? COLLAPSED_PULL : EXPANDED_PULL) * alpha;
      for (const n of nodes) {
        n.vx += (cx - n.x) * k;
        n.vy += (cy - n.y) * k;
      }
    }
  };
  // Resolved once per simulation rather than per tick: the membership cannot
  // change without the effect below re-running and building a new simulation.
  force.initialize = (all) => {
    const byId = new Map(all.map((n) => [n.id, n]));
    members = groups
      .map((g) => ({
        collapsed: !!g.collapsed,
        nodes: g.members.map((id) => byId.get(id)).filter(Boolean),
      }))
      .filter((g) => g.nodes.length > 1);
  };
  return force;
}

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
 * | `group`     | Pulls the members of a user-defined group together       |
 * | `x` / `y`  | Weak restoring force to keep nodes on-screen             |
 *
 * The `alphaDecay` is set low (`0.01`) so the simulation runs long enough
 * for the layout to settle smoothly, but `ready` is also set after 1.5 s as
 * a guaranteed minimum so the UI doesn't stay invisible indefinitely.
 *
 * ### When does the simulation restart?
 * Only when the number of elements/relations changes, or a group is created,
 * collapsed or dissolved — **not** on every re-render, so performance is not a
 * concern.
 *
 * ### A resize moves the layout; it does not redo it
 * A new panel size changes only where the centre is. The nodes are shifted by
 * however far it moved and the forces re-aimed at it, without reheating the
 * simulation — which used to restart at full heat and spend seconds with every
 * node on the move, for a layout whose shape nothing had asked to change. Going
 * full screen is the case that shows it; the statement view, whose cards are
 * pushed apart afresh whenever the layout moves, showed it worst.
 *
 * @param {REState} state - Full RE state; all elements and relations are used for layout.
 * @param {Dims}    dims  - Pixel dimensions of the graph panel. The simulation centre is
 *                          set to `(dims.w / 2, dims.h / 2)` so nodes cluster in the
 *                          visible area rather than the full window.
 * @param {function(Record<string, {x: number, y: number}>): void} [onPin] - Told
 *   where dragged nodes were dropped, as offsets from the centre; the state's
 *   `pins`, which this reads back, is where they are kept.
 *
 * @returns {{ positions: PositionMap, ready: boolean, drag: { grab: function(string[]): void, moveTo: function(number, number): void, release: function(): void } }}
 *   - `positions` — map from element ID to `{x, y}`.  Updated on every simulation tick.
 *   - `ready`     — `false` until the simulation has run long enough; used to fade the
 *                   graph in once layout is stable (avoids a flash of scrambled nodes).
 *   - `drag`      — moves nodes by hand, for the Graph tab's node dragging.
 *
 * @example
 * const { positions, ready } = useStablePositions(state, { w: 800, h: 600 });
 * // positions["J1"] → { x: 412, y: 290 }
 * // ready           → true (after ~1.5 s)
 */
export function useStablePositions(state, dims, onPin) {
  /** @type {React.RefObject<PositionMap>} Persists positions across simulation restarts. */
  const posRef = useRef({});
  /** @type {React.RefObject<d3.Simulation|null>} Reference to the running simulation so we can stop it before starting a new one. */
  const simRef = useRef(null);
  /** @type {React.RefObject<{x: number, y: number}|null>} Where the layout is centred. */
  const centerRef = useRef(null);
  /** @type {React.RefObject<Map<string, {x: number, y: number}>>} Where each dragged node stood when it was picked up. */
  const grabbedRef = useRef(new Map());
  // Latest callback, read at drop time, so that `drag` can stay stable.
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const [positions, setPositions] = useState({});
  const [ready, setReady] = useState(false);
  const halfWidth = dims.w / 2;
  const halfHeight = dims.h / 2;
  // Same reasoning as the element and relation counts below: only a change to
  // the grouping itself should re-run the layout, and `state.groups` is a fresh
  // array after every mutation anywhere in the state.
  const groupSignature = groupsOf(state)
    .map((g) => `${g.id}:${g.collapsed ? 1 : 0}:${g.members.join(",")}`)
    .join("|");

  const hasDims = dims.w > 0 && dims.h > 0;

  /** Snapshots node positions into the ref (stable) and state (re-renders). */
  function publish(nodes) {
    const p = {};
    nodes.forEach((n) => {
      p[n.id] = { x: n.x, y: n.y };
    });
    posRef.current = p;
    setPositions({ ...p });
  }

  // Declared before the simulation's effect, so that on the render that first
  // has a size the centre is recorded before the simulation reads it.
  useEffect(() => {
    const prev = centerRef.current;
    centerRef.current = { x: halfWidth, y: halfHeight };
    const sim = simRef.current;
    if (!prev || !sim) return;
    const dx = halfWidth - prev.x;
    const dy = halfHeight - prev.y;
    if (!dx && !dy) return;
    const nodes = sim.nodes();
    for (const n of nodes) {
      n.x += dx;
      n.y += dy;
      // A node the reader has placed moves with the rest, or it would be left
      // behind by exactly the shift that was meant to change nothing.
      if (n.fx != null) n.fx += dx;
      if (n.fy != null) n.fy += dy;
    }
    for (const start of grabbedRef.current.values()) {
      start.x += dx;
      start.y += dy;
    }
    // Re-aimed without touching alpha: a simulation already at rest stays at
    // rest, and one still settling carries on from where it was.
    sim
      .force("center", d3.forceCenter(halfWidth, halfHeight))
      .force("x", d3.forceX(halfWidth).strength(0.04))
      .force("y", d3.forceY(halfHeight).strength(0.04));
    publish(nodes);
  }, [halfWidth, halfHeight]);

  useEffect(() => {
    if (!hasDims) return;
    const { x: cx, y: cy } = centerRef.current;
    const allEls = state.elements;
    const allRels = state.relations;
    const groups = groupsOf(state);
    const collapsedIds = new Set(
      groups.filter((g) => g.collapsed).flatMap((g) => g.members),
    );

    // A node the reader has dropped stays where they put it: a re-run starts
    // at full heat, and anything left free moves. Pins are offsets from the
    // centre (utils/pinUtils.js).
    const pins = pinsOf(state);

    // Build D3 node objects, reusing previous positions where available.
    const nodes = allEls.map((e) => {
      const pin = pins[e.id] && { x: cx + pins[e.id].x, y: cy + pins[e.id].y };
      const prev = pin ?? posRef.current[e.id];
      return {
        ...(pin && { fx: pin.x, fy: pin.y }),
        id: e.id,
        type: e.type,
        // Node radius used for collision detection. Asked for rather than
        // restated: this used to hardcode the base radii and so ignored
        // confidence, which over-spaced small nodes and — now that confidence
        // swings the radius by 3× — would let big ones overlap.
        r: nodeRadius(e.type, e.confidence),
        // Members of a collapsed group pack far tighter than the rest: they are
        // drawn as one node, and keeping them a node-width apart would leave
        // the group's disc ringed by the hole its own members were holding
        // open. Not to a single point, though — the History tab shares this one
        // simulation and does *not* collapse anything, playback being about the
        // process rather than about how the user has filed it, so a pile of
        // exactly coincident nodes there would be unreadable.
        collapsed: collapsedIds.has(e.id),
        x: prev?.x ?? cx + ((Math.random() - 0.5) * cx) / 10,
        y: prev?.y ?? cy + ((Math.random() - 0.5) * cy) / 10,
        vx: 0,
        vy: 0,
      };
    });

    const links = allRels.map((r) => ({ source: r.from, target: r.to }));

    // Stop any previous simulation before creating a new one. A drag in
    // progress was holding nodes of the old one, which are gone.
    if (simRef.current) simRef.current.stop();
    grabbedRef.current = new Map();

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
      .force("center", d3.forceCenter(cx, cy))
      .force(
        "collision",
        d3.forceCollide().radius((d) => (d.collapsed ? d.r * 0.4 : d.r + 12)),
      )
      .force("group", groupingForce(groups))
      // Weak restoring forces keep isolated nodes from drifting off-screen.
      .force("x", d3.forceX(cx).strength(0.04))
      .force("y", d3.forceY(cy).strength(0.04))
      .alphaDecay(0.01);

    sim.on("tick", () => publish(nodes));

    // Mark ready when the simulation finishes — or after a guaranteed timeout so
    // the UI never stays invisible indefinitely on slow machines or large graphs.
    const READY_TIMEOUT_MS = 1500;
    sim.on("end", () => setReady(true));
    const readyTimer = setTimeout(() => setReady(true), READY_TIMEOUT_MS);

    simRef.current = sim;
    return () => {
      sim.stop();
      clearTimeout(readyTimer);
    };
    // Keyed on counts rather than on state.elements/state.relations themselves.
    // Those arrays are rebuilt by every mutation, so depending on them would
    // restart the layout whenever an element's text, confidence, or status
    // changed — scrambling the positions the user is currently reading. Only a
    // node or edge appearing or disappearing should re-run the simulation; a
    // new size is the effect above's business.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.elements.length, state.relations.length, groupSignature, hasDims]);

  // Pins that change without the layout re-running — an import that happens
  // to hold as many elements as the process it replaces, a group closing and
  // letting go of its members — are applied to the running simulation. A drop
  // lands here too, and changes nothing: the node is already where its pin says.
  const pinRecord = state.pins;
  useEffect(() => {
    const sim = simRef.current;
    const c = centerRef.current;
    if (!sim || !c) return;
    const pins = pinRecord ?? {};
    let changed = false;
    for (const n of sim.nodes()) {
      if (grabbedRef.current.has(n.id)) continue;
      const p = pins[n.id];
      const fx = p ? c.x + p.x : null;
      const fy = p ? c.y + p.y : null;
      const same =
        fx === null
          ? n.fx == null
          : n.fx != null &&
            Math.abs(n.fx - fx) < 0.5 &&
            Math.abs(n.fy - fy) < 0.5;
      if (same) continue;
      n.fx = fx;
      n.fy = fy;
      changed = true;
    }
    if (changed) sim.alpha(Math.max(sim.alpha(), 0.3)).restart();
  }, [pinRecord]);

  // Stable across renders: everything it touches is a ref.
  const drag = useMemo(
    () => ({
      /**
       * Holds the named nodes where they stand. The layout is left as it is —
       * not warmed, as D3's own drag does — so nothing but the dragged nodes
       * moves: a node is put somewhere, not tugged there with its neighbours
       * trailing after it. A layout still settling carries on settling.
       */
      grab(ids) {
        const sim = simRef.current;
        if (!sim) return;
        const wanted = new Set(ids);
        const grabbed = new Map();
        for (const n of sim.nodes()) {
          if (!wanted.has(n.id)) continue;
          n.fx = n.x;
          n.fy = n.y;
          grabbed.set(n.id, { x: n.x, y: n.y });
        }
        grabbedRef.current = grabbed;
      },
      /**
       * Moves what `grab` holds to where it was picked up, plus `(dx, dy)` in
       * layout space. Published here rather than by a tick, since a layout at
       * rest does not tick.
       */
      moveTo(dx, dy) {
        const sim = simRef.current;
        if (!sim) return;
        const grabbed = grabbedRef.current;
        const p = {};
        for (const n of sim.nodes()) {
          const start = grabbed.get(n.id);
          if (start) {
            n.x = n.fx = start.x + dx;
            n.y = n.fy = start.y + dy;
          }
          p[n.id] = { x: n.x, y: n.y };
        }
        posRef.current = p;
        setPositions({ ...p });
      },
      /**
       * Hands `onPin` where the nodes were dropped, as offsets from the
       * centre, for the state to keep.
       */
      release() {
        const sim = simRef.current;
        const c = centerRef.current;
        const grabbed = grabbedRef.current;
        grabbedRef.current = new Map();
        if (!sim || !c) return;
        const round = (v) => Math.round(v * 10) / 10;
        const pins = {};
        for (const n of sim.nodes()) {
          if (grabbed.has(n.id))
            pins[n.id] = { x: round(n.fx - c.x), y: round(n.fy - c.y) };
        }
        onPinRef.current?.(pins);
      },
    }),
    [],
  );

  return { positions, ready, drag };
}
