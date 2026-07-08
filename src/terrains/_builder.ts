import type { BaseId } from '../engine/types'
import type { RegionDef, SpecialBase, TerrainDef } from './schema'

const COL_LETTERS = 'abcdefgh'

export interface GridSpec {
  id: string
  name: string
  description: string
  medalObjective: number
  theme: TerrainDef['theme']
  /** X coordinate per column, Y coordinate per row (viewBox units). */
  cols: number[]
  rows: number[]
  /** Base ids to omit (holes in the grid), e.g. 'c2'. */
  skip?: BaseId[]
  extraEdges?: [BaseId, BaseId][]
  removeEdges?: [BaseId, BaseId][]
  specials?: Record<BaseId, SpecialBase>
  /**
   * Medal regions on grid cells, keyed by the cell's top-left base id.
   * The four corner bases must all exist.
   */
  cellMedals?: Record<BaseId, number>
  /** Non-cell regions (rings around holes etc.). */
  customRegions?: RegionDef[]
}

/**
 * Build a TerrainDef from a grid layout: bases at column/row intersections,
 * orthogonal paths between neighbors, HQs docked left (red) and right (blue)
 * connected to every base in their nearest column.
 */
export function gridTerrain(spec: GridSpec): TerrainDef {
  const skip = new Set(spec.skip ?? [])
  const baseAt = (c: number, r: number): BaseId | null => {
    if (c < 0 || r < 0 || c >= spec.cols.length || r >= spec.rows.length) return null
    const id = `${COL_LETTERS[c]}${r + 1}`
    return skip.has(id) ? null : id
  }

  const bases: TerrainDef['bases'] = []
  for (let c = 0; c < spec.cols.length; c++) {
    for (let r = 0; r < spec.rows.length; r++) {
      const id = baseAt(c, r)
      if (!id) continue
      bases.push({
        id,
        pos: { x: spec.cols[c], y: spec.rows[r] },
        kind: 'base',
        ...(spec.specials?.[id] ? { special: spec.specials[id] } : {}),
      })
    }
  }

  const midY = spec.rows[Math.floor(spec.rows.length / 2)]
  const redHq = { x: spec.cols[0] - 130, y: midY }
  const blueHq = { x: spec.cols[spec.cols.length - 1] + 130, y: midY }
  bases.push({
    id: 'hq-red',
    pos: redHq,
    kind: 'hq',
    hqOwner: 'red',
    ...(spec.specials?.['hq-red'] ? { special: spec.specials['hq-red'] } : {}),
  })
  bases.push({
    id: 'hq-blue',
    pos: blueHq,
    kind: 'hq',
    hqOwner: 'blue',
    ...(spec.specials?.['hq-blue'] ? { special: spec.specials['hq-blue'] } : {}),
  })

  const removed = new Set((spec.removeEdges ?? []).map(([a, b]) => [a, b].sort().join('|')))
  const edges: [BaseId, BaseId][] = []
  const addEdge = (a: BaseId | null, b: BaseId | null) => {
    if (!a || !b) return
    if (removed.has([a, b].sort().join('|'))) return
    edges.push([a, b])
  }
  for (let c = 0; c < spec.cols.length; c++) {
    for (let r = 0; r < spec.rows.length; r++) {
      addEdge(baseAt(c, r), baseAt(c + 1, r))
      addEdge(baseAt(c, r), baseAt(c, r + 1))
    }
  }
  for (let r = 0; r < spec.rows.length; r++) {
    addEdge('hq-red', baseAt(0, r))
    addEdge('hq-blue', baseAt(spec.cols.length - 1, r))
  }
  for (const [a, b] of spec.extraEdges ?? []) addEdge(a, b)

  const posOf = new Map(bases.map((b) => [b.id, b.pos]))
  const regions: RegionDef[] = []
  for (const [topLeft, medals] of Object.entries(spec.cellMedals ?? {})) {
    const c = COL_LETTERS.indexOf(topLeft[0])
    const r = Number(topLeft.slice(1)) - 1
    const corners = [baseAt(c, r), baseAt(c + 1, r), baseAt(c, r + 1), baseAt(c + 1, r + 1)]
    if (corners.some((x) => !x)) throw new Error(`${spec.id}: cell region ${topLeft} has missing corners`)
    const ids = corners as BaseId[]
    regions.push({
      id: `r-${topLeft}`,
      baseIds: ids,
      medals,
      labelPos: {
        x: (posOf.get(ids[0])!.x + posOf.get(ids[3])!.x) / 2,
        y: (posOf.get(ids[0])!.y + posOf.get(ids[3])!.y) / 2,
      },
    })
  }
  regions.push(...(spec.customRegions ?? []))

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    medalObjective: spec.medalObjective,
    viewBox: {
      w: blueHq.x + 130,
      h: spec.rows[spec.rows.length - 1] + 130,
    },
    bases,
    edges,
    regions,
    theme: spec.theme,
  }
}
