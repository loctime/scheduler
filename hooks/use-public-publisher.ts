import { useState } from "react"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useOwnerId } from "./use-owner-id"
import { useData } from "@/contexts/data-context"
import { normalizeCompanySlug } from "@/lib/public-company"

export interface PublishPublicScheduleOptions {
  companyName?: string
  weekId: string
  weekData: any
  publicImageUrl?: string
  employees?: Array<{id: string, name: string}>
}

export interface UsePublicPublisherReturn {
  publishToPublic: (options: PublishPublicScheduleOptions) => Promise<string>
  isPublishing: boolean
  error: string | null
}

export function usePublicPublisher(): UsePublicPublisherReturn {
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownerId = useOwnerId()
  const { user } = useData()

  console.log("🔧 [usePublicPublisher] Hook inicializado", { 
    hasOwnerId: !!ownerId,
    ownerId: ownerId?.substring(0, 10) + '...', // .Solo mostrar primeros 10 chars por seguridad
    hasUser: !!user,
    userId: user?.uid?.substring(0, 10) + '...'
  })

  const publishToPublic = async (options: PublishPublicScheduleOptions): Promise<string> => {
    console.log("🔧 [usePublicPublisher] publishToPublic llamado con:", {
      weekId: options.weekId,
      hasWeekData: !!options.weekData,
      weekDataSize: options.weekData ? JSON.stringify(options.weekData).length : 0,
      weekDataKeys: options.weekData ? Object.keys(options.weekData) : []
    })

    if (!ownerId) {
      console.error("🔧 [usePublicPublisher] Error: No ownerId disponible")
      throw new Error("No se puede publicar sin ownerId")
    }

    if (!db) {
      console.error("🔧 [usePublicPublisher] Error: Firestore no disponible")
      throw new Error("Firestore no disponible")
    }

    // Validación obligatoria: debe haber weekData
    if (!options.weekData) {
      console.error("🔧 [usePublicPublisher] Error: No weekData proporcionado")
      throw new Error("No hay datos de semana para publicar")
    }

    setIsPublishing(true)
    setError(null)

    try {
      // Generar companySlug a partir del companyName
      const companySlug = normalizeCompanySlug(options.companyName || "")
      console.log("🔧 [usePublicPublisher] CompanySlug generado:", companySlug)
      
      // Guardar companySlug en la configuración de la empresa
      const configRef = doc(db, "settings", "main")
      await setDoc(configRef, {
        publicSlug: companySlug,
        companyName: options.companyName,
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      console.log("🔧 [usePublicPublisher] CompanySlug guardado en configuración:", companySlug)
      console.log("🔧 [usePublicPublisher] WeekId:", options.weekId)
      console.log("🔧 [usePublicPublisher] Has publicImageUrl:", !!options.publicImageUrl)
      
      // Path EXACTO: apps/horarios/enlaces_publicos/{ownerId} (3 segmentos - válido)
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
        companyName: options.companyName || ""
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
        console.log("🔧 [usePublicPublisher] Saved document keys:", Object.keys(savedData || {}))
        console.log("🔧 [usePublicPublisher] Has weeks in saved doc:", !!(savedData?.weeks))
        if (savedData?.weeks) {
          console.log("🔧 [usePublicPublisher] Saved weeks keys:", Object.keys(savedData.weeks))
          const weekData = savedData.weeks[options.weekId]
          if (weekData) {
            console.log("🔧 [usePublicPublisher] Week has publicImageUrl:", !!weekData.publicImageUrl)
            console.log("🔧 [usePublicPublisher] Image URL length:", weekData.publicImageUrl?.length || 0)
          }
        }
      }
      
      // Logs detallados para verificar qué se guardó
      console.log("🔧 [usePublicPublisher] Publish success - document written to:", fullPath)
      console.log("🔧 [usePublicPublisher] Document path:", publicRef.path)
      console.log("🔧 [usePublicPublisher] Saved data keys:", Object.keys(publicScheduleData))
      console.log("🔧 [usePublicPublisher] Weeks keys:", Object.keys(publicScheduleData.weeks))
      console.log("🔧 [usePublicPublisher] Week data keys:", Object.keys(publicScheduleData.weeks[options.weekId]))
      console.log("🔧 [usePublicPublisher] Has publicImageUrl:", !!publicScheduleData.weeks[options.weekId].publicImageUrl)
      console.log("🔧 [usePublicPublisher] PublicImageUrl length:", publicScheduleData.weeks[options.weekId].publicImageUrl?.length || 0)
      console.log("🔧 [usePublicPublisher] PublicImageUrl prefix:", publicScheduleData.weeks[options.weekId].publicImageUrl?.substring(0, 50) + "...")
      console.log("🔧 [usePublicPublisher] PublicImageUrl saved successfully:", !!options.publicImageUrl)
      
      return companySlug // Retornar el companySlug para generar URL pública
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al publicar"
      setError(errorMessage)
      console.error("🔧 [usePublicPublisher] Publish error:", err)
      console.error("🔧 [usePublicPublisher] Error details:", {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        ownerId: ownerId?.substring(0, 10) + '...'
      })
      throw new Error(errorMessage)
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
