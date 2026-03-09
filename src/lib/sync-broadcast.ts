import { syncEmitter } from './sync-emitter'
import type { VersionVector } from './sync-types'

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
  /** Device ID that initiated the change (for multi-device sync) */
  deviceId?: string
  /** Version vector for distributed conflict resolution */
  versionVector?: VersionVector
  /** Optional lightweight payload to avoid full refetch for simple events */
  payload?: unknown
  /** Checksum for data integrity verification */
  checksum?: string
}

/**
 * Broadcast a sync event to all connected SSE clients.
 * Call this after every successful database mutation in API routes.
 * 
 * @param event - The sync event without timestamp/version
 * @param options - Optional configuration
 */
export function broadcastSync(
  event: Omit<SyncEvent, 'timestamp' | 'version'>,
  options?: {
    /** Device ID that initiated the change */
    deviceId?: string
    /** Version vector for distributed conflict resolution */
    versionVector?: VersionVector
    /** Optional checksum for data integrity */
    checksum?: string
  }
): void {
  const fullEvent: SyncEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    version: Date.now(),
    deviceId: options?.deviceId,
    versionVector: options?.versionVector,
    checksum: options?.checksum,
  }
  syncEmitter.emit('sync', fullEvent)
}

/**
 * Broadcast a sync event with entity data
 */
export function broadcastSyncWithData<T>(
  event: Omit<SyncEvent, 'timestamp' | 'version'>,
  entityData: T,
  options?: {
    deviceId?: string
    versionVector?: VersionVector
  }
): void {
  const checksum = generateChecksum(entityData)
  broadcastSync(event, {
    ...options,
    checksum,
  })
  syncEmitter.emit('sync:data', { ...event, entityData, checksum })
}

/**
 * Generate a simple checksum for data integrity
 */
function generateChecksum<T>(data: T): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
