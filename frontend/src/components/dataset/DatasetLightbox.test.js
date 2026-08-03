import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { canRegenerateGeneric } from './improveRerun.js';

const lightbox = readFileSync(new URL('./DatasetLightbox.jsx', import.meta.url), 'utf8');
const slider = readFileSync(new URL('./CompareSlider.jsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('./DatasetWorkspace.jsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../../hooks/useDataset.js', import.meta.url), 'utf8');
const grid = readFileSync(new URL('./DatasetGrid.jsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../settings/ScrapingSection.jsx', import.meta.url), 'utf8');
const attribution = readFileSync(new URL('./PexelsAttribution.jsx', import.meta.url), 'utf8');

test('lightbox exposes an accessible responsive image improvement action', () => {
  // ONE button per engine, from the shared pure module — the labels, the
  // per-engine disabled reasons and the trade-off sentences are asserted in
  // utils/improveEngines.test.js, so this file only pins the wiring.
  assert.match(lightbox, /improveButtons\.map\(\(btn\) => \(/);
  assert.match(lightbox, /lightboxImproveButtons\(\{/);
  assert.match(lightbox, /aria-busy=\{improvementActive\}/);
  assert.match(lightbox, /w-full sm:w-auto/);
  // The engine pressed travels to the handler; a single-✨ surface passes none
  // and the improve.engine setting decides instead.
  assert.match(lightbox, /onImprove\(img\.id, engineId\)/);
  // Klein's amber note follows KLEIN's button, never SeedVR2's: it is about
  // Klein's instruction pulling drawn skin towards realism, and SeedVR2 sends
  // no instruction at all.
  assert.match(lightbox, /\{rail && btn\.showKleinNote &&/);
  assert.match(lightbox, /\{!rail && improveButtons\.some\(\(b\) => b\.showKleinNote\)/);
});

// The comparison is what makes an improvement judgeable: before this, the
// lightbox showed the RESULT alone and the original had to be remembered.
// node --test cannot render JSX, so the contract is asserted on the source.
test('a derived image can be inspected against the original it came from', () => {
  // The comparison is ONE frame with a draggable divider, not two panes: the
  // difference an improve pass makes (skin texture, a softened jaw) survives the
  // eye travelling between two boxes, and does not survive a wipe over the same
  // pixels. The slider's own contract is asserted below.
  assert.match(lightbox, /<CompareSlider alt=\{alt\}/);
  assert.doesNotMatch(lightbox, /grid-rows-2 grid-cols-1 sm:grid-rows-1 sm:grid-cols-2/);
  // Both rows travel, not just their URLs: the slider prints each side's face
  // score, which is the number that decides whether an improvement is the same
  // person — and the thresholds come from the dataset, like the grid's badges.
  assert.match(lightbox, /beforeImg=\{compare\.parent\} afterImg=\{img\}/);
  assert.match(lightbox, /faceThresholds=\{faceThresholds\}/);
  // Real button, pressed state carried by aria (not colour alone).
  assert.match(lightbox, /aria-pressed=\{comparing\}/);
  assert.match(lightbox, /Compare with original/);
  assert.match(lightbox, /Exit comparison/);
  // Full-width control at phone width, like the other lightbox actions.
  assert.match(lightbox, /w-full sm:w-auto[^]{0,400}Compare with original/);
  // Each side names itself in TEXT.
  assert.match(lightbox, /compare\.beforeLabel/);
  assert.match(lightbox, /compare\.afterLabel/);
  // Zoom is not silently broken: comparison says, in the same hint slot, that
  // 100 % lives outside the comparison.
  assert.match(lightbox, /exit comparison to zoom/i);
  // A vanished original explains itself instead of leaving a dead button.
  assert.match(lightbox, /compare && !compare\.available/);
  assert.match(lightbox, /\{compare\.reason\}/);
});

test('the compare slider wipes between two images pinned to the same box', () => {
  // Same box + object-contain on BOTH images: Klein rescales to a pixel budget
  // and keeps the aspect ratio, so identical boxes are what makes the two
  // readings comparable. h-full w-full, never max-h/max-w — an <img> at its
  // intrinsic size is capped but never scaled UP, which used to render a small
  // original smaller than the result and compare two different scales.
  const layers = slider.match(/className="absolute inset-0 h-full w-full select-none object-contain"/g);
  assert.equal(layers?.length, 2);
  assert.doesNotMatch(slider, /max-h-full max-w-full select-none object-contain/);
  // clip-path, not width: the top image keeps its box, so the halves stay
  // pixel-aligned at every divider position instead of reflowing as it moves.
  assert.match(slider, /clipPath: `inset\(0 \$\{100 - pct\}% 0 0\)`/);
  // The whole frame is the control (grab anywhere), and the drag survives the
  // pointer leaving the box.
  assert.match(slider, /role="slider"/);
  assert.match(slider, /setPointerCapture\(e\.pointerId\)/);
  assert.match(slider, /hasPointerCapture\(e\.pointerId\)/);
  // Reachable without a pointer at all, and announced while it moves.
  assert.match(slider, /tabIndex=\{0\}/);
  assert.match(slider, /aria-valuenow=\{Math\.round\(pct\)\}/);
  assert.match(slider, /KEY_STEP = \{ ArrowLeft: -2, ArrowRight: 2 \}/);
  // The scores share the grid's single reading of face_state/face_score.
  assert.match(slider, /from '\.\.\/\.\.\/utils\/faceBadge'/);
  // A delta only when BOTH sides carry a real score — "-62 pts" against an
  // unscored original would be a fabricated verdict.
  assert.match(slider, /beforePercent === null \|\| afterPercent === null/);
});

test('an improvement can be judged, and left, without closing the comparison', () => {
  // The verdict is reachable from the one view where it can honestly be made.
  // Same toggle semantics as the grid's ✓/✕ — pressing the current state
  // returns the image to undecided, in both places.
  assert.match(lightbox, /onStatus\(img\.id, img\.status === 'keep' \? 'pending' : 'keep'\)/);
  assert.match(lightbox, /onStatus\(img\.id, img\.status === 'reject' \? 'pending' : 'reject'\)/);
  assert.match(lightbox, /aria-pressed=\{img\.status === 'keep'\}/);
  // Navigation is offered ONLY while this image is itself queued for review; a
  // "next" walking the whole grid would drop the comparison on the first plain
  // photo it reached.
  assert.match(lightbox, /\{onNavigate && queuePosition &&/);
  assert.match(lightbox, /\{queuePosition\.index\} \/ \{queuePosition\.total\} to review/);
  assert.match(lightbox, /disabled=\{queuePosition\.index <= 1\}/);
  assert.match(lightbox, /disabled=\{queuePosition\.index >= queuePosition\.total\}/);
  // Arrow keys walk the queue, EXCEPT while the divider holds focus — it is a
  // slider, and stealing its keys would make the grabbed control inert.
  assert.match(lightbox, /e\.target\?\.closest\?\.\('\[role="slider"\]'\)/);
  assert.match(lightbox, /onNavigate\(e\.key === 'ArrowLeft' \? -1 : 1\)/);
  // Walking the queue KEEPS the comparison open; it closes itself only where
  // there is no original to compare against.
  assert.match(lightbox, /useEffect\(\(\) => \{ if \(!canCompare\) setComparing\(false\); \}/);
});

test('workspace advances the review queue on a verdict and hides it elsewhere', () => {
  // Order and membership from the VISIBLE list, originals from the full one:
  // the "improvements" status filter hides originals by design, and resolving
  // them among the visible rows emptied the queue in that very view.
  assert.match(workspace, /const improveQueue = improvementReviewQueue\(gridImages, images\)/);
  // The next image is resolved BEFORE the verdict: the decision is what removes
  // this row from the queue, so afterwards it can no longer say what followed.
  assert.match(workspace, /const next = advancing \? afterReviewDecision\(improveQueue, imageId\) : null/);
  assert.match(workspace, /await ds\.setStatus\(imageId, status\)[\s\S]{0,80}if \(advancing\) setViewImg\(next\)/);
  // Returning an image to 'pending' is not a verdict — it must not advance.
  assert.match(workspace, /status !== 'pending' && !!reviewQueuePosition\(improveQueue, imageId\)/);
  // The rescue review has its own flow and its own verdict UI.
  assert.match(workspace, /onStatus=\{viewImgLive\._rescueReviewPreview \? undefined : decideViewImg\}/);
});

test('workspace feeds the lightbox the resolved parent of a derived image', () => {
  assert.match(workspace, /describeDerivedComparison/);
  assert.match(workspace, /compare=\{viewImgComparison\}/);
  assert.match(workspace, /parentNonce=/);
});

test('workspace guards rescue rows and detects a pending improvement child', () => {
  assert.match(workspace, /!viewImgLive\._rescueReviewPreview/);
  assert.match(workspace, /!isSmallImageRescueRow\(viewImgLive\)/);
  assert.match(workspace, /viewImgLive\.derivation_kind !== 'klein_image_improve'/);
  assert.match(workspace, /image\.derivation_kind === 'klein_image_improve'/);
  assert.match(workspace, /image\.parent_image_id === viewImgLive\.id/);
  assert.match(workspace, /const viewImgImproving[\s\S]*image\.status === 'pending'[\s\S]*\)\) : false/);
  assert.match(workspace, /const viewImgImprovementReady[\s\S]*image\.status === 'pending'[\s\S]*!!image\.filename/);
  // Engine readiness is read from capabilities INSIDE the lightbox now, per
  // engine — a `kleinAvailable` prop would be a second source of truth for
  // one of the two engines and none for the other.
  assert.match(workspace, /onImprove=\{canImproveViewImg/);
  assert.match(workspace, /ds\.improveImage\(imageId, \{ engine \}\)/);
});

test('dataset hook starts improvement, reports the preserved original, then refreshes', () => {
  assert.match(hook, /`\/api\/dataset\/image\/\$\{imageId\}\/improve`,/);
  // The engine rides along when the caller names one (the lightbox's two
  // buttons); absent, the server falls back to the improve.engine setting.
  assert.match(hook, /engine \? \{ engine \} : \{\}/);
  assert.match(hook, /original stays intact while a separate 2 MP candidate is generated for validation/);
  assert.match(hook, /Could not start image improvement/);
  assert.match(hook, /resolveSmallImageRescue, improveImage, reimproveImage, improveBatch, classify/);
});

test('the bulk improvement is ONE call that starts a server job, not a per-image loop', () => {
  assert.match(hook, /`\/api\/dataset\/\$\{currentId\}\/improve\/batch`,/);
  assert.match(hook, /\{ image_ids: ids, engine \}/);
  // The engine the user pressed rides along; absent, the server falls back to the
  // improve.engine setting (which is what the single-tile pass uses).
  assert.match(grid, /onImproveBatch\(eligible\.map\(\(image\) => image\.id\), engineId\)/);
  // No client-side sequential driver survives: that loop is what walked into the
  // fan-out cap and made ⏹ Stop powerless.
  assert.doesNotMatch(grid, /runSequentialKleinImprove/);
  // Progress is read from the server activity, so it survives a reload.
  assert.match(grid, /improveBatchLabel\(activity\)/);
  // ⏹ Stop generation stays reachable (and enabled) for a running batch. The
  // enabled-ness itself is decided by isStopGenerationBlocked (unit-tested in
  // scraperState.test.js) — this earlier inline expression only exempted
  // 'improve', which left the button dead for every plain generation batch.
  assert.match(workspace, /pending > 0 \|\| act\?\.kind === 'improve'/);
  assert.match(workspace, /disabled=\{isStopGenerationBlocked\(\{[\s\S]{0,120}?busy: ds\.busy, activity: act/);
});

test('settings separates scraper rescue instructions from manual lightbox improvement', () => {
  assert.match(settings, /title="Klein rescue — small scraped images"/);
  assert.match(settings, /automatic rescue of scraped images under 768 px/);
  // The point is that the two flows are distinct and the manual one is elsewhere —
  // asserted on that meaning, not on a fixed sentence. The old wording claimed the
  // manual pass had a fixed profile, which stopped being true once its strength and
  // step count became editable.
  assert.match(settings, /manual Upscale & improve is a different flow/);
  assert.match(settings, /Settings ▸ Image engines/);
  // the rescue card points at the separate manual "Identity & Klein prompts" card
  assert.match(settings, /separate from the manual .Klein upscale &amp; improve. prompt/i);
});

test('manual improvement candidates cannot use the unrelated generic regenerate path', () => {
  const gridItem = readFileSync(new URL('./DatasetGridItem.jsx', import.meta.url), 'utf8');
  // The guard moved into improveRerun.js (testable in node --test, which cannot
  // parse JSX) when the tile gained its own 🔄✨ re-run of the improve pass. Same
  // meaning, asserted at both ends: the tile delegates, and the decision refuses.
  assert.match(gridItem, /const isImageImproveCandidate = isImageImproveRow\(img\)/);
  assert.match(gridItem, /const canRegenerate = canRegenerateGeneric\(img, \{ isRescueDerived \}\)/);
  assert.match(gridItem, /if \(!isImageImproveCandidate && img\.status !== 'reject'/);
  assert.equal(canRegenerateGeneric({ source: 'generated', filename: 'a.png', status: 'keep',
    derivation_kind: 'klein_image_improve', parent_image_id: 2 }), false);
});

test('curation grid and lightbox render the persisted safe Pexels attribution', () => {
  const gridItem = readFileSync(new URL('./DatasetGridItem.jsx', import.meta.url), 'utf8');
  assert.match(gridItem, /<PexelsAttribution metadata=\{img\.source_metadata\}/);
  assert.match(lightbox, /<PexelsAttribution metadata=\{img\.source_metadata\}/);
  assert.match(attribution, /Photo by\{' '\}/);
  assert.match(attribution, /rel="noopener noreferrer"/);
  assert.match(attribution, /attribution\.photographerUrl/);
  assert.match(attribution, /attribution\.sourceUrl/);
});
