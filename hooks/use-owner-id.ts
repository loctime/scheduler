import { useData } from "@/contexts/data-context"

/**
 * Hook unificado para obtener el ownerId correcto
 * Regla: Si role === "invited" → usar userData.ownerId, caso contrario → usar user.uid
 */
export function useOwnerId(): string | null {
  const { userData, user } = useData()
  
  if (!userData || !user) return null
  
  return userData.role === "invited" && userData.ownerId 
    ? userData.ownerId 
    : user.uid
}

/**
 * Helper function para obtener ownerId sin hook (para uso fuera de componentes React)
 */
export function getOwnerId(userData: any, user: any): string | null {
  if (!userData || !user) return null
  
  return userData.role === "invited" && userData.ownerId 
    ? userData.ownerId 
    : user.uid
}
