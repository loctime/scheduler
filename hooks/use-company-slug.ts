import { useState, useEffect } from "react"
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore"
import { auth, db, COLLECTIONS } from "@/lib/firebase"

export function useCompanySlug() {
  const [companySlug, setCompanySlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const user = auth?.currentUser
      if (!user || !db) {
        setIsLoading(false)
        return
      }

      try {
        // Buscar en la colección config donde se guarda el publicSlug
        const configQuery = query(
          collection(db, COLLECTIONS.CONFIG),
          where("publicSlug", "!=", null),
          where("userId", "==", user.uid),
          limit(1)
        )
        const querySnapshot = await getDocs(configQuery)
        
        if (!querySnapshot.empty) {
          const configDoc = querySnapshot.docs[0]
          const data = configDoc.data()
          if (data.publicSlug) {
            setCompanySlug(data.publicSlug)
          }
        }

      } catch (e) {
        console.error("Error cargando slug:", e)
      }

      setIsLoading(false)
    }

    load()
  }, [auth])

  return { companySlug, isLoading }
}
