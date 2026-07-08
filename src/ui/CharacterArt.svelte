<script lang="ts">
  import type { TroopType } from '../engine/types'

  let { troop }: { troop: TroopType } = $props()
</script>

<!--
  Each character lives in a 100×100 box, centered ~(50,50).
  Toy-sticker style: bold shapes, warm dark outline, one gloss dot.
  Swap these for AI-generated WebP art via assets/art-bible.md when ready.
-->
<g stroke="#33281e" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
  {#if troop === 'skully'}
    <!-- wind-up skeleton -->
    <path d="M30 78 L42 64 M70 78 L58 64" stroke-width="5" />
    <circle cx="30" cy="78" r="7" fill="#fffdf8" />
    <circle cx="70" cy="78" r="7" fill="#fffdf8" />
    <ellipse cx="50" cy="42" rx="24" ry="22" fill="#fffdf8" />
    <rect x="38" y="58" width="24" height="14" rx="6" fill="#fffdf8" />
    <circle cx="41" cy="42" r="6" fill="#33281e" stroke="none" />
    <circle cx="59" cy="42" r="6" fill="#33281e" stroke="none" />
    <path d="M50 50 l-4 7 h8 z" fill="#33281e" stroke="none" />
    <path d="M44 63 v7 M50 63 v7 M56 63 v7" />
    <circle cx="43" cy="39" r="2" fill="#fffdf8" stroke="none" />
  {:else if troop === 'capn'}
    <!-- pirate monkey -->
    <circle cx="26" cy="46" r="10" fill="#b07b4f" />
    <circle cx="74" cy="46" r="10" fill="#b07b4f" />
    <circle cx="26" cy="46" r="4" fill="#e8c49a" stroke="none" />
    <circle cx="74" cy="46" r="4" fill="#e8c49a" stroke="none" />
    <circle cx="50" cy="50" r="26" fill="#b07b4f" />
    <ellipse cx="50" cy="60" rx="16" ry="12" fill="#e8c49a" />
    <circle cx="41" cy="46" r="4.5" fill="#33281e" stroke="none" />
    <circle cx="59" cy="46" r="4.5" fill="#33281e" stroke="none" />
    <path d="M44 63 q6 5 12 0" fill="none" />
    <path d="M25 36 a26 26 0 0 1 50 0 l-3 6 q-22 -10 -44 0 z" fill="#e23d2e" />
    <circle cx="72" cy="40" r="5" fill="#e23d2e" />
    <circle cx="33" cy="30" r="2.5" fill="#fffdf8" stroke="none" />
  {:else if troop === 'jumbo'}
    <!-- elephant on wheels -->
    <circle cx="30" cy="80" r="9" fill="#e23d2e" />
    <circle cx="70" cy="80" r="9" fill="#e23d2e" />
    <circle cx="30" cy="80" r="3" fill="#fffdf8" stroke="none" />
    <circle cx="70" cy="80" r="3" fill="#fffdf8" stroke="none" />
    <ellipse cx="24" cy="42" rx="14" ry="17" fill="#8f9bb0" />
    <ellipse cx="76" cy="42" rx="14" ry="17" fill="#8f9bb0" />
    <ellipse cx="24" cy="44" rx="8" ry="10" fill="#c8d0de" stroke="none" />
    <ellipse cx="76" cy="44" rx="8" ry="10" fill="#c8d0de" stroke="none" />
    <ellipse cx="50" cy="48" rx="26" ry="24" fill="#a9b4c7" />
    <path d="M50 52 q-3 14 8 20 q6 3 8 -2" fill="none" stroke-width="8" stroke="#a9b4c7" />
    <path d="M50 52 q-3 14 8 20 q6 3 8 -2" fill="none" />
    <circle cx="41" cy="42" r="4.5" fill="#33281e" stroke="none" />
    <circle cx="59" cy="42" r="4.5" fill="#33281e" stroke="none" />
    <path d="M36 60 q-6 6 -2 12 M64 60 q6 6 2 12" fill="none" stroke="#fffdf8" stroke-width="5" />
    <circle cx="42" cy="32" r="3" fill="#fffdf8" stroke="none" />
  {:else if troop === 'hook'}
    <!-- grappling pirate -->
    <path d="M50 88 a16 16 0 1 1 15 -21" fill="none" stroke-width="8" stroke="#9aa5b1" />
    <path d="M50 88 a16 16 0 1 1 15 -21" fill="none" stroke-width="3" />
    <circle cx="50" cy="40" r="22" fill="#e8c49a" />
    <path d="M27 38 a24 24 0 0 1 46 0 l2 6 q-25 -8 -50 0 z" fill="#33281e" />
    <path d="M27 38 h46" stroke="#f2b01e" stroke-width="4" />
    <circle cx="42" cy="44" r="4.5" fill="#33281e" stroke="none" />
    <path d="M52 38 l14 0 a3 3 0 0 1 0 8 l-14 0 z" fill="#33281e" stroke="none" />
    <circle cx="59" cy="44" r="5" fill="#4b4237" stroke="none" />
    <path d="M42 56 q8 6 16 0" fill="none" />
    <circle cx="35" cy="30" r="2.5" fill="#fffdf8" stroke="none" />
  {:else if troop === 'xb42'}
    <!-- tin robot -->
    <path d="M50 22 v-8" />
    <circle cx="50" cy="10" r="5" fill="#e23d2e" />
    <rect x="22" y="22" width="56" height="52" rx="12" fill="#8fd0d8" />
    <rect x="28" y="28" width="44" height="24" rx="8" fill="#e6f4f5" stroke-width="2.5" />
    <circle cx="40" cy="40" r="6.5" fill="#33281e" stroke="none" />
    <circle cx="60" cy="40" r="6.5" fill="#33281e" stroke="none" />
    <circle cx="42" cy="38" r="2" fill="#fffdf8" stroke="none" />
    <circle cx="62" cy="38" r="2" fill="#fffdf8" stroke="none" />
    <path d="M36 62 h28 M36 62 v6 M43 62 v6 M50 62 v6 M57 62 v6 M64 62 v6" stroke-width="2.5" />
    <circle cx="26" cy="80" r="6" fill="#f2b01e" />
    <circle cx="74" cy="80" r="6" fill="#f2b01e" />
    <circle cx="29" cy="27" r="2.5" fill="#fffdf8" stroke="none" />
  {:else if troop === 'star'}
    <!-- toy unicorn -->
    <path d="M50 26 l6 -20 4 22 z" fill="#f2b01e" />
    <path d="M28 34 q-10 14 -2 28 q4 8 12 10" fill="#ff9ecb" stroke-width="7" stroke="#ff9ecb" />
    <circle cx="52" cy="52" r="26" fill="#fffdf8" />
    <ellipse cx="60" cy="62" rx="14" ry="10" fill="#ffe1ee" stroke-width="2.5" />
    <circle cx="66" cy="60" r="2.5" fill="#33281e" stroke="none" />
    <circle cx="56" cy="60" r="2.5" fill="#33281e" stroke="none" />
    <path d="M40 46 q4 -4 8 0" fill="none" />
    <path d="M38 30 q8 -8 16 -2" fill="#ff9ecb" />
    <circle cx="44" cy="38" r="3" fill="#fffdf8" stroke="none" />
    <path d="M74 40 l3 -6 3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 z" fill="#f2b01e" stroke-width="2" />
  {:else if troop === 'roxy'}
    <!-- t-rex -->
    <path d="M26 78 q-6 -8 2 -14 M40 82 q-4 -8 4 -12" fill="none" stroke-width="4" />
    <path d="M22 44 q4 -22 30 -22 q28 0 30 20 l-4 6 -30 2 q2 8 -4 12 l-8 2 q-16 -4 -14 -20" fill="#63a94f" />
    <path d="M48 50 l5 7 5 -7 5 7 5 -7 5 7 5 -7" fill="#fffdf8" stroke-width="2.5" />
    <circle cx="42" cy="38" r="5" fill="#fffdf8" />
    <circle cx="43" cy="39" r="2.5" fill="#33281e" stroke="none" />
    <circle cx="72" cy="36" r="2.5" fill="#33281e" stroke="none" />
    <path d="M30 26 l6 8 M42 20 l3 9" stroke="#e8f0d8" stroke-width="4" />
    <circle cx="34" cy="32" r="2.5" fill="#fffdf8" stroke="none" />
  {:else}
    <!-- kwak, the viking duck -->
    <path d="M22 40 q-8 -14 4 -18 l6 8 M78 40 q8 -14 -4 -18 l-6 8" fill="#d9d2c6" />
    <path d="M26 42 a24 14 0 0 1 48 0 z" fill="#9aa5b1" />
    <path d="M26 42 h48" stroke-width="3" />
    <circle cx="50" cy="58" r="24" fill="#ffd23e" />
    <circle cx="42" cy="52" r="4.5" fill="#33281e" stroke="none" />
    <circle cx="58" cy="52" r="4.5" fill="#33281e" stroke="none" />
    <path d="M38 66 q12 -6 24 0 q-6 9 -12 9 q-6 0 -12 -9 z" fill="#f28c28" />
    <circle cx="44" cy="48" r="2" fill="#fffdf8" stroke="none" />
    <circle cx="38" cy="34" r="2.5" fill="#fffdf8" stroke="none" />
  {/if}
</g>
