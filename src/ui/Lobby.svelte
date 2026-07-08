<script lang="ts">
  import type { OnlineSession } from '../app/session.svelte'
  import { getTerrain } from '../terrains'
  import TerrainThumb from './TerrainThumb.svelte'

  let { session, onExit }: { session: OnlineSession; onExit: () => void } = $props()

  let copied = $state(false)

  const link = $derived(`${location.origin}${location.pathname}#room=${session.room}`)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {
      /* clipboard blocked; the code is visible anyway */
    }
  }

  const statusText = $derived.by(() => {
    switch (session.status) {
      case 'connecting':
        return 'Setting up the room…'
      case 'handshake':
        return 'Friend found! Shuffling the toy boxes…'
      case 'room-full':
        return 'This room already has two players.'
      default:
        return 'Waiting for your friend to join…'
    }
  })
</script>

<div class="lobby">
  <div class="cardboard box pop-in">
    <h2>Room ready!</h2>
    <div class="code sticker">{session.room}</div>
    <button class="btn gold" onclick={copyLink}>{copied ? 'Copied!' : 'Copy invite link'}</button>
    <p class="link">{link}</p>
    <div class="status">
      <span class="dot" class:on={session.peerHere}></span>
      {statusText}
    </div>
    <div class="picked">
      <TerrainThumb terrain={getTerrain(session.pickedTerrain)} selected />
    </div>
    <button class="text-btn" onclick={onExit}>leave room</button>
  </div>
</div>

<style>
  .lobby {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    padding: 2rem 2.6rem;
    text-align: center;
    max-width: 92vw;
  }

  .code {
    font-family: 'Lilita One', sans-serif;
    font-size: 2.4rem;
    letter-spacing: 0.25em;
    padding: 0.3em 0.7em;
  }

  .link {
    font-size: 0.72rem;
    color: var(--ink-soft);
    word-break: break-all;
    max-width: 40ch;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-weight: 800;
    color: var(--ink-soft);
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--kraft);
    box-shadow: inset 0 0 0 2px rgba(51, 40, 30, 0.25);
  }

  .dot.on {
    background: var(--grass);
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0.5;
    }
  }

  .text-btn {
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--ink-soft);
    text-decoration: underline;
  }
</style>
