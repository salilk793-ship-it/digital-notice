'use client'

import {
  type SyncEvent,
  type SyncEventType,
  type EntityState,
  type ConflictResolution,
  type VersionVector,
  detectConflict,
  resolveConflict,
  mergeVersionVectors,
  needsSync,
} from './sync-types'
import {
  getOrCreateDeviceId,
  getDeviceInfo,
  getSyncState,
  saveSyncState,
  type DeviceInfo,
} from './secure-sync'

/**
 * Sync client state manager
 * Handles optimistic updates, conflict resolution, and state persistence
 */
export class SyncClient {
  private deviceId: string
  private deviceInfo: DeviceInfo
  private handlers: Map<SyncEventType, Set<(event: SyncEvent) => void>> = new Map()
  private entityCache: Map<string, EntityState> = new Map()
  private versionVector: VersionVector = {}
  private pendingMutations: Map<string, EntityState> = new Map()
  private listeners: Set<(state: SyncClientState) => void> = new Set()

  constructor() {
    this.deviceId = getOrCreateDeviceId()
    this.deviceInfo = getDeviceInfo()
    this.loadState()
  }

  /**
   * Load persisted state
   */
  private loadState(): void {
    const state = getSyncState()
    if (state) {
      this.versionVector = state.versionVector || {}
    }
  }

  /**
   * Save current state
   */
  private persistState(): void {
    saveSyncState({
      lastSyncTimestamp: new Date().toISOString(),
      lastVersion: Date.now(),
      versionVector: this.versionVector,
    })
  }

  /**
   * Get the device ID
   */
  getDeviceId(): string {
    return this.deviceId
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo {
    return this.deviceInfo
  }

  /**
   * Get current version vector
   */
  getVersionVector(): VersionVector {
    return { ...this.versionVector }
  }

  /**
   * Update local version for this device
   */
  incrementVersion(): number {
    const newVersion = Date.now()
    this.versionVector[this.deviceId] = newVersion
    this.persistState()
    return newVersion
  }

  /**
   * Merge remote version vector
   */
  mergeRemoteVersionVector(remote: VersionVector): boolean {
    const needed = needsSync(this.versionVector, remote)
    this.versionVector = mergeVersionVectors(this.versionVector, remote)
    this.persistState()
    return needed
  }

  /**
   * Register a handler for sync events
   */
  on(type: SyncEventType, handler: (event: SyncEvent) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  /**
   * Emit a sync event to all registered handlers
   */
  emit(event: SyncEvent): void {
    const handlers = this.handlers.get(event.type)
    if (handlers) {
      handlers.forEach((handler) => handler(event))
    }
    this.emitStateChange()
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: SyncClientState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all state listeners
   */
  private emitStateChange(): void {
    const state = this.getState()
    this.listeners.forEach((listener) => listener(state))
  }

  /**
   * Get current client state
   */
  getState(): SyncClientState {
    return {
      deviceId: this.deviceId,
      deviceInfo: this.deviceInfo,
      versionVector: this.versionVector,
      pendingCount: this.pendingMutations.size,
      cacheSize: this.entityCache.size,
    }
  }

  /**
   * Set entity in local cache (optimistic update)
   */
  setEntity<T>(id: string, data: T, isPending = false): EntityState<T> {
    const existing = this.entityCache.get(id)
    const state: EntityState<T> = {
      id,
      data,
      version: this.incrementVersion(),
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
      isPending,
      isConflict: false,
    }

    this.entityCache.set(id, state)

    if (isPending) {
      this.pendingMutations.set(id, state)
    }

    this.persistState()
    this.emitStateChange()
    return state
  }

  /**
   * Get entity from local cache
   */
  getEntity<T>(id: string): EntityState<T> | undefined {
    return this.entityCache.get(id) as EntityState<T> | undefined
  }

  /**
   * Remove entity from local cache
   */
  removeEntity(id: string): void {
    this.entityCache.delete(id)
    this.pendingMutations.delete(id)
    this.emitStateChange()
  }

  /**
   * Apply remote change with conflict resolution
   */
  applyRemoteChange<T>(
    id: string,
    remoteData: T,
    remoteVersion: number,
    remoteTimestamp: string,
    mergeFn?: (local: T, remote: T) => T
  ): ConflictResolution<T> {
    const local = this.entityCache.get(id) as EntityState<T> | undefined

    if (!local) {
      // No local version, accept remote directly
      this.setEntity(id, remoteData)
      return { resolved: true, strategy: 'remote', data: remoteData }
    }

    // Detect conflict
    const detection = detectConflict(
      local.version,
      remoteVersion,
      local.timestamp,
      remoteTimestamp
    )

    if (!detection.hasConflict) {
      // No conflict, accept remote
      this.setEntity(id, remoteData)
      return { resolved: true, strategy: 'remote', data: remoteData }
    }

    // Conflict detected - resolve based on strategy
    if (detection.strategy === 'accept') {
      // Local is newer, keep local
      return { resolved: false, strategy: 'local', conflicts: ['version'] }
    }

    // Remote is newer - resolve
    return resolveConflict(
      local.data,
      remoteData,
      mergeFn ? 'merge' : 'remote',
      mergeFn
    )
  }

  /**
   * Mark mutation as confirmed (success response from server)
   */
  confirmMutation(id: string): void {
    const pending = this.pendingMutations.get(id)
    if (pending) {
      this.pendingMutations.delete(id)
      const confirmed = this.entityCache.get(id)
      if (confirmed) {
        this.entityCache.set(id, { ...confirmed, isPending: false })
      }
      this.emitStateChange()
    }
  }

  /**
   * Mark mutation as failed (revert optimistic update)
   */
  revertMutation(id: string): void {
    const pending = this.pendingMutations.get(id)
    if (pending) {
      this.pendingMutations.delete(id)
      this.entityCache.delete(id)
      this.emitStateChange()
    }
  }

  /**
   * Get all pending mutations
   */
  getPendingMutations(): EntityState[] {
    return Array.from(this.pendingMutations.values())
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges(): boolean {
    return this.pendingMutations.size > 0
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.entityCache.clear()
    this.pendingMutations.clear()
    this.emitStateChange()
  }
}

/**
 * Sync client state interface
 */
export interface SyncClientState {
  deviceId: string
  deviceInfo: DeviceInfo
  versionVector: VersionVector
  pendingCount: number
  cacheSize: number
}

/**
 * Singleton instance
 */
let syncClientInstance: SyncClient | null = null

/**
 * Get or create the sync client instance
 */
export function getSyncClient(): SyncClient {
  if (typeof window === 'undefined') {
    // Return a server-side mock for SSR
    return new SyncClient()
  }

  if (!syncClientInstance) {
    syncClientInstance = new SyncClient()
  }
  return syncClientInstance
}

/**
 * Reset the sync client (for testing or logout)
 */
export function resetSyncClient(): void {
  syncClientInstance = null
}
