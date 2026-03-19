import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

// Hook: runs a D3 force-directed simulation over all elements (including withdrawn)
// and returns stable {x, y} positions keyed by element ID. Positions persist across
// tab switches and the show-withdrawn toggle so nodes don't jump around.
export function useStablePositions(state, dims) {
  const posRef = useRef({});
  const simRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!dims.w || !dims.h) return;
    const allEls = state.elements;
    const allRels = state.relations;

    const nodes = allEls.map(e => {
      const prev = posRef.current[e.id];
      return {
        id: e.id, type: e.type,
        r: e.type === "principle" ? 28 : e.type === "theory" ? 22 : 18,
        x: prev?.x ?? dims.w / 2 + (Math.random() - 0.5) * 200,
        y: prev?.y ?? dims.h / 2 + (Math.random() - 0.5) * 200,
        vx: 0, vy: 0,
      };
    });

    const links = allRels.map(r => ({ source: r.from, target: r.to }));

    if (simRef.current) simRef.current.stop();

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(110).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2))
      .force("collision", d3.forceCollide().radius(d => d.r + 12))
      .force("x", d3.forceX(dims.w / 2).strength(0.04))
      .force("y", d3.forceY(dims.h / 2).strength(0.04))
      .alphaDecay(0.01);

    sim.on("tick", () => {
      const p = {};
      nodes.forEach(n => { p[n.id] = { x: n.x, y: n.y }; });
      posRef.current = p;
      setPositions({ ...p });
    });

    sim.on("end", () => setReady(true));
    setTimeout(() => setReady(true), 1500);

    simRef.current = sim;
    return () => sim.stop();
  }, [state.elements.length, state.relations.length, dims.w, dims.h]);

  return { positions, ready };
}
