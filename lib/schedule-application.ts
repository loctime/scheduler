import type { Horario, Empleado, Turno } from "@/lib/types"
import { format, startOfWeek } from "date-fns"
import { doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore"
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
    // Parsear la fecha de forma segura usando componentes individuales para evitar problemas de zona horaria
    const [year, month, day] = date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day, 12, 0, 0) // Usar mediodía local
    return format(startOfWeek(dateObj, { weekStartsOn }), "yyyy-MM-dd")
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

    // LOG TEMPORAL PARA DEBUG - Especial para lunes
    const dateObj = new Date(date + 'T00:00:00') // Agregar hora para evitar problemas de zona horaria
    const dayOfWeek = dateObj.getDay() // 0 = domingo, 1 = lunes
    const isMonday = dayOfWeek === 1
    const weekStartDateObj = new Date(weekStartStr + 'T00:00:00') // Agregar hora para evitar problemas de zona horaria
    const weekStartDayOfWeek = weekStartDateObj.getDay()
    console.log('[updateAssignment] DEBUG:', {
      date,
      dayOfWeek,
      dayName: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dayOfWeek],
      isMonday,
      configSemanaInicioDia: _config?.semanaInicioDia,
      computedWeekStartStr: weekStartStr,
      scheduleId,
      weekStartDate: weekStartDayOfWeek,
      weekStartDayName: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][weekStartDayOfWeek],
      weekStartShouldBeMonday: weekStartDayOfWeek === 1
    })

    const assignmentType = assignments[0]?.type

    // Leer el documento actual para preservar la estructura existente
    const currentDoc = await getDoc(scheduleRef)
    const currentData = currentDoc.exists() ? currentDoc.data() : {}
    
    // LOG TEMPORAL - Verificar lectura del documento
    console.log("📖 PRE-WRITE READ:", {
      scheduleId,
      exists: currentDoc.exists(),
      hasAssignments: !!currentData.assignments,
      assignmentsKeys: currentData.assignments ? Object.keys(currentData.assignments) : [],
      weekStartInDoc: currentData.weekStart,
      expectedWeekStart: weekStartStr,
      weekStartMatch: currentData.weekStart === weekStartStr
    })
    
    // Construir el objeto assignments completo con estructura anidada correcta
    const currentAssignments = currentData.assignments || {}
    const updatedAssignments = {
      ...currentAssignments,
      [date]: {
        ...(currentAssignments[date] || {}),
        [employeeId]: assignments,
      },
    }

    // Construir el objeto dayStatus completo con estructura anidada correcta
    const currentDayStatus = currentData.dayStatus || {}
    const updatedDayStatus = {
      ...currentDayStatus,
      [date]: {
        ...(currentDayStatus[date] || {}),
        [employeeId]: assignmentType === "franco" || assignmentType === "medio_franco" ? assignmentType : "normal",
      },
    }

    const updateData: Record<string, any> = {
      ownerId,
      weekStart: weekStartStr,
      updatedAt: serverTimestamp(),
      assignments: updatedAssignments,
      dayStatus: updatedDayStatus,
    }

    // Preservar campos inmutables si existen
    if (currentData.createdAt) updateData.createdAt = currentData.createdAt
    if (currentData.createdBy) updateData.createdBy = currentData.createdBy
    if (currentData.createdByName) updateData.createdByName = currentData.createdByName
    if (currentData.completada !== undefined) updateData.completada = currentData.completada

    // LOG TEMPORAL - Verificar datos exactos de escritura
    console.log('[updateAssignment] DATOS A ESCRIBIR:', {
      scheduleId,
      weekStartStr,
      updateData,
      assignmentPath: `assignments.${date}.${employeeId}`,
      assignmentsValue: assignments,
      hasAssignmentsObject: !!updateData.assignments,
      assignmentsStructure: Object.keys(updateData.assignments || {})
    })

    await setDoc(
      scheduleRef,
      updateData,
      { merge: true },
    )

    const snapshot = await getDoc(scheduleRef)
    console.log("🔥 POST-WRITE SNAPSHOT:", {
      scheduleId,
      exists: snapshot.exists(),
      dataKeys: Object.keys(snapshot.data() || {}),
      assignmentsType: typeof snapshot.data()?.assignments,
      hasAssignmentsObject: !!snapshot.data()?.assignments,
      hasLiteralAssignmentField: Object.keys(snapshot.data() || {}).some(k => k.includes("assignments.")),
      rawData: snapshot.data()
    })
  }
}

export const scheduleApplication = new ScheduleApplication()
