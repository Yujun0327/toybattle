# Pinned rulings

The rulebook leaves several interactions ambiguous. Each decision below is
pinned by a named test in `test/`. Change a ruling → change its test.

1. **H.Q. and regions** — an H.Q. bordering a region counts as permanently
   occupied by its owner for region completion.
2. **Frozen troops (Battlefield)** — a frozen troop does not occupy its base
   (breaks connection, blocks region completion for everyone) and cannot be
   covered. It CAN be discarded by Jumbo. It thaws at the start of the
   freezing player's next turn (`frozen[base] = turnNumber + 2`).
3. **Kwak vs strength-restricted slots (Tropical Pool)** — the joker has no
   numeric strength and therefore may NOT be placed on restricted slots.
4. **Hook vs enemy H.Q.** — Hook's exemption applies to bases only; capturing
   the enemy H.Q. always requires connection.
5. **XB-42 with an empty opponent rack** — the effect fizzles silently.
6. **XB-42 randomness** — the stolen index comes from the shared seeded PRNG,
   so neither player chooses it; the victim only reveals the tile at that index.
7. **Castle Field return** — you may not return the tile you just placed
   (pointless undo); any other of your visible tiles is fair game. Skipped
   silently if your rack is full.
8. **Cap'n's pending choice** — created whenever the rack is non-empty (a
   public fact), even if no legal target exists; the UI auto-skips when the
   actor has no legal chained placement. Cap'n chains (Cap'n → Cap'n → Cap'n)
   are legal.
9. **Volcanic Jungle move** — moves the top enemy troop from a base adjacent
   to the special base onto any base adjacent to the troop's base, ignoring
   strength and connection, but never onto an H.Q., a frozen base, or back
   onto the special base itself.
10. **Battlefield freeze target** — chosen by shared PRNG over the sorted list
    of enemy-occupied bases.
11. **Simultaneous medal objective** — if one mutation pushes both players to
    the objective, the acting player wins.
12. **Stalemate declaration** — the stuck player broadcasts `stalemate`; the
    opponent can verify the draw half publicly but trusts the placement half
    (rack is private). Commit-reveal (future) audits it after the game.
13. **Effect draw limits** — Skully/Star/City-of-Clouds draws respect the
    8-tile rack cap and reserve size, drawing fewer (or zero) when capped.
14. **Board layouts** — Castle Field is traced from a photo of the physical
    board (castle ring roads, four catapult platforms, river pools worth 2,
    3-medal home regions bordered by each H.Q., objective 7). The other 7
    terrains remain original layouts *inspired by* the physical boards: same
    terrain names, special-base behaviors; different geometry.
15. **Two-base regions** — Castle Field's river pools are enclosed by only
    two bases (the two banks) plus parallel paths; occupying both banks
    claims the pool.
