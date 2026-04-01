import { useData } from "@/contexts/data-context"

/**
 * Hook unificado para obtener el ownerId correcto
 * Regla: si existe userData.ownerId, usarlo; si no, usar user.uid
 */
export function useOwnerId(): string | null {
  const { userData, user } = useData()

  return getOwnerIdForActor(user, userData)
}

/**
 * Helper function para obtener ownerId sin hook (para uso fuera de componentes React)
 */
export function getOwnerIdForActor(user: any, userData: any): string | null {
  if (!userData || !user) return null

  return userData.ownerId || user.uid
}
