import { gridTerrain } from './_builder'

export const cursedCemetery = gridTerrain({
  id: 'cursed-cemetery',
  name: 'Cursed Cemetery',
  description:
    'Nothing stays buried. The two haunted crypts let you recover a discarded troop back onto your rack.',
  medalObjective: 6,
  theme: { mat: '#7D8F7B', matDark: '#55665A', accent: '#B9A3D6', icon: 'grave' },
  cols: [200, 400, 600, 800],
  rows: [140, 320, 500],
  specials: {
    b2: { kind: 'cemeteryRecover' },
    c2: { kind: 'cemeteryRecover' },
  },
  cellMedals: { a1: 1, c1: 1, a2: 1, c2: 1, b1: 2, b2: 2 },
})
