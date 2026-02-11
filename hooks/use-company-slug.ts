import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

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
  }, [auth])

  return { companySlug, isLoading }
}
