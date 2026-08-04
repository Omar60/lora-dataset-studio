/* The Markdown report shares the grid's modal, and must not inherit its pixels.

   Tile size, the footer and the 8000px cap warning are all about an image; left
   visible on a text export they would offer settings that change nothing, which
   is how a dialog teaches people to distrust it. `node --test` cannot render
   JSX, so the modal is read as source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync(
  new URL('../src/components/dataset/studio/ExportGridModal.jsx', import.meta.url), 'utf8');

test('Markdown is offered next to the two image formats', () => {
  assert.match(modal, /\['md', 'Report \(\.md\)'\]/);
  assert.match(modal, /const isReport = fileFormat === 'md'/);
  // The same request, one more format — no second endpoint to keep in sync.
  assert.match(modal, /lora-test\/export-grid/);
  assert.match(modal, /format: fileFormat/);
});

test('the image-only controls leave with the pixels', () => {
  assert.match(modal, /isReport \? 'hidden' : ''/);            // tile size
  assert.match(modal, /isReport \? 'hidden' : 'flex'/);        // footer toggle
  assert.match(modal, /\{willDownscale && !isReport &&/);      // size-cap warning
});

test('the dialog says what a report IS, and what it does not carry', () => {
  assert.match(modal, /\{isReport && \(/);
  assert.match(modal, /per-checkpoint means and the ranking/);
  // The promise the backend keeps (basenames only) is the one made here.
  assert.match(modal, /Only file names travel,\s*\n?\s*never their folder/);
});

test('the wording never calls a text file a composed grid', () => {
  assert.match(modal, /isReport\s*\n?\s*\? 'Report exported'/);
  assert.match(modal, /isReport \? 'lora-report\.md' : 'lora-grid\.jpg'/);
  assert.match(modal, /isReport \? 'Writing…' : 'Composing…'/);
});
