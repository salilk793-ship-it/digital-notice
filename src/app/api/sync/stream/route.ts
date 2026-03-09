import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { syncEmitter } from '@/lib/sync-emitter'
import type { SyncEvent } from '@/lib/sync-broadcast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/sync/stream
 *
 * Server-Sent Events endpoint. Authenticated clients connect here to receive
 * real-time data-change notifications from all other connected devices.
 *
 * Each event is encoded as:
 *   data: <JSON-stringified SyncEvent>\n\n
 *
 * Features:
 * - Device ID tracking for multi-device sync
 * - Version vectors for conflict resolution
 * - Connection state management
 * - Heartbeat for keep-alive through proxies
 */
export async function GET(request: NextRequest) {
  // ── Authentication ──────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const sessionUserId = cookieStore.get('session_user')?.value

  if (!sessionUserId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = await db.user.findUnique({ where: { userId: sessionUserId } })
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Get client metadata ─────────────────────────────────────────────────────
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIP = forwardedFor?.split(',')[0] || 'unknown'

  // Generate or get device ID from headers
  const deviceId = request.headers.get('x-device-id') || `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

  // ── SSE Stream ─────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation with device info
      const connectEvent: SyncEvent = {
        type: 'notices',
        action: 'refresh',
        timestamp: new Date().toISOString(),
        version: Date.now(),
        deviceId,
        payload: { 
          connected: true, 
          userId: user.userId,
          deviceId,
          userAgent,
          clientIP,
        },
      }
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(connectEvent)}\n\n`)
      )

      // Heartbeat every 30 s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Forward every sync broadcast to this SSE client
      const onSync = (event: SyncEvent) => {
        try {
          // Add device ID to the event for tracking
          const enrichedEvent: SyncEvent = {
            ...event,
            deviceId: event.deviceId || deviceId,
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(enrichedEvent)}\n\n`)
          )
        } catch {
          // Client disconnected – clean up
          syncEmitter.off('sync', onSync)
          clearInterval(heartbeat)
        }
      }

      syncEmitter.on('sync', onSync)

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        syncEmitter.off('sync', onSync)
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable Nginx/Caddy buffering
    },
  })
}
