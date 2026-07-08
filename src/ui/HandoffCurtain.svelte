<script lang="ts">
  import type { PlayerId } from '../engine/types'

  let { player, onReady }: { player: PlayerId; onReady: () => void } = $props()
</script>

<div class="curtain" style={`--c: var(--${player}); --c-lo: var(--${player}-lo)`}>
  <div class="cardboard box pop-in">
    <div class="flag" aria-hidden="true">⚑</div>
    <h2>Pass the device to <span class="name">{player === 'red' ? 'RED' : 'BLUE'}</span></h2>
    <p>No peeking at the other rack, general.</p>
    <button class="btn {player}" onclick={onReady}>I'm {player === 'red' ? 'Red' : 'Blue'} — ready!</button>
  </div>
</div>

<style>
  .curtain {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.04) 0 24px, transparent 24px 48px),
      var(--paper);
  }

  .box {
    text-align: center;
    padding: 2.2rem 2.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    align-items: center;
    max-width: 90vw;
  }

  .flag {
    font-size: 2.6rem;
    color: var(--c);
    text-shadow: 0 2px 0 var(--c-lo);
  }

  .name {
    color: var(--c);
  }

  p {
    color: var(--ink-soft);
    font-weight: 700;
  }
</style>
