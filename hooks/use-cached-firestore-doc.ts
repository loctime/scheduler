"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCache, setCache } from "@/lib/cache/indexeddb-cache"

/**
 * Hook genérico para cargar documentos de Firestore con cache stale-while-revalidate
 * 
 * Patrón implementado:
 * 1. Cargar desde cache local inmediatamente (si existe)
 * 2. Renderizar con datos del cache
 * 3. En paralelo, consultar Firestore
 * 4. Si hay cambios, actualizar estado y cache
 * 
 * @param cacheKey - Clave única para el cache (ej: "horario-semanal-2026-02-22")
 * @param fetchFn - Función async que trae datos de Firestore
 * @param options - Opciones de configuración
 */
export function useCachedFirestoreDoc<T>(
  cacheKey: string | null,
  fetchFn: () => Promise<T>,
  options: {
    enabled?: boolean
    maxCacheAge?: number // Tiempo máximo en ms antes de considerar el cache "stale" (default: 5 minutos)
    onError?: (error: Error) => void
  } = {}
) {
  const { enabled = true, maxCacheAge = 5 * 60 * 1000, onError } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Ref para evitar múltiples fetches simultáneos
  const fetchingRef = useRef(false)
  // Ref para evitar actualizaciones después de desmontar
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchData = useCallback(async (skipCache = false) => {
    if (!cacheKey || !enabled || fetchingRef.current) return

    fetchingRef.current = true

    try {
      // 1. Intentar cargar desde cache primero (stale-while-revalidate)
      if (!skipCache) {
        const cachedData = await getCache<T>(cacheKey, maxCacheAge)
        if (cachedData !== null && mountedRef.current) {
          setData(cachedData)
          setFromCache(true)
          setLoading(false)
          // Continuar con fetch en background
        }
      }

      // 2. Fetch desde Firestore
      const freshData = await fetchFn()

      // 3. Actualizar solo si el componente sigue montado
      if (mountedRef.current) {
        // Siempre actualizar datos frescos (la comparación se hace en el setState de React)
        setData(freshData)
        setFromCache(false)
        setLoading(false)
        setError(null)

        // 4. Actualizar cache en background
        await setCache(cacheKey, freshData)
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setLoading(false)
        onError?.(error)
      }
    } finally {
      fetchingRef.current = false
    }
  }, [cacheKey, fetchFn, enabled, maxCacheAge, onError])

  // Cargar datos al montar o cuando cambian las dependencias
  useEffect(() => {
    if (!cacheKey || !enabled) {
      setData(null)
      setLoading(false)
      setFromCache(false)
      return
    }

    fetchData()
  }, [cacheKey, enabled, fetchData])

  // Función para refrescar manualmente (ignorando cache)
  const refresh = useCallback(() => {
    if (cacheKey && enabled) {
      fetchData(true)
    }
  }, [cacheKey, enabled, fetchData])

  return {
    data,
    loading,
    fromCache,
    error,
    refresh,
  }
}

/**
 * Hook para colecciones de Firestore con cache stale-while-revalidate
 * Similar a useCachedFirestoreDoc pero para arrays de documentos
 */
export function useCachedFirestoreCollection<T>(
  cacheKey: string | null,
  fetchFn: () => Promise<T[]>,
  options: {
    enabled?: boolean
    maxCacheAge?: number
    onError?: (error: Error) => void
  } = {}
) {
  const { enabled = true, maxCacheAge = 5 * 60 * 1000, onError } = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchData = useCallback(async (skipCache = false) => {
    if (!cacheKey || !enabled || fetchingRef.current) return

    fetchingRef.current = true

    try {
      // 1. Cache primero
      if (!skipCache) {
        const cachedData = await getCache<T[]>(cacheKey, maxCacheAge)
        if (cachedData !== null && mountedRef.current) {
          setData(cachedData)
          setFromCache(true)
          setLoading(false)
        }
      }

      // 2. Fetch desde Firestore
      const freshData = await fetchFn()

      // 3. Actualizar datos frescos
      if (mountedRef.current) {
        setData(freshData)
        setFromCache(false)
        setLoading(false)
        setError(null)

        // 4. Actualizar cache
        await setCache(cacheKey, freshData)
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setLoading(false)
        onError?.(error)
      }
    } finally {
      fetchingRef.current = false
    }
  }, [cacheKey, fetchFn, enabled, maxCacheAge, onError])

  useEffect(() => {
    if (!cacheKey || !enabled) {
      setData([])
      setLoading(false)
      setFromCache(false)
      return
    }

    fetchData()
  }, [cacheKey, enabled, fetchData])

  const refresh = useCallback(() => {
    if (cacheKey && enabled) {
      fetchData(true)
    }
  }, [cacheKey, enabled, fetchData])

  return {
    data,
    loading,
    fromCache,
    error,
    refresh,
  }
}
