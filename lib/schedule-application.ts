import type { Horario, Empleado, Turno, ShiftAssignment } from "@/lib/types"
import { format, startOfWeek } from "date-fns"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { scheduleRepository } from "./schedule-repository"
import { db, COLLECTIONS } from "@/lib/firebase"
import { buildScheduleDocId } from "@/lib/firestore-helpers"
import {
  createWeekScheduleData,
  validateAssignmentData,
  findMedioTurno,
  createMedioFrancoAssignment,
  createAssignmentData,
  createScheduleCreationData,
  createScheduleUpdateData,
  createWeekCompletionData,
  type AssignmentUpdateData,
  type WeekCompletionData
} from "./schedule-domain"

export interface ScheduleApplicationService {
  markWeekComplete(weekStartStr: string, completed: boolean, user: any, employees: Empleado[], config: any): Promise<void>
  updateAssignment(data: AssignmentUpdateData, user: any, employees: Empleado[], shifts: Turno[], config: any, schedules: Horario[], getWeekSchedule: (weekStartStr: string) => Horario | null): Promise<void>
}

class ScheduleApplication implements ScheduleApplicationService {
  private resolveOwnerId(user: any): string {
    if (user?.role === "invited" && user?.ownerId) {
      return user.ownerId
    }
    return user?.ownerId || user?.uid || ""
  }

  private getWeekStartStr(date: string): string {
    const parsedDate = new Date(date)
    return format(startOfWeek(parsedDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
  }

  async markWeekComplete(
    weekStartStr: string,
    completed: boolean,
    user: any,
    employees: Empleado[],
    config: any
  ): Promise<void> {
    // Implementación lógica de marcado de semana completa
    const weekScheduleData = {
      weekStartDate: new Date(weekStartStr),
      weekStartStr,
      weekEndStr: format(new Date(weekStartStr), 'yyyy-MM-dd'), // Simplified - should be actual week end
      userName: user?.displayName || user?.email || 'Unknown',
      userId: user?.uid || 'unknown',
      ownerId: user?.uid || 'unknown'
    }
    
    const completionData = createWeekCompletionData(completed, weekScheduleData, employees, config)
    
    // Lógica para crear o actualizar el schedule
    // Esta es una implementación simplificada, la completa requeriría más detalles
    console.log("Marking week complete:", { weekStartStr, completed })
  }

  async updateAssignment(
    data: AssignmentUpdateData,
    user: any,
    employees: Empleado[],
    shifts: Turno[],
    config: any,
    schedules: Horario[],
    getWeekSchedule: (weekStartStr: string) => Horario | null
  ): Promise<void> {
    const { date, employeeId, assignments, options } = data

    // Validaciones
    const validation = validateAssignmentData(employees, shifts, true)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    if (!db) {
      throw new Error("Firebase no está configurado")
    }

    const ownerId = this.resolveOwnerId(user)
    if (!ownerId) {
      throw new Error("Owner no válido")
    }

    const weekStartStr = this.getWeekStartStr(date)
    const scheduleId = buildScheduleDocId(ownerId, weekStartStr)
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)

    const assignmentType = assignments[0]?.type
    const patch: Record<string, any> = {
      ownerId,
      weekStart: weekStartStr,
      updatedAt: serverTimestamp(),
      [`assignments.${date}.${employeeId}`]: assignments,
    }

    if (assignmentType === "franco" || assignmentType === "medio_franco") {
      patch[`dayStatus.${date}.${employeeId}`] = assignmentType
    } else {
      patch[`dayStatus.${date}.${employeeId}`] = "normal"
    }

    console.log("🔍 [updateAssignment] Persisting assignment:", {
      scheduleId,
      weekStartStr,
      collectionPath: COLLECTIONS.SCHEDULES,
      updatedPaths: Object.keys(patch),
      hasAssignments: assignments.length > 0,
      options,
    })

    await setDoc(scheduleRef, patch, { merge: true })

    console.log("✅ [updateAssignment] Assignment persisted", {
      scheduleId,
      weekStartStr,
      date,
      employeeId,
    })
  }

  private async handleSpecialAssignment(
    assignment: ShiftAssignment,
    date: string,
    employeeId: string,
    user: any,
    config: any,
    getWeekSchedule: (weekStartStr: string) => Horario | null
  ): Promise<void> {
    const medioTurnos = config?.mediosTurnos || []
    const { medioTurnoToUse } = findMedioTurno(assignment, medioTurnos, config)

    if (assignment.type === "medio_franco" && !medioTurnoToUse) {
      throw new Error("No hay medio turno configurado para asignar medio franco")
    }

    const medioFrancoAssignment = createMedioFrancoAssignment(assignment, medioTurnoToUse)
    const otherAssignments: ShiftAssignment[] = [] // Se obtendrían de las asignaciones existentes
    const assignmentData = createAssignmentData(assignment, medioFrancoAssignment, otherAssignments)

    // Lógica para crear o actualizar schedule con asignación especial
    console.log("Handling special assignment:", { assignment, assignmentData })
  }
}

export const scheduleApplication = new ScheduleApplication()
