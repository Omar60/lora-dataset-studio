/**
 * Full-screen inspection lightbox (F3): toggle fit ↔ 100 % (native pixels) to
 * hunt skin/eyes artefacts before keeping an image. Esc, ✕ or a click on the
 * backdrop close it; a click on the image toggles the zoom mode.
 *
 * The action bar is NOT always at the bottom: beside a portrait image on a wide
 * window it becomes a side rail in the space that image cannot use, which hands
 * the bar's height back to the photo. `lightboxActionPlacement.js` owns that
 * decision and its stability guarantees.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import CompareSlider from './CompareSlider';
import KleinImproveNote from './KleinImproveNote';
import { lightboxImproveButtons } from '../../utils/improveEngines';
import { useCapabilities } from '../../context/CapabilitiesContext';
import {
  decideActionPlacement, rememberImageRatio, readImageRatio,
} from './lightboxActionPlacement';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { displayLabel } from '../../utils/labels';
import PexelsAttribution from './PexelsAttribution';

const COMPARE_HELP = 'Overlay the original this image was made from and drag the divider to compare, at the same scale.';

export default function DatasetLightbox({
  img,
  datasetId,
  nonce = 0,
  compare = null,
  parentNonce = 0,
  onClose,
  onCrop,
  onMirror,
  onRotate,
  onImprove,
  busy = false,
  mirrorBusy = false,
  improvePending = false,
  improveReady = false,
  subjectType = '',
  faceThresholds = null,
  onStatus,
  onNavigate,
  queuePosition = null,
}) {
  const { caps } = useCapabilities();
  const [full, setFull] = useState(false); // false = fit screen, true = 100 %
  const [comparing, setComparing] = useState(false);
  const [improving, setImproving] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  /* WHERE THE ACTIONS LIVE. A portrait photo on a wide monitor leaves two
     thirds of the width black while the buttons queue on one line under it, on
     the one axis the image is short of. The rule (and the geometry behind it)
     lives in lightboxActionPlacement.js because `node --test` cannot parse JSX
     and this is the part that must be tested case by case. */
  const imageId = img?.id ?? null;
  // A rail decided mid-rotation would move under the pointer that started it.
  const actionsLocked = busy || mirrorBusy || improving || improvePending;
  const [ratio, setRatio] = useState(() => readImageRatio(imageId));
  // Decided for the FIRST painted frame, not corrected by an effect afterwards:
  // with the ratio already known (the grid measured it) there is no frame in
  // which the actions sit somewhere they are about to leave.
  const [placement, setPlacement] = useState(() => decideActionPlacement({
    viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
    imageWidth: ratio?.imageWidth,
    imageHeight: ratio?.imageHeight,
  }));

  // A new image starts from whatever was measured for it before — reopening one
  // therefore never replays the bottom→rail commit in front of the user.
  useEffect(() => { setRatio(readImageRatio(imageId)); }, [imageId]);

  const onImageLoad = useCallback((event) => {
    const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
    rememberImageRatio(imageId, w, h);
    setRatio((prev) => (prev && prev.imageWidth === w && prev.imageHeight === h
      ? prev
      : { imageWidth: w, imageHeight: h }));
  }, [imageId]);

  useEffect(() => {
    let frame = 0;
    const apply = () => setPlacement((current) => decideActionPlacement({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      imageWidth: ratio?.imageWidth,
      imageHeight: ratio?.imageHeight,
      current,
      comparing,
      locked: actionsLocked,
    }));
    apply();
    // One decision per frame: a window drag fires `resize` dozens of times a
    // second, and re-deciding per event is how a bar ends up shimmering.
    const onResize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; apply(); });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ratio, comparing, actionsLocked]);

  const rail = placement === 'rail';

  // Focus trap keeps Tab inside the dialog (P2-7).
  useFocusTrap(dialogRef, !!(img && img.filename));

  // A comparison is only ever entered when the original is actually renderable;
  // an unavailable one degrades to a stated reason, never a dead button.
  const canCompare = !!(compare && compare.available && compare.parent?.filename);

  // Keyboard support: Escape closes, ← → walk the review queue, initial focus on
  // the close button.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!onNavigate || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      // The divider owns the arrows while it holds focus — it is a slider, and
      // stealing its keys would make the one control you just grabbed inert.
      if (e.target?.closest?.('[role="slider"]')) return;
      e.preventDefault();
      onNavigate(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);
  useEffect(() => { closeRef.current?.focus(); }, []);
  /* Walking the review queue KEEPS the comparison open: leaving it between two
     candidates is the manual step this queue exists to remove. It closes itself
     only when the next image has no original to compare against, where staying
     "in comparison" would be a mode with nothing in it. */
  useEffect(() => { if (!canCompare) setComparing(false); }, [img?.id, canCompare]);

  if (!img || !img.filename) return null;
  const fileUrl = (filename, v) =>
    `/api/dataset/${datasetId}/img/${encodeURIComponent(filename)}${v ? `?v=${v}` : ''}`;
  const url = fileUrl(img.filename, nonce);
  const alt = displayLabel(img.variation_label) || 'dataset image';
  const inCompare = canCompare && comparing;
  const improvementActive = improving || improvePending;
  /* ONE button per engine that can run here, exactly like the selection
     toolbar. The lightbox is where you are when you are looking at the one
     image you want to fix, and until now it only offered Klein — so on a DRAWN
     dataset the amber note warned that Klein pulls the skin towards realism
     while the pass that does not, SeedVR2, was two screens away (reported by
     a user with a screenshot of exactly that). The wording, the gating and the
     per-engine disabled reasons all come from the shared pure module, so this
     surface can never drift from the toolbar's. */
  const improveButtons = onImprove
    ? lightboxImproveButtons({
      caps, engines: caps?.engines, improving, improvePending, improveReady, busy,
    })
    : [];

  const improve = (engineId, disabled) => async (event) => {
    event.stopPropagation();
    if (!onImprove || disabled) return;
    setImproving(true);
    try {
      await onImprove(img.id, engineId);
    } finally {
      setImproving(false);
    }
  };

  const mirror = async (event) => {
    event.stopPropagation();
    if (!onMirror || busy || mirrorBusy) return;
    await onMirror(img.id);
  };

  // 🔄 Quarter turns (idea by 1Tomber, GitHub #17). `mirrorBusy` is the shared
  // "a pixel edit is running on this image" flag — both actions rewrite the same
  // file, so neither may start while the other is in flight.
  const rotate = (degrees) => async (event) => {
    event.stopPropagation();
    if (!onRotate || busy || mirrorBusy) return;
    await onRotate(img.id, degrees);
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Inspect — ${alt}`}
      className={`fixed inset-0 z-[9996] bg-black/95 flex ${rail ? 'flex-row' : 'flex-col'}`}
      onClick={onClose}>
      <button type="button" ref={closeRef}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close (Esc)" aria-label="Close inspection"
        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg leading-none">✕</button>

      {inCompare ? (
        /* One frame for both images at every width — a phone gets the same
           reading as a desktop, which two stacked 190 px panes never gave. */
        <CompareSlider alt={alt}
          before={fileUrl(compare.parent.filename, parentNonce)} after={url}
          beforeLabel={compare.beforeLabel} afterLabel={compare.afterLabel}
          beforeImg={compare.parent} afterImg={img} faceThresholds={faceThresholds} />
      ) : full ? (
        <div className="flex-1 min-h-0 min-w-0 overflow-auto">
          <img src={url} alt={alt} onLoad={onImageLoad}
            onClick={(e) => { e.stopPropagation(); setFull(false); }}
            className="max-w-none cursor-zoom-out select-none" />
        </div>
      ) : (
        /* min-w-0 matters only in rail mode: without it this flex child refuses
           to shrink below its content and the rail gets pushed off-screen. */
        <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-4">
          <img src={url} alt={alt} onLoad={onImageLoad}
            onClick={(e) => { e.stopPropagation(); setFull(true); }}
            className="max-h-full max-w-full object-contain cursor-zoom-in select-none" />
        </div>
      )}

      {/* DOM order is the SAME in both placements — meta, then compare, crop,
          mirror, rotate, improve, then the Klein note. A rail that reads left
          to right on screen but jumps around under Tab would trade one problem
          for a worse one, so nothing here reorders itself; only the axis
          changes. `overflow-y-auto` is the promise that a short window can
          still reach the last action. */}
      <div onClick={(e) => e.stopPropagation()}
        className={rail
          ? 'shrink-0 flex w-[17rem] flex-col items-stretch gap-2 overflow-y-auto border-l border-white/10 bg-black/60 px-4 pb-4 pt-14'
          : 'shrink-0 flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 bg-black/60'}>
        {/* One group, so the rail stacks four lines of context instead of four
            full-width blocks (a stretched 10 px pill reads as a button). */}
        <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${
          rail ? 'justify-start' : 'justify-center'}`}>
          <span className="text-white text-sm">{alt}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/80">
            {img.source === 'import' ? 'real' : 'generated'}{img.framing ? ` · ${img.framing}` : ''}
          </span>
          <PexelsAttribution metadata={img.source_metadata}
            className="text-[11px] text-white/70" />
          <span className="text-white/50 text-[11px]">
            {inCompare
              /* Zoom is OFF here, and says so. At 100 % a 2 MP result and a 0.5 MP
                 original cover different parts of the subject, which is exactly
                 the dishonest comparison this mode exists to avoid. */
              ? 'same scale — drag the divider; exit comparison to zoom to 100 %'
              : full ? '100 % — click image to fit' : 'fitted — click image for 100 %'}
          </span>
        </div>
        {canCompare && (
          <button type="button" aria-pressed={comparing}
            onClick={(e) => { e.stopPropagation(); setFull(false); setComparing((v) => !v); }}
            aria-label={comparing
              ? `Hide the original overlay on ${alt}`
              : `Overlay the original on ${alt} to compare`}
            title={COMPARE_HELP}
            className="min-h-9 w-full sm:w-auto px-3 py-1.5 rounded-lg border border-indigo-400/50 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 text-xs font-semibold">
            {comparing ? '⊟ Exit comparison' : '⧉ Compare with original'}
          </button>
        )}
        {compare && !compare.available && (
          /* No affordance rather than a dead one — and it says why, because
             "there is no compare button here" is otherwise indistinguishable
             from a bug. */
          <span role="note"
            className="max-w-full break-words rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
            <span aria-hidden>⚠ </span>{compare.reason}
          </span>
        )}
        {onStatus && (
          /* The verdict lives HERE, next to the comparison, because this is
             where it can be made: judging an improvement from the grid means
             remembering what the original looked like. Same toggle semantics as
             the grid's ✓/✕ (pressing the current state returns to undecided) —
             two places, one behaviour. Deciding a queued improvement also moves
             to the next one; that is the parent's business, not this button's. */
          <div className={`flex items-stretch gap-2 ${rail ? 'w-full' : 'w-full sm:w-auto'}`}>
            <button type="button" disabled={busy}
              onClick={() => onStatus(img.id, img.status === 'keep' ? 'pending' : 'keep')}
              aria-pressed={img.status === 'keep'} aria-label={`Keep ${alt}`}
              title="Keep this version (press again to make it undecided)"
              className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                img.status === 'keep'
                  ? 'bg-green-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'}`}>
              <span aria-hidden="true">✓</span> Keep
            </button>
            <button type="button" disabled={busy}
              onClick={() => onStatus(img.id, img.status === 'reject' ? 'pending' : 'reject')}
              aria-pressed={img.status === 'reject'} aria-label={`Reject ${alt}`}
              title="Reject this version (press again to make it undecided)"
              className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                img.status === 'reject'
                  ? 'bg-red-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'}`}>
              <span aria-hidden="true">✕</span> Reject
            </button>
          </div>
        )}
        {onNavigate && queuePosition && (
          /* Only ever shown while this image IS one of the improvements waiting
             for a verdict: a "next" that walked the whole grid would leave the
             comparison behind on the first plain photo it hit. The count is the
             honest part — it says how much of the queue is left. */
          <div className={`flex items-stretch gap-2 ${rail ? 'w-full' : 'w-full sm:w-auto'}`}>
            <button type="button" onClick={() => onNavigate(-1)}
              disabled={queuePosition.index <= 1}
              aria-label="Previous improvement to review"
              title="Previous improvement to review (←)"
              className="min-h-9 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45">
              <span aria-hidden="true">‹</span>
            </button>
            <span className="flex flex-1 items-center justify-center px-1 text-[11px] text-white/60 tabular-nums"
              title="Improvements still waiting for a verdict">
              {queuePosition.index} / {queuePosition.total} to review
            </span>
            <button type="button" onClick={() => onNavigate(1)}
              disabled={queuePosition.index >= queuePosition.total}
              aria-label="Next improvement to review"
              title="Next improvement to review (→)"
              className="min-h-9 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45">
              <span aria-hidden="true">›</span>
            </button>
          </div>
        )}
        {onCrop && (
          <button type="button" onClick={() => onCrop(img)}
            title="Open the crop editor for this image (stretchable box, any ratio)"
            className="min-h-9 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
            ✂ Crop
          </button>
        )}
        {onMirror && (
          <button type="button" onClick={mirror} disabled={busy || mirrorBusy}
            aria-busy={mirrorBusy}
            aria-label={mirrorBusy ? `Mirroring ${alt} horizontally` : `Mirror ${alt} horizontally`}
            title={mirrorBusy ? 'Mirroring horizontally…' : 'Mirror horizontally (flip left and right)'}
            className="min-h-9 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45">
            {mirrorBusy ? '⇆ Mirroring…' : '⇆ Mirror horizontally'}
          </button>
        )}
        {onRotate && (
          /* The pair shares ONE row even on a 400 px screen: two full-width
             rows for two halves of the same gesture would push everything else
             below the fold. In the rail the same row spans its full width —
             `sm:flex-none` would otherwise leave them huddled on the left,
             reading as a different kind of control than their neighbours.
             Emoji stay aria-hidden — the label is the text. */
          <div className={`flex items-stretch gap-2 ${rail ? 'w-full' : 'w-full sm:w-auto'}`}>
            <button type="button" onClick={rotate(270)} disabled={busy || mirrorBusy}
              aria-busy={mirrorBusy} aria-label={`Rotate ${alt} 90 degrees left`}
              title="Rotate 90° left (counter-clockwise) — keeps the file's format; four turns come back round"
              className={`min-h-9 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45 ${
                rail ? '' : 'sm:flex-none'}`}>
              <span aria-hidden="true">↺</span> Rotate left
            </button>
            <button type="button" onClick={rotate(90)} disabled={busy || mirrorBusy}
              aria-busy={mirrorBusy} aria-label={`Rotate ${alt} 90 degrees right`}
              title="Rotate 90° right (clockwise) — keeps the file's format; four turns come back round"
              className={`min-h-9 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45 ${
                rail ? '' : 'sm:flex-none'}`}>
              <span aria-hidden="true">↻</span> Rotate right
            </button>
          </div>
        )}
        {improveButtons.map((btn) => (
          <Fragment key={btn.id}>
            <button type="button"
              onClick={improve(btn.id, btn.disabled)} disabled={btn.disabled}
              aria-busy={improvementActive} title={btn.title}
              className="min-h-9 w-full sm:w-auto px-3 py-1.5 rounded-lg border border-indigo-400/50 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45">
              {btn.label}
            </button>
            {/* Klein's note goes BETWEEN the two buttons in the rail, and only
                there. The rail is a column, so sitting under Klein is what makes
                it read as Klein's — which matters, because it warns that Klein's
                INSTRUCTION ("detailed texture, sharp details") pulls drawn skin
                towards realism, while SeedVR2 sends no instruction at all.
                In the BOTTOM bar the buttons are a horizontal ROW, and a
                full-width paragraph dropped mid-row pushes everything after it
                onto its own line: a user reported the second improve button
                stranded alone, centred, at the very bottom of the screen. There
                the note therefore follows the whole group (see below) — its own
                first words, "Improve asks Klein to:", carry the attribution that
                position gave it in the rail. */}
            {rail && btn.showKleinNote && !improvementActive && (
              <KleinImproveNote subjectType={subjectType} datasetId={datasetId}
                className="w-full border-t border-white/10 pt-2" />
            )}
          </Fragment>
        ))}
        {/* Bottom bar only: the note takes its OWN line under the buttons.
            `sm:w-auto` used to let it sit INLINE beside them, which was fine
            with a single improve button and is not with two — the paragraph
            took the width the second button needed and pushed it off alone.
            Full-width in a wrap container is a line break, so the buttons wrap
            among themselves and the note reads under the whole group. */}
        {!rail && improveButtons.some((b) => b.showKleinNote) && !improvementActive && (
          <KleinImproveNote subjectType={subjectType} datasetId={datasetId}
            className="w-full" />
        )}
        {/* Its strength, step count and instruction are all editable, and nothing
            here said so — the reported case for making settings discoverable from
            where the action happens. A link alone was not enough: it pointed at
            the strength knobs while the complaint ("anime comes back realistic",
            Qeeyana on Reddit) is caused by the INSTRUCTION. The note quotes that
            instruction live and links to both. */}
        {/* It stays glued to ✨, in both placements. It is what the button is
            about to ask the model for, so it is only worth reading in the
            second before clicking — parked anywhere else it becomes a stray
            paragraph. The rail is where it fits BEST: it is prose, and a 15rem
            column is a better shape for prose than a strip squeezed to the
            right of six buttons. A rule above it ties it to the ✨ it explains. */}

      </div>
    </div>
  );
}
