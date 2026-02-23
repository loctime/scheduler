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
    if (!ownerId || !viewer?.employeeId) return null
    
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0')
    
    return `${ownerId}_${viewer.employeeId}_${dateStr}`
  }

  // Toggle completed status for an action
  const toggleCompleted = async (actionId: string) => {
    const docId = getDocumentId()
    if (!docId || !viewer?.employeeId || !db) return

    const isCompleted = completedIds.includes(actionId)
    const newCompletedIds = isCompleted 
      ? completedIds.filter(id => id !== actionId)
      : [...completedIds, actionId]

    // Update local state immediately for better UX
    setCompletedIds(newCompletedIds)

    // Update Firestore
    const docRef = doc(db, "apps/horarios/dailyActionStatus", docId)
    await setDoc(docRef, {
      ownerId,
      employeeId: viewer.employeeId,
      date: docId.split('_')[2], // Extract YYYYMMDD from docId
      completedActionIds: newCompletedIds,
      updatedAt: Timestamp.now()
    }, { merge: true })
  }

  // Listen to real-time updates
  useEffect(() => {
    if (!ownerId || !viewer?.employeeId || !db) {
      setIsLoading(false)
      return
    }

    const docId = getDocumentId()
    if (!docId) {
      setIsLoading(false)
      return
    }

    const docRef = doc(db, "apps/horarios/dailyActionStatus", docId)
    
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as DailyActionStatus
        setCompletedIds(data.completedActionIds || [])
      } else {
        // Document doesn't exist yet, start with empty array
        setCompletedIds([])
      }
      setIsLoading(false)
    }, (error) => {
      console.error("Error listening to daily action status:", error)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [ownerId, viewer?.employeeId])

  return {
    completedIds,
    toggleCompleted,
    isLoading
  }
}
