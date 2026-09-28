/**
 * @fileoverview What a new, empty process says about where to begin.
 *
 * A process started from the home page opened on an empty graph and a text
 * panel of "JUDGMENTS (0)" headings, with nothing to say what comes first — and
 * the method has an answer: judgments. The wording follows the tour's
 * "Reflective equilibrium" section, so a reader who skipped the tour is told
 * the same thing it would have told them. It does not offer the tour: that
 * runs on the demo process, and leaving this one for it is the header's ?
 * button's business, which asks first.
 *
 * Shown only while the process has no elements; the first one added replaces it.
 * @module components/EmptyProcessGuide
 */

import { C } from "../constants/colors.js";
import { LLM_ENABLED } from "../config.js";

/**
 * @param {Object}   props
 * @param {boolean}  [props.brief] - One line only, for the graph when the text
 *   panel beside it already carries the whole guide.
 * @param {boolean}  props.isWide - Where the add form is: a bar along the
 *   bottom when wide, a + button when narrow.
 */
export function EmptyProcessGuide({ brief = false, isWide }) {
  if (brief) {
    return (
      <p data-empty-guide style={{ ...TEXT, margin: 0 }}>
        Your judgments, principles and theories appear here as you add them.
      </p>
    );
  }
  return (
    <div data-empty-guide style={{ maxWidth: 440 }}>
      <p style={{ ...TEXT, color: C.text, fontWeight: "bold", fontSize: 13 }}>
        Start with your judgments
      </p>
      <p style={TEXT}>
        Reflective equilibrium starts from concrete moral judgments you are
        fairly confident about. Add a few with{" "}
        {isWide ? "the bar at the bottom" : "the + button"}, then look for
        general principles that would explain them.
      </p>
      {LLM_ENABLED && (
        <p style={TEXT}>Assist → Judgments can suggest some to start from.</p>
      )}
    </div>
  );
}

const TEXT = {
  fontSize: 12,
  lineHeight: 1.6,
  color: C.dim,
  margin: "0 0 8px",
};
