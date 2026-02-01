import { useState, useEffect } from "react"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

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

  const loadSettings = async () => {
    try {
      if (!db) {
        console.warn("Firestore not available")
        setIsLoading(false)
        return
      }

      const settingsRef = doc(db, "apps/horarios/settings/main")
      const settingsDoc = await getDoc(settingsRef)
      
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as Settings)
      } else {
        // Crear settings si no existen
        const initialSettings: Settings = {}
        setSettings(initialSettings)
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      setSettings(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const updatePublishedWeek = async (weekId: string) => {
    try {
      if (!db) {
        throw new Error("Firestore not available")
      }

      const settingsRef = doc(db, "apps/horarios/settings/main")
      
      await updateDoc(settingsRef, {
        publishedWeekId: weekId,
        updatedAt: serverTimestamp()
      })
      
      // Actualizar estado local
      setSettings(prev => prev ? { ...prev, publishedWeekId: weekId } : { publishedWeekId: weekId })
    } catch (error) {
      console.error("Error updating published week:", error)
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
