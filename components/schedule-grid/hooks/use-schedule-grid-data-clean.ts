import { useState, useMemo, useCallback } from "react"
import { Turno, Empleado, ShiftAssignment, Horario, Separador, Configuracion } from "@/lib/types"
import { toAssignments, toShiftIds } from "../utils/schedule-grid-utils"

interface UseScheduleGridDataProps {
  schedule: Horario | null
  employees: Empleado[]
  shifts: Turno[]
  separators: Separador[]
  config: Configuracion | null
  scheduleId?: string
}

export function useScheduleGridData({
  schedule,
  employees,
  shifts,
  separators,
  config,
  scheduleId,
}: UseScheduleGridDataProps) {
  // Cache de employee requests por cacheKey
  const [employeeRequestCache, setEmployeeRequestCache] = useState<Map<string, any>>(new Map())

  // Función para actualizar el caché (evita loops con useCallback)
  const updateEmployeeRequestCache = useCallback((
    cacheKey: string, 
    request: any
  ) => {
    console.log('💾 [updateEmployeeRequestCache] Guardando:', cacheKey, request?.active ? 'ACTIVE' : 'INACTIVE')
    
    setEmployeeRequestCache(prev => {
      const newCache = new Map(prev)
      if (request && request.active) {
        newCache.set(cacheKey, request)
      } else {
        newCache.delete(cacheKey)
      }
      return newCache
    })
  }, [])

  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  // Memoizar mapa de separadores para búsqueda O(1)
  const separatorMap = useMemo(() => {
    return new Map(separators.map((s) => [s.id, s]))
  }, [separators])

  // Memoizar empleados por ID para búsqueda O(1)
  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]))
  }, [employees])

  // Función para obtener IDs de turnos de un empleado en una fecha
  const getEmployeeShiftIds = useMemo(
    () => (employeeId: string, date: string) => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return toShiftIds(employeeShifts)
    },
    [schedule?.assignments]
  )

  // Función para obtener asignaciones completas con employee requests como overrides
  const getEmployeeAssignments = useMemo(
    () => (employeeId: string, date: string) => {
      // Verificar primero si hay un employee request activo en el caché
      const cacheKey = `${scheduleId}_${employeeId}_${date}`
      const request = employeeRequestCache.get(cacheKey)
      
      if (request && request.active && request.requestedShift) {
        console.log('✅ [getEmployeeAssignments] Override aplicado:', cacheKey)
        
        // Convertir requestedShift a ShiftAssignment
        const requestedShift = request.requestedShift
        let overrideAssignment: any

        switch (requestedShift.type) {
          case 'franco':
            overrideAssignment = { type: 'franco' }
            break
          
          case 'medio-franco':
            overrideAssignment = {
              type: 'medio_franco',
              startTime: requestedShift.startTime,
              endTime: requestedShift.endTime
            }
            break
          
          case 'existing':
            if (requestedShift.shiftId) {
              const shift = shiftMap.get(requestedShift.shiftId)
              overrideAssignment = {
                type: 'shift',
                shiftId: requestedShift.shiftId,
                startTime: requestedShift.startTime || shift?.startTime || '',
                endTime: requestedShift.endTime || shift?.endTime || ''
              }
            }
            break
          
          case 'manual':
            overrideAssignment = {
              type: 'shift',
              startTime: requestedShift.startTime,
              endTime: requestedShift.endTime
            }
            break
        }

        // Si hay un override válido, reemplazar los assignments base
        if (overrideAssignment) {
          return [overrideAssignment]
        }
      }

      // Si no hay override, obtener assignments del schedule
      let baseAssignments: any[] = []
      if (schedule?.assignments) {
        const dateAssignments = schedule.assignments[date] || {}
        const employeeShifts = dateAssignments[employeeId]
        baseAssignments = toAssignments(employeeShifts, shifts)
      }
      
      return baseAssignments
    },
    [schedule?.assignments, shifts, shiftMap, scheduleId, employeeRequestCache]
  )

  // Memoizar función de obtener info de turno
  const getShiftInfo = useMemo(
    () => (shiftId: string) => {
      return shiftMap.get(shiftId)
    },
    [shiftMap]
  )

  // Memoizar función de obtener info de separador
  const getSeparatorInfo = useMemo(
    () => (separatorId: string) => {
      return separatorMap.get(separatorId)
    },
    [separatorMap]
  )

  // Memoizar función de obtener info de empleado
  const getEmployeeInfo = useMemo(
    () => (employeeId: string) => {
      return employeeMap.get(employeeId)
    },
    [employeeMap]
  )

  return {
    getEmployeeShiftIds,
    getEmployeeAssignments,
    getShiftInfo,
    getSeparatorInfo,
    getEmployeeInfo,
    updateEmployeeRequestCache,
  }
}
