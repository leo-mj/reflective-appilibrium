/**
 * @fileoverview Round log section for TextTab.
 * @module components/text_panel/LogSection
 */

import { C } from "../../constants/colors.js";
import { CARD_STYLE } from "../../constants/textTabStyles.js";
import { SectionHeader, Highlight } from "./TextTabCards.jsx";

/**
 * @param {Object}    props
 * @param {Array}     props.log        - state.log entries.
 * @param {React.Ref} props.sectionRef
 * @param {boolean}   props.isCollapsed
 * @param {function}  props.onToggle
 * @param {string}    props.search
 */
export function LogSection({ log, sectionRef, isCollapsed, onToggle, search }) {
  return (
    <div ref={sectionRef}>
      <SectionHeader
        title="Round Log"
        collapsed={isCollapsed}
        onToggle={onToggle}
      />
      {!isCollapsed &&
        log.map((l) => (
          <div
            key={l.round}
            style={{ ...CARD_STYLE, paddingBottom: 10, marginBottom: 10 }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: C.text,
                marginBottom: 3,
              }}
            >
              Round {l.round}
            </div>
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
              <Highlight text={l.changes} query={search} />
            </div>
          </div>
        ))}
    </div>
  );
}
