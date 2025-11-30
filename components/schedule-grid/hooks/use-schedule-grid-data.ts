import { useMemo } from "react"
import { Empleado, Separador, ShiftAssignmentValue, Horario, HistorialItem } from "@/lib/types"
import { toShiftIds, toAssignments } from "../utils/schedule-grid-utils"

export type GridItem = { type: "employee"; data: Empleado } | { type: "separator"; data: Separador }

interface UseScheduleGridDataProps {
  employees: Empleado[]
  shifts: any[]
  separadores?: Separador[]
  ordenEmpleados?: string[]
  schedule: Horario | HistorialItem | null
  isScheduleCompleted?: boolean
  currentWeekStart?: string // Fecha de inicio de la semana actual (formato yyyy-MM-dd)
  lastCompletedWeekStart?: string | null // Fecha de inicio de la última semana completada (formato yyyy-MM-dd)
  allEmployees?: Empleado[] // Todos los empleados (para determinar cuáles son nuevos)
}

export function useScheduleGridData({
  employees,
  shifts,
  separadores = [],
  ordenEmpleados = [],
  schedule,
  isScheduleCompleted = false,
  currentWeekStart,
  lastCompletedWeekStart,
  allEmployees = [],
}: UseScheduleGridDataProps) {
  // Memoizar mapa de turnos para búsqueda O(1)
  const shiftMap = useMemo(() => {
    return new Map(shifts.map((s) => [s.id, s]))
  }, [shifts])

  // Memoizar mapa de separadores para búsqueda O(1)
  const separadorMap = useMemo(() => {
    if (!separadores || separadores.length === 0) return new Map()
    return new Map(separadores.map((s) => [s.id, s]))
  }, [separadores])

  // Filtrar empleados: si el horario está completado, mostrar empleados del snapshot
  // Si no hay snapshot, usar la lógica anterior (compatibilidad con horarios antiguos)
  // Si la semana es pasada (no completada), solo mostrar empleados que existían entonces
  const filteredEmployees = useMemo(() => {
    // Si está completado, usar lógica de snapshot
    if (isScheduleCompleted) {
      // Verificar que es un Horario (no HistorialItem) y tiene snapshot
      // HistorialItem tiene 'horarioId', Horario no
      if (schedule && !('horarioId' in schedule)) {
        const horarioSchedule = schedule as Horario
        if (horarioSchedule.empleadosSnapshot && horarioSchedule.empleadosSnapshot.length > 0) {
          const snapshotIds = new Set(horarioSchedule.empleadosSnapshot.map((e) => e.id))
          return employees.filter((emp) => snapshotIds.has(emp.id))
        }
      }
      
      // Fallback: si no hay snapshot, usar lógica anterior (compatibilidad)
      const employeeIdsToShow = new Set<string>()
      
      // Agregar empleados que tienen asignaciones
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
    
    // Si no está completado, verificar si es una semana pasada
    // Si hay última semana completada y la semana actual es anterior o igual a ella,
    // solo mostrar empleados que existían en ese momento
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

  // Función para obtener asignaciones completas
  const getEmployeeAssignments = useMemo(
    () => (employeeId: string, date: string) => {
      if (!schedule?.assignments) return []
      const dateAssignments = schedule.assignments[date] || {}
      const employeeShifts = dateAssignments[employeeId]
      return toAssignments(employeeShifts)
    },
    [schedule?.assignments]
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
  }
}

