import { syncEmitter } from './sync-emitter'

export type SyncEventType =
  | 'notices'
  | 'reactions'
  | 'comments'
  | 'bookmarks'
  | 'requests'
  | 'feedback'
  | 'views'
  | 'analytics'
  | 'activity'

export type SyncAction = 'created' | 'updated' | 'deleted' | 'refresh'

export interface SyncEvent {
  type: SyncEventType
  action: SyncAction
  entityId?: string
  /** ISO timestamp of when the change occurred (used for conflict resolution) */
  timestamp: string
  /** Monotonic version using Date.now() – last-write-wins conflict strategy */
  version: number
  /** Optional lightweight payload to avoid full refetch for simple events */
  payload?: unknown
}

/**
 * Broadcast a sync event to all connected SSE clients.
 * Call this after every successful database mutation in API routes.
 */
export function broadcastSync(
  event: Omit<SyncEvent, 'timestamp' | 'version'>
): void {
  const fullEvent: SyncEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    version: Date.now(),
  }
  syncEmitter.emit('sync', fullEvent)
}
