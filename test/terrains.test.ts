import { describe, expect, it } from 'vitest'
import { TERRAINS, validateTerrain } from '../src/terrains'
import { mini } from './helpers'

describe('terrain data', () => {
  it('ships all 8 terrains', () => {
    expect(TERRAINS.map((t) => t.id)).toEqual([
      'castle-field',
      'tropical-pool',
      'city-of-clouds',
      'volcanic-jungle',
      'cursed-cemetery',
      'caribbean-sea',
      'station-metal-x',
      'battlefield',
    ])
  })

  it('every terrain passes validation', () => {
    for (const t of TERRAINS) validateTerrain(t)
    validateTerrain(mini)
  })

  it('medal objectives are reachable and positive', () => {
    for (const t of TERRAINS) {
      const total = t.regions.reduce((sum, r) => sum + r.medals, 0)
      expect(t.medalObjective).toBeGreaterThan(0)
      expect(total).toBeGreaterThanOrEqual(t.medalObjective)
    }
  })

  it('every terrain has exactly one HQ per player', () => {
    for (const t of TERRAINS) {
      const owners = t.bases.filter((b) => b.kind === 'hq').map((b) => b.hqOwner)
      expect(owners.sort()).toEqual(['blue', 'red'])
    }
  })
})
