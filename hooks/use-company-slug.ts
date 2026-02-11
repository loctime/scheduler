import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"

export function useCompanySlug() {
  const { user } = useAuth()
  const [companySlug, setCompanySlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user || !db) {
        setIsLoading(false)
        return
      }

      try {
        const userRef = doc(db, "apps/horarios/users", user.uid)
        const snap = await getDoc(userRef)

        if (snap.exists()) {
          const data = snap.data()
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
  }, [user])

  return { companySlug, isLoading }
}
