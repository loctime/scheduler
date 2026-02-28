import { 
  WeekDocument, 
  WeekVersion, 
  WeekVersionCreateData, 
  CreateVersionResult, 
  CompleteWeekResult 
} from "@/lib/types/week-versioning"
import { doc, serverTimestamp, setDoc, getDoc, runTransaction } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ShiftAssignment, Empleado } from "@/lib/types"

// Colección para el nuevo sistema de versiones
const WEEKS_COLLECTION = "weeks"

export class WeekVersioningService {
  /**
   * Crea una nueva versión de una semana
   */
  static async createNewVersion(
    baseWeekId: string,
    versionData: Omit<WeekVersionCreateData, "baseWeekId" | "versionNumber">
  ): Promise<CreateVersionResult> {
    if (!db) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "Firestore no está configurado",
      }
    }

    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      
      const result = await runTransaction(db as any, async (transaction: any) => {
        const weekDoc = await transaction.get(weekRef)
        
        if (!weekDoc.exists()) {
          throw new Error("La semana no existe")
        }
        
        const weekData = weekDoc.data() as WeekDocument
        const newVersionNumber = (weekData.currentVersion || 0) + 1
        
        // Crear nueva versión
        const newVersion: WeekVersion = {
          versionNumber: newVersionNumber,
          isCompleted: versionData.isCompleted,
          assignments: versionData.assignments,
          dayStatus: versionData.dayStatus,
          employeesSnapshot: versionData.employeesSnapshot,
          createdAt: serverTimestamp(),
          createdBy: versionData.createdBy,
          createdByName: versionData.createdByName,
          previousVersion: weekData.currentVersion || undefined,
        }
        
        // Actualizar documento
        const updatedWeekData: Partial<WeekDocument> = {
          currentVersion: newVersionNumber,
          status: versionData.isCompleted ? "completed" : "draft",
          updatedAt: serverTimestamp(),
          versions: {
            ...weekData.versions,
            [newVersionNumber]: newVersion,
          },
        }
        
        transaction.set(weekRef, updatedWeekData, { merge: true })
        
        return newVersionNumber
      })
      
      return {
        success: true,
        newVersionNumber: result as number,
      }
    } catch (error) {
      console.error("Error creating new version:", error)
      return {
        success: false,
        newVersionNumber: 0,
        error: error instanceof Error ? error.message : "Error desconocido",
      }
    }
  }
  
  /**
   * Marca la versión actual como completada (crea nueva versión completada)
   */
  static async completeCurrentWeek(
    baseWeekId: string,
    employees: Empleado[],
    shifts: any[],
    assignments: any,
    dayStatus: any,
    userId: string,
    userName: string
  ): Promise<CompleteWeekResult> {
    if (!db) {
      return {
        success: false,
        completedVersionNumber: 0,
        error: "Firestore no está configurado",
      }
    }

    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      
      const result = await runTransaction(db as any, async (transaction: any) => {
        const weekDoc = await transaction.get(weekRef)
        
        if (!weekDoc.exists()) {
          throw new Error("La semana no existe")
        }
        
        const weekData = weekDoc.data() as WeekDocument
        const newVersionNumber = (weekData.currentVersion || 0) + 1
        
        // Crear snapshot de empleados
        const employeeIdsInWeek = new Set<string>()
        Object.values(assignments).forEach((dayAssignments: any) => {
          if (!dayAssignments || typeof dayAssignments !== "object") return
          Object.keys(dayAssignments).forEach((employeeId) => employeeIdsInWeek.add(employeeId))
        })
        
        const employeesMap = new Map(employees.map((employee) => [employee.id, employee]))
        const employeesSnapshot = Array.from(employeeIdsInWeek).map((id) => {
          const employee = employeesMap.get(id)
          return {
            id,
            name: employee?.name || id,
          }
        })
        
        // Crear nueva versión completada
        const completedVersion: WeekVersion = {
          versionNumber: newVersionNumber,
          isCompleted: true,
          assignments: JSON.parse(JSON.stringify(assignments || {})),
          dayStatus: JSON.parse(JSON.stringify(dayStatus || {})),
          employeesSnapshot,
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          previousVersion: weekData.currentVersion || undefined,
        }
        
        // Actualizar documento
        const updatedWeekData: Partial<WeekDocument> = {
          currentVersion: newVersionNumber,
          status: "completed",
          updatedAt: serverTimestamp(),
          versions: {
            ...weekData.versions,
            [newVersionNumber]: completedVersion,
          },
        }
        
        transaction.set(weekRef, updatedWeekData, { merge: true })
        
        return newVersionNumber
      })
      
      return {
        success: true,
        completedVersionNumber: result as number,
      }
    } catch (error) {
      console.error("Error completing week:", error)
      return {
        success: false,
        completedVersionNumber: 0,
        error: error instanceof Error ? error.message : "Error desconocido",
      }
    }
  }
  
  /**
   * Obtiene la versión actual de una semana
   */
  static async getCurrentVersion(baseWeekId: string): Promise<WeekVersion | null> {
    if (!db) return null
    
    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return null
      }
      
      const weekData = weekDoc.data() as WeekDocument
      const currentVersionNumber = weekData.currentVersion || 0
      
      return weekData.versions[currentVersionNumber] || null
    } catch (error) {
      console.error("Error getting current version:", error)
      return null
    }
  }
  
  /**
   * Obtiene todas las versiones de una semana
   */
  static async getAllVersions(baseWeekId: string): Promise<WeekVersion[]> {
    if (!db) return []
    
    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return []
      }
      
      const weekData = weekDoc.data() as WeekDocument
      const versions = weekData.versions || {}
      
      return Object.values(versions).sort((a, b) => b.versionNumber - a.versionNumber)
    } catch (error) {
      console.error("Error getting all versions:", error)
      return []
    }
  }
  
  /**
   * Verifica si una semana necesita migración (formato antiguo)
   */
  static async needsMigration(baseWeekId: string): Promise<boolean> {
    if (!db) return false
    
    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return false
      }
      
      const weekData = weekDoc.data()
      
      // Si no tiene el campo versions, necesita migración
      return !weekData.versions
    } catch (error) {
      console.error("Error checking migration:", error)
      return false
    }
  }
  
  /**
   * Migra una semana del formato antiguo al nuevo sistema de versiones
   */
  static async migrateFromLegacy(
    baseWeekId: string,
    legacyWeekData: any
  ): Promise<boolean> {
    if (!db) return false
    
    try {
      const weekRef = doc(db, WEEKS_COLLECTION, baseWeekId)
      
      await runTransaction(db as any, async (transaction: any) => {
        // Crear versión inicial desde datos legados
        const initialVersion: WeekVersion = {
          versionNumber: 1,
          isCompleted: legacyWeekData.completada || false,
          assignments: legacyWeekData.assignments || {},
          dayStatus: legacyWeekData.dayStatus || {},
          employeesSnapshot: legacyWeekData.weekSnapshot?.employees || [],
          createdAt: legacyWeekData.createdAt || serverTimestamp(),
          createdBy: legacyWeekData.createdBy,
          createdByName: legacyWeekData.createdByName,
        }
        
        // Crear nuevo documento con estructura de versiones
        const newWeekData: WeekDocument = {
          id: baseWeekId,
          baseWeekId,
          currentVersion: 1,
          status: legacyWeekData.completada ? "completed" : "draft",
          versions: {
            "1": initialVersion,
          },
          createdAt: legacyWeekData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          ownerId: legacyWeekData.ownerId,
          weekStart: legacyWeekData.weekStart,
          semanaInicio: legacyWeekData.semanaInicio,
          semanaFin: legacyWeekData.semanaFin,
          nombre: legacyWeekData.nombre,
        }
        
        transaction.set(weekRef, newWeekData)
      })
      
      return true
    } catch (error) {
      console.error("Error migrating legacy week:", error)
      return false
    }
  }
}
