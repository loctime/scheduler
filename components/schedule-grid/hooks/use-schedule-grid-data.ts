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
}

export function useScheduleGridData({
  employees,
  shifts,
  separadores = [],
  ordenEmpleados = [],
  schedule,
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

  // Obtener orden de elementos (empleados y separadores) desde configuración o usar orden por defecto
  const orderedItemIds = useMemo(() => {
    if (ordenEmpleados && ordenEmpleados.length > 0) {
      const employeeIds = new Set(employees.map((emp) => emp.id))
      const separatorIds = new Set(separadores?.map((s) => s.id) || [])

      // Filtrar solo IDs válidos (empleados o separadores)
      const validOrder = ordenEmpleados.filter((id) => employeeIds.has(id) || separatorIds.has(id))

      // Agregar empleados nuevos que no estén en el orden
      const newEmployees = employees.filter((emp) => !validOrder.includes(emp.id)).map((emp) => emp.id)

      return [...validOrder, ...newEmployees]
    }
    // Si no hay orden guardado, usar el orden por defecto (por nombre)
    return employees.map((emp) => emp.id)
  }, [ordenEmpleados, separadores, employees])

  // Obtener elementos ordenados (empleados y separadores) según el orden guardado
  const orderedItems = useMemo(() => {
    const employeeMap = new Map(employees.map((emp) => [emp.id, emp]))
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
  }, [orderedItemIds, employees, separadorMap])

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

