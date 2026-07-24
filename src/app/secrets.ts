import { fullArmy } from '../engine/troops'
import type { PlayerId, TroopType } from '../engine/types'
import type { GameSnapshot } from '../transport/types'

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

export interface SavedGame {
  snapshot: GameSnapshot
  side: PlayerId
  reserve: TroopType[]
}

const key = (room: string) => `toybattle:room:${room}`

export function saveGame(room: string, saved: SavedGame): void {
  try {
    localStorage.setItem(key(room), JSON.stringify(saved))
  } catch {
    /* storage full/blocked — game continues, refresh-resume just won't work */
  }
}

export function loadGame(room: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(key(room))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedGame
    if (!parsed?.snapshot?.gameId || !parsed.side || !Array.isArray(parsed.reserve)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearGame(room: string): void {
  try {
    localStorage.removeItem(key(room))
  } catch {
    /* ignore */
  }
}
