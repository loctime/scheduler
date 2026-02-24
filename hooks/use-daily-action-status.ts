"use client"

import { useState, useEffect } from "react"
import { doc, setDoc, onSnapshot, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useViewer } from "@/components/pwa/PwaViewerBadge"

interface DailyActionStatus {
  ownerId: string
  employeeId: string
  date: string // YYYYMMDD
  completedActionIds: string[]
  updatedAt: Timestamp
}

export function useDailyActionStatus(ownerId: string) {
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const viewer = useViewer()

  // Generate document ID: ownerId_employeeId_YYYYMMDD
  const getDocumentId = () => {
    console.log("🔍 AUDITORÍA getDocumentId:")
    console.log("  - ownerId:", ownerId)
    console.log("  - viewer?.employeeId:", viewer?.employeeId)
    
    if (!ownerId || !viewer?.employeeId) {
      console.log("  ❌ Faltan datos para generar ID")
      return null
    }
    
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0')
    
    const docId = `${ownerId}_${viewer.employeeId}_${dateStr}`
    console.log("  - dateStr (YYYYMMDD):", dateStr)
    console.log("  - documentId generado:", docId)
    
    return docId
  }

  // Toggle completed status for an action
  const toggleCompleted = async (actionId: string) => {
    console.log("🔍 AUDITORÍA toggleCompleted:")
    console.log("  - actionId:", actionId)
    
    const docId = getDocumentId()
    if (!docId || !viewer?.employeeId || !db) {
      console.log("  ❌ No se puede ejecutar toggle - datos incompletos")
      return
    }

    const isCompleted = completedIds.includes(actionId)
    const newCompletedIds = isCompleted 
      ? completedIds.filter(id => id !== actionId)
      : [...completedIds, actionId]

    console.log("  - isCompleted (antes):", isCompleted)
    console.log("  - newCompletedIds (después):", newCompletedIds)

    // Update local state immediately for better UX
    setCompletedIds(newCompletedIds)

    // Update Firestore
    const docRef = doc(db, "apps/horarios/dailyActionStatus", docId)
    console.log("🔍 AUDITORÍA Firestore:")
    console.log("  - Actualizando documento:", docId)
    console.log("  - Datos a guardar:", {
      ownerId,
      employeeId: viewer.employeeId,
      date: docId.split('_')[2],
      completedActionIds: newCompletedIds,
      updatedAt: Timestamp.now()
    })
    
    await setDoc(docRef, {
      ownerId,
      employeeId: viewer.employeeId,
      date: docId.split('_')[2], // Extract YYYYMMDD from docId
      completedActionIds: newCompletedIds,
      updatedAt: Timestamp.now()
    }, { merge: true })
    
    console.log("  ✅ Documento actualizado en Firestore")
  }

  // Listen to real-time updates
  useEffect(() => {
    console.log("🔍 AUDITORÍA useEffect (listener):")
    console.log("  - ownerId:", ownerId)
    console.log("  - viewer?.employeeId:", viewer?.employeeId)
    console.log("  - db:", !!db)
    
    if (!ownerId || !viewer?.employeeId || !db) {
      console.log("  ❌ Condiciones no cumplidas para iniciar listener")
      setIsLoading(false)
      return
    }

    const docId = getDocumentId()
    if (!docId) {
      console.log("  ❌ No se pudo generar documentId")
      setIsLoading(false)
      return
    }

    console.log("  🎯 Iniciando listener para documento:", docId)
    const docRef = doc(db, "apps/horarios/dailyActionStatus", docId)
    
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      console.log("🔍 AUDITORÍA onSnapshot:")
      console.log("  - docSnapshot.exists():", docSnapshot.exists())
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as DailyActionStatus
        console.log("  - Datos del documento:", data)
        console.log("  - completedActionIds:", data.completedActionIds)
        setCompletedIds(data.completedActionIds || [])
      } else {
        console.log("  - Documento no existe - inicializando con array vacío")
        // Document doesn't exist yet, start with empty array
        setCompletedIds([])
      }
      setIsLoading(false)
    }, (error) => {
      console.error("Error listening to daily action status:", error)
      setIsLoading(false)
    })

    return () => {
      console.log("🔍 AUDITORÍA: Limpiando listener")
      unsubscribe()
    }
  }, [ownerId, viewer?.employeeId])

  return {
    completedIds,
    toggleCompleted,
    isLoading
  }
}
