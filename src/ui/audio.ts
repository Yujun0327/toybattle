/**
 * Tiny WebAudio foley kit — synthesized plastic clacks, coins and fanfares,
 * so the repo ships zero audio binaries.
 */
import type { SfxEvent } from '../app/session.svelte'

let ctx: AudioContext | null = null
let muted = false

function ac(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(m: boolean): void {
  muted = m
}

export function isMuted(): boolean {
  return muted
}

function tone(
  freq: number,
  { t = 0, dur = 0.12, type = 'triangle' as OscillatorType, vol = 0.18, glide = 0 } = {},
): void {
  const a = ac()
  const osc = a.createOscillator()
  const gain = a.createGain()
  const start = a.currentTime + t
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function clack({ t = 0, vol = 0.5, cutoff = 900 } = {}): void {
  const a = ac()
  const len = 0.05
  const buffer = a.createBuffer(1, a.sampleRate * len, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(a.currentTime + t)
}

export function play(sfx: SfxEvent | 'select' | 'error'): void {
  if (muted) return
  try {
    switch (sfx) {
      case 'select':
        tone(700, { dur: 0.05, vol: 0.08, type: 'square' })
        return
      case 'error':
        tone(180, { dur: 0.18, vol: 0.12, type: 'sawtooth', glide: -60 })
        return
      case 'place':
        clack()
        tone(240, { dur: 0.08, vol: 0.1, glide: -80 })
        return
      case 'cover':
        clack({ vol: 0.55 })
        clack({ t: 0.06, vol: 0.35, cutoff: 700 })
        tone(200, { dur: 0.1, vol: 0.12, glide: -70 })
        return
      case 'draw':
        clack({ vol: 0.18, cutoff: 2400 })
        clack({ t: 0.07, vol: 0.14, cutoff: 2400 })
        return
      case 'discard':
        tone(420, { dur: 0.16, vol: 0.14, type: 'square', glide: -260 })
        clack({ t: 0.1, vol: 0.3 })
        return
      case 'medal':
        tone(880, { dur: 0.09, vol: 0.14, type: 'square' })
        tone(1320, { t: 0.08, dur: 0.16, vol: 0.14, type: 'square' })
        return
      case 'freeze':
        tone(1600, { dur: 0.3, vol: 0.08, type: 'sine', glide: 500 })
        tone(2100, { t: 0.08, dur: 0.3, vol: 0.06, type: 'sine', glide: 400 })
        return
      case 'win':
        for (const [i, f] of [523, 659, 784, 1047].entries())
          tone(f, { t: i * 0.12, dur: 0.25, vol: 0.16 })
        return
      case 'lose':
        for (const [i, f] of [392, 330, 262].entries())
          tone(f, { t: i * 0.16, dur: 0.3, vol: 0.14, type: 'sawtooth' })
        return
    }
  } catch {
    /* audio context unavailable — stay silent */
  }
}
