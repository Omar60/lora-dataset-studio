import test from 'node:test';
import assert from 'node:assert/strict';
import { faceBadge, facePercent, faceVerdict } from './faceBadge.js';

const img = (face_state, face_score) => ({ face_state, face_score });

test('an image the pass never touched says nothing at all', () => {
  assert.equal(faceVerdict({}, null), null);
  assert.equal(faceBadge({}, null), null);
});

test('a face the scorer refused to judge is grey, never a number', () => {
  const v = faceVerdict(img('extreme_pose', null), null);
  assert.equal(v.scored, false);
  assert.equal(v.tone, 'grey');
  assert.equal(v.label, 'profile — not scored');
  assert.equal(facePercent(v), null);
});

test('scorable with no usable number degrades to grey, not to 0 %', () => {
  // A row that says 'scorable' but carries null/NaN is a half-written pass; it
  // must not print "0 %", which reads as "this is not the person".
  for (const bogus of [null, undefined, NaN, '0.62']) {
    assert.equal(faceVerdict(img('scorable', bogus), null).scored, false);
  }
});

test('the three tones sit on the configured thresholds', () => {
  const th = { green: 0.5, orange: 0.45 };
  assert.equal(faceVerdict(img('scorable', 0.5), th).tone, 'green');
  assert.equal(faceVerdict(img('scorable', 0.49), th).tone, 'amber');
  assert.equal(faceVerdict(img('scorable', 0.45), th).tone, 'amber');
  assert.equal(faceVerdict(img('scorable', 0.44), th).tone, 'red');
});

test('settings thresholds win over the shipped fallbacks', () => {
  const strict = { green: 0.7, orange: 0.6 };
  assert.equal(faceVerdict(img('scorable', 0.62), strict).tone, 'amber');
  assert.equal(faceVerdict(img('scorable', 0.62), null).tone, 'green');
});

test('percent is the cosine rounded, not a probability', () => {
  assert.equal(facePercent(faceVerdict(img('scorable', 0.6181), null)), 62);
  assert.equal(facePercent(faceVerdict(img('scorable', 0.8088), null)), 81);
});

test('the grid badge keeps its wording and its non-colour cues', () => {
  assert.equal(faceBadge(img('scorable', 0.62), null).label, '0.62');
  assert.equal(faceBadge(img('scorable', 0.47), null).label, '0.47 to review');
  assert.equal(faceBadge(img('scorable', 0.30), null).label, '0.30 low');
  assert.match(faceBadge(img('no_face', null), null).border, /dashed/);
});
