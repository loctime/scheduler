import { useState, useCallback } from "react"

interface UseDragAndDropProps {
  readonly: boolean
  orderedItemIds: string[]
  onOrderUpdate: (newOrder: string[]) => void
}

export function useDragAndDrop({ readonly, orderedItemIds, onOrderUpdate }: UseDragAndDropProps) {
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null)
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<string | null>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent, employeeId: string) => {
      if (readonly) return
      setDraggedEmployeeId(employeeId)
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", employeeId)
      // Hacer el elemento semi-transparente mientras se arrastra
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5"
      }
    },
    [readonly]
  )

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (readonly) return
    setDraggedEmployeeId(null)
    setDragOverEmployeeId(null)
    // Restaurar opacidad
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1"
    }
  }, [readonly])

  const handleDragOver = useCallback(
    (e: React.DragEvent, employeeId: string) => {
      if (readonly || !draggedEmployeeId || draggedEmployeeId === employeeId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOverEmployeeId(employeeId)
    },
    [readonly, draggedEmployeeId]
  )

  const handleDragLeave = useCallback(() => {
    setDragOverEmployeeId(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      if (readonly || !draggedEmployeeId || draggedEmployeeId === targetId) return
      e.preventDefault()

      const draggedIndex = orderedItemIds.indexOf(draggedEmployeeId)
      const targetIndex = orderedItemIds.indexOf(targetId)

      if (draggedIndex === -1 || targetIndex === -1) return

      // Reordenar el array
      const newOrder = [...orderedItemIds]
      const [removed] = newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, removed)

      setDraggedEmployeeId(null)
      setDragOverEmployeeId(null)

      // Guardar el nuevo orden
      onOrderUpdate(newOrder)
    },
    [readonly, draggedEmployeeId, orderedItemIds, onOrderUpdate]
  )

  return {
    draggedEmployeeId,
    dragOverEmployeeId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}

