"use client"

import { useState, useCallback, useRef } from "react"
import { Horario } from "@/lib/types"

interface UndoState {
  scheduleId: string
  assignments: Horario["assignments"]
  timestamp: number
  description: string
}

interface UseUndoRedoProps {
  maxHistorySize?: number
}

export function useUndoRedo({ maxHistorySize = 50 }: UseUndoRedoProps = {}) {
  const [undoStack, setUndoStack] = useState<UndoState[]>([])
  const [redoStack, setRedoStack] = useState<UndoState[]>([])
  const currentStateRef = useRef<UndoState | null>(null)

  const saveState = useCallback(
    (scheduleId: string, assignments: Horario["assignments"], description: string) => {
      const newState: UndoState = {
        scheduleId,
        assignments: JSON.parse(JSON.stringify(assignments)),
        timestamp: Date.now(),
        description,
      }

      setUndoStack((prev) => {
        const newStack = [newState, ...prev]
        return newStack.slice(0, maxHistorySize)
      })
      setRedoStack([])
      currentStateRef.current = newState
    },
    [maxHistorySize],
  )

  const undo = useCallback((): UndoState | null => {
    if (undoStack.length === 0) return null

    const stateToRestore = undoStack[0]
    setUndoStack((prev) => prev.slice(1))
    setRedoStack((prev) => {
      if (currentStateRef.current) {
        return [currentStateRef.current, ...prev]
      }
      return prev
    })
    currentStateRef.current = stateToRestore

    return stateToRestore
  }, [undoStack])

  const redo = useCallback((): UndoState | null => {
    if (redoStack.length === 0) return null

    const stateToRestore = redoStack[0]
    setRedoStack((prev) => prev.slice(1))
    setUndoStack((prev) => {
      if (currentStateRef.current) {
        return [currentStateRef.current, ...prev]
      }
      return [stateToRestore]
    })
    currentStateRef.current = stateToRestore

    return stateToRestore
  }, [redoStack])

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  const lastChangeDescription = undoStack[0]?.description || null

  const clearHistory = useCallback(() => {
    setUndoStack([])
    setRedoStack([])
    currentStateRef.current = null
  }, [])

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    lastChangeDescription,
    clearHistory,
  }
}



