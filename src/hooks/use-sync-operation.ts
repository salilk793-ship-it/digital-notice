'use client'

import { useCallback } from 'react'
import { useSync, enqueueMutation } from './use-sync'
import { getSyncClient } from '@/lib/sync-client'
import type { SyncEventType } from '@/lib/sync-types'

/**
 * Hook for performing sync-aware mutations
 * Handles optimistic updates, offline queuing, and conflict resolution
 */
export function useSyncOperation() {
  const { optimisticUpdate, confirmUpdate, revertUpdate, getVersionVector, getDeviceId, status } = useSync()

  /**
   * Perform a sync-aware mutation
   */
  const mutate = useCallback(async <T,>(
    key: string,
    options: {
      /** The API endpoint URL */
      url: string
      /** HTTP method */
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      /** Request body (will be JSON stringified) */
      body?: unknown
      /** Additional headers */
      headers?: Record<string, string>
      /** Callback when mutation succeeds */
      onSuccess?: (data: T) => void
      /** Callback when mutation fails */
      onError?: (error: Error) => void
      /** Whether to skip optimistic update (default: false) */
      skipOptimistic?: boolean
      /** Custom event type for sync broadcast */
      syncEventType?: SyncEventType
      /** Custom event action for sync broadcast */
      syncEventAction?: 'created' | 'updated' | 'deleted'
    }
  ): Promise<T | null> => {
    const { url, method = 'POST', body, headers, onSuccess, onError, skipOptimistic } = options
    
    const deviceId = getDeviceId()
    const version = Date.now()

    // Optimistically update the cache
    if (!skipOptimistic && body) {
      optimisticUpdate(key, body)
    }

    try {
      // Check if we're online
      if (!navigator.onLine) {
        // Queue the mutation for later
        enqueueMutation(url, {
          method,
          body: body ? JSON.stringify(body) : undefined,
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': deviceId,
            'X-Version': version.toString(),
            ...headers,
          },
        })
        
        return null
      }

      // Perform the actual request
      const response = await fetch(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId,
          'X-Version': version.toString(),
          ...headers,
        },
      })

      // Handle conflict (409)
      if (response.status === 409) {
        const conflict = await response.json()
        revertUpdate(key)
        onError?.(new Error(conflict.error || 'Conflict detected'))
        return null
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }))
        revertUpdate(key)
        onError?.(new Error(error.error || 'Request failed'))
        return null
      }

      const data = await response.json()
      
      // Confirm the mutation
      confirmUpdate(key)
      onSuccess?.(data)
      
      return data
    } catch (error) {
      revertUpdate(key)
      onError?.(error instanceof Error ? error : new Error('Unknown error'))
      return null
    }
  }, [optimisticUpdate, confirmUpdate, revertUpdate, getDeviceId])

  /**
   * Create a new entity
   */
  const create = useCallback(<T,>(
    url: string,
    data: T,
    options?: {
      headers?: Record<string, string>
      onSuccess?: (data: T) => void
      onError?: (error: Error) => void
    }
  ) => {
    return mutate<T>(`create_${Date.now()}`, {
      url,
      method: 'POST',
      body: data,
      ...options,
    })
  }, [mutate])

  /**
   * Update an existing entity
   */
  const update = useCallback(<T,>(
    url: string,
    data: T & { id: string },
    options?: {
      headers?: Record<string, string>
      onSuccess?: (data: T) => void
      onError?: (error: Error) => void
    }
  ) => {
    return mutate<T>(`update_${data.id}`, {
      url,
      method: 'PUT',
      body: data,
      ...options,
    })
  }, [mutate])

  /**
   * Delete an entity
   */
  const remove = useCallback(
    (url: string, id: string, options?: {
      headers?: Record<string, string>
      onSuccess?: () => void
      onError?: (error: Error) => void
    }) => {
      return mutate(`delete_${id}`, {
        url,
        method: 'DELETE',
        ...options,
      })
    },
    [mutate]
  )

  return {
    mutate,
    create,
    update,
    remove,
    status,
  }
}

/**
 * Hook to get sync-aware data
 */
export function useSyncData<T>(
  key: string,
  initialData: T | null = null
) {
  const client = typeof window !== 'undefined' ? getSyncClient() : null
  
  const cached = client?.getEntity<T>(key)
  
  return cached?.data ?? initialData
}
