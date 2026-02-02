import { useState, useEffect } from "react"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useOwnerId } from "./use-owner-id"
import { createValidDocRef, normalizeFirestoreId } from "@/lib/firestore-helpers"

export interface Settings {
  publishedWeekId?: string
  updatedAt?: any
  updatedBy?: string
}

export interface UseSettingsReturn {
  settings: Settings | null
  isLoading: boolean
  updatePublishedWeek: (weekId: string) => Promise<void>
  refreshSettings: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const ownerId = useOwnerId()

  const loadSettings = async () => {
    try {
      if (!db) {
        console.warn("Firestore not available")
        setIsLoading(false)
        return
      }

      if (!ownerId) {
        console.warn("🔧 [useSettings] ownerId not available yet")
        setIsLoading(false)
        return
      }

      console.log("🔧 [useSettings] Loading settings for ownerId:", ownerId)
      
      // Usar path consistente: apps/horarios/{ownerId}/settings
      const settingsRef = createValidDocRef(db, "apps", "horarios", normalizeFirestoreId(ownerId), "settings")
      console.log("🔧 [useSettings] Settings ref created successfully")
      
      const settingsDoc = await getDoc(settingsRef)
      
      if (settingsDoc.exists()) {
        console.log("🔧 [useSettings] Settings found:", settingsDoc.data())
        setSettings(settingsDoc.data() as Settings)
      } else {
        console.log("🔧 [useSettings] No settings found, creating empty")
        // Crear settings si no existen
        const initialSettings: Settings = {}
        setSettings(initialSettings)
      }
    } catch (error) {
      console.error("🔧 [useSettings] Error loading settings:", error)
      setSettings(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [ownerId]) // Disparar cuando ownerId cambie

  const updatePublishedWeek = async (weekId: string) => {
    try {
      if (!db) {
        throw new Error("Firestore not available")
      }

      if (!ownerId) {
        throw new Error("ownerId not available")
      }

      console.log("🔧 [useSettings] Updating published week:", weekId, "for ownerId:", ownerId)
      
      const settingsRef = createValidDocRef(db, "apps", "horarios", normalizeFirestoreId(ownerId), "settings")
      
      await updateDoc(settingsRef, {
        publishedWeekId: weekId,
        updatedAt: serverTimestamp()
      })
      
      console.log("🔧 [useSettings] Published week updated successfully")
      
      // Actualizar estado local
      setSettings(prev => prev ? { ...prev, publishedWeekId: weekId } : { publishedWeekId: weekId })
    } catch (error) {
      console.error("🔧 [useSettings] Error updating published week:", error)
      throw error
    }
  }

  const refreshSettings = async () => {
    setIsLoading(true)
    await loadSettings()
  }

  return {
    settings,
    isLoading,
    updatePublishedWeek,
    refreshSettings
  }
}
