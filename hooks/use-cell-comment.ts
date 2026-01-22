import { doc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useState, useEffect } from "react"

export interface CellComment {
  ownerId: string
  employeeId: string
  date: string
  comment: string
  createdAt: any
  createdBy: string
  updatedAt?: any
}

export function useCellComment(ownerId: string, employeeId: string, date: string) {
  const [comment, setComment] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate deterministic ID: apps/horarios/solicitudes/{ownerId_employeeId_date}
  const docId = `${ownerId}_${employeeId}_${date}`
  
  if (!db) {
    return {
      comment: null,
      loading: false,
      error: "Firestore not available",
      saveComment: async () => {},
      deleteComment: async () => {},
    }
  }
  
  const docRef = doc(db, COLLECTIONS.SOLICITUDES, docId)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as CellComment
          setComment(data.comment)
        } else {
          setComment(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error("Error listening to comment:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [docId])

  const saveComment = async (commentText: string, userId: string) => {
    try {
      if (!commentText.trim()) {
        // If empty, delete the comment
        await deleteDoc(docRef)
        setComment(null)
      } else {
        // Save or update the comment
        const commentData: CellComment = {
          ownerId,
          employeeId,
          date,
          comment: commentText.trim(),
          createdAt: serverTimestamp(),
          createdBy: userId,
          updatedAt: serverTimestamp(),
        }

        await setDoc(docRef, commentData, { merge: true })
        setComment(commentText.trim())
      }
      setError(null)
    } catch (err: any) {
      console.error("Error saving comment:", err)
      setError(err.message)
      throw err
    }
  }

  const deleteComment = async () => {
    try {
      await deleteDoc(docRef)
      setComment(null)
      setError(null)
    } catch (err: any) {
      console.error("Error deleting comment:", err)
      setError(err.message)
      throw err
    }
  }

  return {
    comment,
    loading,
    error,
    saveComment,
    deleteComment,
  }
}
