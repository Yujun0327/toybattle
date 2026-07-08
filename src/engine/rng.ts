/** Deterministic PRNG (mulberry32). Used ONLY for shared public randomness. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Draw the n-th value (0-based) of the shared stream for `seed`.
 * O(n), but n stays tiny (a handful of draws per game).
 */
export function sharedDrawAt(seed: number, cursor: number): number {
  const rng = mulberry32(seed)
  let v = 0
  for (let i = 0; i <= cursor; i++) v = rng()
  return Math.floor(v * 4294967296) >>> 0
}
