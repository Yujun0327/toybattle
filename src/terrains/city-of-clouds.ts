import { gridTerrain } from './_builder'

export const cityOfClouds = gridTerrain({
  id: 'city-of-clouds',
  name: 'City of Clouds',
  description:
    'Sky bridges cross the middle towers, and landing on a cloud pad lets you draw a fresh troop.',
  medalObjective: 6,
  theme: { mat: '#A8C8E8', matDark: '#7BA3CC', accent: '#FFFFFF', icon: 'cloud' },
  cols: [200, 400, 600, 800],
  rows: [140, 320, 500],
  extraEdges: [
    ['a1', 'b2'],
    ['d1', 'c2'],
    ['a3', 'b2'],
    ['d3', 'c2'],
  ],
  specials: {
    b2: { kind: 'cloudDraw' },
    c2: { kind: 'cloudDraw' },
  },
  cellMedals: { a1: 1, c1: 1, a2: 1, c2: 1, b1: 2, b2: 2 },
})
