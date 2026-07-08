<script lang="ts">
  import { ALL_TROOP_TYPES, TROOPS } from '../engine/troops'
  import TroopTile from './TroopTile.svelte'

  let { onClose }: { onClose: () => void } = $props()
</script>

<div class="back" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
  <div class="cardboard leaflet pop-in" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="rules" tabindex="-1" onkeydown={() => {}}>
    <button class="close" onclick={onClose} aria-label="close">✕</button>
    <h2>How to play</h2>
    <ol>
      <li>On your turn, either <strong>draw 2 troops</strong> to your rack (max 8) or <strong>place 1 troop</strong>.</li>
      <li>
        Place on an empty base, on your own troops, on a weaker enemy troop (strictly lower number), or on the
        <strong>enemy H.Q.</strong> to win instantly.
      </li>
      <li>
        <strong>Supply line:</strong> your target must trace back to your H.Q. through bases you occupy. Empty or
        enemy bases cut the line.
      </li>
      <li>
        Surround a region (occupy every base around it) to claim its <span class="gold">★ medals</span> — reach the
        map's objective to win. Medals are yours forever.
      </li>
      <li>If you can't draw or place, the game ends — most medals wins, and ties doom the stuck player.</li>
    </ol>
    <h3>The toys</h3>
    <div class="troops">
      {#each ALL_TROOP_TYPES as t (t)}
        <div class="troop">
          <svg viewBox="0 0 100 120"><TroopTile troop={t} owner={t === 'kwak' ? 'blue' : 'red'} /></svg>
          <p>{TROOPS[t].effectText}</p>
        </div>
      {/each}
    </div>
    <p class="credit">
      A fan-made tribute to <em>Toy Battle</em> by Paolo Mori &amp; Alessandro Zucchini (Repos Production).
      Buy the real thing — it fits in a coat pocket.
    </p>
  </div>
</div>

<style>
  .back {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(51, 40, 30, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .leaflet {
    position: relative;
    max-width: 760px;
    max-height: 88dvh;
    overflow-y: auto;
    padding: 1.8rem 2.2rem;
  }

  .close {
    position: absolute;
    top: 0.8rem;
    right: 1rem;
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--ink-soft);
  }

  h2 {
    margin-bottom: 0.8rem;
  }

  h3 {
    margin: 1.2rem 0 0.6rem;
  }

  ol {
    padding-left: 1.2rem;
    display: grid;
    gap: 0.45rem;
    font-weight: 600;
  }

  .gold {
    color: var(--gold-lo);
    font-weight: 800;
  }

  .troops {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.8rem;
  }

  .troop {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    background: var(--white);
    border-radius: 12px;
    padding: 0.5rem;
    box-shadow: 0 2px 5px rgba(51, 40, 30, 0.15);
  }

  .troop svg {
    width: 46px;
    flex-shrink: 0;
  }

  .troop p {
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--ink-soft);
  }

  .credit {
    margin-top: 1.2rem;
    font-size: 0.78rem;
    color: var(--ink-soft);
    font-weight: 600;
  }
</style>
