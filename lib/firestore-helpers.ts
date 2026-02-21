import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, writeBatch, setDoc } from "firebase/firestore"
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
 * ID determinístico para garantizar unicidad lógica por ownerId + weekStart.
 */
export function buildScheduleDocId(ownerId: string, weekStart: string): string {
  const normalizedOwnerId = normalizeFirestoreId(ownerId)
  const normalizedWeekStart = normalizeFirestoreId(weekStart)
  return `${normalizedOwnerId}__${normalizedWeekStart}`
}

/**
 * Crea el schedule de una semana únicamente si no existe ya el documento determinístico.
 */
export async function createScheduleIfMissing(
  ownerId: string,
  weekStart: string,
  scheduleData: Record<string, any>,
): Promise<{ id: string; created: boolean }> {
  if (!db) {
    throw new Error("Firebase no está configurado")
  }

  const scheduleId = buildScheduleDocId(ownerId, weekStart)
  const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)
  const existing = await getDoc(scheduleRef)

  if (existing.exists()) {
    return { id: scheduleId, created: false }
  }

  await setDoc(scheduleRef, scheduleData)
  return { id: scheduleId, created: true }
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

  // 🔥 Campos inmutables que siempre se deben preservar (SOLO si existen en el original)
  if (currentSchedule.createdAt !== undefined && currentSchedule.createdAt !== null) {
    preserved.createdAt = currentSchedule.createdAt
  }
  // createdBy SIEMPRE debe preservarse si existe en el schedule actual
  // Esto es crítico para las reglas de seguridad
  if (currentSchedule.createdBy !== undefined && currentSchedule.createdBy !== null) {
    preserved.createdBy = currentSchedule.createdBy
  }
  if (currentSchedule.createdByName !== undefined && currentSchedule.createdByName !== null) {
    preserved.createdByName = currentSchedule.createdByName
  }

  // 🔥 Campos de completado - preservar solo si existen y no son null
  if (currentSchedule.completada !== undefined && currentSchedule.completada !== null) {
    preserved.completada = currentSchedule.completada
  }

  // 🔥 NEVER preserve ownerId - debe ser immutable desde creación
  // No incluir ownerId aquí para evitar violar reglas unchanged()

  // Combinar campos preservados con los nuevos datos de actualización
  const result = { ...preserved, ...updateData }
  
  // 🔥 LOG DEFENSIVO: Depuración de combinación
  console.debug("🔥 [preserveScheduleFields] Combinación:", {
    preservedKeys: Object.keys(preserved),
    updateKeys: Object.keys(updateData),
    resultKeys: Object.keys(result),
    hasOwnerId: 'ownerId' in result,
    hasCreatedBy: 'createdBy' in result,
    hasNullValues: Object.values(result).some(v => v === null)
  })
  
  return result
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

  // 🔥 CRÍTICO: Excluir campos protegidos ANTES de cualquier procesamiento
  // Estos campos NUNCA deben enviarse en updates
  const protectedFields = ['ownerId', 'createdBy', 'createdAt', 'createdByName']
  const safeUpdateData: any = {}
  Object.keys(updateData).forEach((key) => {
    if (!protectedFields.includes(key) && updateData[key] !== undefined) {
      safeUpdateData[key] = updateData[key]
    }
  })

  // 🔥 CRÍTICO: Eliminar valores null problemáticos (Firestore rules rechazan null en campos que deberían unchanged)
  const cleanUpdateData: any = {}
  Object.keys(safeUpdateData).forEach((key) => {
    const value = safeUpdateData[key]
    // Solo incluir si no es undefined ni null
    if (value !== undefined && value !== null) {
      cleanUpdateData[key] = value
    }
  })

  const finalUpdateData = preserveScheduleFields(currentSchedule, cleanUpdateData)
  
  // 🔥 CRÍTICO: Limpieza final - eliminar cualquier undefined/null residual
  const finalCleanData: any = {}
  Object.keys(finalUpdateData).forEach((key) => {
    const value = finalUpdateData[key]
    // Solo incluir si no es undefined ni null
    if (value !== undefined && value !== null) {
      finalCleanData[key] = value
    }
  })
  
  // 🔥 LOG DEFENSIVO: Payload final enviado a Firestore
  console.debug("🔥 [updateSchedulePreservingFields] Payload final:", {
    scheduleId,
    payloadKeys: Object.keys(finalCleanData),
    payload: finalCleanData,
    hasProtectedFields: protectedFields.some(field => field in finalCleanData),
    hasNullValues: Object.values(finalCleanData).some(v => v === null),
    hasUndefinedValues: Object.values(finalCleanData).some(v => v === undefined)
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
