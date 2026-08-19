/**
 * @fileoverview Coherence section (tensions, orphans, possible support) for TextTab.
 * @module components/text_panel/CoherenceSection
 */

import { C } from "../../constants/colors.js";
import { SectionHeader, CoherenceGroup } from "./TextTabCards.jsx";
import { ClusterListing } from "./TextTabClusterSection.jsx";

/**
 * Reads out what the relation graph says about the current commitments.
 *
 * The lists are computed from the graph rather than taken from
 * `state.coherence`, which is only ever populated by an imported Phase 1 state
 * and would otherwise sit empty forever. Computing them means they are exact
 * and current, and they work with no backend.
 *
 * Coherent clusters are read out here too, under {@link ClusterListing}. They
 * used to be a section of their own, which asked the reader to know that a
 * cluster is a coherence finding before they could think to look for it —
 * tensions, orphans and clusters are all answers to the same question.
 *
 * Rendered only when there is something to report: the caller gates on there
 * being at least one finding or one cluster.
 *
 * @param {Object}      props
 * @param {{tensions: string[], orphans: string[], possibleSupport: string[]}} props.coherence
 * @param {import('../../types.js').REState} props.state
 * @param {Array}       props.clusters
 * @param {React.Ref}   props.sectionRef
 * @param {boolean}     props.isCollapsed
 * @param {function}    props.onToggle
 */
export function CoherenceSection({
  coherence,
  state,
  clusters,
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
          <ClusterListing state={state} clusters={clusters} />
        </>
      )}
    </div>
  );
}
