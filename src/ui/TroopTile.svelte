<script lang="ts">
  import type { PlayerId, TroopType } from '../engine/types'
  import { TROOPS } from '../engine/troops'
  import CharacterArt from './CharacterArt.svelte'

  let {
    troop,
    owner,
    faceDown = false,
  }: { troop?: TroopType; owner: PlayerId; faceDown?: boolean } = $props()

  const fill = $derived(owner === 'red' ? 'var(--red)' : 'var(--blue)')
  const rim = $derived(owner === 'red' ? 'var(--red-lo)' : 'var(--blue-lo)')
  const hi = $derived(owner === 'red' ? 'var(--red-hi)' : 'var(--blue-hi)')
  const def = $derived(troop ? TROOPS[troop] : null)
</script>

<!-- Dog-tag tile in a 100×120 box. Wrap in <svg> or place in a board <g>. -->
<g>
  {#if def}
    <title>{def.name} · strength {def.strength === 'joker' ? 'Joker' : def.strength} — {def.effectText}</title>
  {/if}
  <!-- chain hole tab -->
  <circle cx="50" cy="16" r="11" fill={rim} />
  <circle cx="50" cy="16" r="4.5" fill="var(--paper)" />
  <!-- tag body -->
  <rect x="8" y="20" width="84" height="94" rx="16" fill={fill} stroke={rim} stroke-width="5" />
  <!-- plastic gloss -->
  <path d="M18 34 q34 -12 64 0 l0 8 q-30 -10 -64 0 z" fill={hi} opacity="0.65" />

  {#if faceDown}
    <!-- tile back: star emboss -->
    <path
      d="M50 42 l7.6 15.4 17 2.5 -12.3 12 2.9 16.9 -15.2 -8 -15.2 8 2.9 -16.9 -12.3 -12 17 -2.5 z"
      fill={rim}
      opacity="0.85"
    />
    <path
      d="M50 38 l7.6 15.4 17 2.5 -12.3 12 2.9 16.9 -15.2 -8 -15.2 8 2.9 -16.9 -12.3 -12 17 -2.5 z"
      fill={hi}
      opacity="0.9"
    />
  {:else if troop && def}
    <!-- character -->
    <g transform="translate(14, 32) scale(0.72)">
      <CharacterArt {troop} />
    </g>
    <!-- riveted strength badge -->
    <circle cx="24" cy="38" r="14" fill="var(--white)" stroke={rim} stroke-width="4" />
    <text
      x="24"
      y="44"
      text-anchor="middle"
      font-family="Lilita One, sans-serif"
      font-size={def.strength === 'joker' ? 15 : 18}
      fill={rim}>{def.strength === 'joker' ? '★' : def.strength}</text
    >
    <!-- name plate -->
    <rect x="20" y="98" width="60" height="14" rx="6" fill="var(--white)" opacity="0.92" />
    <text
      x="50"
      y="109"
      text-anchor="middle"
      font-family="Lilita One, sans-serif"
      font-size="11"
      fill="#33281e">{def.name}</text
    >
  {/if}
</g>
