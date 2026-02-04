import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { db, COLLECTIONS } from "./firebase"
import type { Horario, HistorialItem } from "./types"

/**
 * Normaliza IDs para Firestore reemplazando caracteres problemáticos
 */
export function normalizeFirestoreId(value: string): string {
  return value.replace(/\//g, '_').replace(/#/g, '_').replace(/\$/g, '_').replace(/\[/g, '_').replace(/\]/g, '_')
}

/**
 * Construye paths válidos para Firestore con número par de segmentos
 */
export function buildFirestorePath(basePath: string, ...segments: string[]): string {
  const normalizedSegments = segments.map(segment => normalizeFirestoreId(segment))
  return [basePath, ...normalizedSegments].join('/')
}

/**
 * Helper para crear referencia de settings válida
 * Path: apps/horarios_settings/{ownerId}
 */
export function createSettingsRef(dbInstance: any, ownerId: string) {
  if (!dbInstance) {
    throw new Error("Firestore instance not available")
  }

  if (!ownerId || ownerId.trim() === '') {
    throw new Error("ownerId is required for settings reference")
  }

  const normalizedOwnerId = normalizeFirestoreId(ownerId)
  console.log("🔧 [createSettingsRef] Creating settings ref for ownerId:", ownerId, '→', normalizedOwnerId)
  
  try {
    const ref = doc(dbInstance, "apps", "horarios_settings", normalizedOwnerId)
    console.log("🔧 [createSettingsRef] Settings reference created successfully: apps/horarios_settings/" + normalizedOwnerId)
    return ref
  } catch (error) {
    console.error("🔧 [createSettingsRef] Failed to create settings reference:", error)
    throw new Error(`Failed to create settings reference: ${error}`)
  }
}

/**
 * Helper para crear referencia de week válida
 * Path: apps/horarios_weeks/{ownerId}_{weekId}
 */
export function createWeekRef(dbInstance: any, ownerId: string, weekId: string) {
  if (!dbInstance) {
    throw new Error("Firestore instance not available")
  }

  if (!ownerId || ownerId.trim() === '') {
    throw new Error("ownerId is required for week reference")
  }

  if (!weekId || weekId.trim() === '') {
    throw new Error("weekId is required for week reference")
  }

  const normalizedOwnerId = normalizeFirestoreId(ownerId)
  const normalizedWeekId = normalizeFirestoreId(weekId)
  const compositeId = `${normalizedOwnerId}_${normalizedWeekId}`
  
  console.log("🔧 [createWeekRef] Creating week ref:", { ownerId, weekId, compositeId })
  
  try {
    const ref = doc(dbInstance, "apps", "horarios_weeks", compositeId)
    console.log("🔧 [createWeekRef] Week reference created successfully: apps/horarios_weeks/" + compositeId)
    return ref
  } catch (error) {
    console.error("🔧 [createWeekRef] Failed to create week reference:", error)
    throw new Error(`Failed to create week reference: ${error}`)
  }
}

/**
 * Crea una referencia de colección válida
 */
export function createValidCollectionRef(dbInstance: any, pathSegments: string[]) {
  if (!dbInstance) {
    throw new Error("Firestore instance not available")
  }

  const normalizedSegments = pathSegments.map(segment => {
    if (typeof segment !== 'string') {
      console.error('🔧 [createValidCollectionRef] Invalid segment type:', typeof segment, segment)
      throw new Error(`Invalid segment type: ${typeof segment}`)
    }
    
    const normalized = normalizeFirestoreId(segment)
    console.log('🔧 [createValidCollectionRef] Normalizing:', segment, '→', normalized)
    return normalized
  })

  const fullPath = normalizedSegments.join('/')
  console.log('🔧 [createValidCollectionRef] Final collection path:', fullPath)

  return collection(dbInstance, normalizedSegments[0], ...normalizedSegments.slice(1))
}

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
  // createdBy SIEMPRE debe preservarse si existe en el schedule actual
  // Esto es crítico para las reglas de seguridad
  if (currentSchedule.createdBy) {
    preserved.createdBy = currentSchedule.createdBy
  }
  if (currentSchedule.createdByName) {
    preserved.createdByName = currentSchedule.createdByName
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
    ownerId: schedule.ownerId,
    horarioId: schedule.id,
    version: 0, // Se asignará cuando se guarde en Firestore
    nombre: schedule.nombre || `Semana del ${weekStartStr || schedule.weekStart || schedule.semanaInicio}`,
    semanaInicio: schedule.semanaInicio || weekStartStr || schedule.weekStart || "",
    semanaFin: schedule.semanaFin || weekEndStr || "",
    weekStart: schedule.weekStart || weekStartStr || schedule.semanaInicio,
    assignments: { ...schedule.assignments },
    createdAt: schedule.updatedAt || schedule.createdAt || serverTimestamp(),
    // Siempre usar el userId del usuario actual para el historial
    createdBy: userId,
    createdByName: userName,
    accion: action,
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
  
  // Limpiar valores undefined y null problemáticos del objeto final (Firestore no acepta undefined)
  const finalCleanData: any = {}
  Object.keys(finalUpdateData).forEach((key) => {
    const value = finalUpdateData[key]
    // Solo incluir si no es undefined
    if (value !== undefined) {
      finalCleanData[key] = value
    }
  })
  
  await updateDoc(doc(db, COLLECTIONS.SCHEDULES, scheduleId), finalCleanData)
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
