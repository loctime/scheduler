import { useState, useCallback } from "react"
import { Separador } from "@/lib/types"

interface UseSeparatorsProps {
  readonly: boolean
  orderedItemIds: string[]
  separadorMap: Map<string, Separador>
  addSeparator?: (nombre: string, tipo?: "puesto" | "personalizado", color?: string) => Promise<Separador | null>
  updateSeparator?: (id: string, separator: Partial<Separador> & { nombre: string }) => Promise<void>
  deleteSeparator?: (id: string) => Promise<void>
  onOrderUpdate: (newOrder: string[]) => void
}

export function useSeparators({
  readonly,
  orderedItemIds,
  separadorMap,
  addSeparator,
  updateSeparator,
  deleteSeparator,
  onOrderUpdate,
}: UseSeparatorsProps) {
  const [editingSeparatorId, setEditingSeparatorId] = useState<string | null>(null)
  const [separatorEditName, setSeparatorEditName] = useState("")
  const [separatorEditColor, setSeparatorEditColor] = useState("")

  // Handler para agregar separador en una posición específica
  const handleAddSeparator = useCallback(
    async (position: number) => {
      if (readonly || !addSeparator) return

      const nombre = "SEPARADOR"
      const newSeparator = await addSeparator(nombre, undefined, undefined)
      if (!newSeparator) return

      // Insertar el separador en la posición indicada
      const newOrder = [...orderedItemIds]
      newOrder.splice(position, 0, newSeparator.id)

      onOrderUpdate(newOrder)
    },
    [readonly, addSeparator, orderedItemIds, onOrderUpdate]
  )

  // Handler para editar separador
  const handleEditSeparator = useCallback((separator: Separador) => {
    setEditingSeparatorId(separator.id)
    setSeparatorEditName(separator.nombre)
    setSeparatorEditColor(separator.color || "")
  }, [])

  // Handler para guardar edición de separador
  const handleSaveSeparatorEdit = useCallback(async () => {
    if (!editingSeparatorId || !updateSeparator || !separatorEditName.trim()) {
      setEditingSeparatorId(null)
      setSeparatorEditName("")
      setSeparatorEditColor("")
      return
    }

    const separator = separadorMap.get(editingSeparatorId)
    if (!separator) {
      setEditingSeparatorId(null)
      setSeparatorEditName("")
      setSeparatorEditColor("")
      return
    }

    await updateSeparator(editingSeparatorId, {
      ...separator,
      nombre: separatorEditName.trim(),
      color: separatorEditColor.trim() || undefined,
    })

    setEditingSeparatorId(null)
    setSeparatorEditName("")
    setSeparatorEditColor("")
  }, [editingSeparatorId, separatorEditName, separatorEditColor, updateSeparator, separadorMap])

  // Handler para cancelar edición
  const handleCancelEdit = useCallback(() => {
    setEditingSeparatorId(null)
    setSeparatorEditName("")
    setSeparatorEditColor("")
  }, [])

  // Handler para eliminar separador
  const handleDeleteSeparator = useCallback(
    async (separatorId: string) => {
      if (readonly || !deleteSeparator) return

      await deleteSeparator(separatorId)

      // Remover del orden
      const newOrder = orderedItemIds.filter((id) => id !== separatorId)
      onOrderUpdate(newOrder)
    },
    [readonly, deleteSeparator, orderedItemIds, onOrderUpdate]
  )

  return {
    editingSeparatorId,
    separatorEditName,
    separatorEditColor,
    setSeparatorEditName,
    setSeparatorEditColor,
    handleAddSeparator,
    handleEditSeparator,
    handleSaveSeparatorEdit,
    handleCancelEdit,
    handleDeleteSeparator,
  }
}

