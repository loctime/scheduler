import { useState } from "react"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
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

      // Path EXACTO: apps/horarios/enlaces_publicos/{ownerId}
      const fullPath = "apps/horarios/enlaces_publicos/" + ownerId
      console.log("🔧 [usePublicPublisher] Writing to:", fullPath)

      console.log("🔧 [usePublicPublisher] Datos a guardar:", {
        weekId: options.weekId,
        hasEmployees: !!(options.employees),
        employeesCount: options.employees?.length || 0,
        employees: options.employees,
        hasWeekDataEmployees: !!(options.weekData.employees),
        weekDataEmployeesCount: options.weekData.employees?.length || 0,
        weekDataEmployees: options.weekData.employees
      })

      // Estructura con weeks y publicImageUrl
      const weekData = {
        weekId: options.weekId,
        weekLabel: options.weekData.startDate && options.weekData.endDate 
          ? `${options.weekData.startDate} - ${options.weekData.endDate}`
          : `Semana ${options.weekId}`,
        publishedAt: serverTimestamp(),
        publicImageUrl: options.publicImageUrl || null,
        days: options.weekData.scheduleData?.assignments || options.weekData.assignments || {},
        dayStatus: options.weekData.scheduleData?.dayStatus || options.weekData.dayStatus || {},
        employees: options.employees || options.weekData.employees || []
      }

      console.log("🔧 [usePublicPublisher] weekData.employees final:", weekData.employees)

      const publicScheduleData = {
        ownerId: ownerId,
        publishedWeekId: options.weekId,
        weeks: {
          [options.weekId]: weekData
        },
        userId: user?.uid, // Requerido por las reglas de Firestore
        isPublic: true, // Flag para identificar como horario público
        companyName: options.companyName.trim()
      }

      console.log("🔧 [usePublicPublisher] Datos a publicar:", {
        ...publicScheduleData,
        publishedAt: "[Timestamp]",
        weeksCount: Object.keys(publicScheduleData.weeks).length,
        currentWeekId: publicScheduleData.publishedWeekId,
        hasPublicImageUrl: !!weekData.publicImageUrl,
        daysCount: Object.keys(weekData.days).length,
        employeesCount: weekData.employees.length
      })

      // Usar setDoc con overwrite completo en apps/horarios/enlaces_publicos/{ownerId}
      const publicRef = doc(db, "apps", "horarios", "enlaces_publicos", ownerId)
      console.log("🔧 [usePublicPublisher] Document reference created for apps/horarios/enlaces_publicos/" + ownerId)

      await setDoc(publicRef, publicScheduleData, { merge: true })

      // Verificar inmediatamente si el documento se guardó
      const savedDoc = await getDoc(publicRef)
      console.log("🔧 [usePublicPublisher] Document exists after save:", savedDoc.exists())
      if (savedDoc.exists()) {
        const savedData = savedDoc.data()
        console.log("🔧 [usePublicPublisher] Saved data verification:", {
          hasOwnerId: !!savedData.ownerId,
          hasPublishedWeekId: !!savedData.publishedWeekId,
          weeksCount: Object.keys(savedData.weeks || {}).length,
          isPublic: savedData.isPublic
        })
      } else {
        throw new Error("No se pudo verificar el guardado del documento")
      }

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
