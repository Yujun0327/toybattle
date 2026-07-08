# Toy Battle — Art Bible

The game currently ships with hand-drawn SVG "toy sticker" characters
(`src/ui/CharacterArt.svelte`). This document is the recipe for upgrading to
AI-generated imagery while keeping every asset in one consistent style.
Generate all assets in ONE sitting with the same master prompt — consistency
dies the moment you improvise.

## Master style prompt (prepend to every character prompt)

> collectible vinyl toy figurine, glossy molded plastic with visible seam
> lines, bright saturated colors, soft studio top-light, 3/4 view, centered,
> plain solid background, no text, no watermark, toy photography, shallow
> depth of field

Negative prompt (where supported): `realistic, gritty, horror, text, logo, human skin`

## Palette anchors (mention in prompts)

- Red player: tomato red `#E23D2E`
- Blue player: cobalt blue `#2B5FD9`
- Warm cream backdrop `#F5EBDC`, mustard gold accents `#F2B01E`

## The 8 characters (original archetypes — do NOT copy Repos' art)

| File | Character | Prompt fragment |
|---|---|---|
| `skully.webp` | Skully (1) | wind-up toy skeleton, white plastic bones, oversized round skull, silver wind-up key in its back, cheerful grin |
| `capn.webp` | Cap'n (2) | pirate monkey toy, brown plastic fur, red bandana, tiny gold earring, mischievous smile |
| `jumbo.webp` | Jumbo (3) | toy elephant on red wheels, pastel gray plastic, big friendly ears, pull-along string |
| `hook.webp` | Hook (4) | pirate toy with oversized silver grappling hook arm, black tricorn hat, eye patch |
| `xb42.webp` | XB-42 (5) | retro tin robot toy, teal body, red antenna bulb, riveted chest grill, boxy head |
| `star.webp` | Star (6) | toy unicorn figurine, white body, golden horn, pink mane, tiny gold star on flank |
| `roxy.webp` | Roxy (7) | toy t-rex figurine, leaf-green plastic, stubby arms, huge grin with white teeth |
| `kwak.webp` | Kwak (★) | rubber duck wearing a silver viking helmet with horns, defiant expression |

## Terrain backdrop mats (optional, 8 files)

> top-down illustrated game play-mat, soft painted texture, muted detail so
> game pieces stay readable, rounded corners, [terrain flavor]

Flavors: castle courtyard lawn / tropical pool & sand / cloud city on blue
sky / jungle with lava crater / foggy toy graveyard / caribbean sea with
islands / sci-fi space station floor / green army sandbox trenches.

## Post-processing pipeline

1. Generate at 1024×1024.
2. Remove background (characters only) → transparent PNG.
3. Color-grade toward the palette (warm highlights, no pure black).
4. Export WebP: characters 256×256 (`cwebp -q 85`), mats 1024-wide.
5. Drop into `src/assets/characters/` and `src/assets/mats/`.

## Wiring them in

`CharacterArt.svelte` is the single swap point: replace its `<g>` branches
with `<image href={url} width="100" height="100">` per troop, importing URLs
via `import.meta.glob('./characters/*.webp', { eager: true, query: '?url' })`
with the SVG glyphs kept as fallback for missing files. Board mats hook into
`Board.svelte` behind the socket layer (draw them at ~35% opacity so sockets
and paths stay readable).
