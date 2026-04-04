import { db } from "@/lib/firebase"
import { doc, getDoc, getDocs, collection, query, where, runTransaction, serverTimestamp } from "firebase/firestore"
import { WeekVersioningService } from "@/lib/week-versioning-service-fixed"

/**
 * Script de migración segura del sistema de semanas al nuevo versionado
 * 
 * Este script migra todas las semanas existentes del formato antiguo
 * al nuevo sistema de versiones inmutable.
 * 
 * Uso:
 * node scripts/migrate-to-week-versioning.js
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

async function migrateAllWeeks() {
  if (!db) {
    console.error("❌ Firestore no está configurado")
    return
  }

  console.log("🚀 Iniciando migración al sistema de versionado de semanas...")
  
  try {
    // Obtener todas las semanas existentes
    const schedulesRef = collection(db, "apps/horarios/schedules")
    const schedulesSnapshot = await getDocs(schedulesRef)
    
    console.log(`📊 Encontradas ${schedulesSnapshot.docs.length} semanas para migrar`)
    
    let migratedCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    // Procesar cada semana
    for (const scheduleDoc of schedulesSnapshot.docs) {
      const legacyWeek = scheduleDoc.data() as LegacyWeek
      const weekId = scheduleDoc.id
      
      try {
        console.log(`🔄 Migrando semana: ${weekId} (${legacyWeek.nombre})`)
        
        // Verificar si ya fue migrada
        const needsMigration = await WeekVersioningService.needsMigration(weekId)
        
        if (!needsMigration) {
          console.log(`✅ Semana ${weekId} ya migrada, omitiendo...`)
          continue
        }
        
        // Migrar al nuevo sistema
        const migrationSuccess = await WeekVersioningService.migrateFromLegacy(weekId, legacyWeek)
        
        if (migrationSuccess) {
          migratedCount++
          console.log(`✅ Semana ${weekId} migrada exitosamente`)
        } else {
          errorCount++
          const errorMsg = `Error migrando semana ${weekId}`
          errors.push(errorMsg)
          console.error(`❌ ${errorMsg}`)
        }
        
      } catch (error) {
        errorCount++
        const errorMsg = `Error procesando semana ${weekId}: ${error instanceof Error ? error.message : "Error desconocido"}`
        errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }
    
    // Reporte final
    console.log("\n" + "=".repeat(50))
    console.log("📋 REPORTE DE MIGRACIÓN")
    console.log("=".repeat(50))
    console.log(`📊 Total semanas procesadas: ${schedulesSnapshot.docs.length}`)
    console.log(`✅ Semanas migradas exitosamente: ${migratedCount}`)
    console.log(`❌ Semanas con errores: ${errorCount}`)
    
    if (errors.length > 0) {
      console.log("\n🚨 ERRORES DETALLADOS:")
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }
    
    console.log("\n🎯 RECOMENDACIONES:")
    console.log("1. Verificar que todas las semanas críticas hayan sido migradas")
    console.log("2. Probar el nuevo sistema de versionado en ambiente de staging")
    console.log("3. Realizar backup de la base de datos antes de producción")
    
    if (errorCount === 0) {
      console.log("\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE")
      console.log("✅ Todas las semanas han sido migradas al nuevo sistema de versionado")
      console.log("✅ El sistema antiguo puede ser desactivado después de verificar")
    } else {
      console.log("\n⚠️ MIGRACIÓN COMPLETADA CON ERRORES")
      console.log("⚠️ Revisar los errores detallados y ejecutar nuevamente si es necesario")
    }
    
    console.log("=".repeat(50))
    
  } catch (error) {
    console.error("❌ Error crítico durante la migración:", error)
    process.exit(1)
  }
}

// Función para verificar estado antes de migrar
async function checkMigrationPrerequisites() {
  console.log("🔍 Verificando prerrequisitos para migración...")
  
  if (!db) {
    console.error("❌ Firestore no está configurado")
    return false
  }
  
  try {
    // Verificar conexión a Firestore
    const testDoc = doc(db, "apps/horarios/_migration_test")
    await getDoc(testDoc)
    console.log("✅ Conexión a Firestore verificada")
    
    // Verificar colección de schedules
    const schedulesRef = collection(db, "apps/horarios/schedules")
    const schedulesSnapshot = await getDocs(schedulesRef)
    console.log(`✅ Colección schedules accesible: ${schedulesSnapshot.docs.length} documentos`)
    
    return true
  } catch (error) {
    console.error("❌ Error verificando prerrequisitos:", error)
    return false
  }
}

// Función para rollback en caso de error crítico
async function rollbackMigration() {
  console.log("🔄 Iniciando rollback de migración...")
  
  try {
    // Eliminar documentos migrados que puedan existir
    const weeksRef = collection(db, "weeks")
    const weeksSnapshot = await getDocs(weeksRef)
    
    for (const weekDoc of weeksSnapshot.docs) {
      await deleteDoc(weekDoc.ref)
      console.log(`🗑️ Eliminado documento migrado: ${weekDoc.id}`)
    }
    
    console.log("✅ Rollback completado")
  } catch (error) {
    console.error("❌ Error durante rollback:", error)
  }
}

// Ejecutar migración
async function main() {
  console.log("🚀 SCRIPT DE MIGRACIÓN A SISTEMA DE VERSIONADO")
  console.log("=".repeat(60))
  
  // Verificar prerrequisitos
  const prerequisitesOk = await checkMigrationPrerequisites()
  
  if (!prerequisitesOk) {
    console.error("❌ Prerrequisitos no cumplidos. Abortando migración.")
    process.exit(1)
  }
  
  // Confirmar migración
  console.log("\n⚠️ ESTA A PUNTO DE MIGRAR TODAS LAS SEMANAS AL NUEVO SISTEMA")
  console.log("⚠️ Se recomienda hacer backup de la base de datos antes de continuar")
  console.log("⚠️ ¿Desea continuar? (Ctrl+C para cancelar)")
  
  // Esperar 5 segundos para permitir cancelación
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Ejecutar migración
  await migrateAllWeeks()
}

// Manejar interrupción
process.on('SIGINT', () => {
  console.log("\n\n⚠️ MIGRACIÓN CANCELADA POR EL USUARIO")
  console.log("⚠️ No se han realizado cambios permanentes")
  process.exit(0)
})

// Ejecutar solo si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error("❌ Error fatal en script de migración:", error)
    process.exit(1)
  })
}
