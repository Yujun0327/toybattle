import type { TroopType } from './types'

export interface TroopDef {
  type: TroopType
  name: string
  /** Numeric strength, or 'joker' (Kwak: covers anything, covered by anything). */
  strength: number | 'joker'
  tagline: string
  effectText: string
}

export const TROOPS: Record<TroopType, TroopDef> = {
  skully: {
    type: 'skully',
    name: 'Skully',
    strength: 1,
    tagline: 'Wind-up skeleton',
    effectText: 'Draw 2 Troops from your reserve.',
  },
  capn: {
    type: 'capn',
    name: "Cap'n",
    strength: 2,
    tagline: 'Pirate monkey',
    effectText: 'You may immediately place 1 extra Troop (its effect applies too).',
  },
  jumbo: {
    type: 'jumbo',
    name: 'Jumbo',
    strength: 3,
    tagline: 'Elephant on wheels',
    effectText: 'You may discard 1 visible enemy Troop on an adjacent base.',
  },
  hook: {
    type: 'hook',
    name: 'Hook',
    strength: 4,
    tagline: 'Grappling pirate',
    effectText: 'Hook may be placed ignoring the connection rule (not on the enemy H.Q.).',
  },
  xb42: {
    type: 'xb42',
    name: 'XB-42',
    strength: 5,
    tagline: 'Tin robot',
    effectText: "Discard 1 random Troop from your opponent's rack, face up.",
  },
  star: {
    type: 'star',
    name: 'Star',
    strength: 6,
    tagline: 'Toy unicorn',
    effectText: 'Draw 1 Troop from your reserve.',
  },
  roxy: {
    type: 'roxy',
    name: 'Roxy',
    strength: 7,
    tagline: 'T-rex',
    effectText: 'No effect. Pure muscle.',
  },
  kwak: {
    type: 'kwak',
    name: 'Kwak',
    strength: 'joker',
    tagline: 'Viking duck',
    effectText: 'No effect, but Kwak covers ANY enemy Troop — and any enemy Troop covers Kwak.',
  },
}

export const ALL_TROOP_TYPES = Object.keys(TROOPS) as TroopType[]

/** The full 24-tile army: 3 copies of each of the 8 types. */
export function fullArmy(): TroopType[] {
  return ALL_TROOP_TYPES.flatMap((t) => [t, t, t])
}
