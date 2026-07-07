'use client'

export interface OfflineTransactionRecord<TPayload = unknown> {
  id: string
  type: string
  payload: TPayload
  createdAt: string
}

const DB_NAME = 'edunexus-offline'
const DB_VERSION = 1
const STORE_NAME = 'transactions'

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
  const record: OfflineTransactionRecord<TPayload> = {
    id: `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
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
  return withStore('readonly', async (store) => {
    const source = type ? store.index('type') : store
    const request = type ? source.getAll(type) : source.getAll()
    const result = (await requestToPromise(request as IDBRequest<OfflineTransactionRecord<TPayload>[]>)) ?? []
    return [...result].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

export async function removeOfflineTransaction(id: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(id))
    return undefined
  })
}

export function writeOfflineDraft<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function readOfflineDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function clearOfflineDraft(key: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}