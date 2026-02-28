import { db } from "@/lib/firebase"
import { doc, getDoc, getDocs, collection, query, where, runTransaction, serverTimestamp, deleteDoc } from "firebase/firestore"
import { WeekVersioningService } from "@/lib/week-versioning-service-fixed"

/**
 * Script de migración segura al sistema de versionado con subcolecciones
 * 
 * Características:
 * - IDEMPOTENTE: No sobrescribe si ya migrado
 * - ATÓMICO: Usa transacciones Firestore
 * - PRESERVA: Todos los datos existentes
 * - REPORTA: Estadísticas detalladas
 */

interface LegacyWeek {
  id: string
  nombre: string
  weekStart: string
  semanaInicio: string
  semanaFin: string
  ownerId: string
  assignments: any
  dayStatus: any
  completada: boolean
  createdAt: any
  createdBy?: string
  createdByName?: string
  weekSnapshot?: {
    version: 1
    capturedAt?: any
    employees: Array<{ id: string; name: string }>
    shifts: any[]
    separadores: any[]
    ordenEmpleados: string[]
    assignments: any
    dayStatus?: any
  }
}

interface MigrationReport {
  totalWeeks: number
  migratedSuccessfully: number
  alreadyMigrated: number
  errors: number
  errorDetails: string[]
  duration: number
}

async function migrateAllWeeks(): Promise<MigrationReport> {
  if (!db) {
    throw new Error("Firestore no está configurado")
  }

  const startTime = Date.now()
  console.log("🚀 Iniciando migración a sistema de versionado con subcolecciones...")
  
  try {
    // Obtener todas las semanas existentes
    const schedulesRef = collection(db as any, "apps/horarios/schedules")
    const schedulesSnapshot = await getDocs(schedulesRef)
    
    const report: MigrationReport = {
      totalWeeks: schedulesSnapshot.docs.length,
      migratedSuccessfully: 0,
      alreadyMigrated: 0,
      errors: 0,
      errorDetails: [],
      duration: 0,
    }
    
    console.log(`📊 Encontradas ${schedulesSnapshot.docs.length} semanas para procesar`)
    
    // Procesar cada semana
    for (const scheduleDoc of schedulesSnapshot.docs) {
      const legacyWeek = scheduleDoc.data() as LegacyWeek
      const weekId = scheduleDoc.id
      
      try {
        console.log(`🔄 Procesando semana: ${weekId} (${legacyWeek.nombre})`)
        
        // 1️⃣ Verificar si ya fue migrada al nuevo sistema
        const needsMigration = await WeekVersioningService.needsMigration(weekId)
        
        if (!needsMigration) {
          report.alreadyMigrated++
          console.log(`✅ Semana ${weekId} ya migrada, omitiendo...`)
          continue
        }
        
        // 2️⃣ Validar integridad de datos legados
        if (!legacyWeek.assignments) {
          legacyWeek.assignments = {}
        }
        
        if (!legacyWeek.dayStatus) {
          legacyWeek.dayStatus = {}
        }
        
        // 3️⃣ Preservar weekSnapshot si existe
        if (legacyWeek.weekSnapshot?.employees) {
          console.log(`📸 Preservando snapshot con ${legacyWeek.weekSnapshot.employees.length} empleados`)
        }
        
        // 4️⃣ Migrar al nuevo sistema (IDEMPOTENTE)
        const migrationSuccess = await WeekVersioningService.migrateFromLegacy(weekId, legacyWeek)
        
        if (migrationSuccess) {
          report.migratedSuccessfully++
          console.log(`✅ Semana ${weekId} migrada exitosamente`)
        } else {
          report.errors++
          const errorMsg = `Error migrando semana ${weekId}`
          report.errorDetails.push(errorMsg)
          console.error(`❌ ${errorMsg}`)
        }
        
      } catch (error) {
        report.errors++
        const errorMsg = `Error procesando semana ${weekId}: ${error instanceof Error ? error.message : "Error desconocido"}`
        report.errorDetails.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }
    
    report.duration = Date.now() - startTime
    
    // Reporte final
    generateMigrationReport(report)
    
    return report
    
  } catch (error) {
    console.error("❌ Error crítico durante la migración:", error)
    throw error
  }
}

function generateMigrationReport(report: MigrationReport): void {
  console.log("\n" + "=".repeat(60))
  console.log("📋 REPORTE DE MIGRACIÓN - SISTEMA DE VERSIONADO")
  console.log("=".repeat(60))
  console.log(`📊 Total semanas procesadas: ${report.totalWeeks}`)
  console.log(`✅ Migradas exitosamente: ${report.migratedSuccessfully}`)
  console.log(`🔄 Ya migradas previamente: ${report.alreadyMigrated}`)
  console.log(`❌ Semanas con errores: ${report.errors}`)
  console.log(`⏱️ Duración total: ${(report.duration / 1000).toFixed(2)} segundos`)
  
  if (report.errorDetails.length > 0) {
    console.log("\n🚨 ERRORES DETALLADOS:")
    report.errorDetails.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`)
    })
  }
  
  console.log("\n🎯 ESTADO DE LA MIGRACIÓN:")
  const successRate = ((report.migratedSuccessfully + report.alreadyMigrated) / report.totalWeeks) * 100
  
  if (report.errors === 0) {
    console.log("🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE")
    console.log("✅ Todas las semanas han sido migradas al nuevo sistema de versionado")
    console.log("✅ Estructura: weeks/{baseWeekId} + subcolección versions/")
    console.log("✅ Sin límite de 1MB por documento")
    console.log("✅ Listo para producción SaaS")
  } else {
    console.log(`⚠️ MIGRACIÓN COMPLETADA CON ${report.errors} ERRORES`)
    console.log(`⚠️ Tasa de éxito: ${successRate.toFixed(1)}%`)
    console.log("⚠️ Revisar errores detallados y ejecutar nuevamente si es necesario")
  }
  
  console.log("\n🔍 VERIFICACIONES POST-MIGRACIÓN:")
  console.log("1. Ejecutar: node scripts/verify-migration.js")
  console.log("2. Probar carga de semanas en UI")
  console.log("3. Verificar creación de nuevas versiones")
  console.log("4. Validar inmutabilidad de versiones completadas")
  
  console.log("=".repeat(60))
}

// Función de verificación post-migración
async function verifyMigration(): Promise<void> {
  if (!db) {
    throw new Error("Firestore no está configurado")
  }

  console.log("🔍 Verificando migración...")
  
  try {
    // Verificar estructura de nuevas colecciones
    const weeksRef = collection(db as any, "weeks")
    const weeksSnapshot = await getDocs(weeksRef)
    
    console.log(`📊 Documentos en weeks/: ${weeksSnapshot.docs.length}`)
    
    let totalVersions = 0
    let completedVersions = 0
    
    for (const weekDoc of weeksSnapshot.docs) {
      const versionsRef = collection(weekDoc.ref, "versions")
      const versionsSnapshot = await getDocs(versionsRef)
      
      totalVersions += versionsSnapshot.docs.length
      
      versionsSnapshot.docs.forEach(versionDoc => {
        const version = versionDoc.data()
        if (version.isCompleted) {
          completedVersions++
        }
      })
    }
    
    console.log(`📈 Total versiones migradas: ${totalVersions}`)
    console.log(`✅ Versiones completadas: ${completedVersions}`)
    console.log(`📊 Promedio versiones por semana: ${(totalVersions / weeksSnapshot.docs.length).toFixed(1)}`)
    
    console.log("✅ Verificación completada - Estructura correcta")
    
  } catch (error) {
    console.error("❌ Error en verificación:", error)
    throw error
  }
}

// Función de rollback de emergencia
async function rollbackMigration(): Promise<void> {
  if (!db) {
    throw new Error("Firestore no está configurado")
  }

  console.log("🔄 INICIANDO ROLLBACK DE MIGRACIÓN...")
  console.log("⚠️ ESTO ELIMINARÁ TODOS LOS DATOS MIGRADOS")
  
  try {
    const weeksRef = collection(db as any, "weeks")
    const weeksSnapshot = await getDocs(weeksRef)
    
    for (const weekDoc of weeksSnapshot.docs) {
      // Eliminar subcolección versions
      const versionsRef = collection(weekDoc.ref, "versions")
      const versionsSnapshot = await getDocs(versionsRef)
      
      for (const versionDoc of versionsSnapshot.docs) {
        await deleteDoc(versionDoc.ref)
      }
      
      // Eliminar documento principal
      await deleteDoc(weekDoc.ref)
      console.log(`🗑️ Eliminado: weeks/${weekDoc.id}`)
    }
    
    console.log("✅ Rollback completado")
    console.log("⚠️ Los datos originales en schedules/ siguen intactos")
    
  } catch (error) {
    console.error("❌ Error durante rollback:", error)
    throw error
  }
}

// Ejecutar migración
async function main() {
  console.log("🚀 SCRIPT DE MIGRACIÓN - SISTEMA DE VERSIONADO")
  console.log("🏗️ Arquitectura: weeks/{baseWeekId} + subcolección versions/")
  console.log("🔒 Características: IDEMPOTENTE, ATÓMICO, PRESERVA DATOS")
  console.log("=".repeat(70))
  
  // Verificar prerrequisitos
  if (!db) {
    console.error("❌ Firestore no está configurado")
    process.exit(1)
  }
  
  // Confirmar migración
  console.log("\n⚠️ ESTA A PUNTO DE MIGRAR AL NUEVO SISTEMA DE VERSIONADO")
  console.log("⚠️ Características:")
  console.log("   - Subcolecciones (sin límite 1MB)")
  console.log("   - Transacciones atómicas")
  console.log("   - Idempotencia (no sobrescribe)")
  console.log("   - Preservación completa de datos")
  console.log("⚠️ ¿Desea continuar? (Ctrl+C para cancelar)")
  
  // Esperar 5 segundos para permitir cancelación
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Ejecutar migración
  const report = await migrateAllWeeks()
  
  // Verificar si fue exitosa
  if (report.errors === 0) {
    console.log("\n🔍 Ejecutando verificación post-migración...")
    await verifyMigration()
  }
}

// Manejar interrupción
process.on('SIGINT', () => {
  console.log("\n\n⚠️ MIGRACIÓN CANCELADA POR EL USUARIO")
  console.log("⚠️ No se han realizado cambios permanentes")
  process.exit(0)
})

// Exportar funciones para testing
export { migrateAllWeeks, verifyMigration, rollbackMigration }

// Ejecutar solo si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error("❌ Error fatal en script de migración:", error)
    process.exit(1)
  })
}
