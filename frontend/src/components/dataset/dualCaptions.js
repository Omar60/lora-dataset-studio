// Which training families can actually honour dual (long + short) captions.
//
// Krea 2 and Anima pre-cache their text embeddings and unload the text encoder to fit
// their DiT in VRAM. ai-toolkit caches exactly ONE embedding per image (the long
// caption), and once the encoder is gone the train loop reads those cached embeddings
// instead of the prompt strings — so a short caption has nowhere to be encoded. Emitting
// the pair anyway crashed the run at the first step (GitHub issue #22, reported by
// 1Tomber). The backend now refuses the combination when it builds the ai-toolkit config;
// this mirror exists so the toggle can say so BEFORE the launch instead of letting the
// user believe both wordings are training.
//
// Kept in a plain .js module (not the JSX panel) so `node --test` can cover it.
export const DUAL_CAPTION_UNSUPPORTED_FAMILIES = ['krea', 'anima'];

const FAMILY_LABEL = {
  zimage: 'Z-Image', krea: 'Krea 2', sdxl: 'SDXL',
  flux: 'FLUX.1', flux2klein: 'FLUX.2 Klein', anima: 'Anima',
};

/** Does this family cache text embeddings when nobody says otherwise?
    Mirrors lora_training._cache_text_embeddings_eff: Krea 2 and Anima emit the
    cache in their own recipe, every other family only when asked. */
export function cacheTextEmbeddingsDefault(family) {
  return DUAL_CAPTION_UNSUPPORTED_FAMILIES.includes(family);
}

/** What the run will ACTUALLY do: the stored override when it is a real
    boolean, the family's own recipe otherwise (null/undefined = untouched). */
export function cacheTextEmbeddingsEffective(value, family) {
  return typeof value === 'boolean' ? value : cacheTextEmbeddingsDefault(family);
}

/**
 * @param {string} family training family id (`train_type`)
 * @param {{cacheTextEmbeddings?: boolean|null}} [opts] the stored override
 * @returns {{supported: boolean, note: string}} `note` is empty when supported.
 */
export function dualCaptionsSupport(family, { cacheTextEmbeddings } = {}) {
  const label = FAMILY_LABEL[family] || family;
  // An override turns caching ON anywhere — and OFF on the two families that
  // ship it. What decides is the effective value, never the family alone: a
  // Krea run with the cache switched off CAN train both captions, and a Z-Image
  // run with it switched on cannot.
  if (!cacheTextEmbeddingsEffective(cacheTextEmbeddings, family)) {
    return { supported: true, note: '' };
  }
  if (cacheTextEmbeddings === true && !cacheTextEmbeddingsDefault(family)) {
    return {
      supported: false,
      note: 'Cache text embeddings is on, and ai-toolkit caches exactly one embedding per '
        + 'image (the long caption) — turn it off to train both wordings.',
    };
  }
  return {
    supported: false,
    note: `${label} caches its text embeddings and unloads the text encoder, so the short `
      + 'caption cannot be encoded — this run trains on the long caption alone.',
  };
}
