import { RulesError, type TroopType, type Zone } from './types'

export function makeKnownZone(tiles: TroopType[]): Zone {
  return { count: tiles.length, known: [...tiles] }
}

export function makeHiddenZone(count: number): Zone {
  return { count }
}

/** Move up to n tiles from the front of `from` to the end of `to` (draw). */
export function zoneTransfer(from: Zone, to: Zone, n: number): void {
  if (n > from.count) throw new RulesError('zone underflow')
  from.count -= n
  to.count += n
  if (from.known) {
    const moved = from.known.splice(0, n)
    if (to.known) to.known.push(...moved)
  } else if (to.known) {
    throw new RulesError('cannot transfer from hidden zone into known zone')
  }
}

/** Remove one tile of the given type (first occurrence) — e.g. playing from rack. */
export function zoneRemoveTroop(zone: Zone, troop: TroopType): void {
  if (zone.count <= 0) throw new RulesError('zone empty')
  zone.count--
  if (zone.known) {
    const i = zone.known.indexOf(troop)
    if (i === -1) throw new RulesError(`tile ${troop} not in zone`)
    zone.known.splice(i, 1)
  }
}

/** Remove the tile at a canonical index (XB-42 steal). Returns the type if known. */
export function zoneRemoveAt(zone: Zone, index: number): TroopType | undefined {
  if (index < 0 || index >= zone.count) throw new RulesError('bad zone index')
  zone.count--
  if (zone.known) return zone.known.splice(index, 1)[0]
  return undefined
}

/** Append a specific tile (recovering from discard, returning from board). */
export function zoneAdd(zone: Zone, troop: TroopType): void {
  zone.count++
  if (zone.known) zone.known.push(troop)
}
