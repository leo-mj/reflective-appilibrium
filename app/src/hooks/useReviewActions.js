/**
 * @fileoverview Process-review handlers, composed into useREActions.
 *
 * Like {@link module:hooks/useGroupActions} and unlike everything in
 * {@link module:hooks/useElementActions}, neither of these advances the round or
 * writes a log entry — and here the reason is sharper than "it is only a view".
 * A review is a reading *of* the process. Logging one as a change would alter
 * the record it describes, and would then reach the next review's timeline as
 * though it were a move in the argument rather than a comment on it. Not
 * bumping the round is also what makes running a review mid-process safe: the
 * round the review is stamped with stays the round it actually read.
 *
 * They do go through `mutate`, so accepting and discarding are undoable.
 *
 * @module hooks/useReviewActions
 */

import { newReviewId, reviewsOf } from "../utils/stateUtils.js";

/**
 * @param {{ state: import('../types.js').REState, mutate: Function }} deps
 */
export function useReviewActions({ mutate }) {
  /**
   * Accepts a review, appending it to the series.
   *
   * Appending rather than replacing is the feature: the next review is given
   * the earlier ones and asked to say what has moved since, so discarding the
   * previous one on accept would cut the thread every time it was used.
   *
   * @param {{headline: string, arc: string, surprises: string, missed: string,
   *          method: string, model: string, origin: string}} review
   */
  const handleSaveReview = (review) => {
    mutate((prev) => ({
      ...prev,
      reviews: [
        ...reviewsOf(prev),
        { ...review, id: newReviewId(), round: prev.round },
      ],
    }));
  };

  /**
   * Discards one saved review. Keyed on id rather than round: two reviews can
   * share a round, since nothing stops a second run before the next change.
   *
   * @param {string} reviewId
   */
  const handleDiscardReview = (reviewId) => {
    mutate((prev) => ({
      ...prev,
      reviews: reviewsOf(prev).filter((r) => r.id !== reviewId),
    }));
  };

  return { handleSaveReview, handleDiscardReview };
}
