<script lang="ts">
  import { HotseatSession, OnlineSession } from './app/session.svelte'
  import { makeRoomCode } from './transport/trystero'
  import Home from './ui/Home.svelte'
  import Lobby from './ui/Lobby.svelte'
  import GameScreen from './ui/GameScreen.svelte'

  let hotseat = $state<HotseatSession | null>(null)
  let online = $state<OnlineSession | null>(null)
  let hotseatConfig: { terrainId: string; openRacks: boolean } | null = null

  function roomFromHash(): string | null {
    const m = location.hash.match(/room=([A-Za-z0-9]{4,})/)
    return m ? m[1].toUpperCase() : null
  }

  function syncFromHash() {
    const room = roomFromHash()
    if (room && online?.room !== room) {
      online?.destroy()
      const creator = sessionStorage.getItem(`creator:${room}`) !== null
      online = new OnlineSession(room, creator)
      const picked = sessionStorage.getItem(`creator:${room}`)
      if (picked) online.pickedTerrain = picked
    } else if (!room && online) {
      online.destroy()
      online = null
    }
  }

  syncFromHash()
  $effect(() => {
    const handler = () => syncFromHash()
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  })

  function startHotseat(terrainId: string, openRacks: boolean) {
    hotseatConfig = { terrainId, openRacks }
    hotseat = new HotseatSession(terrainId, openRacks)
  }

  function createRoom(terrainId: string) {
    const code = makeRoomCode()
    sessionStorage.setItem(`creator:${code}`, terrainId)
    location.hash = `room=${code}`
  }

  function joinRoom(code: string) {
    location.hash = `room=${code}`
  }

  function exitToHome() {
    hotseat = null
    if (online) {
      online.leave()
      online = null
      location.hash = ''
    }
  }

  function rematch() {
    if (hotseat && hotseatConfig) {
      hotseat = new HotseatSession(hotseatConfig.terrainId, hotseatConfig.openRacks)
    } else if (online) {
      online.requestRematch()
    }
  }
</script>

{#if online}
  {#if online.playing}
    <GameScreen session={online} onExit={exitToHome} onRematch={rematch} />
  {:else}
    <Lobby session={online} onExit={exitToHome} />
  {/if}
{:else if hotseat}
  <GameScreen session={hotseat} onExit={exitToHome} onRematch={rematch} />
{:else}
  <Home onHotseat={startHotseat} onCreateRoom={createRoom} onJoinRoom={joinRoom} />
{/if}
