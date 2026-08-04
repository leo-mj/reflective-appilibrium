/**
 * @fileoverview Hook that auto-fits a graph into its container by computing
 * the bounding box of positioned nodes and calling `resetView`.
 *
 * Two modes:
 *   - No `refitKey`: fit once on mount (fittedRef guard). Same as the original.
 *   - With `refitKey`: re-fit whenever `refitKey` OR `dims` changes, but NOT
 *     when `positions` changes (i.e. simulation ticks). This mirrors the
 *     original ClusterTab inline effect's `[dims.w, dims.h, memberKey]` deps.
 *
 * @module hooks/useAutoFit
 */

import { useEffect, useRef } from "react";
import { fitView } from "../utils/graphHelpers.js";

/**
 * @param {Object}        options
 * @param {Object}        options.positions  - PositionMap keyed by element ID.
 * @param {string[]}      [options.ids]      - Subset of IDs to fit. Defaults to all keys in positions.
 * @param {{ w: number, h: number }} options.dims - Container pixel dimensions.
 * @param {function}      options.resetView  - From `usePan`: (pan, zoom) => void.
 * @param {boolean}       [options.enabled]  - Pass `false` to skip. Default true.
 * @param {number}        [options.padding]  - Total px subtracted per axis before fitting. Default 96.
 * @param {number}        [options.maxZoom]  - Upper zoom bound. Default 1.
 * @param {*}             [options.refitKey] - Re-fits whenever this value or `dims` changes.
 *                                            Omit for "fit once on mount" behaviour.
 */
export function useAutoFit({
  positions,
  ids,
  dims,
  resetView,
  enabled = true,
  padding = 96,
  maxZoom = 1,
  refitKey,
}) {
  const fittedRef = useRef(false);
  const prevFitRef = useRef({ refitKey: Symbol(), w: -1, h: -1 });

  useEffect(() => {
    if (!positions) return;
    if (!enabled) return;

    if (refitKey === undefined) {
      // "Fit once" mode — skip after first successful fit.
      if (fittedRef.current) return;
    } else {
      // "Fit on change" mode — skip only when both refitKey and dims are
      // unchanged since the last fit (i.e. only positions changed = sim tick).
      const p = prevFitRef.current;
      if (refitKey === p.refitKey && dims.w === p.w && dims.h === p.h) return;
    }

    const view = fitView(positions, ids ?? null, dims, { padding, maxZoom });
    if (!view) return;

    resetView(view.pan, view.zoom);
    prevFitRef.current = { refitKey, w: dims.w, h: dims.h };
    fittedRef.current = true;
  }, [positions, ids, dims, enabled, resetView, refitKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
