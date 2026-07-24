<script lang="ts">
  import type { BaseId, Move, PlayerId, TroopType } from '../engine/types'
  import { opponent } from '../engine/types'
  import { TROOPS } from '../engine/troops'
  import { HotseatSession, OnlineSession } from '../app/session.svelte'
  import { play } from './audio'
  import Board from './Board.svelte'
  import Rack from './Rack.svelte'
  import TroopTile from './TroopTile.svelte'
  import HandoffCurtain from './HandoffCurtain.svelte'
  import VictoryOverlay from './VictoryOverlay.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'

  let {
    session,
    onExit,
    onRematch,
  }: {
    session: HotseatSession | OnlineSession
    onExit: () => void
    onRematch: () => void
  } = $props()

  let selectedTroop = $state<TroopType | null>(null)
  let selectedIndex = $state(-1)
  let volcanicFrom = $state<BaseId | null>(null)
  let showRules = $state(false)
  let confirmConcede = $state(false)
  let muted = $state(false)

  const view = $derived(session.visibleState)
  const me = $derived(session.mode === 'online' ? (session as OnlineSession).side : view.turn)
  const foe = $derived(opponent(me))
  const pending = $derived(view.pending)
  const myMoves = $derived(session.myTurn && !view.result ? session.myMoves() : [])
  const canDrawNow = $derived(myMoves.some((m) => m.type === 'draw'))
  const objective = $derived(session.terrain.medalObjective)

  // reset picks whenever the decision context changes
  $effect(() => {
    void pending?.kind
    void view.turn
    selectedTroop = null
    selectedIndex = -1
    volcanicFrom = null
  })

  // sound effects
  let seenEvent = -1
  $effect(() => {
    for (const e of session.events) {
      if (e.id > seenEvent) {
        seenEvent = e.id
        if (!muted) play(e.sfx)
      }
    }
  })

  const placeTargets = $derived.by(() => {
    const set = new Set<BaseId>()
    if (!selectedTroop) return set
    for (const m of myMoves) {
      if (m.type === 'place' && m.troop === selectedTroop) set.add(m.base)
      if (m.type === 'choice' && 'place' in m.value && m.value.place.troop === selectedTroop)
        set.add(m.value.place.base)
    }
    return set
  })

  const highlights = $derived.by(() => {
    if (view.result || !session.myTurn) return new Set<BaseId>()
    if (pending) {
      switch (pending.kind) {
        case 'capnPlace':
          return placeTargets
        case 'jumboDiscard':
        case 'castleReturn':
          return new Set(pending.options)
        case 'volcanicMove':
          return volcanicFrom
            ? new Set(pending.options.filter((o) => o.from === volcanicFrom).map((o) => o.to))
            : new Set(pending.options.map((o) => o.from))
        default:
          return new Set<BaseId>()
      }
    }
    return placeTargets
  })

  function submit(move: Move) {
    try {
      session.submit(move)
    } catch (err) {
      console.warn(err)
      play('error')
    }
    selectedTroop = null
    selectedIndex = -1
    volcanicFrom = null
  }

  function onBase(base: BaseId) {
    if (!session.myTurn || view.result) return
    if (pending?.kind === 'jumboDiscard' || pending?.kind === 'castleReturn') {
      submit({ type: 'choice', value: { base } })
      return
    }
    if (pending?.kind === 'volcanicMove') {
      if (!volcanicFrom) {
        volcanicFrom = base
      } else {
        submit({ type: 'choice', value: { move: { from: volcanicFrom, to: base } } })
      }
      return
    }
    if (selectedTroop) {
      if (pending?.kind === 'capnPlace') {
        submit({ type: 'choice', value: { place: { troop: selectedTroop, base } } })
      } else {
        submit({ type: 'place', troop: selectedTroop, base })
      }
    }
  }

  function selectTile(troop: TroopType, index: number) {
    if (!session.myTurn || view.result) return
    if (pending && pending.kind !== 'capnPlace') return
    play('select')
    if (selectedIndex === index) {
      selectedTroop = null
      selectedIndex = -1
    } else {
      selectedTroop = troop
      selectedIndex = index
    }
  }

  const promptText = $derived.by(() => {
    if (!pending || !session.myTurn) return null
    switch (pending.kind) {
      case 'capnPlace':
        return "Cap'n's orders: you may place one extra troop!"
      case 'jumboDiscard':
        return 'Jumbo may stomp an adjacent enemy toy — pick one.'
      case 'volcanicMove':
        return volcanicFrom
          ? 'Now pick where the lava shoves them.'
          : 'The lava vent erupts! Pick an adjacent enemy toy to shove.'
      case 'castleReturn':
        return 'The castle recalls a toy — pick one of yours to take back.'
      case 'cemeteryRecover':
        return 'The crypt stirs… recover a discarded toy.'
      case 'xb42Pick':
        return "XB-42 raids the enemy rack — pick a face-down tile up top (or skip)!"
      case 'xb42Reveal':
        return 'XB-42 raids your rack…'
    }
  })

  const skippable = $derived(pending !== null && 'optional' in pending && session.myTurn)

  const banner = $derived.by(() => {
    if (view.result) return 'Game over'
    if (session.mode === 'hotseat') return `${view.turn === 'red' ? 'RED' : 'BLUE'}'s turn`
    if (session.myTurn) return 'Your turn'
    return 'Waiting for opponent…'
  })

  const statusChip = $derived.by(() => {
    if (session.mode !== 'online') return null
    const s = session as OnlineSession
    if (s.status === 'peer-left') return 'Opponent disconnected — they can rejoin with the room link'
    if (s.status === 'desync') return 'Out of sync! Try refreshing both browsers.'
    return null
  })

  function playerName(p: PlayerId): string {
    if (session.mode === 'hotseat') return p === 'red' ? 'Red' : 'Blue'
    return p === me ? 'You' : 'Opponent'
  }
</script>

<div class="screen" style={`--mine: var(--${me}); --mine-lo: var(--${me}-lo)`}>
  <!-- opponent strip -->
  <header class="strip foe">
    <div class="who sticker tilt-r" style={`color: var(--${foe})`}>
      {playerName(foe)}
      <span class="medals">
        {#each Array(view.players[foe].medals) as _, i (i)}<span class="coin">★</span>{/each}
        <span class="objective">{view.players[foe].medals}/{objective}</span>
      </span>
    </div>
    <div class="foe-rack" class:raiding={pending?.kind === 'xb42Pick' && session.myTurn}>
      <Rack
        owner={foe}
        tiles={view.players[foe].rack.known ?? null}
        count={view.players[foe].rack.count}
        compact
        selectHidden={pending?.kind === 'xb42Pick' && session.myTurn}
        onSelect={pending?.kind === 'xb42Pick' && session.myTurn
          ? (_, index) => submit({ type: 'choice', value: { index } })
          : undefined}
      />
      <span class="reserve" title="reserve">🂠 {view.players[foe].reserve.count}</span>
    </div>
    <div class="discards">
      {#each view.players[foe].discard as t, i (i)}
        <svg viewBox="0 0 100 120" class="mini"><TroopTile troop={t} owner={foe} /></svg>
      {/each}
    </div>
  </header>

  <!-- board -->
  <main class="board-wrap">
    <div class="banner display" class:mine={session.myTurn && !view.result}>{banner}</div>
    {#if statusChip}
      <div class="chip">{statusChip}</div>
    {/if}
    <Board terrain={session.terrain} state={view} {highlights} marked={volcanicFrom} {onBase} />
    <div class="terrain-name">{session.terrain.name} · first to {objective} ★ or the enemy flag</div>
  </main>

  <!-- my strip -->
  <footer class="strip mine-strip">
    {#if promptText}
      <div class="prompt sticker pop-in">
        <span>{promptText}</span>
        {#if pending?.kind === 'cemeteryRecover' && session.myTurn}
          <span class="prompt-tiles">
            {#each pending.options as t (t)}
              <button class="mini-pick" onclick={() => submit({ type: 'choice', value: { troop: t } })}>
                <svg viewBox="0 0 100 120"><TroopTile troop={t} owner={me} /></svg>
              </button>
            {/each}
          </span>
        {/if}
        {#if skippable}
          <button class="btn small gold" onclick={() => submit({ type: 'skip' })}>Skip</button>
        {/if}
      </div>
    {/if}

    <div class="my-controls">
      <div class="who sticker" style={`color: var(--${me})`}>
        {playerName(me)}
        <span class="medals">
          {#each Array(view.players[me].medals) as _, i (i)}<span class="coin">★</span>{/each}
          <span class="objective">{view.players[me].medals}/{objective}</span>
        </span>
      </div>
      <Rack
        owner={me}
        tiles={view.players[me].rack.known ?? []}
        {selectedIndex}
        onSelect={(t, i) => t && selectTile(t, i)}
      />
      <div class="actions">
        <button
          class="btn {me}"
          disabled={!canDrawNow}
          onclick={() => submit({ type: 'draw' })}
          title={TROOPS.skully.name}
        >
          Draw 2 <span class="reserve-count">({view.players[me].reserve.count} left)</span>
        </button>
        <div class="small-actions">
          <button class="text-btn" onclick={() => (showRules = true)}>rules</button>
          <button class="text-btn" onclick={() => (muted = !muted)}>{muted ? 'unmute' : 'mute'}</button>
          {#if !view.result}
            <button class="text-btn danger" onclick={() => (confirmConcede = true)}>give up</button>
          {/if}
          <button class="text-btn" onclick={onExit}>exit</button>
        </div>
      </div>
    </div>
    {#if view.players[me].discard.length}
      <div class="discards my-discards">
        lost:
        {#each view.players[me].discard as t, i (i)}
          <svg viewBox="0 0 100 120" class="mini"><TroopTile troop={t} owner={me} /></svg>
        {/each}
      </div>
    {/if}
  </footer>

  {#if session.mode === 'hotseat' && (session as HotseatSession).handoffNeeded}
    <HandoffCurtain
      player={view.turn}
      onReady={() => ((session as HotseatSession).acknowledged = view.turn)}
    />
  {/if}

  {#if view.result}
    <VictoryOverlay {session} result={view.result} {onRematch} {onExit} />
  {/if}

  {#if showRules}
    <RulesLeaflet onClose={() => (showRules = false)} />
  {/if}

  {#if confirmConcede}
    <div class="modal-back">
      <div class="cardboard confirm pop-in">
        <h3>Wave the white flag?</h3>
        <div class="row">
          <button class="btn red" onclick={() => { confirmConcede = false; submit({ type: 'concede' }) }}>
            Give up
          </button>
          <button class="btn" onclick={() => (confirmConcede = false)}>Keep fighting</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .screen {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100dvh;
    max-width: 1180px;
    margin: 0 auto;
    width: 100%;
    padding: 0.4rem 0.8rem;
    gap: 0.2rem;
  }

  .strip {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .foe {
    justify-content: space-between;
    padding: 0.3rem 0.5rem 0;
  }

  .foe-rack {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .foe-rack.raiding {
    outline: 4px dashed var(--gold);
    outline-offset: 6px;
    border-radius: 12px;
    animation: raid-pulse 1s ease-in-out infinite;
  }

  @keyframes raid-pulse {
    50% {
      outline-color: var(--gold-lo);
    }
  }

  .reserve {
    font-weight: 800;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .who {
    font-family: 'Lilita One', sans-serif;
    font-size: 1.05rem;
    white-space: nowrap;
  }

  .medals {
    margin-left: 0.5em;
  }

  .coin {
    color: var(--gold);
    text-shadow: 0 1px 0 var(--gold-lo);
  }

  .objective {
    font-size: 0.75em;
    color: var(--ink-soft);
    margin-left: 0.35em;
  }

  .board-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .board-wrap :global(svg.board) {
    max-height: calc(100dvh - 320px);
    max-width: 100%;
  }

  .banner {
    font-size: 1.3rem;
    color: var(--ink-soft);
    padding: 0.1em 0;
  }

  .banner.mine {
    color: var(--mine);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  .chip {
    background: var(--gold);
    color: var(--ink);
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 800;
    padding: 0.25em 1em;
    margin-bottom: 0.3rem;
    box-shadow: 0 2px 0 var(--gold-lo);
  }

  .terrain-name {
    font-size: 0.8rem;
    color: var(--ink-soft);
    padding-top: 0.25rem;
  }

  .mine-strip {
    flex-direction: column;
    gap: 0.2rem;
    padding-bottom: 0.4rem;
  }

  .my-controls {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
  }

  .reserve-count {
    font-size: 0.75em;
    opacity: 0.85;
  }

  .small-actions {
    display: flex;
    gap: 0.8rem;
  }

  .text-btn {
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--ink-soft);
    text-decoration: underline;
  }

  .text-btn.danger {
    color: var(--red);
  }

  .prompt {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    font-weight: 800;
    z-index: 5;
  }

  .prompt-tiles {
    display: flex;
    gap: 0.3rem;
  }

  .mini-pick {
    width: 44px;
    padding: 0;
  }

  .mini-pick svg,
  .mini {
    width: 100%;
    display: block;
  }

  .mini-pick:hover {
    transform: translateY(-4px);
  }

  .discards {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.75rem;
    color: var(--ink-soft);
    font-weight: 800;
  }

  .discards .mini {
    width: 30px;
    opacity: 0.85;
  }

  .modal-back {
    position: fixed;
    inset: 0;
    background: rgba(51, 40, 30, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
  }

  .confirm {
    padding: 1.6rem 2rem;
    text-align: center;
  }

  .confirm h3 {
    margin-bottom: 1rem;
  }

  .row {
    display: flex;
    gap: 0.8rem;
    justify-content: center;
  }

  @media (max-width: 700px) {
    .board-wrap :global(svg.board) {
      max-height: calc(100dvh - 360px);
    }
  }
</style>
