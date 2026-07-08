import type { Ctx } from './legality'
import {
  canDraw,
  canPlace,
  connectedTargets,
  isFrozen,
  occupiedBy,
  placementTargets,
  topOf,
} from './legality'
import { sweepRegions } from './regions'
import { sharedDrawAt } from './rng'
import { zoneAdd, zoneRemoveAt, zoneRemoveTroop, zoneTransfer } from './zones'
import type {
  BaseId,
  ChoiceValue,
  EffectFrame,
  GameState,
  Move,
  PlayerId,
  TroopType,
} from './types'
import { opponent, RulesError } from './types'

const ACTIVE_SPECIALS = new Set([
  'castleReturn',
  'cloudDraw',
  'volcanicMove',
  'cemeteryRecover',
  'battlefieldFreeze',
])

/**
 * The reducer. Pure with respect to its inputs: clones the state, applies the
 * move, resolves the effect stack until it needs input (state.pending) or the
 * game ends, then hands the turn over.
 *
 * Determinism contract: every branch below depends only on PUBLIC information
 * (counts, board, discards, shared PRNG) or on data carried inside the move
 * itself — so both clients fold the same wire log into the same public state,
 * whether or not they can see a given rack.
 */
export function applyMove(ctx: Ctx, prev: GameState, actor: PlayerId, move: Move): GameState {
  if (prev.result) throw new RulesError('game is over')
  const s = structuredClone(prev)

  if (move.type === 'concede') {
    s.result = { winner: opponent(actor), reason: 'concede' }
    return s
  }

  if (s.pending) {
    if (actor !== s.pending.actor) throw new RulesError('not your choice to make')
    if (move.type === 'skip') {
      if (!('optional' in s.pending)) throw new RulesError('this choice cannot be skipped')
      s.pending = null
    } else if (move.type === 'choice') {
      resolveChoice(ctx, s, actor, move.value)
    } else {
      throw new RulesError('a choice is pending')
    }
  } else {
    if (actor !== s.turn) throw new RulesError('not your turn')
    switch (move.type) {
      case 'draw': {
        if (!canDraw(s, actor)) throw new RulesError('cannot draw')
        drawN(s, actor, 2)
        break
      }
      case 'place': {
        const rack = s.players[actor].rack
        if (rack.known && !rack.known.includes(move.troop)) throw new RulesError('tile not in rack')
        if (rack.count === 0) throw new RulesError('rack empty')
        const connected = connectedTargets(ctx, s, actor)
        if (!canPlace(ctx, s, actor, move.troop, move.base, connected))
          throw new RulesError(`illegal placement: ${move.troop} on ${move.base}`)
        doPlace(ctx, s, actor, move.troop, move.base)
        break
      }
      case 'stalemate': {
        if (canDraw(s, actor)) throw new RulesError('you can still draw')
        const rack = s.players[actor].rack
        if (rack.known) {
          for (const t of new Set(rack.known)) {
            if (placementTargets(ctx, s, actor, t).length > 0)
              throw new RulesError('you can still place')
          }
        }
        const mine = s.players[actor].medals
        const theirs = s.players[opponent(actor)].medals
        s.result =
          mine === theirs
            ? { winner: opponent(actor), reason: 'stalemateTie' } // the stuck player loses ties
            : { winner: mine > theirs ? actor : opponent(actor), reason: 'stalemate' }
        return s
      }
      default:
        throw new RulesError(`unexpected move ${move.type}`)
    }
  }

  resolveStack(ctx, s)
  return s
}

function resolveStack(ctx: Ctx, s: GameState): void {
  while (!s.result && !s.pending && s.effectStack.length > 0) {
    runFrame(ctx, s, s.effectStack.pop()!)
  }
  if (!s.result && !s.pending) endTurn(s)
}

/** Place a tile, wiring up its effect frames. Shared by the place move and Cap'n's chained placement. */
function doPlace(ctx: Ctx, s: GameState, actor: PlayerId, troop: TroopType, base: BaseId): void {
  zoneRemoveTroop(s.players[actor].rack, troop)
  const def = ctx.baseById.get(base)!
  ;(s.board[base] ??= []).push({ owner: actor, troop })
  if (def.kind === 'hq') {
    s.result = { winner: actor, reason: 'hq' } // instant win; nothing else resolves
    return
  }

  // LIFO: special-base frame goes under the troop frame, so the troop effect resolves first.
  if (def.special && ACTIVE_SPECIALS.has(def.special.kind)) {
    s.effectStack.push({ kind: 'specialBase', base, actor })
  }
  if (def.special?.kind !== 'effectsDisabled') {
    s.effectStack.push({ kind: 'troopEffect', troop, base, actor })
  }
  checkpoint(ctx, s, actor)
}

/** Region sweep + win check. Runs after every board mutation. */
function checkpoint(ctx: Ctx, s: GameState, actor: PlayerId): void {
  if (s.result) return
  sweepRegions(ctx, s)
  const objective = ctx.terrain.medalObjective
  // If a single mutation somehow pushed both players over the line, the acting player wins.
  for (const p of [actor, opponent(actor)]) {
    if (s.players[p].medals >= objective) {
      s.result = { winner: p, reason: 'medals' }
      return
    }
  }
}

function drawN(s: GameState, player: PlayerId, want: number): void {
  const p = s.players[player]
  const n = Math.min(want, 8 - p.rack.count, p.reserve.count)
  if (n > 0) zoneTransfer(p.reserve, p.rack, n)
}

function sharedRandomBelow(s: GameState, bound: number): number {
  const v = sharedDrawAt(s.config.sharedSeed, s.sharedRngCursor)
  s.sharedRngCursor++
  return v % bound
}

function runFrame(ctx: Ctx, s: GameState, frame: EffectFrame): void {
  const actor = frame.actor
  const enemy = opponent(actor)

  if (frame.kind === 'troopEffect') {
    switch (frame.troop) {
      case 'skully':
        drawN(s, actor, 2)
        return
      case 'star':
        drawN(s, actor, 1)
        return
      case 'capn':
        // Pending iff the rack is non-empty (a PUBLIC fact — contents may be
        // hidden from us, so target availability is the actor's to judge; skip
        // is always available).
        if (s.players[actor].rack.count > 0) {
          s.pending = { kind: 'capnPlace', actor, optional: true }
        }
        return
      case 'jumbo': {
        const options = (ctx.adjacency.get(frame.base) ?? []).filter((b) => {
          const def = ctx.baseById.get(b)!
          return def.kind === 'base' && topOf(s, b)?.owner === enemy
        })
        if (options.length > 0) s.pending = { kind: 'jumboDiscard', actor, options, optional: true }
        return
      }
      case 'xb42': {
        const victimRack = s.players[enemy].rack
        if (victimRack.count === 0) return // fizzles
        const index = sharedRandomBelow(s, victimRack.count)
        s.pending = { kind: 'xb42Reveal', actor: enemy, index }
        return
      }
      case 'hook': // placement-time rule, nothing to do now
      case 'roxy':
      case 'kwak':
        return
    }
  }

  // Special base effects
  const special = ctx.baseById.get(frame.base)!.special!
  switch (special.kind) {
    case 'cloudDraw':
      drawN(s, actor, 1)
      return
    case 'castleReturn': {
      if (s.players[actor].rack.count >= 8) return
      const options = ctx.terrain.bases
        .filter(
          (b) =>
            b.kind === 'base' &&
            b.id !== frame.base && // returning the tile you just placed is pointless; pinned ruling
            topOf(s, b.id)?.owner === actor,
        )
        .map((b) => b.id)
      if (options.length > 0) s.pending = { kind: 'castleReturn', actor, options, optional: true }
      return
    }
    case 'cemeteryRecover': {
      if (s.players[actor].rack.count >= 8) return
      const options = [...new Set(s.players[actor].discard)]
      if (options.length > 0) s.pending = { kind: 'cemeteryRecover', actor, options, optional: true }
      return
    }
    case 'volcanicMove': {
      const options: { from: BaseId; to: BaseId }[] = []
      for (const from of ctx.adjacency.get(frame.base) ?? []) {
        const fromDef = ctx.baseById.get(from)!
        if (fromDef.kind !== 'base' || isFrozen(s, from)) continue
        if (topOf(s, from)?.owner !== enemy) continue
        for (const to of ctx.adjacency.get(from) ?? []) {
          const toDef = ctx.baseById.get(to)!
          if (toDef.kind !== 'base' || isFrozen(s, to) || to === frame.base) continue
          options.push({ from, to })
        }
      }
      if (options.length > 0) s.pending = { kind: 'volcanicMove', actor, options, optional: true }
      return
    }
    case 'battlefieldFreeze': {
      const targets = ctx.terrain.bases
        .filter((b) => b.kind === 'base' && !isFrozen(s, b.id) && topOf(s, b.id)?.owner === enemy)
        .map((b) => b.id)
        .sort()
      if (targets.length === 0) return
      const target = targets[sharedRandomBelow(s, targets.length)]
      // Frozen through the enemy's next turn; thaws when the freezer acts again.
      s.frozen[target] = s.turnNumber + 2
      checkpoint(ctx, s, actor) // freezing can vacate a region border… or complete one for the freezer
      return
    }
    default:
      return
  }
}

function resolveChoice(ctx: Ctx, s: GameState, actor: PlayerId, value: ChoiceValue): void {
  const pend = s.pending!
  s.pending = null

  switch (pend.kind) {
    case 'capnPlace': {
      if (!('place' in value)) throw new RulesError('expected a placement')
      const { troop, base } = value.place
      const rack = s.players[actor].rack
      if (rack.known && !rack.known.includes(troop)) throw new RulesError('tile not in rack')
      if (rack.count === 0) throw new RulesError('rack empty')
      const connected = connectedTargets(ctx, s, actor)
      if (!canPlace(ctx, s, actor, troop, base, connected)) throw new RulesError('illegal chained placement')
      doPlace(ctx, s, actor, troop, base)
      return
    }
    case 'jumboDiscard': {
      if (!('base' in value)) throw new RulesError('expected a base')
      if (!pend.options.includes(value.base)) throw new RulesError('not a legal Jumbo target')
      const entry = s.board[value.base].pop()!
      s.players[entry.owner].discard.push(entry.troop)
      checkpoint(ctx, s, actor)
      return
    }
    case 'xb42Reveal': {
      if (!('troop' in value)) throw new RulesError('expected a troop')
      const victim = pend.actor
      const removed = zoneRemoveAt(s.players[victim].rack, pend.index)
      if (removed !== undefined && removed !== value.troop) throw new RulesError('reveal mismatch')
      s.players[victim].discard.push(value.troop)
      return
    }
    case 'volcanicMove': {
      if (!('move' in value)) throw new RulesError('expected a move')
      const { from, to } = value.move
      if (!pend.options.some((o) => o.from === from && o.to === to)) throw new RulesError('not a legal lava move')
      const entry = s.board[from].pop()!
      ;(s.board[to] ??= []).push(entry)
      checkpoint(ctx, s, actor)
      return
    }
    case 'castleReturn': {
      if (!('base' in value)) throw new RulesError('expected a base')
      if (!pend.options.includes(value.base)) throw new RulesError('not a legal return target')
      const entry = s.board[value.base].pop()!
      zoneAdd(s.players[actor].rack, entry.troop)
      checkpoint(ctx, s, actor)
      return
    }
    case 'cemeteryRecover': {
      if (!('troop' in value)) throw new RulesError('expected a troop')
      if (!pend.options.includes(value.troop)) throw new RulesError('not in your discard')
      const discard = s.players[actor].discard
      discard.splice(discard.indexOf(value.troop), 1)
      zoneAdd(s.players[actor].rack, value.troop)
      return
    }
  }
}

function endTurn(s: GameState): void {
  s.turnNumber++
  s.turn = opponent(s.turn)
  for (const [base, until] of Object.entries(s.frozen)) {
    if (until <= s.turnNumber) delete s.frozen[base]
  }
}
