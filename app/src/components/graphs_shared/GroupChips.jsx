/**
 * @fileoverview The action handles for the groups drawn on the canvas.
 *
 * HTML, positioned over the SVG, rather than shapes inside it. The graph draws
 * a group's *identity* — the hull, the disc, the name — and this draws what you
 * can do to it, because those are buttons: they want a focus ring, a tab stop
 * and an accessible name, and none of that is free for a `<rect>` with an
 * onClick. It also keeps the whole feature out of the canvas hit-testing in
 * `useGraphClick`, which already has four shapes to disambiguate.
 *
 * @module components/graphs_shared/GroupChips
 */

/** @import { REGroup, PositionMap } from '../../types.js' */

import { C } from "../../constants/colors.js";
import { elementRadius } from "../../utils/graphHelpers.js";
import { CollapseIcon, EditIcon, ExpandIcon, TrashIcon } from "../Icons.jsx";
import { Tooltip } from "../Tooltip.jsx";

const BUTTON = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: C.dim,
  cursor: "pointer",
  padding: 0,
  borderRadius: 3,
};

/** How far above its anchor a chip floats, so it never covers what it labels. */
const CHIP_LIFT = 32;

/**
 * One handle on the chip.
 *
 * `label` is the accessible name and stays terse, because it is also what a
 * voice-control user says. `tooltip` is what the icon cannot say on its own —
 * three unlabelled glyphs over a graph are a guess each — and the app's own
 * Tooltip is used rather than `title` so it also answers a long press, these
 * being the only handles a group has on a touchscreen.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.tooltip
 * @param {function} props.onClick
 */
function ChipButton({ label, tooltip, onClick, children }) {
  return (
    <Tooltip text={tooltip}>
      <button type="button" onClick={onClick} aria-label={label} style={BUTTON}>
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * Where each group's chip belongs, in container pixels, and the box on screen
 * it belongs to.
 *
 * A collapsed group is anchored to its disc and centred over it; an expanded
 * one to the top-left corner of its hull. Both float clear of the shape rather
 * than sitting on it — `rect` is the shape itself, which is what decides
 * whether the chip is wanted at all.
 *
 * @param {Object} args
 * @param {Array<{ group: REGroup, box: Object }>} args.hulls
 * @param {import('../../types.js').REElement[]} args.groupNodes
 * @param {PositionMap} args.positions
 * @param {{ x: number, y: number }} args.pan
 * @param {number} args.zoom
 * @returns {Array<{ group: REGroup, left: number, top: number, centred: boolean,
 *                  rect: { x: number, y: number, w: number, h: number } }>}
 */
function chipAnchors({ hulls, groupNodes, positions, pan, zoom }) {
  const anchors = [];
  for (const { group, box } of hulls) {
    const x = box.x * zoom + pan.x;
    const y = box.y * zoom + pan.y;
    anchors.push({
      group,
      left: x,
      top: y - CHIP_LIFT,
      centred: false,
      rect: { x, y, w: box.w * zoom, h: box.h * zoom },
    });
  }
  for (const node of groupNodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    const r = elementRadius(node) * zoom;
    const x = pos.x * zoom + pan.x;
    const y = pos.y * zoom + pan.y;
    anchors.push({
      // `groupNodes` carries the projected copy, whose `members` were narrowed
      // to what is visible; the chip acts on the group as stored.
      group: { id: node.id, label: node.label, collapsed: true },
      left: x,
      top: y - r - CHIP_LIFT,
      centred: true,
      rect: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
    });
  }
  return anchors;
}

/** Roughly how wide a chip is: three 24px buttons, gaps and border. */
const CHIP_WIDTH = 86;
/** Clearance kept between a chip and the edge it is pushed off. */
const CHIP_MARGIN = 4;

/**
 * Renders the selected group's chip, over the graph.
 *
 * Place as (part of) `GraphCanvas`'s `overlay`.
 *
 * @param {Object} props
 * @param {Array<{ group: REGroup, box: Object }>} props.hulls - Expanded groups.
 * @param {import('../../types.js').REElement[]} props.groupNodes - Collapsed ones.
 * @param {PositionMap} props.positions - Including the group nodes' own positions.
 * @param {{ x: number, y: number }} props.pan
 * @param {number} props.zoom
 * @param {{ w: number, h: number }} props.dims - Container size, to drop off-screen chips.
 * @param {string|null} props.selectedId - Only this group gets a chip. A chip
 *   over every group turned the canvas into a row of toolbars, and a group is
 *   drawn to be *read* most of the time; the handles are for the one you have
 *   just reached for.
 * @param {function(string): void} props.onToggle
 * @param {function(REGroup): void} props.onEdit - Opens the name/membership dialog.
 * @param {function(string): void} props.onUngroup
 */
export function GroupChips({
  hulls,
  groupNodes,
  positions,
  pan,
  zoom,
  dims,
  selectedId,
  onToggle,
  onEdit,
  onUngroup,
}) {
  const anchors = chipAnchors({ hulls, groupNodes, positions, pan, zoom }).filter(
    ({ group }) => group.id === selectedId,
  );
  if (!anchors.length) return null;

  return (
    <>
      {anchors.map(({ group, left, top, centred, rect }) => {
        // Whether the *group* is on screen, not whether its chip's anchor is:
        // the anchor floats above the shape, so a group against the top edge —
        // where the layout puts one soon enough — had its own handles culled,
        // leaving an expanded group with no way to close it again.
        const onScreen =
          rect.x + rect.w > 0 &&
          rect.x < dims.w &&
          rect.y + rect.h > 0 &&
          rect.y < dims.h;
        if (!onScreen) return null;

        // Pushed back inside rather than dropped. A chip over the shape is
        // worse than one beside it, but either beats one that is not there.
        const halfWidth = centred ? CHIP_WIDTH / 2 : 0;
        const clampedLeft = Math.min(
          Math.max(left, CHIP_MARGIN + halfWidth),
          Math.max(CHIP_MARGIN + halfWidth, dims.w - CHIP_WIDTH + halfWidth),
        );
        const clampedTop = Math.min(
          Math.max(top, CHIP_MARGIN),
          Math.max(CHIP_MARGIN, dims.h - CHIP_LIFT),
        );
        return (
          <div
            key={group.id}
            style={{
              position: "absolute",
              left: Math.round(clampedLeft),
              top: Math.round(clampedTop),
              transform: centred ? "translateX(-50%)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "1px 3px",
              borderRadius: 5,
              background: C.panel,
              border: `1px solid ${C.border}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              zIndex: 5,
            }}
          >
            <ChipButton
              label={
                group.collapsed
                  ? `Expand group ${group.label}`
                  : `Collapse group ${group.label}`
              }
              tooltip={
                group.collapsed
                  ? `Open ${group.label} and show its members again`
                  : `Draw ${group.label} as a single node, keeping every relation its members have to the rest of the graph`
              }
              onClick={() => onToggle(group.id)}
            >
              {group.collapsed ? (
                <ExpandIcon size={13} />
              ) : (
                <CollapseIcon size={13} />
              )}
            </ChipButton>
            <ChipButton
              label={`Edit group ${group.label}`}
              tooltip={`Rename ${group.label}, or change which elements it holds`}
              onClick={() => onEdit(group)}
            >
              <EditIcon size={12} />
            </ChipButton>
            <ChipButton
              label={`Ungroup ${group.label}`}
              // What the bin throws away is the bracket, not the elements —
              // worth saying outright, since a bin usually means the contents.
              tooltip={`Dissolve ${group.label}. Its elements stay exactly as they are`}
              onClick={() => onUngroup(group.id)}
            >
              <TrashIcon size={12} />
            </ChipButton>
          </div>
        );
      })}
    </>
  );
}
