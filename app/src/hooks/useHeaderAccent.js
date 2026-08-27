/**
 * @fileoverview How an assist tab's header is drawn, per viewing mode.
 * @module hooks/useHeaderAccent
 */

import { C } from "../constants/colors.js";
import { headerAccent, inkWeight } from "../constants/palettes.js";
import { usePalette } from "./useTheme.js";

/**
 * The colour an assist tab's header wears, and how it is drawn.
 *
 * The colour is the graph constant for whatever that tab produces, taken exactly
 * — see {@link module:constants/palettes.headerAccent}.
 *
 * **Default mode**: the constant as type, on the panel. Several are under AA
 * there, which is the same decision the node ramp already embodies: the palette
 * is judged by eye and high-contrast mode is the compliant path.
 *
 * **High-contrast mode**: a badge, filled with the constant and written in the
 * ink that fill takes — which is to say, the header is drawn the way the node is
 * drawn. A yellow Theories badge with black type reads as the same object as a
 * yellow theory diamond with a black id on it, which no amount of tuned
 * foreground colour ever quite does.
 *
 * A tab naming no element or relation — Review — gets none of this: no graph
 * colour, and no badge. Giving it one produced a badge with the panel's own text
 * colour on it, which in the light theme is near-black on near-black.
 *
 * `data-accent="graph"` marks the elements that carry a graph colour, which is
 * how the e2e audit tells a deliberate default-mode failure from a real one.
 *
 * `weight` follows the ink, by the same rule and for the same reason node ids do
 * — see {@link module:constants/palettes.inkWeight}. On the panel the accent is
 * thin coloured type and needs the weight to hold its colour at 12px; on a
 * saturated chip the dark ink goes blobby with it, which is what made the
 * high-contrast headers look heavy-handed next to the nodes they name.
 *
 * @param {string} tab  A key from ASSIST_TABS.
 * @returns {{accent: string, ink: string, weight: string, marker: Object, badge: Object}}
 *   `accent` for borders, `ink` for text — they are the same value except on a
 *   badge. Kept apart rather than left to spread order, which is what a caller
 *   gets wrong.
 */
export function useHeaderAccent(tab) {
  const palette = usePalette();
  const accent = headerAccent(palette, tab);
  if (!accent) {
    return { accent: C.text, ink: C.text, weight: "bold", marker: {}, badge: {} };
  }
  const isBadge = palette.id === "accessible";
  return {
    accent: accent.fill,
    ink: isBadge ? accent.ink : accent.fill,
    weight: isBadge ? inkWeight(accent.ink) : "bold",
    marker: { "data-accent": "graph" },
    badge: isBadge
      ? { background: accent.fill, padding: "2px 7px", borderRadius: 4 }
      : {},
  };
}
