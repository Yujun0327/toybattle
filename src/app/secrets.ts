import { fullArmy } from '../engine/troops'
import type { TroopType } from '../engine/types'

/** Cryptographically shuffle a fresh army and remove 4 tiles unseen → a 20-tile reserve. */
export function shuffledReserve(): TroopType[] {
  const tiles = fullArmy()
  const rand = new Uint32Array(tiles.length)
  crypto.getRandomValues(rand)
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return tiles.slice(4) // the first 4 leave the game, unseen by anyone
}
