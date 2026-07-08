<script lang="ts">
  import type { GameState, BaseId } from '../engine/types'
  import type { TerrainDef, SpecialBase } from '../terrains/schema'
  import { isFrozen } from '../engine/legality'
  import TroopTile from './TroopTile.svelte'

  let {
    terrain,
    state,
    highlights = new Set<BaseId>(),
    marked = null,
    onBase,
  }: {
    terrain: TerrainDef
    state: GameState
    highlights?: Set<BaseId>
    /** A base to ring in gold (e.g. the volcanic "from" pick). */
    marked?: BaseId | null
    onBase?: (base: BaseId) => void
  } = $props()

  const vw = $derived(terrain.viewBox.w)
  const vh = $derived(terrain.viewBox.h)
  const posOf = $derived(new Map(terrain.bases.map((b) => [b.id, b.pos])))

  /** Deterministic wobble so paths look hand-drawn but stable. */
  function wobble(a: string, b: string): { mx: number; my: number } {
    let h = 0
    for (const ch of a + '|' + b) h = (h * 31 + ch.charCodeAt(0)) | 0
    return { mx: ((h % 17) - 8) * 1.6, my: (((h >> 4) % 17) - 8) * 1.6 }
  }

  function edgePath(a: string, b: string): string {
    const pa = posOf.get(a)!
    const pb = posOf.get(b)!
    const w = wobble(a, b)
    return `M ${pa.x} ${pa.y} Q ${(pa.x + pb.x) / 2 + w.mx} ${(pa.y + pb.y) / 2 + w.my} ${pb.x} ${pb.y}`
  }

  function specialGlyph(s: SpecialBase): string {
    switch (s.kind) {
      case 'castleReturn':
        return '⌂'
      case 'cloudDraw':
        return '+1'
      case 'volcanicMove':
        return '⇢'
      case 'cemeteryRecover':
        return '✚'
      case 'battlefieldFreeze':
        return '✱'
      case 'strengthRestricted':
        return s.allowed.length > 3
          ? `${Math.min(...s.allowed)}–${Math.max(...s.allowed)}`
          : s.allowed.join('·')
      case 'effectsDisabled':
        return 'Ø'
    }
  }

  const TILE_SCALE = 0.62
</script>

<svg viewBox={`0 0 ${vw} ${vh}`} class="board" role="group" aria-label="game board">
  <!-- play mat -->
  <rect x="8" y="8" width={vw - 16} height={vh - 16} rx="30" fill={terrain.theme.matDark} />
  <rect x="16" y="14" width={vw - 32} height={vh - 34} rx="24" fill={terrain.theme.mat} />
  <!-- mat stitching -->
  <rect
    x="28"
    y="26"
    width={vw - 56}
    height={vh - 58}
    rx="18"
    fill="none"
    stroke="rgba(255,255,255,0.35)"
    stroke-width="3"
    stroke-dasharray="1 12"
    stroke-linecap="round"
  />

  <!-- printed paths -->
  {#each terrain.edges as [a, b] (a + b)}
    <path d={edgePath(a, b)} fill="none" stroke={terrain.theme.matDark} stroke-width="9" stroke-linecap="round" opacity="0.55" />
    <path
      d={edgePath(a, b)}
      fill="none"
      stroke="rgba(255,255,255,0.5)"
      stroke-width="3"
      stroke-dasharray="1 14"
      stroke-linecap="round"
    />
  {/each}

  <!-- regions: medal coins (or claim ribbon) -->
  {#each terrain.regions as region (region.id)}
    {@const claimed = state.regionsClaimed[region.id]}
    <g transform={`translate(${region.labelPos.x}, ${region.labelPos.y})`}>
      {#if claimed}
        <g opacity="0.85">
          <circle r="15" fill={claimed === 'red' ? 'var(--red)' : 'var(--blue)'} stroke="#33281e" stroke-width="2.5" />
          <path d="M-6 0 l4 5 8 -10" fill="none" stroke="#fffdf8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      {:else}
        {#each Array(region.medals) as _, i (i)}
          <g transform={`translate(${(i - (region.medals - 1) / 2) * 26}, 0) rotate(${(i % 2 ? 1 : -1) * 6})`}>
            <circle r="13" fill="var(--gold)" stroke="var(--gold-lo)" stroke-width="3" />
            <path
              d="M0 -7 l2.1 4.3 4.7 0.7 -3.4 3.3 0.8 4.7 -4.2 -2.2 -4.2 2.2 0.8 -4.7 -3.4 -3.3 4.7 -0.7 z"
              fill="var(--gold-lo)"
            />
            <circle cx="-4" cy="-5" r="2.5" fill="rgba(255,255,255,0.7)" />
          </g>
        {/each}
      {/if}
    </g>
  {/each}

  <!-- bases -->
  {#each terrain.bases as base (base.id)}
    {@const p = base.pos}
    {@const stack = state.board[base.id] ?? []}
    {@const top = stack.length ? stack[stack.length - 1] : null}
    {@const frozen = isFrozen(state, base.id)}
    {@const clickable = highlights.has(base.id)}
    <g
      class:clickable
      onclick={() => clickable && onBase?.(base.id)}
      onkeydown={(e) => e.key === 'Enter' && clickable && onBase?.(base.id)}
      role="button"
      tabindex={clickable ? 0 : -1}
      aria-label={base.id}
    >
      {#if base.kind === 'hq'}
        {@const c = base.hqOwner === 'red' ? 'var(--red)' : 'var(--blue)'}
        {@const lo = base.hqOwner === 'red' ? 'var(--red-lo)' : 'var(--blue-lo)'}
        <ellipse cx={p.x} cy={p.y + 34} rx="52" ry="18" fill="rgba(51,40,30,0.18)" />
        <g stroke="#33281e" stroke-width="3">
          <rect x={p.x - 40} y={p.y - 10} width="80" height="44" rx="8" fill={c} />
          <rect x={p.x - 40} y={p.y - 10} width="80" height="10" rx="5" fill={lo} />
          <rect x={p.x - 14} y={p.y + 6} width="28" height="28" rx="6" fill={lo} />
          <path d={`M ${p.x} ${p.y - 12} v -46`} stroke-width="4" />
          <path d={`M ${p.x} ${p.y - 56} q 24 -6 44 4 q -20 12 -44 8 z`} fill={c} />
          <path
            d={`M ${p.x + 12} ${p.y - 52} l 3.4 6.9 7.6 1.1 -5.5 5.4 1.3 7.6 -6.8 -3.6 -6.8 3.6 1.3 -7.6 -5.5 -5.4 7.6 -1.1 z`}
            fill="var(--gold)"
            stroke-width="2"
          />
        </g>
        {#if top}
          <g transform={`translate(${p.x - 50 * TILE_SCALE}, ${p.y - 90 * TILE_SCALE}) scale(${TILE_SCALE})`} class="tile pop">
            <TroopTile troop={top.troop} owner={top.owner} />
          </g>
        {/if}
      {:else}
        <!-- molded socket -->
        <ellipse cx={p.x} cy={p.y + 14} rx="46" ry="20" fill={terrain.theme.matDark} />
        <ellipse cx={p.x} cy={p.y + 12} rx="40" ry="16" fill="rgba(51,40,30,0.35)" />
        <ellipse cx={p.x} cy={p.y + 10} rx="34" ry="12" fill={terrain.theme.mat} opacity="0.7" />
        {#if base.special}
          <g transform={`translate(${p.x + 34}, ${p.y - 26})`}>
            <circle r="14" fill="var(--white)" stroke={terrain.theme.matDark} stroke-width="3" />
            <text
              y="4.5"
              text-anchor="middle"
              font-family="Lilita One, sans-serif"
              font-size="12"
              fill="#33281e">{specialGlyph(base.special)}</text
            >
            <title>{base.special.kind}</title>
          </g>
        {/if}

        <!-- stack depth edges -->
        {#each stack.slice(0, -1) as under, i (i)}
          <rect
            x={p.x - 50 * TILE_SCALE + 5}
            y={p.y + 18 - (stack.length - 1 - i) * 5}
            width={100 * TILE_SCALE - 10}
            height="8"
            rx="4"
            fill={under.owner === 'red' ? 'var(--red-lo)' : 'var(--blue-lo)'}
            stroke="#33281e"
            stroke-width="1.5"
          />
        {/each}

        {#if top}
          <g
            transform={`translate(${p.x - 50 * TILE_SCALE}, ${p.y + 14 - 114 * TILE_SCALE - (stack.length - 1) * 5}) scale(${TILE_SCALE})`}
            class="tile pop"
          >
            <TroopTile troop={top.troop} owner={top.owner} />
          </g>
        {/if}

        {#if frozen}
          <g transform={`translate(${p.x}, ${p.y - 20})`} pointer-events="none">
            <rect x="-34" y="-36" width="68" height="62" rx="14" fill="rgba(190,230,255,0.55)" stroke="#8fd0ff" stroke-width="3" />
            <text y="4" text-anchor="middle" font-size="30" fill="#2b7fd9">❄</text>
          </g>
        {/if}
      {/if}

      {#if marked === base.id}
        <ellipse cx={p.x} cy={p.y + 14} rx="52" ry="24" fill="none" stroke="var(--gold)" stroke-width="5" />
      {/if}
      {#if clickable}
        <ellipse cx={p.x} cy={p.y + 14} rx="50" ry="22" class="halo" />
        <ellipse cx={p.x} cy={p.y + (base.kind === 'hq' ? 10 : 14)} rx="56" ry={base.kind === 'hq' ? 60 : 42} fill="transparent" />
      {/if}
    </g>
  {/each}
</svg>

<style>
  .board {
    width: 100%;
    height: 100%;
    display: block;
    filter: drop-shadow(0 12px 20px rgba(51, 40, 30, 0.3));
    touch-action: manipulation;
  }

  .clickable {
    cursor: pointer;
  }

  .halo {
    fill: rgba(255, 255, 255, 0.25);
    stroke: #d7f26a;
    stroke-width: 5;
    animation: pulse 1.1s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }

  .tile.pop {
    animation: drop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: center bottom;
  }

  @keyframes drop {
    0% {
      translate: 0 -26px;
      opacity: 0.4;
    }
    60% {
      translate: 0 3px;
    }
    100% {
      translate: 0 0;
      opacity: 1;
    }
  }
</style>
