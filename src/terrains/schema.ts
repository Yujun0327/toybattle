import type { BaseId, PlayerId, RegionId } from '../engine/types'

export type SpecialBase =
  | { kind: 'castleReturn' }                              // return one of your board troops to your rack
  | { kind: 'cloudDraw' }                                 // draw 1 troop
  | { kind: 'volcanicMove' }                              // move 1 adjacent enemy troop to an adjacent base, ignoring rules
  | { kind: 'cemeteryRecover' }                           // recover 1 discarded troop to your rack
  | { kind: 'battlefieldFreeze' }                         // freeze 1 random enemy troop until your next turn
  | { kind: 'strengthRestricted'; allowed: number[] }     // Tropical Pool: only listed strengths may be placed
  | { kind: 'effectsDisabled' }                           // Station Metal-X: troop effects do not trigger here

export interface BaseDef {
  id: BaseId
  pos: { x: number; y: number }
  kind: 'base' | 'hq'
  hqOwner?: PlayerId
  special?: SpecialBase
}

export interface RegionDef {
  id: RegionId
  /** Bases (and HQs) that surround this region; occupying all of them claims it. */
  baseIds: BaseId[]
  medals: number
  labelPos: { x: number; y: number }
}

export interface TerrainDef {
  id: string
  name: string
  medalObjective: number
  viewBox: { w: number; h: number }
  bases: BaseDef[]
  /** Undirected edges, each stored once. */
  edges: ReadonlyArray<readonly [BaseId, BaseId]>
  regions: RegionDef[]
  /** Board mat tint + flavor used by the renderer. */
  theme: {
    mat: string       // main mat color
    matDark: string   // path/shadow tone
    accent: string    // decorative accent
    icon: string      // small flavor glyph id used by the renderer
  }
  description: string
}

export function buildAdjacency(t: TerrainDef): Map<BaseId, BaseId[]> {
  const adj = new Map<BaseId, BaseId[]>()
  for (const b of t.bases) adj.set(b.id, [])
  for (const [a, b] of t.edges) {
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  return adj
}

/** Throws with a descriptive message if the terrain data is malformed. */
export function validateTerrain(t: TerrainDef): void {
  const ids = new Set<string>()
  for (const b of t.bases) {
    if (ids.has(b.id)) throw new Error(`${t.id}: duplicate base id ${b.id}`)
    ids.add(b.id)
  }
  const hqs = t.bases.filter((b) => b.kind === 'hq')
  if (hqs.length !== 2) throw new Error(`${t.id}: expected 2 HQs, got ${hqs.length}`)
  if (new Set(hqs.map((h) => h.hqOwner)).size !== 2 || hqs.some((h) => !h.hqOwner))
    throw new Error(`${t.id}: HQs must have distinct owners`)

  const seenEdges = new Set<string>()
  for (const [a, b] of t.edges) {
    if (!ids.has(a) || !ids.has(b)) throw new Error(`${t.id}: edge ${a}-${b} references unknown base`)
    if (a === b) throw new Error(`${t.id}: self edge ${a}`)
    const key = [a, b].sort().join('|')
    if (seenEdges.has(key)) throw new Error(`${t.id}: duplicate edge ${a}-${b}`)
    seenEdges.add(key)
  }

  const adj = buildAdjacency(t)
  for (const b of t.bases) {
    if ((adj.get(b.id) ?? []).length === 0) throw new Error(`${t.id}: base ${b.id} has no edges`)
  }

  // Whole graph must be connected (otherwise parts of the board are unreachable).
  const stack = [t.bases[0].id]
  const seen = new Set(stack)
  while (stack.length) {
    for (const n of adj.get(stack.pop()!)!) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  if (seen.size !== t.bases.length) throw new Error(`${t.id}: graph is not connected`)

  const regionIds = new Set<string>()
  let medalSum = 0
  for (const r of t.regions) {
    if (regionIds.has(r.id)) throw new Error(`${t.id}: duplicate region id ${r.id}`)
    regionIds.add(r.id)
    // 2-base regions are real: e.g. Castle Field's river pools, enclosed by two parallel bank paths
    if (r.baseIds.length < 2) throw new Error(`${t.id}: region ${r.id} has fewer than 2 bases`)
    for (const b of r.baseIds) if (!ids.has(b)) throw new Error(`${t.id}: region ${r.id} references unknown base ${b}`)
    if (new Set(r.baseIds).size !== r.baseIds.length) throw new Error(`${t.id}: region ${r.id} repeats a base`)
    if (r.medals < 1) throw new Error(`${t.id}: region ${r.id} has no medals`)
    medalSum += r.medals
  }
  if (medalSum < t.medalObjective)
    throw new Error(`${t.id}: medal objective ${t.medalObjective} unreachable (total ${medalSum})`)
}
