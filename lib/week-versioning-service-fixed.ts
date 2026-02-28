import { 
  WeekDocument, 
  WeekVersion, 
  CreateVersionData, 
  CreateVersionResult, 
  CompleteWeekResult,
  WeekVersioningRules,
  WeekSnapshotMeta
} from "@/lib/types/week-versioning"
import { doc, collection, serverTimestamp, getDoc, runTransaction, query, orderBy, getDocs, Firestore } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Empleado } from "@/lib/types"

// Colecciones para el nuevo sistema de versionado
const WEEKS_COLLECTION = "weeks"
const VERSIONS_SUBCOLLECTION = "versions"

export class WeekVersioningService {
  /**
   * Crea una nueva versión CLONANDO la versión actual desde Firestore
   * NO depende de datos desde la UI
   */
  static async createNewVersion(
    baseWeekId: string,
    versionData: Omit<CreateVersionData, "assignments" | "dayStatus" | "employeesSnapshot">
  ): Promise<CreateVersionResult> {
    if (!db) {
      return {
        success: false,
        newVersionNumber: 0,
        error: "Firestore no está configurado",
      }
    }

    try {
      const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
      const versionsRef = collection(weekRef, VERSIONS_SUBCOLLECTION)
      
      const result = await runTransaction(db as Firestore, async (transaction) => {
        // 1️⃣ Leer documento base en transacción
        const weekDoc = await transaction.get(weekRef)
        
        if (!weekDoc.exists()) {
          throw new Error("La semana no existe")
        }
        
        const weekData = weekDoc.data() as WeekDocument
        const currentVersionNumber = weekData.currentVersionNumber
        
        // 2️⃣ Leer versión actual desde Firestore (CLONADO REAL)
        const currentVersionRef = doc(versionsRef, currentVersionNumber.toString())
        const currentVersionDoc = await transaction.get(currentVersionRef)
        
        if (!currentVersionDoc.exists()) {
          throw new Error("La versión actual no existe")
        }
        
        const currentVersion = currentVersionDoc.data() as WeekVersion
        
        // 3️⃣ Calcular nuevo número de versión (CONCURRENCIA SEGURA)
        const newVersionNumber = currentVersionNumber + 1
        
        if (!WeekVersioningRules.validateVersionNumber(newVersionNumber)) {
          throw new Error("Número de versión inválido")
        }
        
        // 4️⃣ Crear nueva versión CLONANDO datos de la versión actual
        const newVersion: WeekVersion = {
          versionNumber: newVersionNumber,
          isCompleted: versionData.isCompleted,
          assignments: JSON.parse(JSON.stringify(currentVersion.assignments)), // Deep copy real
          dayStatus: JSON.parse(JSON.stringify(currentVersion.dayStatus || {})), // Deep copy real
          employeesSnapshot: JSON.parse(JSON.stringify(currentVersion.employeesSnapshot)), // Deep copy real
          createdAt: serverTimestamp(),
          createdBy: versionData.createdBy,
          createdByName: versionData.createdByName,
          previousVersionNumber: currentVersionNumber,
        }
        
        // 5️⃣ Crear documento de nueva versión en subcolección
        const newVersionRef = doc(versionsRef, newVersionNumber.toString())
        transaction.set(newVersionRef, newVersion)
        
        // 6️⃣ Actualizar documento base con nueva versión actual
        const updatedWeekData: Partial<WeekDocument> = {
          currentVersionNumber: newVersionNumber,
          status: versionData.isCompleted ? "completed" : "draft",
          updatedAt: serverTimestamp(),
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
   * Completa la semana actual creando NUEVA versión completada
   * NO modifica versión existente
   */
  static async completeCurrentWeek(
    baseWeekId: string,
    employees: Empleado[],
    shifts: any[],
    assignments: WeekVersion["assignments"],
    dayStatus: WeekVersion["dayStatus"],
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
      const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
      const versionsRef = collection(weekRef, VERSIONS_SUBCOLLECTION)
      
      const result = await runTransaction(db as Firestore, async (transaction) => {
        // 1️⃣ Leer documento base
        const weekDoc = await transaction.get(weekRef)
        
        if (!weekDoc.exists()) {
          throw new Error("La semana no existe")
        }
        
        const weekData = weekDoc.data() as WeekDocument
        const newVersionNumber = weekData.currentVersionNumber + 1
        
        // 2️⃣ Crear snapshot de empleados desde assignments actuales
        const employeeIdsInWeek = new Set<string>()
        Object.values(assignments).forEach((dayAssignments) => {
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
        
        // 3️⃣ Crear NUEVA versión completada
        const completedVersion: WeekVersion = {
          versionNumber: newVersionNumber,
          isCompleted: true,
          assignments: JSON.parse(JSON.stringify(assignments || {})),
          dayStatus: JSON.parse(JSON.stringify(dayStatus || {})),
          employeesSnapshot,
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          previousVersionNumber: weekData.currentVersionNumber,
        }
        
        // 4️⃣ Crear documento de versión completada
        const completedVersionRef = doc(versionsRef, newVersionNumber.toString())
        transaction.set(completedVersionRef, completedVersion)
        
        // 5️⃣ Actualizar documento base
        const updatedWeekData: Partial<WeekDocument> = {
          currentVersionNumber: newVersionNumber,
          status: "completed",
          updatedAt: serverTimestamp(),
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
   * Obtiene la versión actual - SOLO carga doc base + versión actual
   * NO carga todas las versiones
   */
  static async getCurrentVersion(baseWeekId: string): Promise<WeekVersion | null> {
    if (!db) return null
    
    try {
      const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return null
      }
      
      const weekData = weekDoc.data() as WeekDocument
      const currentVersionNumber = weekData.currentVersionNumber
      
      // Cargar solo la versión actual desde subcolección
      const versionsRef = collection(weekRef, VERSIONS_SUBCOLLECTION)
      const currentVersionRef = doc(versionsRef, currentVersionNumber.toString())
      const currentVersionDoc = await getDoc(currentVersionRef)
      
      if (!currentVersionDoc.exists()) {
        return null
      }
      
      return currentVersionDoc.data() as WeekVersion
    } catch (error) {
      console.error("Error getting current version:", error)
      return null
    }
  }
  
  /**
   * Obtiene todas las versiones - QUERY sobre subcolección ordenada
   */
  static async getAllVersions(baseWeekId: string): Promise<WeekVersion[]> {
    if (!db) return []
    
    try {
      const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
      const versionsRef = collection(weekRef, VERSIONS_SUBCOLLECTION)
      
      // Query ordenado por versionNumber descendente
      const versionsQuery = query(versionsRef, orderBy("versionNumber", "desc"))
      const versionsSnapshot = await getDocs(versionsQuery)
      
      return versionsSnapshot.docs.map(doc => doc.data() as WeekVersion)
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
      const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
      const weekDoc = await getDoc(weekRef)
      
      if (!weekDoc.exists()) {
        return false
      }
      
      const weekData = weekDoc.data()
      
      // Si no tiene el campo currentVersionNumber, necesita migración
      return !weekData.currentVersionNumber
    } catch (error) {
      console.error("Error checking migration:", error)
      return false
    }
  }
  
  /**
   * Migra una semana del formato antiguo al nuevo sistema de versiones
   * IDEMPOTENTE - no sobrescribe si ya existe
   */
  static async migrateFromLegacy(
    baseWeekId: string,
    legacyWeekData: any
  ): Promise<boolean> {
    if (!db) return false
    
    try {
      const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
      const versionsRef = collection(weekRef, VERSIONS_SUBCOLLECTION)
      
      await runTransaction(db as Firestore, async (transaction) => {
        // Verificar si ya fue migrada (IDEMPOTENCIA)
        const existingWeekDoc = await transaction.get(weekRef)
        
        if (existingWeekDoc.exists() && existingWeekDoc.data().currentVersionNumber) {
          console.log(`Week ${baseWeekId} already migrated, skipping...`)
          return
        }
        
        const hasWeekSnapshot = !!legacyWeekData.weekSnapshot
        const snapshotMeta: WeekSnapshotMeta | undefined = hasWeekSnapshot
          ? {
              capturedAt: legacyWeekData.weekSnapshot?.capturedAt,
              shifts: legacyWeekData.weekSnapshot?.shifts || [],
              separadores: legacyWeekData.weekSnapshot?.separadores || [],
              ordenEmpleados: legacyWeekData.weekSnapshot?.ordenEmpleados || [],
            }
          : undefined

        // Crear versión inicial desde datos legados con fidelidad histórica completa
        const initialVersion: WeekVersion = {
          versionNumber: 1,
          isCompleted: legacyWeekData.completada || false,
          assignments: hasWeekSnapshot
            ? (legacyWeekData.weekSnapshot?.assignments || {})
            : (legacyWeekData.assignments || {}),
          dayStatus: hasWeekSnapshot
            ? (legacyWeekData.weekSnapshot?.dayStatus || {})
            : (legacyWeekData.dayStatus || {}),
          employeesSnapshot: hasWeekSnapshot
            ? (legacyWeekData.weekSnapshot?.employees || [])
            : (legacyWeekData.employeesSnapshot || []),
          snapshotMeta,
          createdAt: legacyWeekData.createdAt || serverTimestamp(),
          createdBy: legacyWeekData.createdBy,
          createdByName: legacyWeekData.createdByName,
        }
        
        // Crear nuevo documento con estructura correcta
        const newWeekData: WeekDocument = {
          id: baseWeekId,
          baseWeekId,
          currentVersionNumber: 1,
          status: legacyWeekData.completada ? "completed" : "draft",
          createdAt: legacyWeekData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          ownerId: legacyWeekData.ownerId,
          weekStart: legacyWeekData.weekStart,
          semanaInicio: legacyWeekData.semanaInicio,
          semanaFin: legacyWeekData.semanaFin,
          nombre: legacyWeekData.nombre,
        }
        
        // Crear documento base
        transaction.set(weekRef, newWeekData)
        
        // Crear versión inicial en subcolección
        const initialVersionRef = doc(versionsRef, "1")
        transaction.set(initialVersionRef, initialVersion)
      })
      
      return true
    } catch (error) {
      console.error("Error migrating legacy week:", error)
      return false
    }
  }
  

  /**
   * Verificación de integridad estructural:
   * - weeks/{baseWeekId} sin versions embebidas
   * - versión actual existente en subcolección
   */
  static async verifyWeekStructure(baseWeekId: string): Promise<{ valid: boolean; reason?: string }> {
    if (!db) return { valid: false, reason: "Firestore no está configurado" }

    const weekRef = doc(db as Firestore, WEEKS_COLLECTION, baseWeekId)
    const weekDoc = await getDoc(weekRef)

    if (!weekDoc.exists()) {
      return { valid: false, reason: "La semana no existe" }
    }

    const weekData = weekDoc.data() as any
    if (weekData.versions) {
      return { valid: false, reason: "Documento base contiene campo versions embebido" }
    }

    const currentVersionNumber = weekData.currentVersionNumber
    const currentVersionRef = doc(collection(weekRef, VERSIONS_SUBCOLLECTION), String(currentVersionNumber))
    const currentVersionDoc = await getDoc(currentVersionRef)

    if (!currentVersionDoc.exists()) {
      return { valid: false, reason: "No existe documento de versión actual en subcolección" }
    }

    return { valid: true }
  }

  /**
   * VALIDACIÓN DE SEGURIDAD - No permite modificar versiones completadas
   */
  static validateVersionModification(version: WeekVersion): void {
    if (version.isCompleted) {
      throw new Error("No se puede modificar una versión completada. Cree una nueva versión.")
    }
  }
}
