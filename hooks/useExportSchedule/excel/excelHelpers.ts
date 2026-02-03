import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Empleado, Turno, Horario, Separador } from "@/lib/types"
import { getShiftText } from "../utils/assignments"

export const createEmployeeMaps = (employees: Empleado[], shifts: Turno[], separadores?: Separador[]) => {
  const shiftMap = new Map(shifts.map((s) => [s.id, s]))
  const separadorMap = new Map((separadores || []).map((s) => [s.id, s]))
  const employeeMap = new Map(employees.map((e) => [e.id, e]))

  return { shiftMap, separadorMap, employeeMap }
}

export const getOrderedItemIds = (employees: Empleado[], separadores?: Separador[], ordenEmpleados?: string[]) => {
  let orderedItemIds: string[] = []
  if (ordenEmpleados && ordenEmpleados.length > 0) {
    const employeeIds = new Set(employees.map((e) => e.id))
    const separatorIds = new Set((separadores || []).map((s) => s.id))
    const validOrder = ordenEmpleados.filter((id) => employeeIds.has(id) || separatorIds.has(id))
    const newEmployees = employees.filter((emp) => !validOrder.includes(emp.id)).map((emp) => emp.id)
    orderedItemIds = [...validOrder, ...newEmployees]
  } else {
    orderedItemIds = employees.map((emp) => emp.id)
  }
  return orderedItemIds
}

export const createHeaderRow = (weekDays: Date[], nombreEmpresa?: string) => {
  const headerRow = [nombreEmpresa || "Empleado"]
  weekDays.forEach((day) => {
    headerRow.push(format(day, "EEE d MMM", { locale: es }))
  })
  return headerRow
}

export const processEmployeeRow = (
  employee: Empleado,
  weekDays: Date[],
  schedule: Horario | null,
  shiftMap: Map<string, Turno>
) => {
  const row: any[] = [employee.name]
  
  weekDays.forEach((day) => {
    const dateStr = format(day, "yyyy-MM-dd")
    const assignments = schedule?.assignments[dateStr]?.[employee.id]
    const dayStatus = schedule?.dayStatus?.[dateStr]?.[employee.id] || "normal"

    if (dayStatus === "franco") {
      row.push("FRANCO")
      return
    }

    if (!assignments || assignments.length === 0) {
      row.push("-")
    } else {
      // Convertir a array de ShiftAssignment
      let assignmentArray: any[] = []
      assignmentArray = assignments as any[]
      
      // Convertir asignaciones a texto (múltiples turnos separados por \n)
      const shiftTexts = assignmentArray.map((a) => getShiftText(a, shiftMap)).filter(s => s.text)
      
      if (shiftTexts.length === 0) {
        row.push("-")
      } else {
        // Combinar textos con \n (cada turno en una línea)
        const combinedText = shiftTexts.map(s => s.text).join("\n")
        row.push(combinedText)
      }
    }
  })
  
  return row
}

export const processSeparatorRow = (separator: Separador, weekDays: Date[]) => {
  // Para separadores, solo poner contenido en la primera celda
  // Las demás celdas deben estar vacías para que el merge funcione correctamente
  const row: any[] = [separator.nombre]
  // Agregar celdas vacías para el resto de columnas (días)
  for (let i = 0; i < weekDays.length; i++) {
    row.push(null) // Usar null en lugar de "" para celdas vacías
  }
  return row
}
