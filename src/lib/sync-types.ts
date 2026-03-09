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

/**
 * Version vector for conflict resolution
 * Tracks the last known version from each device/client
 */
export interface VersionVector {
  [deviceId: string]: number
}

/**
 * Entity state for optimistic updates
 */
export interface EntityState<T = unknown> {
  id: string
  data: T
  version: number
  deviceId: string
  timestamp: string
  isPending: boolean
  isConflict: boolean
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution<T = unknown> {
  resolved: boolean
  strategy: 'local' | 'remote' | 'merge'
  data?: T
  conflicts?: string[]
}

/**
 * Sync event with enhanced metadata for conflict resolution
 */
export interface SyncEvent {
  type: SyncEventType
  action: SyncAction
  entityId?: string
  /** ISO timestamp of when the change occurred */
  timestamp: string
  /** Monotonic version using Date.now() – last-write-wins conflict strategy */
  version: number
  /** Device ID that initiated the change */
  deviceId?: string
  /** Version vector for multi-device conflict resolution */
  versionVector?: VersionVector
  /** Optional lightweight payload to avoid full refetch for simple events */
  payload?: unknown
  /** Checksum for data integrity verification */
  checksum?: string
}

/**
 * Extended sync event with entity data
 */
export interface SyncEventWithData<T = unknown> extends SyncEvent {
  entityData?: T
}

/**
 * Client information for multi-device sync
 */
export interface SyncClient {
  id: string
  userId: string
  lastSeen: string
  platform?: string
  isOnline: boolean
}

/**
 * Queued mutation with conflict resolution metadata
 */
export interface QueuedMutation {
  id: string
  url: string
  method: string
  body?: string
  headers?: Record<string, string>
  timestamp: string
  retries: number
  deviceId: string
  version: number
  versionVector?: VersionVector
}

/**
 * Conflict detection result
 */
export interface ConflictDetection {
  hasConflict: boolean
  localVersion: number
  remoteVersion: number
  conflictFields?: string[]
  strategy: 'accept' | 'reject' | 'merge'
}

/**
 * Broadcast a sync event to all connected SSE clients.
 * Call this after every successful database mutation in API routes.
 * 
 * @param event - The sync event without timestamp/version (these are added automatically)
 * @param options - Optional configuration for enhanced sync
 */
export function broadcastSync(
  event: Omit<SyncEvent, 'timestamp' | 'version'>,
  options?: {
    /** Device ID that initiated the change */
    deviceId?: string
    /** Version vector for conflict resolution */
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
export function generateChecksum<T>(data: T): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Detect conflicts between local and remote versions
 */
export function detectConflict(
  localVersion: number,
  remoteVersion: number,
  localTimestamp: string,
  remoteTimestamp: string
): ConflictDetection {
  // If versions are equal, no conflict
  if (localVersion === remoteVersion) {
    return {
      hasConflict: false,
      localVersion,
      remoteVersion,
      strategy: 'accept',
    }
  }

  // Use timestamp-based last-write-wins as default strategy
  const localTime = new Date(localTimestamp).getTime()
  const remoteTime = new Date(remoteTimestamp).getTime()

  if (localTime === remoteTime) {
    // If timestamps are equal, use version as tiebreaker
    return {
      hasConflict: false,
      localVersion,
      remoteVersion,
      strategy: localVersion > remoteVersion ? 'accept' : 'reject',
    }
  }

  return {
    hasConflict: localTime > remoteTime,
    localVersion,
    remoteVersion,
    strategy: localTime > remoteTime ? 'accept' : 'reject',
  }
}

/**
 * Resolve conflict using the specified strategy
 */
export function resolveConflict<T>(
  localData: T,
  remoteData: T,
  strategy: 'local' | 'remote' | 'merge',
  mergeFn?: (local: T, remote: T) => T
): ConflictResolution<T> {
  switch (strategy) {
    case 'local':
      return {
        resolved: true,
        strategy: 'local',
        data: localData,
      }
    case 'remote':
      return {
        resolved: true,
        strategy: 'remote',
        data: remoteData,
      }
    case 'merge':
      if (mergeFn) {
        return {
          resolved: true,
          strategy: 'merge',
          data: mergeFn(localData, remoteData),
        }
      }
      // Default merge: remote wins for simple objects
      return {
        resolved: true,
        strategy: 'merge',
        data: remoteData,
      }
  }
}

/**
 * Merge version vectors
 */
export function mergeVersionVectors(
  local: VersionVector,
  remote: VersionVector
): VersionVector {
  const merged: VersionVector = { ...local }
  
  for (const [deviceId, version] of Object.entries(remote)) {
    if (!merged[deviceId] || merged[deviceId] < version) {
      merged[deviceId] = version
    }
  }
  
  return merged
}

/**
 * Compare version vectors to determine if sync is needed
 */
export function needsSync(local: VersionVector, remote: VersionVector): boolean {
  for (const [deviceId, version] of Object.entries(remote)) {
    if (!local[deviceId] || local[deviceId] < version) {
      return true
    }
  }
  return false
}
