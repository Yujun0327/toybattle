import type { TerrainDef } from './schema'
import { castleField } from './castle-field'
import { tropicalPool } from './tropical-pool'
import { cityOfClouds } from './city-of-clouds'
import { volcanicJungle } from './volcanic-jungle'
import { cursedCemetery } from './cursed-cemetery'
import { caribbeanSea } from './caribbean-sea'
import { stationMetalX } from './station-metal-x'
import { battlefield } from './battlefield'

export const TERRAINS: TerrainDef[] = [
  castleField,
  tropicalPool,
  cityOfClouds,
  volcanicJungle,
  cursedCemetery,
  caribbeanSea,
  stationMetalX,
  battlefield,
]

export function getTerrain(id: string): TerrainDef {
  const t = TERRAINS.find((t) => t.id === id)
  if (!t) throw new Error(`unknown terrain: ${id}`)
  return t
}

export * from './schema'
