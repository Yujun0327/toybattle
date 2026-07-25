import mqtt, { type MqttClient } from 'mqtt'
import type { NetMsg, Transport } from './types'

/**
 * Broadcast transport over public MQTT brokers (plain WebSocket pub/sub).
 *
 * The beacon protocol only needs a lossy, low-rate broadcast channel — not
 * P2P — so WebRTC/ICE/NAT/signaling are unnecessary failure surfaces. We
 * publish every message to THREE public brokers simultaneously and
 * subscribe on all of them: any single live broker suffices, duplicates
 * are absorbed by the session's idempotent merge, and mqtt.js's keepalive
 * (PINGREQ every 30s) + auto-reconnect solve the stale-socket disease that
 * plagued long-lived tabs.
 *
 * Privacy: topics on public brokers are world-readable. Beacons carry only
 * public game state — racks/reserves never leave the client.
 */
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
]

function randHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function connectRoom(code: string): Transport {
  const topic = `toybattle/v3/${code.toUpperCase()}`
  // per-instance tag: filters our own echoes (brokers deliver your publishes back)
  const tag = randHex(6)

  const messageHandlers: ((msg: NetMsg, peerId: string) => void)[] = []
  const joinHandlers: ((peerId: string) => void)[] = []
  const leaveHandlers: ((peerId: string) => void)[] = []

  // cross-broker duplicate suppression: same payload seen within 3s → drop
  const seen = new Map<string, number>()
  const isDuplicate = (payload: string): boolean => {
    const now = Date.now()
    if (seen.size > 64) {
      for (const [k, t] of seen) if (now - t > 3000) seen.delete(k)
    }
    const t = seen.get(payload)
    seen.set(payload, now)
    return t !== undefined && now - t < 3000
  }

  const clients: MqttClient[] = BROKERS.map((url, i) => {
    const client = mqtt.connect(url, {
      // random per-connection id — public brokers kick duplicate client ids
      clientId: `toybattle_${tag}_${i}_${randHex(3)}`,
      clean: true,
      keepalive: 30,
      reconnectPeriod: 2000,
      connectTimeout: 10_000,
      protocolVersion: 4,
      resubscribe: true,
    })
    client.on('connect', () => {
      client.subscribe(topic, { qos: 0 })
      console.log(`[toybattle] broker up: ${url}`)
      for (const fn of joinHandlers) fn(url)
    })
    client.on('close', () => {
      for (const fn of leaveHandlers) fn(url)
    })
    client.on('error', (err) => console.warn(`[toybattle] broker error ${url}:`, err.message))
    client.on('message', (t, payload) => {
      if (t !== topic) return
      const text = payload.toString()
      try {
        const env = JSON.parse(text) as { s: string; m: NetMsg }
        if (env.s === tag || !env.m) return // our own echo
        if (isDuplicate(text)) return // same beacon via another broker
        for (const fn of messageHandlers) fn(env.m, url)
      } catch {
        /* foreign/garbled payload on a public topic — ignore */
      }
    })
    return client
  })

  return {
    send: (msg) => {
      const payload = JSON.stringify({ s: tag, m: msg })
      if (payload.length > 64_000) console.warn(`[toybattle] oversized beacon: ${payload.length}B`)
      for (const client of clients) {
        if (client.connected) client.publish(topic, payload, { qos: 0 })
      }
    },
    onMessage: (fn) => void messageHandlers.push(fn),
    onPeerJoin: (fn) => void joinHandlers.push(fn),
    onPeerLeave: (fn) => void leaveHandlers.push(fn),
    close: () => {
      for (const client of clients) client.end(true)
    },
    relayCount: () => clients.filter((c) => c.connected).length,
    wake: () => {
      for (const client of clients) {
        if (!client.connected) {
          try {
            client.reconnect()
          } catch {
            /* mid-reconnect already */
          }
        }
      }
    },
  }
}

export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}
