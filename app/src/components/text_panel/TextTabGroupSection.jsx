/**
 * @fileoverview GroupSection — the user's graph groups, listed in the text tab.
 *
 * The graph is where a group is *made*; this is where it can be read. A
 * collapsed group hides its members on the canvas, and the panel is the one
 * place they are still spelled out — which also makes it the place to change
 * what a group holds without expanding it first.
 *
 * @module components/text_panel/TextTabGroupSection
 */

/** @import { REGroup, REState } from '../../types.js' */

import { useContext } from "react";
import { C } from "../../constants/colors.js";
import {
  CARD_STYLE,
  CLUSTER_CARD_STYLE,
  GHOST_BTN_STYLE,
} from "../../constants/textTabStyles.js";
import { Ctx } from "./TextTabContext.js";
import { Badge, Highlight, SectionHeader } from "./TextTabCards.jsx";

/**
 * A group's name, and the way to select it.
 *
 * The same job `Badge` does for an element: selecting from the text is what
 * focuses the graph, and a group can be selected exactly as an element can —
 * see `selectionIds` in utils/groupUtils.
 */
function GroupChip({ group, selected, onSelect }) {
  const isSelected = selected === group.id;
  return (
    <button
      type="button"
      onClick={() => onSelect((prev) => (prev === group.id ? null : group.id))}
      aria-label={`Select group ${group.label}`}
      aria-pressed={isSelected}
      className="tap-target-sm"
      style={{
        fontSize: 12,
        fontWeight: "bold",
        padding: "1px 7px",
        borderRadius: 4,
        background: isSelected ? C.dim + "44" : C.dim + "22",
        color: C.text,
        border: `1px solid ${isSelected ? C.dim : C.dim + "55"}`,
        cursor: "pointer",
      }}
    >
      {group.label}
    </button>
  );
}

/**
 * @param {Object} props
 * @param {REState} props.state
 * @param {REGroup[]} props.groups
 * @param {React.RefObject} props.sectionRef
 * @param {boolean} props.collapsed
 * @param {function} props.onToggle
 */
export function GroupSection({
  state,
  groups,
  sectionRef,
  collapsed,
  onToggle,
}) {
  const {
    search,
    selected,
    onSelect,
    onToggleGroup,
    onEditGroupRequest,
    onUngroup,
    onRemoveFromGroup,
  } = useContext(Ctx);

  // Unlike every other section, this one renders with nothing in it: the "+" on
  // its header is the answer to "how do I make a group", and hiding the header
  // until there is a group hides the only place that says so.
  return (
    <div ref={sectionRef}>
      <SectionHeader
        title={`Groups${groups.length ? ` (${groups.length})` : ""}`}
        collapsed={collapsed}
        onToggle={onToggle}
        onAdd={onEditGroupRequest ? () => onEditGroupRequest() : undefined}
        addLabel="New group"
      />

      {!collapsed && groups.length === 0 && (
        <div
          style={{
            fontSize: 12,
            color: C.dim,
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          Bracket elements together to tidy the graph — a collapsed group draws
          as one node, keeping every relation its members have to the rest of
          the graph. Use <strong style={{ color: C.text }}>+</strong> above, or
          ctrl/⌘-click nodes on the graph and choose{" "}
          <strong style={{ color: C.text }}>Group</strong>.
        </div>
      )}

      {!collapsed &&
        groups.map((g) => (
          <div key={g.id} style={CARD_STYLE}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <GroupChip group={g} selected={selected} onSelect={onSelect} />
              <span style={{ fontSize: 11, color: C.dim }}>
                {g.members.length} member{g.members.length === 1 ? "" : "s"} ·{" "}
                {g.collapsed ? "collapsed" : "expanded"}
              </span>
              <div
                role="group"
                aria-label={`Actions for ${g.label}`}
                style={{ display: "flex", gap: 4, marginLeft: "auto" }}
              >
                <button
                  onClick={() => onToggleGroup?.(g.id)}
                  className="tap-target"
                  style={GHOST_BTN_STYLE}
                >
                  {g.collapsed ? "Expand" : "Collapse"}
                </button>
                <button
                  onClick={() => onEditGroupRequest?.(g.id)}
                  className="tap-target"
                  style={GHOST_BTN_STYLE}
                >
                  Edit
                </button>
                <button
                  onClick={() => onUngroup?.(g.id)}
                  className="tap-target"
                  style={GHOST_BTN_STYLE}
                >
                  Ungroup
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {g.members.map((id) => {
                const el = state.elements.find((e) => e.id === id);
                if (!el) return null;
                return (
                  <div key={id} style={{ ...CLUSTER_CARD_STYLE, minWidth: 0 }}>
                    <Badge id={id} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <Highlight text={el.text} query={search} />
                    </span>
                    <button
                      onClick={() => onRemoveFromGroup?.(id)}
                      aria-label={`Remove ${id} from ${g.label}`}
                      title={`Remove ${id} from ${g.label}`}
                      className="tap-target-square"
                      style={{
                        ...GHOST_BTN_STYLE,
                        border: "none",
                        padding: "0 6px",
                        fontSize: 14,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
