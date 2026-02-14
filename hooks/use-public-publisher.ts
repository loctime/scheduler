import { useState } from "react"
import { doc, setDoc, serverTimestamp, getDoc, deleteField, collection, query, where, getDocs } from "firebase/firestore"
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
        companyName: options.companyName.trim(),
        publicImageUrl: options.publicImageUrl ?? null
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

      // Enlaces públicos: solo metadata (sin weeks) para no superar 1MB por documento.
      // La PWA lee cada semana desde publicSchedules/{companySlug}/weeks/{weekId}.
      const legacyRef = doc(db, "apps", "horarios", "enlaces_publicos", ownerId)
      const existingLegacy = await getDoc(legacyRef)
      const existingData = existingLegacy.exists() ? existingLegacy.data() : {}
      const existingWeekIds: string[] = Array.isArray(existingData.publishedWeekIds)
        ? existingData.publishedWeekIds
        : existingData.weeks ? Object.keys(existingData.weeks) : []
      const publishedWeekIds = existingWeekIds.includes(options.weekId)
        ? existingWeekIds
        : [options.weekId, ...existingWeekIds].slice(0, 104) // máx. ~2 años de semanas

      const legacyPublicData = {
        ownerId,
        companySlug,
        publishedWeekId: options.weekId,
        publishedWeekIds,
        userId: user?.uid,
        isPublic: true,
        activo: true,
        companyName: options.companyName.trim(),
        lastPublishedAt: serverTimestamp(),
        weeks: deleteField() // quitar blob antiguo para no superar 1MB
      }

      await setDoc(legacyRef, legacyPublicData, { merge: true })
      console.log("🔧 [usePublicPublisher] Metadata en enlaces_publicos actualizada (sin weeks):", {
        path: `apps/horarios/enlaces_publicos/${ownerId}`,
        publishedWeekIds: publishedWeekIds.length
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
