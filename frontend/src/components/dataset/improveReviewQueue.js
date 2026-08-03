/* The queue of improvements waiting for a verdict, and where a verdict leaves you.

   Reviewing improvements used to mean leaving the viewer between every single
   one: open the candidate, compare, close, keep, find the next candidate in the
   grid, open it, compare again. The comparison is the ONE place where the
   decision can honestly be made, and it was the one place you could not make it
   from.

   So the viewer walks a queue instead. What belongs in it is deliberately
   narrow: a candidate you can actually judge right now — its pixels have
   landed, its original is still there to compare against, and nobody has ruled
   on it yet. A row that fails any of those has nothing to decide.

   Pure module: `node --test` cannot parse JSX, and this is the part with the
   cases worth pinning. */
import { IMPROVE_DERIVATION } from './improveCandidates.js';

/** Can this row be judged in the comparison view right now? */
export function isReviewable(image, byId) {
  if (!image || image.derivation_kind !== IMPROVE_DERIVATION) return false;
  if (image.status !== 'pending') return false;   // already ruled on
  if (!image.filename) return false;              // still generating
  const parent = byId.get(image.parent_image_id);
  return !!(parent && parent.filename);           // nothing to compare against
}

/**
 * The reviewable candidates of `images`, IN THE ORDER GIVEN — callers pass the
 * grid's own list, so the queue walks the images in the order on screen rather
 * than in some private order of its own.
 *
 * `allImages` is where ORIGINALS are looked up, and it is deliberately a second
 * list: the grid's status filter has an "improvements" mode that shows the
 * candidates and hides everything else, so the parent of a visible candidate is
 * routinely NOT visible itself. Resolving parents against the filtered list
 * emptied the queue in exactly the view built for this review — every filter
 * that hides originals (undecided, improvements, a tag filter) did the same.
 * Membership and order come from what is on screen; existence does not.
 */
export function improvementReviewQueue(images, allImages = images) {
  const rows = Array.isArray(images) ? images.filter(Boolean) : [];
  const pool = Array.isArray(allImages) ? allImages.filter(Boolean) : rows;
  const byId = new Map(pool.map((image) => [image.id, image]));
  return rows.filter((image) => isReviewable(image, byId));
}

/** Where `delta` steps from `currentId`, or null at the ends (never wraps:
    landing back on the first image reads as "the queue restarted"). */
export function stepReviewQueue(queue, currentId, delta) {
  const rows = Array.isArray(queue) ? queue : [];
  const at = rows.findIndex((image) => image.id === currentId);
  if (at < 0) return null;
  return rows[at + delta] || null;
}

/**
 * What to show once `currentId` has been decided. It leaves the queue by that
 * very decision, so this reads the snapshot taken BEFORE it: the next one down,
 * else the one above (you skipped forward and are now walking back), else null
 * — the queue is empty and the viewer has nothing left to show.
 */
export function afterReviewDecision(queue, currentId) {
  return stepReviewQueue(queue, currentId, 1) || stepReviewQueue(queue, currentId, -1);
}

/** `{ index, total }` (1-based) for "3 / 12", or null when off-queue. */
export function reviewQueuePosition(queue, currentId) {
  const rows = Array.isArray(queue) ? queue : [];
  const at = rows.findIndex((image) => image.id === currentId);
  return at < 0 ? null : { index: at + 1, total: rows.length };
}
