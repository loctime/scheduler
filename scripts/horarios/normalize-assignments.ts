/**
 * Script para normalizar assignments incompletos usando turnos base
 * 
 * Uso:
 *   npx tsx scripts/normalize-assignments.ts [--dry-run] [--schedule-id=<id>]
 * 
 * Opciones:
 *   --dry-run: Solo muestra qué se normalizaría sin hacer cambios
 *   --schedule-id=<id>: Normaliza solo un schedule específico
 * 
 * Este script normaliza assignments incompletos copiando la estructura completa
 * del turno base, asegurando que los assignments sean autosuficientes.
 */

import { initializeApp, getApps } from "firebase/app"
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore"
import { detectIncompleteAssignments, normalizeAssignmentFromShift } from "../lib/assignment-utils"
import { Horario, Turno, ShiftAssignment } from "../lib/types"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

interface NormalizationResult {
  scheduleId: string
  scheduleName: string
  normalized: number
  skipped: number
  errors: string[]
}

async function normalizeSchedule(
  db: any,
  scheduleId: string,
  schedule: Horario,
  shifts: Map<string, Turno>,
  dryRun: boolean
): Promise<NormalizationResult> {
  const result: NormalizationResult = {
    scheduleId,
    scheduleName: schedule.nombre || `Schedule ${scheduleId}`,
    normalized: 0,
    skipped: 0,
    errors: [],
  }

  if (!schedule.assignments) {
    return result
  }

  const incomplete = detectIncompleteAssignments(schedule)
  if (incomplete.length === 0) {
    return result
  }

  // Crear copia de assignments para modificar
  const updatedAssignments: typeof schedule.assignments = JSON.parse(JSON.stringify(schedule.assignments))

  // Normalizar cada assignment incompleto
  for (const item of incomplete) {
    const { date, employeeId, assignment } = item

    // Solo normalizar assignments de tipo "shift" con shiftId
    if (assignment.type !== "shift" || !assignment.shiftId) {
      result.skipped++
      continue
    }

    const shift = shifts.get(assignment.shiftId)
    if (!shift) {
      result.errors.push(
        `Turno base no encontrado: ${assignment.shiftId} en ${date} | ${employeeId}`
      )
      result.skipped++
      continue
    }

    // Normalizar el assignment
    const normalized = normalizeAssignmentFromShift(assignment, shift)

    // Actualizar en la estructura de assignments
    if (!updatedAssignments[date]) {
      updatedAssignments[date] = {}
    }
    if (!updatedAssignments[date][employeeId]) {
      updatedAssignments[date][employeeId] = []
    }

    const assignments = updatedAssignments[date][employeeId] as ShiftAssignment[]
    const index = assignments.findIndex((a) => {
      // Buscar el assignment exacto para reemplazarlo
      return (
        a.type === assignment.type &&
        a.shiftId === assignment.shiftId &&
        a.startTime === assignment.startTime &&
        a.endTime === assignment.endTime
      )
    })

    if (index >= 0) {
      assignments[index] = normalized
      result.normalized++
    } else {
      result.errors.push(
        `No se encontró el assignment para reemplazar en ${date} | ${employeeId}`
      )
      result.skipped++
    }
  }

  // Guardar cambios si no es dry-run
  if (!dryRun && result.normalized > 0) {
    try {
      const scheduleRef = doc(db, "apps/horarios/schedules", scheduleId)
      await updateDoc(scheduleRef, {
        assignments: updatedAssignments,
        updatedAt: new Date(),
      })
    } catch (error) {
      result.errors.push(`Error al guardar: ${error}`)
    }
  }

  return result
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const scheduleIdArg = args.find((arg) => arg.startsWith("--schedule-id="))
  const targetScheduleId = scheduleIdArg?.split("=")[1]

  console.log("🔄 Iniciando normalización de assignments...\n")
  if (dryRun) {
    console.log("⚠️  MODO DRY-RUN: No se realizarán cambios\n")
  }

  // Inicializar Firebase
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  const db = getFirestore(app)

  // Cargar todos los turnos
  console.log("📥 Cargando turnos...")
  const shiftsRef = collection(db, "apps/horarios/shifts")
  const shiftsSnapshot = await getDocs(shiftsRef)
  const shifts = new Map<string, Turno>()
  for (const docSnapshot of shiftsSnapshot.docs) {
    const shift = { id: docSnapshot.id, ...docSnapshot.data() } as Turno
    shifts.set(shift.id, shift)
  }
  console.log(`✅ Cargados ${shifts.size} turnos\n`)

  // Obtener schedules
  let schedulesSnapshot
  if (targetScheduleId) {
    console.log(`📥 Cargando schedule específico: ${targetScheduleId}...`)
    const scheduleDoc = await getDoc(doc(db, "apps/horarios/schedules", targetScheduleId))
    if (!scheduleDoc.exists()) {
      console.error(`❌ Schedule no encontrado: ${targetScheduleId}`)
      process.exit(1)
    }
    schedulesSnapshot = {
      docs: [{ id: scheduleDoc.id, data: () => scheduleDoc.data() }],
      size: 1,
    } as any
  } else {
    console.log("📥 Cargando todos los schedules...")
    const schedulesRef = collection(db, "apps/horarios/schedules")
    schedulesSnapshot = await getDocs(schedulesRef)
  }
  console.log(`✅ Cargados ${schedulesSnapshot.size} schedule(s)\n`)

  const results: NormalizationResult[] = []

  // Procesar cada schedule
  for (const docSnapshot of schedulesSnapshot.docs) {
    const scheduleData = docSnapshot.data() as Horario
    const scheduleId = docSnapshot.id

    console.log(`🔄 Procesando: ${scheduleData.nombre || scheduleId}...`)

    const result = await normalizeSchedule(db, scheduleId, scheduleData, shifts, dryRun)
    results.push(result)

    if (result.normalized > 0) {
      console.log(`   ✅ Normalizados: ${result.normalized}`)
    }
    if (result.skipped > 0) {
      console.log(`   ⏭️  Omitidos: ${result.skipped}`)
    }
    if (result.errors.length > 0) {
      console.log(`   ❌ Errores: ${result.errors.length}`)
      for (const error of result.errors) {
        console.log(`      - ${error}`)
      }
    }
    console.log("")
  }

  // Resumen final
  const totalNormalized = results.reduce((sum, r) => sum + r.normalized, 0)
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

  console.log("=".repeat(60))
  console.log("📊 RESUMEN")
  console.log("=".repeat(60))
  console.log(`Schedules procesados: ${results.length}`)
  console.log(`Assignments normalizados: ${totalNormalized}`)
  console.log(`Assignments omitidos: ${totalSkipped}`)
  console.log(`Errores: ${totalErrors}`)
  if (dryRun) {
    console.log("\n⚠️  Este fue un DRY-RUN. No se realizaron cambios.")
    console.log("   Ejecuta sin --dry-run para aplicar los cambios.")
  }
  console.log("=".repeat(60) + "\n")
}

main().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})
