import { useState, useEffect, useRef } from "react"
import { Turno, ShiftAssignment } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { adjustTime } from "@/lib/utils"

interface UseShiftSelectorProps {
  selectedShiftIds: string[]
  selectedAssignments: ShiftAssignment[]
  shifts: Turno[]
  open: boolean
}

export function useShiftSelector({
  selectedShiftIds,
  selectedAssignments,
  shifts,
  open,
}: UseShiftSelectorProps) {
  const { config } = useConfig()
  const [tempSelected, setTempSelected] = useState<string[]>(selectedShiftIds)
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)
  const [adjustedTimes, setAdjustedTimes] = useState<Record<string, Partial<ShiftAssignment>>>({})
  const [extensions, setExtensions] = useState<Record<string, { before: boolean; after: boolean }>>({})
  const [specialType, setSpecialType] = useState<"shift" | "franco" | "medio_franco" | null>(null)
  const [medioFrancoTime, setMedioFrancoTime] = useState({ startTime: "", endTime: "" })
  const [selectedMedioTurnoId, setSelectedMedioTurnoId] = useState<string | null>(null)
  const prevOpenRef = useRef(false)

  // Inicializar cuando el diálogo se abre
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    
    if (justOpened) {
      // Verificar si hay asignaciones especiales
      const hasFranco = selectedAssignments.some(a => a.type === "franco")
      const hasMedioFranco = selectedAssignments.some(a => a.type === "medio_franco")
      
      if (hasFranco) {
        setSpecialType("franco")
        setTempSelected([])
        setMedioFrancoTime({ startTime: "", endTime: "" })
      } else if (hasMedioFranco) {
        const medioFranco = selectedAssignments.find(a => a.type === "medio_franco")
        setSpecialType("medio_franco")
        setTempSelected([])
        const startTime = medioFranco?.startTime || ""
        const endTime = medioFranco?.endTime || ""
        setMedioFrancoTime({ startTime, endTime })
        
        const matchingMedioTurno = config?.mediosTurnos?.find(
          mt => mt.startTime === startTime && mt.endTime === endTime
        )
        setSelectedMedioTurnoId(matchingMedioTurno?.id || null)
      } else {
        setSpecialType("shift")
        setTempSelected(selectedShiftIds)
        setMedioFrancoTime({ startTime: "", endTime: "" })
      }
      
      // Cargar horarios ajustados
      const adjusted: Record<string, Partial<ShiftAssignment>> = {}
      selectedAssignments.forEach((assignment) => {
        if (assignment.shiftId && assignment.type !== "franco" && assignment.type !== "medio_franco") {
          adjusted[assignment.shiftId] = {
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            startTime2: assignment.startTime2,
            endTime2: assignment.endTime2,
          }
        }
      })
      setAdjustedTimes(adjusted)
      setEditingShiftId(null)
      
      // Cargar estado de extensiones
      const loadedExtensions: Record<string, { before: boolean; after: boolean }> = {}
      selectedAssignments.forEach((assignment) => {
        if (assignment.shiftId) {
          const shift = shifts.find((s) => s.id === assignment.shiftId)
          if (shift && assignment.startTime && assignment.endTime) {
            const baseStart30MinBefore = adjustTime(shift.startTime || "", -30)
            const hasBefore = assignment.startTime === baseStart30MinBefore
            
            const baseEnd30MinAfter = adjustTime(shift.endTime || "", 30)
            const hasAfter = assignment.endTime === baseEnd30MinAfter
            
            if (hasBefore || hasAfter) {
              loadedExtensions[assignment.shiftId] = {
                before: hasBefore,
                after: hasAfter,
              }
            }
          }
        }
      })
      setExtensions(loadedExtensions)
    }
    
    prevOpenRef.current = open
  }, [open, selectedShiftIds, selectedAssignments, shifts, config])

  const toggleShift = (shiftId: string) => {
    setTempSelected((prev) => {
      return prev.includes(shiftId)
        ? prev.filter((id) => id !== shiftId)
        : [...prev, shiftId]
    })
  }

  const updateAdjustedTime = (shiftId: string, field: keyof ShiftAssignment, value: string) => {
    setAdjustedTimes((prev) => ({
      ...prev,
      [shiftId]: {
        ...prev[shiftId],
        [field]: value || undefined,
      },
    }))
  }

  const resetAdjustedTime = (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2") => {
    setAdjustedTimes((prev) => {
      const updated = { ...prev[shiftId] }
      delete updated[field]
      return {
        ...prev,
        [shiftId]: updated,
      }
    })
  }

  const resetAllAdjustedTimes = (shiftId: string) => {
    setAdjustedTimes((prev) => {
      const updated = { ...prev }
      delete updated[shiftId]
      return updated
    })
  }

  const adjustTimeField = (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2", minutes: number) => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return

    const currentTime = adjustedTimes[shiftId]?.[field] || shift[field] || ""
    if (!currentTime) return

    const newTime = adjustTime(currentTime, minutes)
    updateAdjustedTime(shiftId, field, newTime)
  }

  const getDisplayTime = (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2"): string => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return ""
    return adjustedTimes[shiftId]?.[field] ?? shift[field] ?? ""
  }

  const hasAdjustments = (shiftId: string): boolean => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) return false
    
    const adjusted = adjustedTimes[shiftId]
    if (!adjusted) return false
    
    return !!(
      (adjusted.startTime !== undefined && adjusted.startTime !== shift.startTime) ||
      (adjusted.endTime !== undefined && adjusted.endTime !== shift.endTime) ||
      (adjusted.startTime2 !== undefined && adjusted.startTime2 !== shift.startTime2) ||
      (adjusted.endTime2 !== undefined && adjusted.endTime2 !== shift.endTime2)
    )
  }

  const resetToInitial = () => {
    const hasFranco = selectedAssignments.some(a => a.type === "franco")
    const hasMedioFranco = selectedAssignments.some(a => a.type === "medio_franco")
    
    if (hasFranco) {
      setSpecialType("franco")
      setTempSelected([])
      setMedioFrancoTime({ startTime: "", endTime: "" })
    } else if (hasMedioFranco) {
      const medioFranco = selectedAssignments.find(a => a.type === "medio_franco")
      setSpecialType("medio_franco")
      setTempSelected([])
      const startTime = medioFranco?.startTime || ""
      const endTime = medioFranco?.endTime || ""
      setMedioFrancoTime({ startTime, endTime })
      
      const matchingMedioTurno = config?.mediosTurnos?.find(
        mt => mt.startTime === startTime && mt.endTime === endTime
      )
      setSelectedMedioTurnoId(matchingMedioTurno?.id || null)
    } else {
      setSpecialType("shift")
      setTempSelected(selectedShiftIds)
      setMedioFrancoTime({ startTime: "", endTime: "" })
    }
    
    const adjusted: Record<string, Partial<ShiftAssignment>> = {}
    selectedAssignments.forEach((assignment) => {
      if (assignment.shiftId && assignment.type !== "franco" && assignment.type !== "medio_franco") {
        adjusted[assignment.shiftId] = {
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          startTime2: assignment.startTime2,
          endTime2: assignment.endTime2,
        }
      }
    })
    setAdjustedTimes(adjusted)
    setEditingShiftId(null)
  }

  return {
    tempSelected,
    editingShiftId,
    adjustedTimes,
    extensions,
    specialType,
    medioFrancoTime,
    selectedMedioTurnoId,
    setTempSelected,
    setEditingShiftId,
    setSpecialType,
    setMedioFrancoTime,
    setSelectedMedioTurnoId,
    setExtensions,
    toggleShift,
    updateAdjustedTime,
    resetAdjustedTime,
    resetAllAdjustedTimes,
    adjustTimeField,
    getDisplayTime,
    hasAdjustments,
    resetToInitial,
  }
}





