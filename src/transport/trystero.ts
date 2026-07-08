import { joinRoom, type Room } from 'trystero'
import type { NetMsg, Transport } from './types'

const APP_ID = 'toybattle-v1'

export function connectRoom(code: string): Transport {
  const room: Room = joinRoom({ appId: APP_ID }, code.toUpperCase())

  const messageHandlers: ((msg: NetMsg) => void)[] = []
  const joinHandlers: (() => void)[] = []
  const leaveHandlers: (() => void)[] = []

  // Payloads travel as JSON strings — simplest fit for trystero's DataPayload.
  const action = room.makeAction<string>('msg', {
    onMessage: (data) => {
      try {
        const msg = JSON.parse(data) as NetMsg
        for (const fn of messageHandlers) fn(msg)
      } catch (err) {
        console.warn('bad message', err)
      }
    },
  })

  room.onPeerJoin = () => {
    for (const fn of joinHandlers) fn()
  }
  room.onPeerLeave = () => {
    for (const fn of leaveHandlers) fn()
  }

  return {
    send: (msg) => void action.send(JSON.stringify(msg)).catch((err) => console.warn('send failed', err)),
    onMessage: (fn) => void messageHandlers.push(fn),
    onPeerJoin: (fn) => void joinHandlers.push(fn),
    onPeerLeave: (fn) => void leaveHandlers.push(fn),
    close: () => void room.leave().catch(() => {}),
  }
}

export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}
