import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { db, COLLECTIONS } from "./firebase"
import type { Horario, HistorialItem } from "./types"

/**
 * Preserva todos los campos inmutables de un schedule al actualizar
 */
export function preserveScheduleFields(
  currentSchedule: Horario,
  updateData: any
): any {
  const preserved: any = {}

  // Campos inmutables que siempre se deben preservar
  if (currentSchedule.createdAt !== undefined && currentSchedule.createdAt !== null) {
    preserved.createdAt = currentSchedule.createdAt
  }
  if (currentSchedule.createdBy !== undefined) {
    preserved.createdBy = currentSchedule.createdBy
  }
  if (currentSchedule.createdByName !== undefined) {
    preserved.createdByName = currentSchedule.createdByName
  }

  // Campos de completado - preservar si existen
  if (currentSchedule.completada !== undefined) {
    preserved.completada = currentSchedule.completada
  }
  if (currentSchedule.completadaPor !== undefined) {
    preserved.completadaPor = currentSchedule.completadaPor
  }
  if (currentSchedule.completadaPorNombre !== undefined) {
    preserved.completadaPorNombre = currentSchedule.completadaPorNombre
  }
  if (currentSchedule.completadaEn !== undefined) {
    preserved.completadaEn = currentSchedule.completadaEn
  }

  // Snapshots de empleados - preservar si existen
  if (currentSchedule.empleadosSnapshot !== undefined) {
    preserved.empleadosSnapshot = currentSchedule.empleadosSnapshot
  }
  if (currentSchedule.ordenEmpleadosSnapshot !== undefined) {
    preserved.ordenEmpleadosSnapshot = currentSchedule.ordenEmpleadosSnapshot
  }

  // Combinar campos preservados con los nuevos datos de actualización
  return { ...preserved, ...updateData }
}

/**
 * Crea una entrada de historial consistente
 */
export function createHistoryEntry(
  schedule: Horario,
  action: "creado" | "modificado",
  user: { uid: string; displayName?: string; email?: string },
  weekStartStr?: string,
  weekEndStr?: string
): Omit<HistorialItem, "id"> {
  const userName = user?.displayName || user?.email || "Usuario desconocido"
  const userId = user?.uid || ""

  return {
    horarioId: schedule.id,
    nombre: schedule.nombre || `Semana del ${weekStartStr || schedule.weekStart || schedule.semanaInicio}`,
    semanaInicio: schedule.semanaInicio || weekStartStr || schedule.weekStart || "",
    semanaFin: schedule.semanaFin || weekEndStr || "",
    weekStart: schedule.weekStart || weekStartStr || schedule.semanaInicio,
    assignments: { ...schedule.assignments },
    createdAt: schedule.updatedAt || schedule.createdAt || serverTimestamp(),
    createdBy: schedule.createdBy || schedule.modifiedBy || userId,
    createdByName: schedule.createdByName || schedule.modifiedByName || userName,
    accion,
    versionAnterior: action === "modificado",
  }
}

/**
 * Guarda una entrada en el historial
 */
export async function saveHistoryEntry(historyEntry: Omit<HistorialItem, "id">): Promise<void> {
  if (!db) {
    throw new Error("Firebase no está configurado")
  }

  await addDoc(collection(db, COLLECTIONS.HISTORIAL), {
    ...historyEntry,
    createdAt: historyEntry.createdAt || serverTimestamp(),
  })
}

/**
 * Obtiene el schedule más reciente directamente de Firestore
 * Útil cuando necesitas el estado más actualizado que podría no estar en el listener
 */
export async function getLatestScheduleFromFirestore(scheduleId: string): Promise<Horario | null> {
  if (!db) {
    throw new Error("Firebase no está configurado")
  }

  try {
    const scheduleDoc = await getDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId))
    if (scheduleDoc.exists()) {
      return { id: scheduleDoc.id, ...scheduleDoc.data() } as Horario
    }
    return null
  } catch (error) {
    console.error(`Error al leer schedule de Firestore:`, error)
    throw error
  }
}

/**
 * Actualiza un schedule preservando campos inmutables
 */
export async function updateSchedulePreservingFields(
  scheduleId: string,
  currentSchedule: Horario,
  updateData: any
): Promise<void> {
  if (!db) {
    throw new Error("Firebase no está configurado")
  }

  // Eliminar valores undefined del objeto (Firestore no los acepta)
  const cleanUpdateData: any = {}
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      cleanUpdateData[key] = updateData[key]
    }
  })

  const finalUpdateData = preserveScheduleFields(currentSchedule, cleanUpdateData)
  
  await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), finalUpdateData)
}

/**
 * Realiza múltiples actualizaciones usando batch writes
 * Maneja automáticamente el límite de 500 operaciones por batch
 */
export async function batchUpdateSchedules(
  updates: Array<{
    scheduleId: string
    updateData: any
  }>
): Promise<void> {
  if (!db) {
    throw new Error("Firebase no está configurado")
  }

  if (updates.length === 0) {
    return
  }

  // Firestore limita a 500 operaciones por batch
  const BATCH_LIMIT = 500
  const batches: Array<Array<typeof updates[0]>> = []

  // Dividir en batches si es necesario
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    batches.push(updates.slice(i, i + BATCH_LIMIT))
  }

  // Ejecutar cada batch
  for (const batchUpdates of batches) {
    const batch = writeBatch(db)
    
    for (const { scheduleId, updateData } of batchUpdates) {
      const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)
      
      // Eliminar valores undefined
      const cleanUpdateData: any = {}
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined) {
          cleanUpdateData[key] = updateData[key]
        }
      })

      batch.update(scheduleRef, cleanUpdateData)
    }

    await batch.commit()
  }
}

