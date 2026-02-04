import { useData } from "@/contexts/data-context"

/**
 * Hook unificado para obtener el ownerId correcto
 * Regla: Si role === "invited" → usar userData.ownerId, caso contrario → usar user.uid
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

  return userData.role === "invited" && userData.ownerId
    ? userData.ownerId
    : user.uid
}
