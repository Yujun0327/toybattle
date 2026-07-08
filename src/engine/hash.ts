import type { GameState, PlayerId } from './types'

/**
 * The public projection of a state: everything both clients must agree on.
 * Private zone contents are excluded; counts are included.
 */
export function publicProjection(state: GameState): unknown {
  const pub = structuredClone(state)
  for (const p of ['red', 'blue'] as PlayerId[]) {
    delete pub.players[p].rack.known
    delete pub.players[p].reserve.known
  }
  return pub
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as object).sort()
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`
}

/** FNV-1a over the canonical public projection. Cheap desync tripwire, not crypto. */
export function publicHash(state: GameState): string {
  const str = stableStringify(publicProjection(state))
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
