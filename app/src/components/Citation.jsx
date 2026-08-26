/**
 * @fileoverview Renders one bibliographic record as an APA 7 reference.
 *
 * The ordering and the italics come from `utils/citation.js`, which the Markdown
 * export uses too — so what appears on screen and what appears in a downloaded
 * document are the same reference, and neither renderer parses anything.
 *
 * @module components/Citation
 */

/** @import { RESource } from '../types.js' */

import { Fragment } from "react";
import { C } from "../constants/colors.js";
import { citationRuns } from "../utils/citation.js";

/**
 * @param {Object}   props
 * @param {RESource} props.source
 */
export function Citation({ source }) {
  return (
    <span style={{ lineHeight: 1.6 }}>
      {citationRuns(source).map((run, i) =>
        run.href ? (
          <a
            key={i}
            href={run.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: C.supports }}
          >
            {run.text}
          </a>
        ) : (
          <Fragment key={i}>{run.italic ? <em>{run.text}</em> : run.text}</Fragment>
        ),
      )}
    </span>
  );
}

/**
 * The caveat that has to accompany a reference wherever one is shown.
 *
 * Two things, and the second is the one that is easy to lose. References are
 * named by a model, which is reliably good at bibliographic *form* and
 * unreliably good at whether a work exists — so a well-formatted invention reads
 * as more authoritative than a sloppy real one. And a Crossref match establishes
 * only that the work exists: nothing here checks that it says what the element
 * claims, which is where a confident-looking error now hides.
 */
export const CITATION_CAVEAT =
  "References are AI-generated. A confirmed one exists; that it says what is " +
  "claimed here is not checked.";
