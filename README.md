# Toy Battle

A fan-made, browser-based implementation of the 2-player board game
**Toy Battle** (Paolo Mori & Alessandro Zucchini, Repos Production 2025),
built for private play among friends. Place your toys, hold your supply
line, surround medal regions, capture the enemy flag.

**No backend.** The site is fully static; online games run browser-to-browser
over WebRTC ([Trystero](https://github.com/dmotz/trystero) handles serverless
signaling). Hidden information (your shuffled reserve and rack) never leaves
your machine — only public facts travel the wire, and every move carries a
public-state hash so the two clients can detect desync.

## Play modes

- **Create/Join room** — share a 6-letter code or link; peer-to-peer online play
- **Hot-seat** — two players, one device, with a pass-the-device privacy curtain

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest: engine property tests + session/UI integration
npm run check      # svelte-check + tsc
npm run build      # production build → dist/
```

## Deploying (GitHub → Netlify)

1. Push this repo to GitHub.
2. In Netlify: *Add new site → Import an existing project* → pick the repo.
3. Build settings are read from `netlify.toml` (`npm run build`, publish `dist/`).

Every push to the default branch redeploys. Room links look like
`https://<your-site>.netlify.app/#room=ABC123`.

## Architecture

```
src/engine/     pure rules engine — deterministic reducer, no DOM/network
src/terrains/   8 boards as data (original layouts inspired by the physical game)
src/transport/  hotseat loopback + Trystero WebRTC wrapper
src/app/        session glue: secrets, persistence, resync, reactive state
src/ui/         Svelte 5 components ("shelf of toys" art direction)
```

- `rulings.md` — pinned decisions for every rules ambiguity, each backed by a test
- `src/assets/art-bible.md` — recipe for generating consistent character art

## Credits

A loving tribute to the original *Toy Battle* by Paolo Mori and Alessandro
Zucchini, published by Repos Production. All artwork here is original.
Buy the real game — it's 15 minutes of joy and fits in a coat pocket.
