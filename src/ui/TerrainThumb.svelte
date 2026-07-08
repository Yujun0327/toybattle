<script lang="ts">
  import type { TerrainDef } from '../terrains/schema'

  let {
    terrain,
    selected = false,
    onPick,
  }: { terrain: TerrainDef; selected?: boolean; onPick?: () => void } = $props()
</script>

<button class="thumb" class:selected onclick={onPick} disabled={!onPick}>
  <svg viewBox={`0 0 ${terrain.viewBox.w} ${terrain.viewBox.h}`}>
    <rect x="8" y="8" width={terrain.viewBox.w - 16} height={terrain.viewBox.h - 16} rx="40" fill={terrain.theme.matDark} />
    <rect x="22" y="20" width={terrain.viewBox.w - 44} height={terrain.viewBox.h - 44} rx="32" fill={terrain.theme.mat} />
    {#each terrain.edges as [a, b] (a + b)}
      {@const pa = terrain.bases.find((x) => x.id === a)!.pos}
      {@const pb = terrain.bases.find((x) => x.id === b)!.pos}
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={terrain.theme.matDark} stroke-width="10" opacity="0.6" />
    {/each}
    {#each terrain.regions as r (r.id)}
      <circle cx={r.labelPos.x} cy={r.labelPos.y} r="18" fill="var(--gold)" stroke="var(--gold-lo)" stroke-width="5" />
    {/each}
    {#each terrain.bases as b (b.id)}
      {#if b.kind === 'hq'}
        <rect
          x={b.pos.x - 34}
          y={b.pos.y - 30}
          width="68"
          height="60"
          rx="14"
          fill={b.hqOwner === 'red' ? 'var(--red)' : 'var(--blue)'}
        />
      {:else}
        <ellipse cx={b.pos.x} cy={b.pos.y} rx="30" ry="16" fill={terrain.theme.matDark} />
        {#if b.special}
          <circle cx={b.pos.x} cy={b.pos.y} r="9" fill="var(--white)" />
        {/if}
      {/if}
    {/each}
  </svg>
  <span class="name">{terrain.name}</span>
  <span class="meta">{terrain.medalObjective} ★ to win</span>
</button>

<style>
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    background: var(--white);
    border-radius: 14px;
    padding: 0.6rem 0.6rem 0.5rem;
    box-shadow: 0 3px 8px rgba(51, 40, 30, 0.18);
    border: 3px solid transparent;
    transition: transform 0.12s, border-color 0.12s;
  }

  .thumb:not(:disabled):hover {
    transform: translateY(-3px) rotate(-0.5deg);
  }

  .thumb.selected {
    border-color: var(--gold);
    box-shadow: 0 3px 8px rgba(51, 40, 30, 0.18), 0 0 0 4px rgba(242, 176, 30, 0.35);
  }

  svg {
    width: 150px;
    display: block;
  }

  .name {
    font-family: 'Lilita One', sans-serif;
    font-size: 0.9rem;
  }

  .meta {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--ink-soft);
  }
</style>
