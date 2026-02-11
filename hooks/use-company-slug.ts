import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

/**
 * Hook para obtener el companySlug de la configuración de la empresa
 * Si no existe, retorna el user.uid como fallback (compatibilidad temporal)
 */
export function useCompanySlug() {
  const [companySlug, setCompanySlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCompanySlug = async () => {
      try {
        if (!db) {
          console.warn("🔧 [useCompanySlug] Firestore no disponible")
          setIsLoading(false)
          return
        }

        // Intentar obtener el companySlug desde settings/main
        const configRef = doc(db, "settings", "main")
        const configDoc = await getDoc(configRef)
        
        if (configDoc.exists()) {
          const configData = configDoc.data()
          if (configData.publicSlug) {
            console.log("🔧 [useCompanySlug] CompanySlug encontrado:", configData.publicSlug)
            setCompanySlug(configData.publicSlug)
            setIsLoading(false)
            return
          }
        }

        console.log("🔧 [useCompanySlug] No se encontró companySlug en configuración")
        setIsLoading(false)
      } catch (error) {
        console.error("🔧 [useCompanySlug] Error cargando companySlug:", error)
        setIsLoading(false)
      }
    }

    loadCompanySlug()
  }, [])

  return { companySlug, isLoading }
}
