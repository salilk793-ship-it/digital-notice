import { EventEmitter } from 'events'

const globalForEmitter = globalThis as unknown as {
  syncEmitter: EventEmitter | undefined
}

export const syncEmitter: EventEmitter =
  globalForEmitter.syncEmitter ?? new EventEmitter()

// Allow up to 1000 concurrent SSE connections
syncEmitter.setMaxListeners(1000)

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.syncEmitter = syncEmitter
}
