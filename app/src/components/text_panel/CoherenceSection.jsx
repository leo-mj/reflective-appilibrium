/**
 * @fileoverview Coherence section (tensions, orphans, possible support) for TextTab.
 * @module components/text_panel/CoherenceSection
 */

import { C } from "../../constants/colors.js";
import { SectionHeader, CoherenceGroup } from "./TextTabCards.jsx";

/**
 * Reads out what the relation graph says about the current commitments.
 *
 * The lists are computed from the graph rather than taken from
 * `state.coherence`, which is only ever populated by an imported Phase 1 state
 * and would otherwise sit empty forever. Computing them means they are exact
 * and current, and they work with no backend.
 *
 * Clusters are not shown here — the Clusters tab is the place for those.
 *
 * Rendered only when there is something to report: the caller gates on
 * `hasCoherence`, so at least one of the two lists is non-empty.
 *
 * @param {Object}      props
 * @param {{tensions: string[], orphans: string[], possibleSupport: string[]}} props.coherence
 * @param {React.Ref}   props.sectionRef
 * @param {boolean}     props.isCollapsed
 * @param {function}    props.onToggle
 */
export function CoherenceSection({
  coherence,
  sectionRef,
  isCollapsed,
  onToggle,
}) {
  const { tensions, orphans, possibleSupport } = coherence;
  return (
    <div ref={sectionRef}>
      <SectionHeader
        title="Coherence"
        collapsed={isCollapsed}
        onToggle={onToggle}
      />
      {!isCollapsed && (
        <>
          <CoherenceGroup
            title="Tensions"
            color={C.conflicts}
            items={tensions}
          />
          <CoherenceGroup
            title="Orphans"
            color={C.undermines}
            items={orphans}
          />
          {/* Teal, like the supports edge it is read off: the other two groups
              are problems, this one is an opening. */}
          <CoherenceGroup
            title="Possible support"
            color={C.supports}
            items={possibleSupport}
          />
        </>
      )}
    </div>
  );
}
