const DB_NAME = 'webverse-cache'
const DB_VERSION = 1
const STORE_NAME = 'entries'

type CacheEntry<T> = { key: string; value: T; updatedAt: number }

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getCache<T>(key: string, maxAgeMs: number): Promise<T | null> {
  if (!('indexedDB' in window)) return null
  try {
    const database = await openDatabase()
    const entry = await new Promise<CacheEntry<T> | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    if (!entry || Date.now() - entry.updatedAt > maxAgeMs) return null
    return entry.value
  } catch { return null }
}

export async function setCache<T>(key: string, value: T) {
  if (!('indexedDB' in window)) return
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ key, value, updatedAt: Date.now() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    database.close()
  } catch { /* Cache failures must never block the app. */ }
}

export async function deleteCache(key: string) {
  if (!('indexedDB' in window)) return
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    database.close()
  } catch { /* Best-effort privacy cleanup. */ }
}
