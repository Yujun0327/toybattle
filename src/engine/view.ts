import { deepClone } from './clone'
import type { GameState, PlayerId } from './types'

/**
 * The state as one player is allowed to see it: the other player's zone
 * contents are stripped, leaving only counts. Hot-seat UIs skip redaction.
 */
export function redact(state: GameState, viewer: PlayerId): GameState {
  const view = deepClone(state)
  for (const p of ['red', 'blue'] as PlayerId[]) {
    if (p !== viewer) {
      delete view.players[p].rack.known
      delete view.players[p].reserve.known
    }
  }
  return view
}
