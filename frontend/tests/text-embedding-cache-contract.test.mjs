/* The text-embedding cache toggle: what the panel must keep saying about it.

   It is a speed/VRAM knob whose two costs are invisible at the moment you press
   it — frozen captions, and dual captions losing its short wording. A checkbox
   that only said "faster" would be an honest-looking trap, so the wording is
   pinned here. `node --test` cannot render JSX; the panel is read as source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('../src/components/dataset/TrainingPanel.jsx', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../src/help/helpRegistry.js', import.meta.url), 'utf8');
const reference = readFileSync(new URL('../../docs/guide/settings-reference.md', import.meta.url), 'utf8');

test('the toggle shows what will RUN, not merely what was stored', () => {
  // Tri-state on the wire: true / false / absent (= the family's own recipe).
  // Binding the box to adv?.cache_text_embeddings alone would leave it unchecked
  // on Krea 2, claiming the opposite of what the run does.
  assert.match(panel, /cacheTextEmbeddingsEffective\(\s*adv\?\.cache_text_embeddings, trainType\)/);
  assert.match(panel, /checked=\{advCacheTextEmbeddings\}/);
  assert.match(panel, /saveAdv\(\{ cache_text_embeddings: e\.target\.checked \}\)/);
});

test('both costs are stated where the box is, not only in the guide', () => {
  // Caching + dual captions is issue #22's shape on ANY family, so the warning
  // is driven by the two live values rather than by the family list.
  assert.match(panel, /\{advCacheTextEmbeddings && advDualCaptions &&/);
  assert.match(panel, /trains on the long caption alone/);
  // Turning it off where the family needs it is allowed, and says what it costs.
  assert.match(panel, /\{!advCacheTextEmbeddings && advCacheIsFamilyDefault &&/);
  assert.match(panel, /out-of-memory one on a small card/);
  // Frozen captions: the part nobody discovers until a re-caption does nothing.
  assert.match(panel, /re-captioning needs a new run/);
});

test('the dual-captions warning reads the cache, not just the family', () => {
  assert.match(panel, /dualCaptionsSupport\(\s*trainType, \{ cacheTextEmbeddings: adv\?\.cache_text_embeddings \}\)/);
});

test('a new setting carries its help topic and its reference entry', () => {
  assert.match(panel, /topic="training\.cache_text_embeddings"/);
  assert.match(registry, /id: 'training\.cache_text_embeddings'/);
  assert.match(reference, /\*\*Cache captions \(text embeddings\)\*\*/);
});
