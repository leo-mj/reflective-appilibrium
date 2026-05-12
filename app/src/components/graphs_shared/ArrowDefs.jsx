/**
 * @fileoverview SVG arrowhead marker definitions for all relation types.
 * @module components/ArrowDefs
 */

import { C } from "../../constants/colors.js";

/**
 * Renders an SVG `<defs>` block containing `<marker>` arrowhead definitions
 * for every combination of relation type × withdrawn state.
 *
 * Each edge in the graph references one of these markers via its `markerEnd`
 * attribute (e.g. `url(#a-supports)` or `url(#ha-conflicts-w)`).  The `prefix`
 * prop keeps marker IDs unique between the Graph SVG (prefix `""`) and the
 * History SVG (prefix `"h"`), preventing browsers from resolving the wrong
 * marker when both SVGs exist in the same document.
 *
 * ### Generated marker IDs
 * With prefix `""`:  `a-supports`, `a-supports-w`, `a-conflicts`, `a-conflicts-w`, …
 * With prefix `"h"`: `ha-supports`, `ha-supports-w`, `ha-conflicts`, `ha-conflicts-w`, …
 *
 * **This component produces no visible output itself** — it only registers the
 * markers so that `<line markerEnd="…">` elements can reference them.
 *
 * @param {Object} props
 * @param {string} props.prefix - String prepended to every marker ID to avoid
 *   collisions between multiple SVGs in the same page. Use `""` for the Graph
 *   tab and `"h"` for the History tab.
 * @returns {React.ReactElement} An SVG `<defs>` element (no visible pixels).
 */
export function ArrowDefs({ prefix }) {
  return (
    <defs>
      {["supports", "conflicts", "undermines", "depends", "jointly_entails", "jointly_precludes"].map((t) =>
        [false, true].map((w) => (
          <marker
            key={`${prefix}-${t}-${w}`}
            id={`${prefix}a-${t}${w ? "-w" : ""}`}
            viewBox="0 -5 10 10"
            refX={10}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path
              d="M0,-5L10,0L0,5"
              fill={w ? C.withdrawn : C[t]}
              opacity={w ? 0.3 : 1}
            />
          </marker>
        )),
      )}
    </defs>
  );
}
