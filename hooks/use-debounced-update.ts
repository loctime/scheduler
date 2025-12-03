import { useRef, useCallback, useEffect } from "react"

/**
 * Hook para debounce de actualizaciones
 * Útil para reducir llamadas excesivas a Firestore durante ediciones rápidas
 */
export function useDebouncedUpdate<T extends (...args: any[]) => Promise<any>>(
  updateFn: T,
  delay: number = 500
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestArgsRef = useRef<Parameters<T> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const debouncedFn = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      // Guardar los argumentos más recientes
      latestArgsRef.current = args

      // Cancelar la operación anterior si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Crear nueva promesa que se resolverá cuando se ejecute el debounce
      return new Promise<ReturnType<T>>((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          // Verificar que aún estamos montados y que los args siguen siendo los más recientes
          if (!isMountedRef.current) {
            return
          }

          // Solo ejecutar si estos son los args más recientes
          if (latestArgsRef.current === args) {
            try {
              const result = await updateFn(...args)
              resolve(result)
            } catch (error) {
              reject(error)
            }
          }
        }, delay)
      })
    },
    [updateFn, delay]
  ) as T

  return debouncedFn
}



