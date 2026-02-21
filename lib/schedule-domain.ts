import type { Horario, Empleado, Turno, ShiftAssignment } from "@/lib/types"
import { format, startOfWeek, addDays, type Day } from "date-fns"

export interface WeekScheduleData {
  weekStartDate: Date
  weekStartStr: string
  weekEndStr: string
  userName: string
  userId: string
  ownerId: string
}

export interface AssignmentUpdateData {
  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  options?: { scheduleId?: string }
}

export interface MedioTurnoData {
  assignment: ShiftAssignment
  medioTurnoToUse?: any
  medioFrancoAssignment?: ShiftAssignment | null
  otherAssignments: ShiftAssignment[]
  cellAssignments: ShiftAssignment[]
}

export interface ScheduleCreationData {
  nombre: string
  weekStartStr: string
  weekEndStr: string
  ownerId: string
  assignments: Record<string, Record<string, any>>
  dayStatus: Record<string, Record<string, any>>
  userId: string
  userName: string
}

export interface ScheduleUpdateData {
  assignments: Record<string, Record<string, any>>
  dayStatus: Record<string, Record<string, any>>
  updatedAt: any
  modifiedBy: string | null
  modifiedByName: string | null
}

// Funciones de dominio puras
export function createWeekScheduleData(date: Date, weekStartsOn: Day, user: any, userData: any): WeekScheduleData {
  const dateObj = new Date(date)
  const weekStartDate = startOfWeek(dateObj, { weekStartsOn })
  const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
  const weekEndStr = format(addDays(weekStartDate, 6), "yyyy-MM-dd")
  const userName = user?.displayName || user?.email || "Usuario desconocido"
  const userId = user?.uid || ""
  const ownerId = userData?.ownerId || ""

  return {
    weekStartDate,
    weekStartStr,
    weekEndStr,
    userName,
    userId,
    ownerId
  }
}

export function validateAssignmentData(
  employees: Empleado[],
  shifts: Turno[],
  db: any
): { valid: boolean; error?: string } {
  if (employees.length === 0) {
    return { valid: false, error: "Debes tener al menos un empleado registrado" }
  }
  if (shifts.length === 0) {
    return { valid: false, error: "Debes tener al menos un turno configurado" }
  }
  if (!db) {
    return { valid: false, error: "Firebase no está configurado" }
  }
  return { valid: true }
}

export function findMedioTurno(
  assignment: ShiftAssignment,
  medioTurnos: any[],
  config: any
): { matchingMedioTurno?: any; medioTurnoToUse?: any } {
  if (assignment.type !== "medio_franco") return {}

  const matchingMedioTurno = medioTurnos.find((medio: any) => {
    if (assignment.startTime && assignment.endTime) {
      return medio.startTime === assignment.startTime && medio.endTime === assignment.endTime
    }
    return false
  })

  const medioTurnoToUse = assignment.type === "medio_franco"
    ? matchingMedioTurno || (medioTurnos.length === 1 ? medioTurnos[0] : undefined)
    : undefined

  return { matchingMedioTurno, medioTurnoToUse }
}

export function createMedioFrancoAssignment(
  assignment: ShiftAssignment,
  medioTurnoToUse?: any
): ShiftAssignment | null {
  if (assignment.type !== "medio_franco" || !medioTurnoToUse) return null

  return {
    type: "medio_franco",
    startTime: medioTurnoToUse?.startTime || assignment.startTime,
    endTime: medioTurnoToUse?.endTime || assignment.endTime,
  }
}

export function createAssignmentData(
  assignment: ShiftAssignment,
  medioFrancoAssignment: ShiftAssignment | null,
  otherAssignments: ShiftAssignment[]
): MedioTurnoData {
  const cellAssignments = assignment.type === "medio_franco" && medioFrancoAssignment
    ? [medioFrancoAssignment, ...otherAssignments]
    : assignment.type === "franco"
      ? [assignment, ...otherAssignments]
      : []

  return {
    assignment,
    medioTurnoToUse: undefined,
    medioFrancoAssignment,
    otherAssignments,
    cellAssignments
  }
}

export function createScheduleCreationData(
  weekScheduleData: WeekScheduleData,
  assignmentData: MedioTurnoData,
  date: string,
  employeeId: string
): ScheduleCreationData {
  const { weekStartStr, weekEndStr, userName, userId, ownerId } = weekScheduleData
  const { cellAssignments } = assignmentData

  return {
    nombre: `Semana del ${weekStartStr}`,
    weekStartStr,
    weekEndStr,
    ownerId,
    assignments: assignmentData.assignment.type === "medio_franco" || assignmentData.assignment.type === "franco"
      ? {
          [date]: {
            [employeeId]: cellAssignments,
          },
        }
      : {},
    dayStatus: assignmentData.assignment.type === "medio_franco" || assignmentData.assignment.type === "franco"
      ? {
          [date]: {
            [employeeId]: assignmentData.assignment.type,
          },
        }
      : {},
    userId,
    userName,
  }
}

export function createScheduleUpdateData(
  targetSchedule: Horario,
  assignmentData: MedioTurnoData,
  date: string,
  employeeId: string,
  weekScheduleData: WeekScheduleData
): ScheduleUpdateData {
  const { userName, userId } = weekScheduleData
  const { cellAssignments } = assignmentData

  const currentDayStatus = targetSchedule.dayStatus || {}
  const updatedDayStatus = {
    ...currentDayStatus,
    [date]: {
      ...currentDayStatus[date],
      [employeeId]: assignmentData.assignment.type as "franco" | "medio_franco"
    }
  }

  const updatedAssignments = { ...targetSchedule.assignments }
  updatedAssignments[date] = {
    ...(updatedAssignments[date] || {}),
    [employeeId]: cellAssignments,
  }

  return {
    assignments: updatedAssignments,
    dayStatus: updatedDayStatus,
    updatedAt: null, // Se asignará en el repositorio
    modifiedBy: userId || null,
    modifiedByName: userName || null,
  }
}


