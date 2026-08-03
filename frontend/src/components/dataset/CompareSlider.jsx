/**
 * Before/after on ONE frame, split by a divider you drag.
 *
 * Two panes side by side made the eye travel between two boxes and remember
 * what it just saw — which is exactly what a subtle change (skin texture, a
 * softened jaw) survives. Stacking the images and wiping between them puts the
 * difference under the same pixels, so it has nowhere to hide.
 *
 * Both images fill the same box with `object-contain`: the improve pass keeps
 * the aspect ratio while changing the pixel count, so identical boxes are what
 * makes the two readings comparable at all. Zoom stays off here for the same
 * reason it was off in the side-by-side view — at 100 % two different pixel
 * counts cover different parts of the subject.
 *
 * The face score of each side rides on its label, because "is it prettier" and
 * "is it still the same person" are two different questions and the improve
 * pass regularly answers them in opposite directions. The delta is the number
 * that decides: a result that costs more than a few points of similarity is a
 * new face, however good the skin looks.
 */
import { useRef, useState } from 'react';
import { faceVerdict, facePercent } from '../../utils/faceBadge';

const TONE = {
  green: 'border-green-400/50 bg-green-400/10 text-green-300',
  amber: 'border-amber-400/50 bg-amber-400/10 text-amber-300',
  red: 'border-red-400/50 bg-red-400/10 text-red-300',
  grey: 'border-white/25 bg-white/5 text-white/60',
};
const NO_SCORE_HELP = 'No face score for this image yet — run 🎭 Analyze faces in Curation';
// Arrow keys are the whole keyboard story: 2 % a press crosses the frame in a
// second held down, and lands on both extremes exactly.
const KEY_STEP = { ArrowLeft: -2, ArrowRight: 2 };

function ScoreBadge({ img, thresholds, delta = null }) {
  const verdict = faceVerdict(img, thresholds);
  const percent = facePercent(verdict);
  const tone = TONE[verdict?.tone || 'grey'];
  const title = verdict?.scored
    ? `Face similarity vs the dataset reference (ArcFace cosine): ${verdict.score.toFixed(3)}`
    : NO_SCORE_HELP;
  // A delta is only meaningful when BOTH sides carry a real score.
  const gap = verdict?.scored && Number.isFinite(delta) ? delta : null;
  return (
    <span title={title}
      className={`ml-1.5 rounded border px-1 py-px text-[10px] font-semibold tabular-nums ${tone}`}>
      🎯 {verdict?.scored ? `${percent}%` : (verdict?.label || 'not scored')}
      {gap !== null && (
        <span className={`ml-1 ${gap > 0 ? 'text-green-300' : gap < 0 ? 'text-red-300' : 'text-white/60'}`}>
          {gap > 0 ? '▲ +' : gap < 0 ? '▼ -' : '± '}{Math.abs(gap)} pts
        </span>
      )}
    </span>
  );
}

export default function CompareSlider({
  before, after, beforeLabel, afterLabel, beforeImg, afterImg, alt, faceThresholds,
}) {
  const [pct, setPct] = useState(50);
  const boxRef = useRef(null);

  const beforePercent = facePercent(faceVerdict(beforeImg, faceThresholds));
  const afterPercent = facePercent(faceVerdict(afterImg, faceThresholds));
  const delta = beforePercent === null || afterPercent === null
    ? null
    : afterPercent - beforePercent;

  const track = (clientX) => {
    const box = boxRef.current;
    if (!box) return;
    const { left, width } = box.getBoundingClientRect();
    if (!width) return;
    setPct(Math.min(100, Math.max(0, ((clientX - left) / width) * 100)));
  };

  return (
    /* role="slider" and not an <input type="range">: the whole frame is the
       control (grab anywhere, not just a thumb), and pointer capture keeps the
       drag alive when the pointer leaves the box mid-wipe. */
    <div ref={boxRef} role="slider" tabIndex={0}
      aria-label={`Compare ${beforeLabel} and ${afterLabel} — drag to reveal`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        track(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e.clientX);
      }}
      onKeyDown={(e) => {
        const step = KEY_STEP[e.key];
        if (!step) return;
        e.preventDefault();
        setPct((v) => Math.min(100, Math.max(0, v + step)));
      }}
      className="relative m-2 flex-1 min-h-0 min-w-0 cursor-ew-resize touch-none select-none overflow-hidden rounded-lg border border-white/15 sm:m-4">
      <img src={after} alt={`${afterLabel} — ${alt}`} draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain" />
      {/* clip-path, not a width: the top image keeps the SAME box as the one
          underneath, so its content never reflows as the divider moves — the
          two halves stay pixel-aligned at every position. */}
      <img src={before} alt={`${beforeLabel} — ${alt}`} draggable={false}
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        className="absolute inset-0 h-full w-full select-none object-contain" />
      <div aria-hidden style={{ left: `${pct}%` }}
        className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
      <div aria-hidden style={{ left: `${pct}%` }}
        className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-black/45" />
      <span className="pointer-events-none absolute left-2 top-2 flex items-center rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-white/80">
        {beforeLabel}
        <ScoreBadge img={beforeImg} thresholds={faceThresholds} />
      </span>
      <span className="pointer-events-none absolute right-2 top-2 flex items-center rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-indigo-200">
        {afterLabel}
        <ScoreBadge img={afterImg} thresholds={faceThresholds} delta={delta} />
      </span>
    </div>
  );
}
