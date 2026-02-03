import { useMemo, useState, useEffect } from "react"
import { Empleado, Separador, ShiftAssignmentValue, Horario, HistorialItem } from "@/lib/types"
import { toShiftIds, toAssignments } from "../utils/schedule-grid-utils"
import { getEmployeeRequest } from "@/lib/employee-requests"

export type GridItem = { type: "employee"; data: Empleado } | { type: "separator"; data: Separador }

interface UseScheduleGridDataProps {
  employees: Empleado[]
  shifts: any[]
  separadores: Separador[]
  ordenEmpleados?: string[]
  schedule?: Horario | null
  scheduleId?: string
  isScheduleCompleted?: boolean
  currentWeekStart?: Date
  lastCompletedWeekStart?: Date
  allEmployees?: Empleado[]
  config?: any
}

export function useScheduleGridData({
  employees,
  shifts,
  separadores,
  ordenEmpleados,
  schedule,
  scheduleId,
  isScheduleCompleted = false,
  currentWeekStart,
  lastCompletedWeekStart,
  allEmployees = employees,
  config,
}: UseScheduleGridDataProps) {
  const DEBUG = false
  // Cache de employee requests por cacheKey
  const [employeeRequestCache, setEmployeeRequestCache] = useState<Map<string, any>>(new Map())

  // Función para actualizar el caché (evita loops con useCallback)
  const updateEmployeeRequestCache = (
    cacheKey: string, 
    request: any
  ) => {
    if (DEBUG) {
      console.log('💾 [updateEmployeeRequestCache] Guardando:', cacheKey, request?.active ? 'ACTIVE' : 'INACTIVE')
    }
    
    setEmployeeRequestCache(prev => {
      const newCache = new Map(prev)
      if (request && request.active) {
        newCache.set(cacheKey, request)
      } else {
        newCache.delete(cacheKey)
      }
      return newCache
    })
  }

  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map((shifts || []).map((s) => [s.id, s]))
  }, [shifts])

  // Memoizar mapa de separadores para búsqueda O(1)
  const separadorMap = useMemo(() => {
    return new Map((separadores || []).map((s) => [s.id, s]))
  }, [separadores])

  // Filtrar empleados según el estado del schedule
  const filteredEmployees = useMemo(() => {
    // Si el schedule está completado, usar los empleados guardados en el schedule
    if (isScheduleCompleted && schedule && !('horarioId' in schedule)) {
      const completedSchedule = schedule as Horario
      if (completedSchedule.ordenEmpleadosSnapshot && completedSchedule.ordenEmpleadosSnapshot.length > 0) {
        const employeeIds = new Set(completedSchedule.ordenEmpleadosSnapshot)
        return employees.filter((emp) => employeeIds.has(emp.id))
      }
    }

    // Si no está completado, verificar si es una semana pasada
    if (lastCompletedWeekStart && currentWeekStart && currentWeekStart <= lastCompletedWeekStart) {
      // Esta es una semana pasada (no completada), solo mostrar empleados que tienen asignaciones
      // o que estaban en el orden personalizado en ese momento
      const employeeIdsToShow = new Set<string>()

      // Agregar empleados que tienen asignaciones en esta semana
      if (schedule?.assignments) {
        Object.values(schedule.assignments).forEach((dateAssignments) => {
          if (dateAssignments && typeof dateAssignments === 'object') {
            Object.keys(dateAssignments).forEach((employeeId) => {
              employeeIdsToShow.add(employeeId)
            })
          }
        })
      }

      // Agregar empleados que están en el orden personalizado
      if (ordenEmpleados && ordenEmpleados.length > 0) {
        ordenEmpleados.forEach((id) => {
          if (employees.some((emp) => emp.id === id)) {
            employeeIdsToShow.add(id)
          }
        })
      }

      // Si no hay empleados para mostrar, mostrar todos (por seguridad)
      if (employeeIdsToShow.size === 0) {
        return employees
      }

      return employees.filter((emp) => employeeIdsToShow.has(emp.id))
    }

    // Si no está completado y es una semana futura (o no hay última semana completada),
    // mostrar todos los empleados (incluyendo los nuevos)
    return employees
  }, [employees, schedule, isScheduleCompleted, ordenEmpleados, currentWeekStart, lastCompletedWeekStart])

  // Obtener orden de elementos (empleados y separadores) desde configuración o usar orden por defecto
  const orderedItemIds = useMemo(() => {
    if (ordenEmpleados && ordenEmpleados.length > 0) {
      const employeeIds = new Set(filteredEmployees.map((emp) => emp.id))
      const separatorIds = new Set(separadores?.map((s) => s.id) || [])
      
      // Filtrar solo IDs válidos (empleados o separadores)
      const validOrder = ordenEmpleados.filter((id) => employeeIds.has(id) || separatorIds.has(id))
      
      // Agregar empleados nuevos que no estén en el orden
      const newEmployees = filteredEmployees.filter((emp) => !validOrder.includes(emp.id)).map((emp) => emp.id)
      
      return [...validOrder, ...newEmployees]
    }
    // Si no hay orden guardado, usar el orden por defecto (por nombre)
    return filteredEmployees.map((emp) => emp.id)
  }, [ordenEmpleados, separadores, filteredEmployees])

  // Obtener elementos ordenados (empleados y separadores) según el orden guardado
  const orderedItems = useMemo(() => {
    const employeeMap = new Map(filteredEmployees.map((emp) => [emp.id, emp]))
    const items: GridItem[] = []

    orderedItemIds.forEach((id) => {
      // Verificar si es un separador
      if (separadorMap.has(id)) {
        const separator = separadorMap.get(id)
        if (separator) {
          items.push({ type: "separator", data: separator })
        }
      }
      // Verificar si es un empleado
      else if (employeeMap.has(id)) {
        const employee = employeeMap.get(id)
        if (employee) {
          items.push({ type: "employee", data: employee })
        }
      }
    })

    return items
  }, [orderedItemIds, filteredEmployees, separadorMap])

  // Memoizar función de obtener turnos de empleado (IDs)
  const getEmployeeShifts = useMemo(
    () => (employeeId: string, date: string): string[] => {
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
        if (DEBUG) {
          console.log('✅ [getEmployeeAssignments] Override aplicado:', cacheKey)
        }
        
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
      
      // MANEJO ESPECIAL: Agregar assignments virtuales para dayStatus
      if (schedule?.dayStatus) {
        const dateDayStatus = schedule.dayStatus[date] || {}
        const employeeDayStatus = dateDayStatus[employeeId]
        
        if (employeeDayStatus === "franco") {
          // Agregar assignment virtual para franco
          baseAssignments.push({
            type: "franco",
          })
        } else if (employeeDayStatus === "medio_franco") {
          // Para medio franco, buscar el medio turno configurado
          const mediosTurnosConfig = config?.mediosTurnos || []
          if (mediosTurnosConfig.length > 0) {
            const medioTurno = mediosTurnosConfig[0]
            baseAssignments.push({
              type: "medio_franco",
              startTime: medioTurno.startTime,
              endTime: medioTurno.endTime,
            })
          } else {
            baseAssignments.push({ type: "medio_franco" })
          }
        }
      }
      
      return baseAssignments
    },
    [schedule?.assignments, schedule?.dayStatus, shifts, shiftMap, scheduleId, employeeRequestCache, config?.mediosTurnos]
  )

  // Memoizar función de obtener info de turno
  const getShiftInfo = useMemo(
    () => (shiftId: string) => {
      return shiftMap.get(shiftId)
    },
    [shiftMap]
  )

  return {
    shiftMap,
    separadorMap,
    orderedItemIds,
    orderedItems,
    getEmployeeShifts,
    getEmployeeAssignments,
    getShiftInfo,
    updateEmployeeRequestCache,
  }
}
