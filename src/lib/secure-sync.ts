/**
 * Secure sync utilities for encrypted data transmission and device tracking
 */

import { generateChecksum, type VersionVector } from './sync-types'

// Device ID storage key
const DEVICE_ID_KEY = 'sync_device_id'
const DEVICE_INFO_KEY = 'sync_device_info'
const SYNC_STATE_KEY = 'sync_state'

/**
 * Generate a unique device ID
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }
  
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  
  if (!deviceId) {
    // Generate a unique device ID using timestamp + random
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  
  return deviceId
}

/**
 * Get device information
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      id: 'server',
      platform: 'server',
      userAgent: 'server',
      language: 'en',
      timezone: 'UTC',
    }
  }
  
  const stored = localStorage.getItem(DEVICE_INFO_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      // Return default if parsing fails
    }
  }
  
  const info: DeviceInfo = {
    id: getOrCreateDeviceId(),
    platform: getPlatform(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  }
  
  localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(info))
  return info
}

/**
 * Get the platform/OS
 */
function getPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  
  const ua = navigator.userAgent
  if (ua.includes('Win')) return 'windows'
  if (ua.includes('Mac')) return 'macos'
  if (ua.includes('Linux')) return 'linux'
  if (ua.includes('Android')) return 'android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios'
  return 'unknown'
}

/**
 * Device information interface
 */
export interface DeviceInfo {
  id: string
  platform: string
  userAgent: string
  language: string
  timezone: string
  screenWidth?: number
  screenHeight?: number
}

/**
 * Sync state for persistence
 */
export interface SyncState {
  lastSyncTimestamp: string
  lastVersion: number
  versionVector: VersionVector
  pendingConflicts: number
  isOnline: boolean
}

/**
 * Get the current sync state
 */
export function getSyncState(): SyncState | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }
  return null
}

/**
 * Save sync state
 */
export function saveSyncState(state: Partial<SyncState>): void {
  if (typeof window === 'undefined') return
  
  const current = getSyncState() || {
    lastSyncTimestamp: new Date().toISOString(),
    lastVersion: 0,
    versionVector: {},
    pendingConflicts: 0,
    isOnline: true,
  }
  
  const updated = { ...current, ...state }
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated))
}

/**
 * Secure payload wrapper
 */
export interface SecurePayload<T = unknown> {
  data: T
  checksum: string
  timestamp: string
  deviceId: string
  version: number
}

/**
 * Create a secure payload with checksum
 */
export function createSecurePayload<T>(
  data: T,
  deviceId: string,
  version: number
): SecurePayload<T> {
  return {
    data,
    checksum: generateChecksum(data),
    timestamp: new Date().toISOString(),
    deviceId,
    version,
  }
}

/**
 * Verify a secure payload
 */
export function verifySecurePayload<T>(payload: SecurePayload<T>): boolean {
  const expectedChecksum = generateChecksum(payload.data)
  return payload.checksum === expectedChecksum
}

/**
 * Encryption utilities using Web Crypto API
 * Note: In production, use a proper key exchange mechanism
 */

/**
 * Generate an encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data
 */
export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  )
  
  return {
    encrypted: arrayBufferToBase64(new Uint8Array(encrypted)),
    iv: arrayBufferToBase64(iv),
  }
}

/**
 * Decrypt data
 */
export async function decryptData(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder()
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
    key,
    base64ToArrayBuffer(encrypted)
  )
  
  return decoder.decode(decrypted)
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Hash data for integrity verification
 */
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return arrayBufferToBase64(new Uint8Array(hashBuffer))
}

/**
 * Clear all sync-related local storage
 */
export function clearSyncStorage(): void {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(DEVICE_ID_KEY)
  localStorage.removeItem(DEVICE_INFO_KEY)
  localStorage.removeItem(SYNC_STATE_KEY)
  localStorage.removeItem('sync_offline_queue')
}

/**
 * Get storage usage for sync data
 */
export function getSyncStorageUsage(): { used: number; quota: number } {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { used: 0, quota: 0 }
  }
  
  // This is async, but we'll return a placeholder
  return { used: 0, quota: 0 }
}
