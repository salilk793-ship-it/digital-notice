'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { SyncEvent, SyncEventType, VersionVector } from '@/lib/sync-types'
import { getSyncClient, type SyncClient } from '@/lib/sync-client'
import { getOrCreateDeviceId, getSyncState, saveSyncState } from '@/lib/secure-sync'

// ── Offline queue ──────────────────────────────────────────────────────────────

const QUEUE_KEY = 'sync_offline_queue'

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
}

function loadQueue(): QueuedMutation[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/**
 * Enqueue a mutation for offline execution
 */
export function enqueueMutation(
  url: string,
  options: RequestInit
): void {
  const queue = loadQueue()
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    method: options.method ?? 'POST',
    body: options.body as string | undefined,
    headers: options.headers as Record<string, string> | undefined,
    timestamp: new Date().toISOString(),
    retries: 0,
    deviceId: getOrCreateDeviceId(),
    version: Date.now(),
  })
  saveQueue(queue)
}

// ── Hook types ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error' | 'disabled'

export type SyncHandlers = Partial<Record<SyncEventType, (event: SyncEvent) => void>>

export interface UseSyncOptions {
  /** Handlers called for each incoming sync event type */
  handlers?: SyncHandlers
  /** Called when connection state changes */
  onStatusChange?: (status: SyncStatus) => void
  /** Whether to start the connection immediately (default: true) */
  enabled?: boolean
  /** Whether to use optimistic updates (default: true) */
  optimistic?: boolean
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * useSync – enhanced real-time bidirectional synchronisation via Server-Sent Events.
 *
 * Features:
 *  - Authenticates via session cookie (no extra tokens needed)
 *  - Auto-reconnects with exponential back-off on connection loss
 *  - Buffers mutations in localStorage when offline; replays on reconnect
 *  - Last-write-wins conflict resolution via `version` (Date.now())
 *  - Works across all browsers / platforms via SSE (HTTP/1.1+)
 *  - Device tracking for multi-device sync
 *  - Version vectors for conflict resolution
 *  - Optimistic updates support
 */
export function useSync({
  handlers = {},
  onStatusChange,
  enabled = true,
  optimistic = true,
}: UseSyncOptions = {}) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlersRef = useRef(handlers)
  const clientRef = useRef<SyncClient | null>(null)
  const deviceIdRef = useRef<string>('')
  const versionVectorRef = useRef<VersionVector>({})

  handlersRef.current = handlers

  const updateStatus = useCallback(
    (s: SyncStatus) => {
      setStatus(s)
      onStatusChange?.(s)
    },
    [onStatusChange]
  )

  // Initialize client
  useEffect(() => {
    if (typeof window === 'undefined') return

    const client = getSyncClient()
    clientRef.current = client
    deviceIdRef.current = client.getDeviceId()
    versionVectorRef.current = client.getVersionVector()

    // Subscribe to client state changes
    const unsubscribe = client.subscribe((state) => {
      versionVectorRef.current = state.versionVector
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // ── Flush offline queue ──────────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    const queue = loadQueue()
    if (queue.length === 0) return
    const remaining: QueuedMutation[] = []

    for (const item of queue) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          body: item.body,
          headers: { 'Content-Type': 'application/json', ...item.headers },
        })

        if (!res.ok && res.status !== 409) {
          // Non-conflict error – keep in queue up to 3 retries
          item.retries += 1
          if (item.retries < 3) remaining.push(item)
        }
        // Conflict (409) or success → discard
      } catch {
        item.retries += 1
        if (item.retries < 3) remaining.push(item)
      }
    }

    saveQueue(remaining)
  }, [])

  // ── Connect / reconnect ─────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!enabled) return

    // Don't attempt connection if no session (e.g., guest mode)
    // Check for session cookie
    const hasSession = document.cookie.includes('session_user=')
    if (!hasSession) {
      updateStatus('disabled')
      return
    }

    // Clean up existing connection
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    updateStatus('connecting')
    const es = new EventSource('/api/sync/stream')
    esRef.current = es

    es.onopen = () => {
      retryRef.current = 0
      updateStatus('connected')
      // Replay any offline mutations now that we're back online
      flushQueue()
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const syncEvent: SyncEvent = JSON.parse(event.data as string)

        // Handle connection confirmation
        if (syncEvent.payload && typeof syncEvent.payload === 'object' && 'connected' in syncEvent.payload) {
          return
        }

        // Update version vector from remote
        if (syncEvent.versionVector && clientRef.current) {
          clientRef.current.mergeRemoteVersionVector(syncEvent.versionVector)
        }

        // Dispatch to the registered handler for this event type
        const handler = handlersRef.current[syncEvent.type]
        handler?.(syncEvent)

        // Also emit to sync client for state management
        clientRef.current?.emit(syncEvent)
      } catch {
        // Malformed event – ignore
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null

      if (navigator.onLine === false) {
        updateStatus('offline')
      } else {
        updateStatus('error')
      }

      // Exponential back-off: 1 s, 2 s, 4 s … max 30 s
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000)
      retryRef.current += 1
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [enabled, updateStatus, flushQueue])

  // ── Online / offline listeners ────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    const handleOnline = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryRef.current = 0
      connect()
    }

    const handleOffline = () => {
      updateStatus('offline')
      esRef.current?.close()
      esRef.current = null
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    connect()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [enabled, connect, updateStatus])

  // ── Optimistic update helper ──────────────────────────────────────────────
  const optimisticUpdate = useCallback(
    <T,>(id: string, data: T): T => {
      if (!optimistic || !clientRef.current) return data

      // Store in client cache
      clientRef.current.setEntity(id, data, true)

      return data
    },
    [optimistic]
  )

  // ── Confirm/revert helpers ───────────────────────────────────────────────
  const confirmUpdate = useCallback((id: string) => {
    clientRef.current?.confirmMutation(id)
  }, [])

  const revertUpdate = useCallback((id: string) => {
    clientRef.current?.revertMutation(id)
  }, [])

  // ── Get version vector ───────────────────────────────────────────────────
  const getVersionVector = useCallback((): VersionVector => {
    return versionVectorRef.current
  }, [])

  // ── Get device ID ───────────────────────────────────────────────────────
  const getDeviceId = useCallback((): string => {
    return deviceIdRef.current
  }, [])

  const value = useMemo(
    () => ({
      status,
      optimisticUpdate,
      confirmUpdate,
      revertUpdate,
      getVersionVector,
      getDeviceId,
    }),
    [
      status,
      optimisticUpdate,
      confirmUpdate,
      revertUpdate,
      getVersionVector,
      getDeviceId,
    ]
  )

  return value
}

/**
 * Hook to get current sync status
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('idle')

  useEffect(() => {
    const handleOnline = () => setStatus('connected')
    const handleOffline = () => setStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial state
    if (navigator.onLine) {
      setStatus('connected')
    } else {
      setStatus('offline')
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return status
}

/**
 * Hook to check if online and queue mutations
 */
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true)
  const [queueLength, setQueueLength] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)
    setQueueLength(loadQueue().length)

    const handleOnline = () => {
      setIsOnline(true)
      // Flush queue when coming back online
      const queue = loadQueue()
      if (queue.length > 0) {
        flushQueue()
      }
    }

    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const flushQueue = async () => {
    const queue = loadQueue()
    if (queue.length === 0) return

    const remaining: QueuedMutation[] = []

    for (const item of queue) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          body: item.body,
          headers: { 'Content-Type': 'application/json', ...item.headers },
        })

        if (!res.ok && res.status !== 409) {
          item.retries += 1
          if (item.retries < 3) remaining.push(item)
        }
      } catch {
        item.retries += 1
        if (item.retries < 3) remaining.push(item)
      }
    }

    saveQueue(remaining)
    setQueueLength(remaining.length)
  }

  return { isOnline, queueLength, flushQueue }
}
