'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type {
  SyncEvent,
  SyncEventType,
  SyncAction,
  EntityState,
  ConflictResolution,
  VersionVector,
} from '@/lib/sync-types'
import { getSyncClient, type SyncClient, type SyncClientState } from '@/lib/sync-client'
import { getOrCreateDeviceId, getDeviceInfo } from '@/lib/secure-sync'

/**
 * Sync status
 */
export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error' | 'disabled'

/**
 * Sync context value
 */
interface SyncContextValue {
  /** Current sync status */
  status: SyncStatus
  /** Device ID for this client */
  deviceId: string
  /** Current version vector */
  versionVector: VersionVector
  /** Number of pending mutations */
  pendingCount: number
  /** Whether there are unapplied remote changes */
  hasUnappliedChanges: boolean
  /** Manual refresh trigger */
  refresh: () => void
  /** Force reconnection */
  reconnect: () => void
  /** Get cached entity */
  getEntity: <T>(id: string) => EntityState<T> | undefined
  /** Optimistically update an entity */
  optimisticUpdate: <T>(id: string, data: T) => EntityState<T>
  /** Confirm a successful mutation */
  confirmMutation: (id: string) => void
  /** Revert a failed mutation */
  revertMutation: (id: string) => void
  /** Subscribe to sync state changes */
  subscribe: (callback: (state: SyncClientState) => void) => () => void
}

/**
 * Create the sync context
 */
const SyncContext = createContext<SyncContextValue | null>(null)

/**
 * Sync provider props
 */
interface SyncProviderProps {
  children: ReactNode
  /** Whether to auto-connect (default: true) */
  autoConnect?: boolean
  /** Called when status changes */
  onStatusChange?: (status: SyncStatus) => void
  /** Called when a sync event is received */
  onSyncEvent?: (event: SyncEvent) => void
}

/**
 * Sync provider component
 */
export function SyncProvider({
  children,
  autoConnect = true,
  onStatusChange,
  onSyncEvent,
}: SyncProviderProps) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [deviceId, setDeviceId] = useState<string>('')
  const [versionVector, setVersionVector] = useState<VersionVector>({})
  const [pendingCount, setPendingCount] = useState(0)
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false)

  const clientRef = useRef<SyncClient | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize client
  useEffect(() => {
    if (typeof window === 'undefined') return

    const client = getSyncClient()
    clientRef.current = client

    setDeviceId(client.getDeviceId())
    setVersionVector(client.getVersionVector())

    // Subscribe to state changes
    const unsubscribe = client.subscribe((state) => {
      setVersionVector(state.versionVector)
      setPendingCount(state.pendingCount)
      setHasUnappliedChanges(state.pendingCount > 0)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Handle status changes
  const handleStatusChange = useCallback(
    (newStatus: SyncStatus) => {
      setStatus(newStatus)
      onStatusChange?.(newStatus)
    },
    [onStatusChange]
  )

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return

    // Don't attempt connection if no session (e.g., guest mode)
    // Check for session cookie
    const hasSession = document.cookie.includes('session_user=')
    if (!hasSession) {
      handleStatusChange('disabled')
      return
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    handleStatusChange('connecting')

    try {
      const es = new EventSource('/api/sync/stream')
      eventSourceRef.current = es

      es.onopen = () => {
        retryRef.current = 0
        handleStatusChange('connected')
      }

      es.onmessage = (event: MessageEvent) => {
        try {
          const syncEvent: SyncEvent = JSON.parse(event.data as string)

          // Handle connection confirmation
          if (syncEvent.payload && typeof syncEvent.payload === 'object' && 'connected' in syncEvent.payload) {
            return
          }

          // Emit to client
          clientRef.current?.emit(syncEvent)

          // Merge version vector if present
          if (syncEvent.versionVector) {
            clientRef.current?.mergeRemoteVersionVector(syncEvent.versionVector)
          }

          // Notify listener
          onSyncEvent?.(syncEvent)
        } catch {
          // Malformed event – ignore
        }
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null

        if (navigator.onLine === false) {
          handleStatusChange('offline')
        } else {
          handleStatusChange('error')
        }

        // Exponential back-off
        const delay = Math.min(1000 * 2 ** retryRef.current, 30_000)
        retryRef.current += 1
        retryTimerRef.current = setTimeout(connect, delay)
      }
    } catch {
      handleStatusChange('error')
    }
  }, [handleStatusChange, onSyncEvent])

  // Handle online/offline events
  useEffect(() => {
    if (!autoConnect) return

    const handleOnline = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryRef.current = 0
      connect()
    }

    const handleOffline = () => {
      handleStatusChange('offline')
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial connection
    connect()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      eventSourceRef.current?.close()
    }
  }, [autoConnect, connect, handleStatusChange])

  // Manual refresh
  const refresh = useCallback(() => {
    // Trigger a full refresh by emitting a refresh event
    clientRef.current?.emit({
      type: 'notices',
      action: 'refresh',
      timestamp: new Date().toISOString(),
      version: Date.now(),
    })
  }, [])

  // Force reconnection
  const reconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryRef.current = 0
    connect()
  }, [connect])

  // Get entity from cache
  const getEntity = useCallback(<T,>(id: string): EntityState<T> | undefined => {
    return clientRef.current?.getEntity<T>(id)
  }, [])

  // Optimistic update
  const optimisticUpdate = useCallback(<T,>(id: string, data: T): EntityState<T> => {
    return clientRef.current?.setEntity(id, data, true) as EntityState<T>
  }, [])

  // Confirm mutation
  const confirmMutation = useCallback((id: string) => {
    clientRef.current?.confirmMutation(id)
  }, [])

  // Revert mutation
  const revertMutation = useCallback((id: string) => {
    clientRef.current?.revertMutation(id)
  }, [])

  // Subscribe to state
  const subscribe = useCallback((callback: (state: SyncClientState) => void) => {
    return clientRef.current?.subscribe(callback) ?? (() => {})
  }, [])

  const value: SyncContextValue = {
    status,
    deviceId,
    versionVector,
    pendingCount,
    hasUnappliedChanges,
    refresh,
    reconnect,
    getEntity,
    optimisticUpdate,
    confirmMutation,
    revertMutation,
    subscribe,
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

/**
 * Use the sync context
 */
export function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider')
  }
  return context
}

/**
 * Hook to register a handler for specific sync event types
 */
export function useSyncEvent(
  type: SyncEventType,
  handler: (event: SyncEvent) => void
) {
  const client = typeof window !== 'undefined' ? getSyncClient() : null

  useEffect(() => {
    if (!client) return

    const unsubscribe = client.on(type, handler)
    return () => unsubscribe()
  }, [client, type, handler])
}

/**
 * Hook to get sync status
 */
export function useSyncStatus(): SyncStatus {
  const { status } = useSyncContext()
  return status
}

/**
 * Hook to check for pending changes
 */
export function usePendingChanges(): boolean {
  const { hasUnappliedChanges } = useSyncContext()
  return hasUnappliedChanges
}
