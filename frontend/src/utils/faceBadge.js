/**
 * The ONE reading of `face_state` / `face_score` the whole app shares.
 *
 * It lived inside DatasetGridItem, so every other surface that wanted to show a
 * face score had to re-invent its thresholds — and a second copy is how the grid
 * and the lightbox end up disagreeing about the same number in front of the
 * user. `faceVerdict` is the fact; `faceBadge` is the grid tile's dressing of it.
 */

// Seuils calibres antelopev2 (test3) — face_score brut persiste -> ajustables dans
// Settings (face_scoring.green/orange) ; ces valeurs ne servent que de repli.
export const DEFAULT_FACE_VALID = 0.50;
export const DEFAULT_FACE_ORANGE = 0.45;

export const GREY_LABEL = { no_face: 'no face detected', low_det: 'low detection',
  too_small: 'face too small', extreme_pose: 'profile — not scored',
  unreadable: 'unreadable', error: 'error' };

/**
 * null when the pass never ran on this image (nothing to say), else
 * `{ scored, score, tone, label }` where tone is 'green' | 'amber' | 'red' for a
 * real score and 'grey' for a face the scorer refused to judge.
 */
export function faceVerdict(img, thresholds) {
  if (img?.face_state == null) return null;
  const score = img.face_score;
  if (img.face_state !== 'scorable' || typeof score !== 'number' || !Number.isFinite(score)) {
    return { scored: false, score: null, tone: 'grey',
      label: GREY_LABEL[img.face_state] || 'not scored' };
  }
  const green = thresholds?.green ?? DEFAULT_FACE_VALID;
  const orange = thresholds?.orange ?? DEFAULT_FACE_ORANGE;
  const tone = score >= green ? 'green' : score >= orange ? 'amber' : 'red';
  return { scored: true, score, tone, label: score.toFixed(2) };
}

/** The cosine as whole percent, or null — what a badge prints. */
export function facePercent(verdict) {
  return verdict?.scored ? Math.round(verdict.score * 100) : null;
}

// Retourne {border, icon, cls, label} d'apres face_state/face_score, ou null si pas analysé.
// La bordure encode la largeur ET le style (plein=jugé / pointillé=non-jugeable) pour
// ne PAS dépendre de la couleur seule (WCAG 1.4.1).
export function faceBadge(img, thresholds) {
  const verdict = faceVerdict(img, thresholds);
  if (verdict === null) return null;
  if (!verdict.scored) {
    return { border: 'border-2 border-dashed border-gray-500', icon: '👁', cls: 'text-gray-300',
      label: verdict.label };
  }
  if (verdict.tone === 'green') {
    return { border: 'border-2 border-green-500', icon: '✓', cls: 'text-green-300',
      label: verdict.label };
  }
  if (verdict.tone === 'amber') {
    return { border: 'border-2 border-amber-500', icon: '~', cls: 'text-amber-300',
      label: `${verdict.label} to review` };
  }
  return { border: 'border-4 border-red-500', icon: '⚠', cls: 'text-red-300',
    label: `${verdict.label} low` };
}
