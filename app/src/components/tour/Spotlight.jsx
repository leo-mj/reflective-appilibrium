/**
 * @fileoverview The tour's spotlight: one grey sheet over the app with a hole
 * cut for each control the section points at, and a ring drawn round each hole.
 *
 * @module components/tour/Spotlight
 */

import { C } from "../../constants/colors.js";
import { TOUR_Z } from "./tourZ.js";

const RING_PAD = 5;

/** Ties the spotlight's holes to the sheet they are cut out of. */
const SPOTLIGHT_MASK = "tour-spotlight-mask";

/**
 * A mask rather than a box-shadow, which can only ever leave one control lit.
 *
 * @param {Object}    props
 * @param {DOMRect[]} props.rects - What to cut out and ring, as measured on
 *   screen.
 */
export function Spotlight({ rects }) {
  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        // dvh for the same reason as the overlay: the holes in the mask are
        // placed from getBoundingClientRect, so the sheet they are cut out
        // of has to be the viewport those rects were measured in.
        height: "100dvh",
        zIndex: TOUR_Z.ring,
        pointerEvents: "none",
      }}
    >
      <defs>
        <mask id={SPOTLIGHT_MASK}>
          {/* Mask values, not colours: white is opaque, black is the
              hole. Tokenizing either would blank the spotlight. */}
          <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.left - RING_PAD}
              y={r.top - RING_PAD}
              width={r.width + RING_PAD * 2}
              height={r.height + RING_PAD * 2}
              rx={7}
              fill="#000"
            />
          ))}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.45)"
        mask={`url(#${SPOTLIGHT_MASK})`}
      />
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.left - RING_PAD}
          y={r.top - RING_PAD}
          width={r.width + RING_PAD * 2}
          height={r.height + RING_PAD * 2}
          rx={7}
          fill="none"
          stroke={C.supports}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
