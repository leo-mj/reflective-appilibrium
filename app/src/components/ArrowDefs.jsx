import { C } from "../constants/colors.js";

// Defines SVG <marker> arrowheads for every relation type (supports/conflicts/undermines/depends)
// in both normal and withdrawn variants. The prefix keeps IDs unique between the Graph and
// History SVGs so they don't collide in the same document.
export function ArrowDefs({ prefix }) {
  return (
    <defs>
      {["supports", "conflicts", "undermines", "depends"].map(t =>
        [false, true].map(w => (
          <marker key={`${prefix}-${t}-${w}`} id={`${prefix}a-${t}${w ? "-w" : ""}`}
            viewBox="0 -5 10 10" refX={10} refY={0}
            markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0,-5L10,0L0,5" fill={w ? C.withdrawn : C[t]} opacity={w ? 0.3 : 1} />
          </marker>
        ))
      )}
    </defs>
  );
}
