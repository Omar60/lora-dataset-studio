import test from 'node:test';
import assert from 'node:assert/strict';
import {
  afterReviewDecision, improvementReviewQueue, reviewQueuePosition, stepReviewQueue,
} from './improveReviewQueue.js';

const parent = (id, over = {}) => ({ id, filename: `src-${id}.png`, status: 'keep', ...over });
const candidate = (id, parentId, over = {}) => ({
  id, parent_image_id: parentId, derivation_kind: 'klein_image_improve',
  status: 'pending', filename: `improved-${id}.png`, ...over,
});

test('the queue holds only candidates that can be judged right now', () => {
  const images = [
    parent(1), candidate(11, 1),
    parent(2), candidate(12, 2, { filename: null }),        // still generating
    parent(3), candidate(13, 3, { status: 'keep' }),        // already decided
    parent(4, { filename: null }), candidate(14, 4),        // original gone
    candidate(15, 999),                                     // orphan parent id
    parent(5), { ...parent(6), derivation_kind: null },     // plain images
  ];
  assert.deepEqual(improvementReviewQueue(images).map((i) => i.id), [11]);
});

test('the queue keeps the order it was given — the grid decides it, not us', () => {
  const images = [parent(1), parent(2), parent(3),
    candidate(33, 3), candidate(11, 1), candidate(22, 2)];
  assert.deepEqual(improvementReviewQueue(images).map((i) => i.id), [33, 11, 22]);
});

test('a junk list is an empty queue, never a crash', () => {
  for (const junk of [null, undefined, 'nope', [null, undefined]]) {
    assert.deepEqual(improvementReviewQueue(junk), []);
  }
});

const queue = [candidate(11, 1), candidate(22, 2), candidate(33, 3)];

test('stepping stops at both ends instead of wrapping', () => {
  assert.equal(stepReviewQueue(queue, 11, 1).id, 22);
  assert.equal(stepReviewQueue(queue, 33, -1).id, 22);
  assert.equal(stepReviewQueue(queue, 33, 1), null);
  assert.equal(stepReviewQueue(queue, 11, -1), null);
  assert.equal(stepReviewQueue(queue, 999, 1), null);
});

test('deciding walks forward, then backward, then closes', () => {
  assert.equal(afterReviewDecision(queue, 11).id, 22);
  // The last one has nothing after it: fall back to what is still above, so a
  // verdict on the tail does not throw away the ones you skipped.
  assert.equal(afterReviewDecision(queue, 33).id, 22);
  // The only one left: null is the signal to close the viewer.
  assert.equal(afterReviewDecision([candidate(11, 1)], 11), null);
});

test('position is 1-based for humans, null off-queue', () => {
  assert.deepEqual(reviewQueuePosition(queue, 22), { index: 2, total: 3 });
  assert.equal(reviewQueuePosition(queue, 999), null);
});
