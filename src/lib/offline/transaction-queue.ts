'use client'

export interface OfflineTransactionRecord<TPayload = unknown> {
  id: string
  type: string
  payload: TPayload
  createdAt: string
  expiresAt: string
  attempts: number
  lastAttemptAt?: string
  lastError?: string
}

interface OfflineDraftEnvelope<T> {
  value: T
  expiresAt: string
}

/**
 * Stable client-side reference used to make replayable/offline transactions
 * idempotent on the server.
 */
export function createClientReference(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'tx'
  const now = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const rnd = Math.random().toString(36).slice(2, 10)
  return `${safePrefix}_${now}_${rnd}`
}

const DB_NAME = 'edunexus-offline'
const DB_VERSION = 1
const STORE_NAME = 'transactions'
const DEFAULT_TRANSACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_DRAFT_TTL_MS = 12 * 60 * 60 * 1000

function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline queue database.'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)

    run(store).then(resolve).catch(reject)
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline queue transaction failed.'))
    transaction.oncomplete = () => db.close()
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

export async function enqueueOfflineTransaction<TPayload>(
  type: string,
  payload: TPayload,
): Promise<OfflineTransactionRecord<TPayload>> {
  const now = new Date()
  const record: OfflineTransactionRecord<TPayload> = {
    id: `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEFAULT_TRANSACTION_TTL_MS).toISOString(),
    attempts: 0,
  }

  await withStore('readwrite', async (store) => {
    await requestToPromise(store.put(record))
    return undefined
  })

  return record
}

export async function listOfflineTransactions<TPayload = unknown>(
  type?: string,
): Promise<OfflineTransactionRecord<TPayload>[]> {
  return withStore('readwrite', async (store) => {
    const source = type ? store.index('type') : store
    const request = type ? source.getAll(type) : source.getAll()
    const result = (await requestToPromise(request as IDBRequest<OfflineTransactionRecord<TPayload>[]>)) ?? []
    const now = Date.now()
    const active: OfflineTransactionRecord<TPayload>[] = []

    for (const record of result) {
      if (Date.parse(record.expiresAt) <= now) {
        await requestToPromise(store.delete(record.id))
        continue
      }
      active.push(record)
    }

    return active.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

export async function markOfflineTransactionAttempt(id: string, errorMessage?: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    const existing = await requestToPromise(
      store.get(id) as IDBRequest<OfflineTransactionRecord<unknown> | undefined>,
    )

    if (!existing) return undefined

    await requestToPromise(
      store.put({
        ...existing,
        attempts: (existing.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: errorMessage,
      }),
    )

    return undefined
  })
}

export async function resetOfflineTransactionAttempts(id: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    const existing = await requestToPromise(
      store.get(id) as IDBRequest<OfflineTransactionRecord<unknown> | undefined>,
    )

    if (!existing) return undefined

    await requestToPromise(
      store.put({
        ...existing,
        attempts: 0,
        lastAttemptAt: undefined,
        lastError: undefined,
      }),
    )

    return undefined
  })
}

export async function removeOfflineTransaction(id: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(id))
    return undefined
  })
}

export function writeOfflineDraft<T>(key: string, value: T, ttlMs = DEFAULT_DRAFT_TTL_MS): void {
  if (typeof window === 'undefined') return
  const now = new Date()
  const envelope: OfflineDraftEnvelope<T> = {
    value,
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  }
  window.localStorage.setItem(key, JSON.stringify(envelope))
}

export function readOfflineDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as OfflineDraftEnvelope<T> | T

    // Backward compatibility for legacy draft payloads stored without metadata.
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'value' in parsed &&
      'expiresAt' in parsed
    ) {
      const envelope = parsed as OfflineDraftEnvelope<T>
      if (Date.parse(envelope.expiresAt) <= Date.now()) {
        window.localStorage.removeItem(key)
        return null
      }
      return envelope.value
    }

    return parsed as T
  } catch {
    return null
  }
}

export function clearOfflineDraft(key: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}