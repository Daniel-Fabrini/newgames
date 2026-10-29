// Loads a scene's hit data (JSON) and its big picture (WebP), with a small cache so the
// next level can be prepared while the player is busy.

const metaCache = new Map();
const imgCache = new Map();

const urlOf = (name) => new URL(`../scenes/${name}`, import.meta.url).href;
export const spriteUrl = (name) => new URL(`../sprites/${name}`, import.meta.url).href;
export const sceneThumbUrl = (id) => urlOf(`${id}_s.webp`);

export function loadMeta(id) {
  if (!metaCache.has(id)) {
    metaCache.set(
      id,
      fetch(urlOf(`${id}.json`)).then((r) => {
        if (!r.ok) throw new Error(`scene ${id}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return metaCache.get(id);
}

export function loadImage(id) {
  if (!imgCache.has(id)) {
    imgCache.set(
      id,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`image ${id}`));
        img.src = urlOf(`${id}.webp`);
      }).then(async (img) => {
        try {
          await img.decode();
        } catch {
          /* already usable */
        }
        return img;
      }),
    );
  }
  return imgCache.get(id);
}

export async function loadScene(id) {
  const [meta, img] = await Promise.all([loadMeta(id), loadImage(id)]);
  return { meta, img };
}

// Keeps only the given scene images in memory (the current and the next one).
export function keepOnly(ids) {
  for (const k of [...imgCache.keys()]) if (!ids.includes(k)) imgCache.delete(k);
}
