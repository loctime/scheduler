/**
 * Utilidad de cache en IndexedDB para datos críticos de la PWA
 * Implementa stale-while-revalidate pattern
 */

const DB_NAME = "horarios_pwa_cache"
const DB_VERSION = 1
const STORE_NAME = "data_cache"

interface CacheEntry<T> {
  data: T
  timestamp: number
  version: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB solo disponible en cliente"))
  }

  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error("Error al abrir IndexedDB"))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" })
        store.createIndex("timestamp", "timestamp", { unique: false })
      }
    }
  })

  return dbPromise
}

/**
 * Guarda datos en cache
 */
export async function setCache<T>(key: string, data: T, version: number = 1): Promise<void> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    const entry: CacheEntry<T> & { key: string } = {
      key,
      data,
      timestamp: Date.now(),
      version,
    }

    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn(`[Cache] Error al guardar cache para ${key}:`, error)
    // No fallar la app si el cache falla
  }
}

/**
 * Obtiene datos del cache
 */
export async function getCache<T>(key: string, maxAge?: number): Promise<T | null> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)

    const entry = await new Promise<(CacheEntry<T> & { key: string }) | null>((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })

    if (!entry) {
      return null
    }

    // Verificar si el cache está expirado
    if (maxAge && Date.now() - entry.timestamp > maxAge) {
      // Cache expirado, pero devolverlo igual para stale-while-revalidate
      return entry.data
    }

    return entry.data
  } catch (error) {
    console.warn(`[Cache] Error al leer cache para ${key}:`, error)
    return null
  }
}

/**
 * Elimina una entrada del cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn(`[Cache] Error al eliminar cache para ${key}:`, error)
  }
}

/**
 * Limpia todo el cache (útil para debugging o reset)
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn("[Cache] Error al limpiar cache:", error)
  }
}

/**
 * Verifica si existe una entrada en cache (sin leer los datos)
 */
export async function hasCache(key: string): Promise<boolean> {
  try {
    const db = await openDB()
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)

    const count = await new Promise<number>((resolve, reject) => {
      const request = store.count(IDBKeyRange.only(key))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return count > 0
  } catch (error) {
    return false
  }
}
