// Script de Migración Segura - Sistema de Versionado Inmutable
// Migra semanas del formato antiguo isCompleted/weekSnapshot al nuevo sistema

import { WeekVersioningService } from "../lib/week-versioning-service-immutable"
import { LegacyWeekData, MigrationResult } from "../lib/types/week-versioning-new"
import { db } from "../lib/firebase"
import { collection, getDocs, query, orderBy } from "firebase/firestore"

// ========================================
// CONFIGURACIÓN DE MIGRACIÓN
// ========================================

const MIGRATION_BATCH_SIZE = 50
const WEEKS_COLLECTION = "apps/horarios/weeks"

// ========================================
// FUNCIONES DE MIGRACIÓN
// ========================================

/**
 * Obtiene todas las semanas que necesitan migración
 */
async function getWeeksNeedingMigration() {
  if (!db) {
    throw new Error("Firestore no está configurado")
  }

  console.log("🔍 [Migration] Searching for weeks needing migration...")
  
  const weeksRef = collection(db, WEEKS_COLLECTION)
  const weeksQuery = query(weeksRef, orderBy("createdAt", "desc"))
  const weeksSnapshot = await getDocs(weeksQuery)
  
  const weeksNeedingMigration = []
  
  for (const doc of weeksSnapshot.docs) {
    const weekData = doc.data()
    
    // Verificar si necesita migración (no tiene currentVersionNumber)
    if (!weekData.currentVersionNumber) {
      weeksNeedingMigration.push({
        id: doc.id,
        data: {
          ...weekData,
          id: doc.id
        }
      })
    }
  }
  
  console.log(`📊 [Migration] Found ${weeksNeedingMigration.length} weeks needing migration`)
  return weeksNeedingMigration
}

/**
 * Migra una semana individual con validación
 */
async function migrateSingleWeek(weekId: string, weekData: any): Promise<boolean> {
  try {
    console.log(`🔄 [Migration] Migrating week: ${weekId}`)
    
    // Convertir a formato LegacyWeekData
    const legacyWeekData = {
      id: weekId,
      isCompleted: weekData.isCompleted,
      completada: weekData.completada,
      assignments: weekData.assignments,
      dayStatus: weekData.dayStatus,
      employeesSnapshot: weekData.employeesSnapshot,
      weekSnapshot: weekData.weekSnapshot,
      createdAt: weekData.createdAt,
      createdBy: weekData.createdBy,
      createdByName: weekData.createdByName,
      ownerId: weekData.ownerId,
      weekStart: weekData.weekStart,
      semanaInicio: weekData.semanaInicio,
      semanaFin: weekData.semanaFin,
      nombre: weekData.nombre,
    }
    
    // Verificar si ya fue migrada (doble check)
    const needsMigration = await WeekVersioningService.needsMigration(weekId)
    if (!needsMigration) {
      console.log(`✅ [Migration] Week ${weekId} already migrated, skipping...`)
      return true
    }
    
    // Ejecutar migración
    const migrated = await WeekVersioningService.migrateFromLegacy(weekId, legacyWeekData)
    
    if (migrated) {
      console.log(`✅ [Migration] Successfully migrated week: ${weekId}`)
      
      // Verificar integridad post-migración
      const verification = await WeekVersioningService.verifyWeekStructure(weekId)
      if (verification.valid) {
        console.log(`✅ [Migration] Week ${weekId} structure verification passed`)
      } else {
        console.error(`❌ [Migration] Week ${weekId} structure verification failed: ${verification.reason}`)
        return false
      }
    } else {
      console.error(`❌ [Migration] Failed to migrate week: ${weekId}`)
    }
    
    return migrated
  } catch (error) {
    console.error(`❌ [Migration] Error migrating week ${weekId}:`, error)
    return false
  }
}

/**
 * Ejecuta la migración completa en batches
 */
async function executeMigration() {
  console.log("🚀 [Migration] Starting week migration to immutable versioning system...")
  
  const result: MigrationResult = {
    success: true,
    migratedWeeks: 0,
    failedWeeks: 0,
    errors: [] as string[]
  }
  
  try {
    // Obtener semanas que necesitan migración
    const weeksToMigrate = await getWeeksNeedingMigration()
    
    if (weeksToMigrate.length === 0) {
      console.log("✅ [Migration] No weeks need migration. System is already up to date.")
      return result
    }
    
    console.log(`📋 [Migration] Starting migration of ${weeksToMigrate.length} weeks...`)
    
    // Procesar en batches
    for (let i = 0; i < weeksToMigrate.length; i += MIGRATION_BATCH_SIZE) {
      const batch = weeksToMigrate.slice(i, i + MIGRATION_BATCH_SIZE)
      console.log(`🔄 [Migration] Processing batch ${Math.floor(i / MIGRATION_BATCH_SIZE) + 1}/${Math.ceil(weeksToMigrate.length / MIGRATION_BATCH_SIZE)}`)
      
      for (const { id, data } of batch) {
        try {
          const migrated = await migrateSingleWeek(id, data)
          
          if (migrated) {
            result.migratedWeeks++
          } else {
            result.failedWeeks++
            result.errors.push(`Error migrando semana ${id}`)
          }
        } catch (error) {
          result.failedWeeks++
          result.errors.push(
            `Error procesando semana ${id}: ${error instanceof Error ? error.message : "Error desconocido"}`
          )
        }
      }
      
      // Pequeña pausa entre batches para no sobrecargar Firestore
      if (i + MIGRATION_BATCH_SIZE < weeksToMigrate.length) {
        console.log("⏳ [Migration] Pausing between batches...")
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    result.success = result.failedWeeks === 0
    
    console.log("📊 [Migration] Migration completed:", {
      totalWeeks: weeksToMigrate.length,
      migrated: result.migratedWeeks,
      failed: result.failedWeeks,
      success: result.success
    })
    
    return result
  } catch (error) {
    result.success = false
    result.errors.push(`Error general en migración: ${error instanceof Error ? error.message : "Error desconocido"}`)
    console.error("❌ [Migration] Critical error during migration:", error)
    return result
  }
}

/**
 * Verificación post-migración
 */
async function verifyMigration() {
  console.log("🔍 [Migration] Running post-migration verification...")
  
  try {
    const weeksToMigrate = await getWeeksNeedingMigration()
    
    if (weeksToMigrate.length === 0) {
      console.log("✅ [Migration] All weeks successfully migrated!")
    } else {
      console.warn(`⚠️ [Migration] ${weeksToMigrate.length} weeks still need migration`)
      weeksToMigrate.forEach(week => {
        console.warn(`  - ${week.id}`)
      })
    }
  } catch (error) {
    console.error("❌ [Migration] Error during verification:", error)
  }
}

// ========================================
// EJECUCIÓN PRINCIPAL
// ========================================

/**
 * Función principal de migración
 */
async function main() {
  console.log("=".repeat(60))
  console.log("🚀 WEEK MIGRATION TO IMMUTABLE VERSIONING SYSTEM")
  console.log("=".repeat(60))
  
  try {
    // Ejecutar migración
    const result = await executeMigration()
    
    // Mostrar resultados
    console.log("\n" + "=".repeat(60))
    console.log("📊 MIGRATION RESULTS")
    console.log("=".repeat(60))
    console.log(`✅ Success: ${result.success}`)
    console.log(`📈 Migrated: ${result.migratedWeeks} weeks`)
    console.log(`❌ Failed: ${result.failedWeeks} weeks`)
    
    if (result.errors.length > 0) {
      console.log("\n🚨 ERRORS:")
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    }
    
    // Verificación final
    await verifyMigration()
    
    console.log("\n" + "=".repeat(60))
    console.log("🎉 MIGRATION PROCESS COMPLETED")
    console.log("=".repeat(60))
    
    if (result.success) {
      console.log("✅ All weeks have been successfully migrated to the immutable versioning system!")
      console.log("🔄 You can now safely use the new week versioning features.")
    } else {
      console.log("⚠️ Some weeks failed to migrate. Please check the errors above and retry if necessary.")
    }
    
  } catch (error) {
    console.error("💥 Critical error during migration process:", error)
    process.exit(1)
  }
}

// ========================================
// EXPORT PARA USO EN OTROS SCRIPTS
// ========================================

export {
  executeMigration,
  verifyMigration,
  getWeeksNeedingMigration,
  migrateSingleWeek,
  main
}

// ========================================
// EJECUCIÓN DIRECTA (si se corre el script)
// ========================================

if (typeof require !== 'undefined' && require.main === module) {
  main().catch(error => {
    console.error("💥 Unhandled error in migration script:", error)
    process.exit(1)
  })
}
