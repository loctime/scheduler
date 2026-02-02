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
  updateCache: (key: string, request: any) => void,
  onAssignmentsUpdate?: (date: string, employeeId: string, assignments: any[], options?: { scheduleId?: string }) => void
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
    
    // Si el request está activo y tiene un horario solicitado, asignarlo realmente en el schedule
    if (requestData.active && requestData.requestedShift && onAssignmentsUpdate) {
      console.log('🔄 [saveEmployeeRequestWithCache] Asignando horario en el schedule:', requestData.requestedShift)
      
      let assignment: any = null
      
      switch (requestData.requestedShift.type) {
        case 'franco':
          assignment = { type: 'franco' }
          break
          
        case 'medio-franco':
          assignment = {
            type: 'medio_franco',
            startTime: requestData.requestedShift.startTime,
            endTime: requestData.requestedShift.endTime
          }
          break
          
        case 'existing':
          if (requestData.requestedShift.shiftId) {
            assignment = {
              type: 'shift',
              shiftId: requestData.requestedShift.shiftId,
              startTime: requestData.requestedShift.startTime,
              endTime: requestData.requestedShift.endTime
            }
          }
          break
          
        case 'manual':
          assignment = {
            type: 'shift',
            startTime: requestData.requestedShift.startTime,
            endTime: requestData.requestedShift.endTime
          }
          break
      }
      
      // Si tenemos una asignación válida, guardarla en el schedule
      if (assignment) {
        onAssignmentsUpdate(date, employeeId, [assignment], { scheduleId })
        console.log('✅ [saveEmployeeRequestWithCache] Horario asignado en el schedule')
      }
    }
    
    console.log('✅ [saveEmployeeRequestWithCache] Request guardado y caché actualizado')
    return true
  } catch (error) {
    console.error('❌ [saveEmployeeRequestWithCache] Error:', error)
    return false
  }
}
