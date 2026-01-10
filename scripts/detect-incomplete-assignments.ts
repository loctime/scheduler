/**
 * Script para detectar assignments incompletos en todos los schedules
 * 
 * Uso:
 *   npx tsx scripts/detect-incomplete-assignments.ts
 * 
 * Este script escanea todos los schedules en Firestore y detecta assignments incompletos
 * según el contrato v1.0 del sistema de horarios.
 */

import { initializeApp, getApps } from "firebase/app"
import { getFirestore, collection, getDocs } from "firebase/firestore"
import { detectIncompleteAssignments, IncompleteAssignment } from "../lib/assignment-utils"
import { Horario } from "../lib/types"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

async function main() {
  console.log("🔍 Iniciando detección de assignments incompletos...\n")

  // Inicializar Firebase
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  const db = getFirestore(app)

  // Obtener todos los schedules
  const schedulesRef = collection(db, "apps/horarios/schedules")
  const schedulesSnapshot = await getDocs(schedulesRef)

  console.log(`📊 Total de schedules encontrados: ${schedulesSnapshot.size}\n`)

  const allIncomplete: Array<{
    scheduleId: string
    scheduleName: string
    incomplete: IncompleteAssignment[]
  }> = []

  let totalIncomplete = 0

  // Procesar cada schedule
  for (const docSnapshot of schedulesSnapshot.docs) {
    const scheduleData = docSnapshot.data() as Horario
    const scheduleId = docSnapshot.id
    const scheduleName = scheduleData.nombre || `Schedule ${scheduleId}`

    const incomplete = detectIncompleteAssignments(scheduleData)

    if (incomplete.length > 0) {
      allIncomplete.push({
        scheduleId,
        scheduleName,
        incomplete,
      })
      totalIncomplete += incomplete.length
    }
  }

  // Mostrar resultados
  if (allIncomplete.length === 0) {
    console.log("✅ No se encontraron assignments incompletos. Todos los schedules están correctos.\n")
    return
  }

  console.log(`⚠️  Se encontraron ${totalIncomplete} assignments incompletos en ${allIncomplete.length} schedules:\n`)

  // Mostrar detalles por schedule
  for (const { scheduleId, scheduleName, incomplete } of allIncomplete) {
    console.log(`📅 Schedule: ${scheduleName} (ID: ${scheduleId})`)
    console.log(`   Assignments incompletos: ${incomplete.length}\n`)

    // Agrupar por razón
    const byReason = new Map<string, IncompleteAssignment[]>()
    for (const item of incomplete) {
      const key = item.reason
      if (!byReason.has(key)) {
        byReason.set(key, [])
      }
      byReason.get(key)!.push(item)
    }

    // Mostrar por razón
    for (const [reason, items] of byReason.entries()) {
      console.log(`   ❌ ${reason}: ${items.length} assignment(s)`)
      for (const item of items.slice(0, 5)) {
        console.log(`      - ${item.date} | Empleado: ${item.employeeId}`)
        console.log(`        Assignment: ${JSON.stringify(item.assignment, null, 2)}`)
      }
      if (items.length > 5) {
        console.log(`      ... y ${items.length - 5} más`)
      }
    }
    console.log("")
  }

  // Resumen final
  console.log("\n" + "=".repeat(60))
  console.log("📊 RESUMEN")
  console.log("=".repeat(60))
  console.log(`Total de schedules con problemas: ${allIncomplete.length}`)
  console.log(`Total de assignments incompletos: ${totalIncomplete}`)
  console.log("\n💡 Siguiente paso: Ejecutar scripts/normalize-assignments.ts para normalizar")
  console.log("=".repeat(60) + "\n")
}

main().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})
