import { saveEmployeeRequest } from "@/lib/employee-requests"

/**
 * Guarda un employee request y actualiza el caché local
 * @param scheduleId - ID del schedule
 * @param employeeId - ID del empleado
 * @param date - Fecha en formato YYYY-MM-DD
 * @param requestData - Datos del request
 * @param ownerId - ID del owner
 * @param updateCache - Función para actualizar el caché
 */
export async function saveEmployeeRequestWithCache(
  scheduleId: string,
  employeeId: string,
  date: string,
  requestData: any,
  ownerId: string,
  updateCache: (key: string, request: any) => void
) {
  try {
    // Guardar en Firestore
    await saveEmployeeRequest(scheduleId, employeeId, date, requestData, ownerId)
    
    // Actualizar caché local inmediatamente
    const cacheKey = `${scheduleId}_${employeeId}_${date}`
    const requestToCache = {
      ...requestData,
      scheduleId,
      employeeId,
      date,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    updateCache(cacheKey, requestToCache)
    
    console.log('✅ [saveEmployeeRequestWithCache] Request guardado y caché actualizado')
    return true
  } catch (error) {
    console.error('❌ [saveEmployeeRequestWithCache] Error:', error)
    return false
  }
}
