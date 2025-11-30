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
}

export function useScheduleGridData({
  employees,
  shifts,
  separadores = [],
  ordenEmpleados = [],
  schedule,
  isScheduleCompleted = false,
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
  const filteredEmployees = useMemo(() => {
    if (!isScheduleCompleted) {
      // Si no está completado, mostrar todos los empleados
      return employees
    }
    
    // Si está completado y tiene snapshot, usar empleados del snapshot
    if (schedule?.empleadosSnapshot && schedule.empleadosSnapshot.length > 0) {
      const snapshotIds = new Set(schedule.empleadosSnapshot.map((e) => e.id))
      return employees.filter((emp) => snapshotIds.has(emp.id))
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
  }, [employees, schedule, isScheduleCompleted, ordenEmpleados])

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

