import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheTextEmbeddingsDefault, cacheTextEmbeddingsEffective, dualCaptionsSupport,
  DUAL_CAPTION_UNSUPPORTED_FAMILIES,
} from './dualCaptions.js';

test('families that cache text embeddings cannot train dual captions (issue #22)', () => {
  for (const fam of ['krea', 'anima']) {
    const s = dualCaptionsSupport(fam);
    assert.equal(s.supported, false, `${fam} must be flagged`);
    assert.match(s.note, /long caption alone/);
    // The note must name the family, not just "this family".
    assert.ok(s.note.length > 40 && /^[A-Z]/.test(s.note));
  }
});

test('every other family keeps dual captions, with no scary note', () => {
  for (const fam of ['zimage', 'sdxl', 'flux', 'flux2klein']) {
    const s = dualCaptionsSupport(fam);
    assert.equal(s.supported, true, `${fam} must stay supported`);
    assert.equal(s.note, '');
  }
});

test('an unknown family is assumed to support them (no false alarm)', () => {
  assert.equal(dualCaptionsSupport('brand_new').supported, true);
  assert.equal(dualCaptionsSupport(undefined).supported, true);
});

test('only Krea 2 and Anima cache text embeddings without being asked', () => {
  // Mirrors lora_training._cache_text_embeddings_eff: those two pass default=True
  // to _dataset_cache_text_embeddings, every other builder emits nothing.
  assert.equal(cacheTextEmbeddingsDefault('krea'), true);
  assert.equal(cacheTextEmbeddingsDefault('anima'), true);
  for (const fam of ['zimage', 'sdxl', 'flux', 'flux2klein', undefined]) {
    assert.equal(cacheTextEmbeddingsDefault(fam), false, `${fam} must not cache by default`);
  }
});

test('the stored override wins over the family recipe, in BOTH directions', () => {
  assert.equal(cacheTextEmbeddingsEffective(true, 'zimage'), true);
  assert.equal(cacheTextEmbeddingsEffective(false, 'krea'), false);
  // null/undefined is "untouched", not "off" — the recipe still speaks.
  assert.equal(cacheTextEmbeddingsEffective(null, 'krea'), true);
  assert.equal(cacheTextEmbeddingsEffective(undefined, 'zimage'), false);
});

test('caching the embeddings costs the short caption, whichever family', () => {
  // Z-Image with the cache switched ON is exactly issue #22's shape, so the
  // toggle must say so there too — the family list alone would stay silent.
  const on = dualCaptionsSupport('zimage', { cacheTextEmbeddings: true });
  assert.equal(on.supported, false);
  assert.match(on.note, /one embedding per image/);
  // And the reverse: Krea with the cache switched OFF can train both wordings.
  const off = dualCaptionsSupport('krea', { cacheTextEmbeddings: false });
  assert.equal(off.supported, true);
  assert.equal(off.note, '');
});

test('the unsupported list is the one the backend refuses', () => {
  // Mirrors lora_training.DUAL_CAPTION_UNSUPPORTED_FAMILIES.
  assert.deepEqual(DUAL_CAPTION_UNSUPPORTED_FAMILIES, ['krea', 'anima']);
});
