import { saveEmployeeRequest } from "@/lib/employee-requests"

/**
 * Guarda un employee request y actualiza el caché local
 * @param scheduleId - ID del schedule
 * @param employeeId - ID del empleado
 * @param date - Fecha en formato YYYY-MM-DD
 * @param requestData - Datos del request
 * @param ownerId - ID del owner
 * @param updateCache - Función para actualizar el caché
 * @param onAssignmentsUpdate - Función para actualizar asignaciones en el schedule
 */
export async function saveEmployeeRequestWithCache(
  scheduleId: string,
  employeeId: string,
  date: string,
  requestData: any,
  ownerId: string,
  updateCache?: (key: string, request: any) => void,
  onAssignmentsUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void
) {
  // 🔥 DESACTIVADO: Employee requests completamente deshabilitados
  console.warn('🚫 [saveEmployeeRequestWithCache] Employee requests desactivados - no se guardará en Firestore')
  return false
}
