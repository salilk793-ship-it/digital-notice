'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { SyncEvent, SyncEventType } from '@/lib/sync-broadcast'

// ── Offline queue ──────────────────────────────────────────────────────────────

const QUEUE_KEY = 'sync_offline_queue'

interface QueuedMutation {
  id: string
  url: string
  method: string
  body?: string
  headers?: Record<string, string>
  timestamp: string
  retries: number
}

function loadQueue(): QueuedMutation[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedMutation[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

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
  })
  saveQueue(queue)
}

// ── Hook types ─────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'connecting' | 'connected' | 'offline' | 'error'

export type SyncHandlers = Partial<Record<SyncEventType, (event: SyncEvent) => void>>

interface UseSyncOptions {
  /** Handlers called for each incoming sync event type */
  handlers?: SyncHandlers
  /** Called when connection state changes */
  onStatusChange?: (status: SyncStatus) => void
  /** Whether to start the connection immediately (default: true) */
  enabled?: boolean
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * useSync – real-time bidirectional synchronisation via Server-Sent Events.
 *
 * Features:
 *  - Authenticates via session cookie (no extra tokens needed)
 *  - Auto-reconnects with exponential back-off on connection loss
 *  - Buffers mutations in localStorage when offline; replays on reconnect
 *  - Last-write-wins conflict resolution via `version` (Date.now())
 *  - Works across all browsers / platforms via SSE (HTTP/1.1+)
 */
export function useSync({
  handlers = {},
  onStatusChange,
  enabled = true,
}: UseSyncOptions = {}) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const updateStatus = useCallback(
    (s: SyncStatus) => {
      setStatus(s)
      onStatusChange?.(s)
    },
    [onStatusChange]
  )

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

  // ── Connect / reconnect ──────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!enabled) return

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
        // Dispatch to the registered handler for this event type
        const handler = handlersRef.current[syncEvent.type]
        handler?.(syncEvent)
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

  // ── Online / offline listeners ────────────────────────────────────────────────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { status }
}
