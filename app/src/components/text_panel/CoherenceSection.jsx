/**
 * @fileoverview Coherence section (tensions, orphans, clusters) for TextTab.
 * @module components/text_panel/CoherenceSection
 */

import { C } from "../../constants/colors.js";
import { SectionHeader, CoherenceGroup } from "./TextTabCards.jsx";

/**
 * @param {Object}      props
 * @param {import('../../types.js').REState} props.state
 * @param {React.Ref}   props.sectionRef
 * @param {boolean}     props.isCollapsed
 * @param {function}    props.onToggle
 */
export function CoherenceSection({ state, sectionRef, isCollapsed, onToggle }) {
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
            items={state.coherence.tensions}
          />
          <CoherenceGroup
            title="Orphans"
            color={C.undermines}
            items={state.coherence.orphans}
          />
          <CoherenceGroup
            title="Clusters"
            color={C.supports}
            items={state.coherence.clusters}
          />
        </>
      )}
    </div>
  );
}
