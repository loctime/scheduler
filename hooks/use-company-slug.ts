import { useState, useEffect, useContext } from "react"
import { doc, getDoc } from "firebase/firestore"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { DataContext } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export function useCompanySlug() {
  const [companySlug, setCompanySlug] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const dataContext = useContext(DataContext)
  const userData = dataContext?.userData || null

  useEffect(() => {
    const load = async () => {
      const user = auth?.currentUser
      if (!user || !db) {
        setIsLoading(false)
        return
      }

      try {
        // Config se guarda con doc ID = ownerId (igual que configuracion)
        const ownerId = getOwnerIdForActor(user, userData) || user.uid
        const configRef = doc(db, COLLECTIONS.CONFIG, ownerId)
        const configSnap = await getDoc(configRef)

        if (configSnap.exists() && configSnap.data()?.publicSlug) {
          setCompanySlug(configSnap.data().publicSlug)
        }
      } catch (e) {
        console.error("Error cargando slug:", e)
      }

      setIsLoading(false)
    }

    load()
  }, [auth, userData])

  return { companySlug, isLoading }
}
