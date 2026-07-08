<script lang="ts">
  import { TERRAINS } from '../terrains'
  import { ALL_TROOP_TYPES } from '../engine/troops'
  import TroopTile from './TroopTile.svelte'
  import TerrainThumb from './TerrainThumb.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'

  let {
    onHotseat,
    onCreateRoom,
    onJoinRoom,
  }: {
    onHotseat: (terrainId: string, openRacks: boolean) => void
    onCreateRoom: (terrainId: string) => void
    onJoinRoom: (code: string) => void
  } = $props()

  type Panel = null | 'hotseat' | 'create' | 'join'
  let panel = $state<Panel>(null)
  let terrainId = $state('castle-field')
  let openRacks = $state(false)
  let joinCode = $state('')
  let showRules = $state(false)

  const marqueeTroops = ['roxy', 'kwak', 'star', 'xb42', 'skully', 'capn'] as const
</script>

<div class="home">
  <header class="hero">
    <div class="marquee" aria-hidden="true">
      {#each marqueeTroops as t, i (t)}
        <svg
          viewBox="0 0 100 120"
          class="hero-tile"
          style={`--r: ${(i * 61) % 17 - 8}deg; --d: ${i * 0.08}s`}
        >
          <TroopTile troop={t} owner={i % 2 ? 'blue' : 'red'} />
        </svg>
      {/each}
    </div>
    <h1 class="logo">
      <span class="word red-w">TOY</span>
      <span class="word blue-w">BATTLE</span>
    </h1>
    <p class="tag sticker">place your toys · hold the line · capture the flag</p>
  </header>

  <nav class="menu">
    <button class="btn red" onclick={() => (panel = panel === 'create' ? null : 'create')}>Create room</button>
    <button class="btn blue" onclick={() => (panel = panel === 'join' ? null : 'join')}>Join room</button>
    <button class="btn" onclick={() => (panel = panel === 'hotseat' ? null : 'hotseat')}>Hot-seat (1 device)</button>
    <button class="btn gold" onclick={() => (showRules = true)}>How to play</button>
  </nav>

  {#if panel === 'join'}
    <section class="cardboard panel pop-in">
      <h3>Join a friend's room</h3>
      <form
        class="join-row"
        onsubmit={(e) => {
          e.preventDefault()
          if (joinCode.trim().length >= 4) onJoinRoom(joinCode.trim().toUpperCase())
        }}
      >
        <input type="text" placeholder="ROOM CODE" maxlength="6" bind:value={joinCode} />
        <button class="btn blue" type="submit" disabled={joinCode.trim().length < 4}>Join</button>
      </form>
      <p class="hint">Ask your friend for the 6-letter code or the room link.</p>
    </section>
  {:else if panel === 'create' || panel === 'hotseat'}
    <section class="cardboard panel pop-in">
      <h3>{panel === 'create' ? 'Pick the battlefield' : 'Hot-seat battle'}</h3>
      <div class="terrains">
        {#each TERRAINS as t (t.id)}
          <TerrainThumb terrain={t} selected={terrainId === t.id} onPick={() => (terrainId = t.id)} />
        {/each}
      </div>
      {#if panel === 'hotseat'}
        <label class="check">
          <input type="checkbox" bind:checked={openRacks} />
          casual mode: keep both racks face-up (no pass-the-device curtain)
        </label>
        <button class="btn red" onclick={() => onHotseat(terrainId, openRacks)}>Start the battle</button>
      {:else}
        <button class="btn red" onclick={() => onCreateRoom(terrainId)}>Create room &amp; get link</button>
        <p class="hint">You'll get a link to send to your friend. No accounts, no server — the game runs browser-to-browser.</p>
      {/if}
    </section>
  {/if}

  <footer class="foot">
    <p>
      A fan-made tribute to <em>Toy Battle</em> (Paolo Mori &amp; Alessandro Zucchini, Repos Production) —
      for private play among friends.
    </p>
  </footer>

  {#if showRules}
    <RulesLeaflet onClose={() => (showRules = false)} />
  {/if}
</div>

<style>
  .home {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.4rem;
    padding: 2.2rem 1rem 1rem;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
  }

  .marquee {
    display: flex;
    gap: 0.4rem;
  }

  .hero-tile {
    width: 58px;
    transform: rotate(var(--r));
    animation: bob 2.6s ease-in-out infinite;
    animation-delay: var(--d);
    filter: drop-shadow(0 4px 5px rgba(51, 40, 30, 0.3));
  }

  @keyframes bob {
    0%,
    100% {
      translate: 0 0;
    }
    50% {
      translate: 0 -7px;
    }
  }

  .logo {
    font-size: clamp(2.6rem, 9vw, 4.6rem);
    line-height: 0.95;
    text-align: center;
    letter-spacing: 0.02em;
  }

  .word {
    display: inline-block;
    -webkit-text-stroke: 2px rgba(51, 40, 30, 0.9);
    text-shadow:
      0 4px 0 rgba(51, 40, 30, 0.35),
      0 1px 0 rgba(255, 255, 255, 0.4);
  }

  .red-w {
    color: var(--red);
    transform: rotate(-2.5deg);
  }

  .blue-w {
    color: var(--blue);
    transform: rotate(1.5deg);
  }

  .tag {
    font-weight: 800;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .menu {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .panel {
    padding: 1.4rem 1.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    max-width: 860px;
  }

  .terrains {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    justify-content: center;
  }

  .join-row {
    display: flex;
    gap: 0.7rem;
    align-items: center;
  }

  .hint {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--ink-soft);
    text-align: center;
    max-width: 46ch;
  }

  .check {
    font-size: 0.85rem;
    font-weight: 700;
    display: flex;
    gap: 0.5em;
    align-items: center;
  }

  .foot {
    margin-top: auto;
    padding: 1rem;
    font-size: 0.72rem;
    color: var(--ink-soft);
    text-align: center;
    max-width: 60ch;
  }
</style>
