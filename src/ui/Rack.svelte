<script lang="ts">
  import type { PlayerId, TroopType } from '../engine/types'
  import TroopTile from './TroopTile.svelte'

  let {
    owner,
    tiles = null,
    count = 0,
    selectedIndex = -1,
    onSelect,
    compact = false,
  }: {
    owner: PlayerId
    /** Known tiles (own rack) — or null to render face-down backs. */
    tiles?: TroopType[] | null
    count?: number
    selectedIndex?: number
    onSelect?: (troop: TroopType, index: number) => void
    compact?: boolean
  } = $props()

  const shown = $derived(tiles ?? Array<null>(count).fill(null))
  /** stable pseudo-random tilt per slot */
  const tilt = (i: number) => ((i * 37) % 7) - 3
</script>

<div class="tray" class:compact>
  <div class="wood"></div>
  <div class="tiles">
    {#each shown as t, i (i)}
      <button
        class="slot"
        class:selected={i === selectedIndex}
        class:pickable={!!onSelect && t !== null}
        style={`transform: rotate(${tilt(i)}deg) translateY(${i === selectedIndex ? -14 : 0}px)`}
        onclick={() => t !== null && onSelect?.(t, i)}
        disabled={!onSelect || t === null}
        aria-label={t ?? 'hidden tile'}
      >
        <svg viewBox="0 0 100 120">
          {#if t !== null}
            <TroopTile troop={t} {owner} />
          {:else}
            <TroopTile {owner} faceDown />
          {/if}
        </svg>
      </button>
    {/each}
    {#if shown.length === 0}
      <span class="empty">empty rack</span>
    {/if}
  </div>
</div>

<style>
  .tray {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 0.4rem 1rem 0.9rem;
  }

  .wood {
    position: absolute;
    inset: auto 0 0 0;
    height: 26px;
    border-radius: 10px;
    background:
      repeating-linear-gradient(93deg, rgba(51, 40, 30, 0.12) 0 7px, transparent 7px 18px),
      linear-gradient(var(--wood), var(--wood-lo));
    box-shadow:
      0 4px 0 var(--wood-lo),
      0 8px 14px rgba(51, 40, 30, 0.3);
  }

  .tiles {
    position: relative;
    display: flex;
    gap: 0.3rem;
    align-items: flex-end;
    min-height: 20px;
  }

  .slot {
    width: 64px;
    padding: 0;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .compact .slot {
    width: 42px;
  }

  .slot svg {
    width: 100%;
    display: block;
    filter: drop-shadow(0 3px 3px rgba(51, 40, 30, 0.35));
  }

  .slot.pickable:hover {
    transform: translateY(-8px) !important;
  }

  .slot.selected svg {
    filter: drop-shadow(0 6px 8px rgba(51, 40, 30, 0.4)) drop-shadow(0 0 6px #d7f26a);
  }

  .slot:disabled {
    cursor: default;
  }

  .empty {
    font-size: 0.8rem;
    color: var(--ink-soft);
    font-style: italic;
    padding-bottom: 6px;
  }
</style>
