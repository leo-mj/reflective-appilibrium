// Colorblind-safe palette for the RE visualization.
// Edges: teal (supports), orange (conflicts), amber (undermines), grey (depends).
// Nodes shaded by confidence within each type.
export const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#e2e8f0",
  dim: "#94a3b8",
  judgment: { high: "#2563eb", moderate: "#60a5fa", low: "#93c5fd" },
  principle: { high: "#7c3aed", moderate: "#a78bfa", low: "#c4b5fd" },
  theory: { high: "#d97706", moderate: "#fbbf24", low: "#fcd34d" },
  withdrawn: "#64748b",
  supports: "#06b6d4",
  conflicts: "#f97316",
  undermines: "#eab308",
  depends: "#6b7280",
  added: "#06b6d4",
  revised: "#eab308",
  withdrawnMark: "#f97316",
};

// Opacity by confidence level, used for node fills.
export const confOp = { high: 1, moderate: 0.75, low: 0.5 };

// CSS transition string applied to nodes and edges for smooth show/hide animations.
export const TRANSITION = "opacity 1.2s ease-in-out";

// Returns { fill, stroke } colors for a node based on type, confidence, and withdrawn status.
export function getColors(e) {
  const isW = e.status === "withdrawn";
  if (isW) return { fill: C.withdrawn, stroke: C.withdrawn };
  if (e.type === "judgment") return { fill: C.judgment[e.confidence], stroke: C.judgment.high };
  if (e.type === "principle") return { fill: C.principle[e.confidence], stroke: C.principle.high };
  return { fill: C.theory[e.confidence], stroke: C.theory.high };
}
