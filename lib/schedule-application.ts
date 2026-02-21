import type { Horario, Empleado, Turno } from "@/lib/types"
import { format, startOfWeek } from "date-fns"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { buildScheduleDocId } from "@/lib/firestore-helpers"
import { validateAssignmentData, type AssignmentUpdateData } from "./schedule-domain"

export interface ScheduleApplicationService {
  markWeekComplete(weekStartStr: string, completed: boolean, user: any): Promise<void>
  updateAssignment(
    data: AssignmentUpdateData,
    user: any,
    employees: Empleado[],
    shifts: Turno[],
    _config: any,
    _schedules: Horario[],
    _getWeekSchedule: (weekStartStr: string) => Horario | null,
  ): Promise<void>
}

class ScheduleApplication implements ScheduleApplicationService {
  private resolveOwnerId(user: any): string {
    if (user?.role === "invited" && user?.ownerId) return user.ownerId
    return user?.ownerId || user?.uid || ""
  }

  private getWeekStartStr(date: string, config: any): string {
    const weekStartsOn = (config?.semanaInicioDia ?? 1) as 0|1|2|3|4|5|6
    return format(startOfWeek(new Date(date), { weekStartsOn }), "yyyy-MM-dd")
  }

  async markWeekComplete(weekStartStr: string, completed: boolean, user: any): Promise<void> {
    if (!db) throw new Error("Firebase no está configurado")

    const ownerId = this.resolveOwnerId(user)
    if (!ownerId) throw new Error("Owner no válido")

    const scheduleId = buildScheduleDocId(ownerId, weekStartStr)
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)

    await setDoc(
      scheduleRef,
      {
        ownerId,
        weekStart: weekStartStr,
        updatedAt: serverTimestamp(),
        completada: completed,
      },
      { merge: true },
    )
  }

  async updateAssignment(
    data: AssignmentUpdateData,
    user: any,
    employees: Empleado[],
    shifts: Turno[],
    _config: any,
    _schedules: Horario[],
    _getWeekSchedule: (weekStartStr: string) => Horario | null,
  ): Promise<void> {
    const { date, employeeId, assignments } = data

    const validation = validateAssignmentData(employees, shifts, true)
    if (!validation.valid) throw new Error(validation.error)
    if (!db) throw new Error("Firebase no está configurado")

    const ownerId = this.resolveOwnerId(user)
    if (!ownerId) throw new Error("Owner no válido")

    const weekStartStr = this.getWeekStartStr(date, _config)
    const scheduleId = buildScheduleDocId(ownerId, weekStartStr)
    const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)

    // LOG TEMPORAL PARA DEBUG
    console.log('[updateAssignment] DEBUG:', {
      date,
      configSemanaInicioDia: _config?.semanaInicioDia,
      computedWeekStartStr: weekStartStr,
      scheduleId
    })

    const assignmentType = assignments[0]?.type

    const updateData = {
      ownerId,
      weekStart: weekStartStr,
      updatedAt: serverTimestamp(),
      [`assignments.${date}.${employeeId}`]: assignments,
      [`dayStatus.${date}.${employeeId}`]: assignmentType === "franco" || assignmentType === "medio_franco" ? assignmentType : "normal",
    }

    // LOG TEMPORAL - Verificar datos exactos de escritura
    console.log('[updateAssignment] DATOS A ESCRIBIR:', {
      scheduleId,
      weekStartStr,
      updateData,
      assignmentPath: `assignments.${date}.${employeeId}`,
      assignmentsValue: assignments
    })

    await setDoc(
      scheduleRef,
      updateData,
      { merge: true },
    )

    // LOG TEMPORAL - Verificar escritura
    console.log('[updateAssignment] ESCRITURA COMPLETADA:', {
      scheduleId,
      path: `schedules/${scheduleId}`,
      assignmentPath: `assignments.${date}.${employeeId}`,
      assignments,
      dayStatus: assignmentType === "franco" || assignmentType === "medio_franco" ? assignmentType : "normal"
    })
  }
}

export const scheduleApplication = new ScheduleApplication()
