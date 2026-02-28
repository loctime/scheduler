// Servicio de Semanas Simplificado - Modelo Final
// Solo dos tipos: Legacy (schedules) y Versionado (weeks/{baseWeekId}/versions/{n})

import { doc, collection, serverTimestamp, getDoc, runTransaction } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Empleado, Horario } from "@/lib/types"
import { buildScheduleDocId } from "@/lib/firestore-helpers"

// ========================================
// CONSTANTES
// ========================================

const WEEKS_COLLECTION = "apps/horarios/weeks"
const VERSIONS_SUBCOLLECTION = "versions"

// ========================================
// TIPOS SIMPLES
// ========================================

interface WeekDocument {
  id: string
  baseWeekId: string
  ownerId: string
  weekStart: string
  semanaInicio: string
  semanaFin: string
  nombre: string
  currentVersionNumber: number
  status: "draft" | "completed"
  createdAt: any
  updatedAt: any
}

interface WeekVersion {
  versionNumber: number
  isCompleted: boolean
  assignments: any
  dayStatus: any
  employeesSnapshot: Array<{ id: string; name: string; ownerId: string }>
  createdAt: any
  createdBy: string
  createdByName: string
  previousVersionNumber?: number
}

interface MarkCompleteResult {
  success: boolean
  versionNumber: number
  error?: string
}

interface EditVersionResult {
  success: boolean
  newVersionNumber: number
  error?: string
}

// ========================================
// SERVICIO DE SEMANAS
// ========================================

export class WeekService {
  /**
   * REGLA 2: Marcar como LISTO
   */
  static async markWeekComplete(
    weekStart: string,
    ownerId: string,
    employees: Empleado[],
    shifts: any[],
    assignments: any,
    dayStatus: any,
    userId: string,
    userName: string
  ): Promise<MarkCompleteResult> {
    if (!db) {
      return {
        success: false,
        versionNumber: 0,
        error: "Firestore no está configurado"
      }
    }

    try {
      const scheduleId = buildScheduleDocId(ownerId, weekStart)
      const baseWeekId = `week_${weekStart}_${ownerId}`

      console.log("[WeekService] Marking week complete:", { weekStart, ownerId, baseWeekId })

      return await runTransaction(db, async (transaction) => {
        // 1. Leer schedule actual
        if (!db) {
          throw new Error("Firestore no está configurado")
        }
        const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)
        const scheduleDoc = await transaction.get(scheduleRef)
        
        if (!scheduleDoc.exists()) {
          throw new Error("Schedule no existe")
        }

        const scheduleData = scheduleDoc.data() as Horario

        // 2. Crear documento base de semana
        const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
        const weekDoc = await transaction.get(weekRef)

        const weekDocument: WeekDocument = {
          id: baseWeekId,
          baseWeekId,
          ownerId,
          weekStart,
          semanaInicio: weekStart,
          semanaFin: weekStart,
          nombre: `Semana ${weekStart}`,
          currentVersionNumber: 1,
          status: "completed",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
        
        if (weekDoc.exists()) {
          // Actualizar documento existente
          const existing = weekDoc.data() as WeekDocument
          weekDocument.currentVersionNumber = (existing.currentVersionNumber || 0) + 1
          transaction.update(weekRef, {
            currentVersionNumber: weekDocument.currentVersionNumber,
            status: "completed",
            updatedAt: serverTimestamp()
          })
        } else {
          // Crear nuevo documento
          transaction.set(weekRef, weekDocument)
        }

        // 3. Crear versión completada
        const versionRef = doc(collection(weekRef, VERSIONS_SUBCOLLECTION), weekDocument.currentVersionNumber.toString())
        const completedVersion: WeekVersion = {
          versionNumber: weekDocument.currentVersionNumber,
          isCompleted: true,
          assignments: JSON.parse(JSON.stringify(assignments)),
          dayStatus: JSON.parse(JSON.stringify(dayStatus)),
          employeesSnapshot: employees.map(emp => ({
            id: emp.id,
            name: emp.name,
            ownerId: emp.ownerId
          })),
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          previousVersionNumber: weekDocument.currentVersionNumber > 1 ? weekDocument.currentVersionNumber - 1 : undefined
        }
        transaction.set(versionRef, completedVersion)

        // 4. Actualizar schedule con baseWeekId y completada
        transaction.update(scheduleRef, {
          baseWeekId,
          completada: true,
          updatedAt: serverTimestamp()
        })

        return {
          success: true,
          versionNumber: weekDocument.currentVersionNumber
        }
      })
    } catch (error) {
      console.error("Error marking week complete:", error)
      return {
        success: false,
        versionNumber: 0,
        error: error instanceof Error ? error.message : "Error desconocido"
      }
    }
  }

  /**
   * REGLA 5: Editar semana versionada
   */
  static async editVersionedWeek(
    baseWeekId: string,
    userId: string,
    userName: string
  ): Promise<EditVersionResult> {
    if (!db) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "Firestore no está configurado"
      }
    }

    try {
      console.log("[WeekService] Editing versioned week:", { baseWeekId })

      return await runTransaction(db, async (transaction) => {
        // 1. Verificar que existe documento base
        if (!db) {
          throw new Error("Firestore no está configurado")
        }
        const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
        const weekDoc = await transaction.get(weekRef)
        
        if (!weekDoc.exists()) {
          throw new Error(`Week document ${baseWeekId} no existe`)
        }

        const weekDocument = weekDoc.data() as WeekDocument

        // 2. Obtener versión actual
        const currentVersionRef = doc(collection(weekRef, VERSIONS_SUBCOLLECTION), weekDocument.currentVersionNumber.toString())
        const currentVersionDoc = await transaction.get(currentVersionRef)
        
        if (!currentVersionDoc.exists()) {
          throw new Error(`Versión actual ${weekDocument.currentVersionNumber} no existe`)
        }

        const currentVersion = currentVersionDoc.data() as WeekVersion

        // 3. Crear nueva versión clonando la actual
        const newVersionNumber = weekDocument.currentVersionNumber + 1
        const newVersionRef = doc(collection(weekRef, VERSIONS_SUBCOLLECTION), newVersionNumber.toString())
        
        const newVersion: WeekVersion = {
          versionNumber: newVersionNumber,
          isCompleted: false, // REGLA: Nueva versión siempre es draft
          assignments: JSON.parse(JSON.stringify(currentVersion.assignments)),
          dayStatus: JSON.parse(JSON.stringify(currentVersion.dayStatus)),
          employeesSnapshot: JSON.parse(JSON.stringify(currentVersion.employeesSnapshot)),
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          previousVersionNumber: currentVersion.versionNumber
        }
        transaction.set(newVersionRef, newVersion)

        // 4. Actualizar documento base
        transaction.update(weekRef, {
          currentVersionNumber: newVersionNumber,
          status: "draft",
          updatedAt: serverTimestamp()
        })

        return {
          success: true,
          newVersionNumber
        }
      })
    } catch (error) {
      console.error("Error editing versioned week:", error)
      return {
        success: false,
        newVersionNumber: 0,
        error: error instanceof Error ? error.message : "Error desconocido"
      }
    }
  }

  /**
   * REGLA 1: Lectura única
   */
  static async getWeekData(baseWeekId: string | null, weekStart: string, ownerId: string): Promise<{
    source: 'schedules' | 'versions'
    data: Horario | WeekVersion
  } | null> {
    if (!db) return null

    try {
      // 1. Verificar si existe en schedules
      const scheduleId = buildScheduleDocId(ownerId, weekStart)
      const scheduleRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId)
      const scheduleDoc = await getDoc(scheduleRef)
      
      if (!scheduleDoc.exists()) {
        return null
      }

      const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() } as Horario

      // 2. REGLA: Si baseWeekId existe, leer SIEMPRE desde weeks/versions
      if (scheduleData.baseWeekId) {
        const weekDoc = await this.getWeekDocument(scheduleData.baseWeekId)
        if (!weekDoc) {
          throw new Error(`Error estructural: baseWeekId ${scheduleData.baseWeekId} existe pero week document no existe`)
        }

        const currentVersion = await this.getCurrentVersion(scheduleData.baseWeekId)
        if (!currentVersion) {
          throw new Error(`Error estructural: baseWeekId ${scheduleData.baseWeekId} existe pero currentVersion no existe`)
        }

        return {
          source: 'versions',
          data: currentVersion
        }
      } else {
        // 3. Si no está versionado, leer desde schedules
        return {
          source: 'schedules',
          data: scheduleData
        }
      }
    } catch (error) {
      console.error("Error getting week data:", error)
      throw error
    }
  }

  /**
   * Utilidades
   */
  static isWeekVersioned(schedule: Horario): boolean {
    return !!schedule.baseWeekId
  }

  static getWeekStatus(schedule: Horario): 'legacy' | 'draft' | 'completed' {
    if (!schedule.baseWeekId) {
      return 'legacy'
    }

    if (schedule.completada === true) {
      return 'completed'
    }

    return 'draft'
  }

  // ========================================
  // MÉTODOS PRIVADOS
  // ========================================

  private static async getWeekDocument(baseWeekId: string): Promise<WeekDocument | null> {
    if (!db) return null
    
    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return null
      }
      
      return weekDoc.data() as WeekDocument
    } catch (error) {
      console.error("Error getting week document:", error)
      return null
    }
  }

  private static async getCurrentVersion(baseWeekId: string): Promise<WeekVersion | null> {
    if (!db) return null
    
    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return null
      }
      
      const weekDocument = weekDoc.data() as WeekDocument
      const versionRef = doc(collection(weekRef, VERSIONS_SUBCOLLECTION), weekDocument.currentVersionNumber.toString())
      const versionDoc = await getDoc(versionRef)
      
      return versionDoc.exists() ? versionDoc.data() as WeekVersion : null
    } catch (error) {
      console.error("Error getting current version:", error)
      return null
    }
  }
}
