<script lang="ts">
  import type { GameResultReason, PlayerId } from '../engine/types'
  import { HotseatSession, OnlineSession } from '../app/session.svelte'

  let {
    session,
    result,
    onRematch,
    onExit,
  }: {
    session: HotseatSession | OnlineSession
    result: { winner: PlayerId | null; reason: GameResultReason }
    onRematch: () => void
    onExit: () => void
  } = $props()

  const online = $derived(session.mode === 'online' ? (session as OnlineSession) : null)
  const iWon = $derived(online ? result.winner === online.side : null)

  const title = $derived.by(() => {
    if (!result.winner) return 'DRAW!'
    if (online) return iWon ? 'VICTORY!' : 'DEFEAT'
    return `${result.winner === 'red' ? 'RED' : 'BLUE'} WINS!`
  })

  const reasonText = $derived.by(() => {
    switch (result.reason) {
      case 'hq':
        return 'The enemy flag has been captured!'
      case 'medals':
        return `Medal objective reached (${session.terrain.medalObjective} ★).`
      case 'stalemate':
        return 'No moves left — most medals wins.'
      case 'stalemateTie':
        return 'No moves left and medals tied — the stuck player loses.'
      case 'concede':
        return 'The other side waved the white flag.'
    }
  })

  const confettiPieces = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 137) % 100,
    delay: ((i * 53) % 40) / 40,
    hue: ['var(--red)', 'var(--blue)', 'var(--gold)', 'var(--grass)'][i % 4],
    spin: ((i * 89) % 360),
  }))
</script>

<div class="overlay">
  {#if !online || iWon}
    {#each confettiPieces as c, i (i)}
      <span
        class="confetti"
        style={`left: ${c.left}%; animation-delay: ${c.delay}s; background: ${c.hue}; --spin: ${c.spin}deg`}
      ></span>
    {/each}
  {/if}
  <div class="cardboard box pop-in">
    <h1
      class="title"
      style={result.winner ? `color: var(--${result.winner})` : ''}
    >
      {title}
    </h1>
    <p class="reason">{reasonText}</p>
    <div class="tally">
      <span class="side red-side">RED {session.state.players.red.medals} ★</span>
      <span class="vs">vs</span>
      <span class="side blue-side">★ {session.state.players.blue.medals} BLUE</span>
    </div>
    <div class="row">
      <button class="btn gold" onclick={onRematch}>
        {online && !online.rematchWanted ? 'Rematch' : online ? 'Waiting…' : 'Rematch'}
      </button>
      <button class="btn" onclick={onExit}>Back to the toy box</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(51, 40, 30, 0.5);
    overflow: hidden;
  }

  .box {
    text-align: center;
    padding: 2.4rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    max-width: 92vw;
  }

  .title {
    font-size: 3rem;
    text-shadow: 0 3px 0 rgba(255, 255, 255, 0.5);
    transform: rotate(-2deg);
  }

  .reason {
    font-weight: 800;
    color: var(--ink-soft);
  }

  .tally {
    display: flex;
    gap: 1rem;
    font-family: 'Lilita One', sans-serif;
    font-size: 1.1rem;
  }

  .red-side {
    color: var(--red);
  }

  .blue-side {
    color: var(--blue);
  }

  .vs {
    color: var(--ink-soft);
  }

  .row {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .confetti {
    position: absolute;
    top: -20px;
    width: 12px;
    height: 18px;
    border-radius: 3px;
    animation: fall 2.8s linear infinite;
    transform: rotate(var(--spin));
  }

  @keyframes fall {
    to {
      transform: translateY(110vh) rotate(calc(var(--spin) + 540deg));
    }
  }
</style>
