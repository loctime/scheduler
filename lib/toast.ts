/**
 * Helper centralizado para mostrar toasts optimizados
 * 
 * Soporta dos modos:
 * - "frequent": Para acciones frecuentes (asignar turnos, editar celdas, drag & drop)
 *   - Muestra solo el título (sin descripción)
 *   - Duración más corta (1.2s)
 * - "important": Para acciones importantes (crear horario, completar semana, errores)
 *   - Muestra título y descripción completos
 *   - Duración estándar (1.75s)
 */

import { toast as baseToast } from '@/hooks/use-toast'

type ToastMode = 'frequent' | 'important'

interface ToastOptions {
  title: string
  description?: string
  mode?: ToastMode
  duration?: number
  variant?: 'default' | 'destructive'
}

/**
 * Muestra un toast de éxito
 */
export function toastSuccess(
  title: string,
  options?: {
    description?: string
    mode?: ToastMode
    duration?: number
  }
) {
  const { description, mode = 'important', duration } = options || {}
  
  // Si es modo frecuente, no mostrar descripción
  if (mode === 'frequent') {
    return baseToast({
      title,
      mode: 'frequent',
      duration: duration ?? 1200,
    })
  }

  return baseToast({
    title,
    description,
    mode: 'important',
    duration: duration ?? 1750,
  })
}

/**
 * Muestra un toast de error
 */
export function toastError(
  title: string,
  options?: {
    description?: string
    mode?: ToastMode
    duration?: number
  }
) {
  const { description, mode = 'important', duration } = options || {}
  
  // Los errores siempre son importantes, pero pueden ser frecuentes si se repiten mucho
  return baseToast({
    title,
    description: mode === 'frequent' ? undefined : description,
    variant: 'destructive',
    mode,
    duration: duration ?? (mode === 'frequent' ? 1500 : 2000),
  })
}

/**
 * Muestra un toast informativo
 */
export function toastInfo(
  title: string,
  options?: {
    description?: string
    mode?: ToastMode
    duration?: number
  }
) {
  const { description, mode = 'important', duration } = options || {}
  
  if (mode === 'frequent') {
    return baseToast({
      title,
      mode: 'frequent',
      duration: duration ?? 1200,
    })
  }

  return baseToast({
    title,
    description,
    mode: 'important',
    duration: duration ?? 1750,
  })
}

/**
 * Helper genérico para casos especiales
 */
export function toast(options: ToastOptions) {
  const { title, description, mode = 'important', duration, variant = 'default' } = options
  
  return baseToast({
    title,
    description: mode === 'frequent' ? undefined : description,
    variant,
    mode,
    duration: duration ?? (mode === 'frequent' ? 1200 : 1750),
  })
}
