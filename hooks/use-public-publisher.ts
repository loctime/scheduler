import { useState } from "react"
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { createPublicCompanySlug } from "@/lib/public-companies"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export interface PublishPublicScheduleOptions {
  companyName: string
  weekId: string
  weekData: {
    startDate?: string
    endDate?: string
    scheduleData?: {
      assignments?: Record<string, any>
      dayStatus?: Record<string, any>
    }
    assignments?: Record<string, any>
    dayStatus?: Record<string, any>
    employees?: any[]
  }
  employees?: any[]
  publicImageUrl?: string | null
}

export interface UsePublicPublisherReturn {
  publishToPublic: (options: PublishPublicScheduleOptions) => Promise<string>
  isPublishing: boolean
  error: string | null
}

/**
 * Hook para publicar horario usando el nuevo sistema de companySlug
 * 
 * Características:
 * - Creación atómica de slug único
 * - Validación estricta de formato
 * - Manejo de colisiones con sufijos automáticos
 * - Transacción para garantizar consistencia
 */
export function usePublicPublisher(user: any): UsePublicPublisherReturn {
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publishToPublic = async (options: PublishPublicScheduleOptions): Promise<string> => {
    if (!user) {
      setError("Usuario no autenticado")
      throw new Error("Usuario no autenticado")
    }

    if (!db) {
      setError("Base de datos no disponible")
      throw new Error("Base de datos no disponible")
    }

    setIsPublishing(true)
    setError(null)

    try {
      // Obtener ownerId del usuario actual.
      // Fallback a user.uid para sesiones donde userData no viene embebido en `user`.
      const ownerId = getOwnerIdForActor(user, user?.userData) || user?.uid || null
      
      if (!ownerId) {
        setError("No se puede determinar el propietario")
        throw new Error("No se puede determinar el propietario")
      }

      // Validar companyName
      if (!options.companyName || options.companyName.trim().length === 0) {
        setError("El nombre de la empresa es requerido")
        throw new Error("El nombre de la empresa es requerido")
      }

      // Crear slug único usando el nuevo sistema atómico
      const companySlug = await createPublicCompanySlug(
        options.companyName.trim(),
        ownerId
      )

      console.log("🔧 [usePublicPublisher] CompanySlug único creado:", companySlug)
      console.log("🔧 [usePublicPublisher] WeekId:", options.weekId)
      console.log("🔧 [usePublicPublisher] Has publicImageUrl:", !!options.publicImageUrl)

      // Guardar el companySlug en la configuración (doc ID = ownerId, igual que configuracion)
      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
        await setDoc(configRef, {
          ownerId,
          publicSlug: companySlug,
          userId: user?.uid,
          updatedAt: serverTimestamp()
        }, { merge: true })
        console.log("🔧 [usePublicPublisher] CompanySlug guardado en config:", companySlug)
      } catch (configError) {
        console.warn("🔧 [usePublicPublisher] No se pudo guardar companySlug en config:", configError)
        // No fallar la publicación si no se puede guardar en config
      }

      // Primero leer el schedule original desde la colección privada
      const originalScheduleRef = doc(db, COLLECTIONS.SCHEDULES, options.weekId)
      const originalScheduleDoc = await getDoc(originalScheduleRef)
      
      if (!originalScheduleDoc.exists()) {
        setError("Horario no encontrado")
        throw new Error("Horario no encontrado")
      }
      
      const originalSchedule = originalScheduleDoc.data()
      console.log("🔧 [usePublicPublisher] Schedule original leído:", {
        weekId: options.weekId,
        hasAssignments: !!originalSchedule.assignments,
        assignmentsCount: Object.keys(originalSchedule.assignments || {}).length
      })

      // Crear documento público en la nueva estructura
      const publicSchedulePath = `apps/horarios/publicSchedules/${companySlug}/weeks/${options.weekId}`
      const publicScheduleRef = doc(db, publicSchedulePath)
      
      // Firestore no acepta undefined: usar null o derivar weekEnd desde weekStart si falta
      const weekStart = originalSchedule.weekStart ?? null
      let weekEnd = originalSchedule.weekEnd ?? null
      if (weekStart && !weekEnd) {
        const start = new Date(weekStart + "T12:00:00")
        start.setDate(start.getDate() + 6)
        weekEnd = start.toISOString().slice(0, 10)
      }
      // Las reglas exigen request.resource.data.ownerId == request.auth.uid
      const publicScheduleData = {
        ownerId: user?.uid,
        weekStart,
        weekEnd,
        assignments: originalSchedule.assignments || {},
        employeesSnapshot: originalSchedule.employeesSnapshot || [],
        ordenEmpleadosSnapshot: originalSchedule.ordenEmpleadosSnapshot || [],
        publishedAt: serverTimestamp(),
        publishedBy: user?.uid,
        companyName: options.companyName.trim()
      }
      
      console.log("🔧 [usePublicPublisher] Escribiendo schedule público en:", publicSchedulePath)
      console.log("🔧 [usePublicPublisher] Datos públicos:", {
        weekStart: publicScheduleData.weekStart,
        weekEnd: publicScheduleData.weekEnd,
        hasAssignments: !!publicScheduleData.assignments,
        assignmentsCount: Object.keys(publicScheduleData.assignments || {}).length,
        employeesCount: publicScheduleData.employeesSnapshot.length
      })

      await setDoc(publicScheduleRef, publicScheduleData)
      
      // Verificar inmediatamente si el documento se guardó
      const savedDoc = await getDoc(publicScheduleRef)
      console.log("🔧 [usePublicPublisher] Verificación de escritura en publicSchedules:", {
        path: publicSchedulePath,
        exists: savedDoc.exists(),
        hasData: savedDoc.exists() ? Object.keys(savedDoc.data() || {}).length : 0
      })
      
      if (!savedDoc.exists()) {
        console.error("❌ [usePublicPublisher] ERROR: No se pudo guardar el documento en publicSchedules")
        throw new Error("No se pudo guardar el documento en publicSchedules")
      }

      // Mantener enlaces_publicos con datos completos para que la PWA pueda leerlos
      // La PWA (usePublicHorario) lee de aquí y espera weeks[weekId].days (asignaciones)
      const employeesForLegacy = options.employees?.length
        ? options.employees
        : (originalSchedule.employeesSnapshot || []).map((e: any) => ({
            id: e.id || e.employeeId,
            name: e.name || e.displayName || e.id || 'Empleado'
          })).filter((e: any) => e.id)

      // Incluir turnos (id, name, color) para que la PWA muestre el color real en "Horario de Hoy"
      let shiftsSnapshot: Array<{ id: string; name: string; color: string }> = []
      try {
        const shiftsQuery = query(
          collection(db, COLLECTIONS.SHIFTS),
          where("ownerId", "==", ownerId)
        )
        const shiftsSnap = await getDocs(shiftsQuery)
        shiftsSnapshot = shiftsSnap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, name: (data.name as string) || "", color: (data.color as string) || "#9ca3af" }
        })
      } catch (shiftsErr) {
        console.warn("🔧 [usePublicPublisher] No se pudieron cargar turnos para snapshot:", shiftsErr)
      }

      const legacyPublicData = {
        ownerId: ownerId,
        publishedWeekId: options.weekId,
        weeks: {
          [options.weekId]: {
            weekId: options.weekId,
            weekLabel: options.weekData.startDate && options.weekData.endDate
              ? `${options.weekData.startDate} - ${options.weekData.endDate}`
              : `Semana ${options.weekId}`,
            publishedAt: serverTimestamp(),
            publicImageUrl: options.publicImageUrl || null,
            days: originalSchedule.assignments || {},
            dayStatus: originalSchedule.dayStatus || {},
            employees: employeesForLegacy,
            shifts: shiftsSnapshot
          }
        },
        userId: user?.uid,
        isPublic: true,
        activo: true, // Requerido por reglas Firestore para lectura pública (PWA mensual)
        companyName: options.companyName.trim()
      }

      const legacyRef = doc(db, "apps", "horarios", "enlaces_publicos", ownerId)
      await setDoc(legacyRef, legacyPublicData, { merge: true })
      
      // Verificar el documento legacy también
      const legacySavedDoc = await getDoc(legacyRef)
      console.log("🔧 [usePublicPublisher] Verificación de escritura en enlaces_publicos:", {
        path: `apps/horarios/enlaces_publicos/${ownerId}`,
        exists: legacySavedDoc.exists(),
        hasData: legacySavedDoc.exists() ? Object.keys(legacySavedDoc.data() || {}).length : 0,
        hasWeeks: legacySavedDoc.exists() ? Object.keys(legacySavedDoc.data()?.weeks || {}).length : 0
      })

      console.log("✅ [usePublicPublisher] Publicación completada exitosamente")
      return companySlug

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("❌ [usePublicPublisher] Error en publicación:", err)
      setError(errorMessage)
      throw err
    } finally {
      setIsPublishing(false)
    }
  }

  return {
    publishToPublic,
    isPublishing,
    error
  }
}
