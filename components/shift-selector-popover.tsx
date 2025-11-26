"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Turno, ShiftAssignment } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useShiftSelector } from "@/hooks/use-shift-selector"
import { SpecialTypeSelector } from "@/components/shift-selector/special-type-selector"
import { ShiftItem } from "@/components/shift-selector/shift-item"

interface ShiftSelectorPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shifts: Turno[]
  selectedShiftIds: string[]
  selectedAssignments?: ShiftAssignment[]
  onShiftChange?: (shiftIds: string[]) => void
  onAssignmentsChange?: (assignments: ShiftAssignment[]) => void
  employeeName: string
  date: string
}

export function ShiftSelectorPopover({
  open,
  onOpenChange,
  shifts,
  selectedShiftIds,
  selectedAssignments = [],
  onShiftChange,
  onAssignmentsChange,
  employeeName,
  date,
}: ShiftSelectorPopoverProps) {
  const { toast } = useToast()
  const { config } = useConfig()

  const {
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
  } = useShiftSelector({
    selectedShiftIds,
    selectedAssignments,
    shifts,
    open,
  })

  const buildAssignmentFromShift = (shiftId: string): ShiftAssignment => {
    const shift = shifts.find((s) => s.id === shiftId)
    const adjusted = adjustedTimes[shiftId] || {}
    const result: ShiftAssignment = { shiftId, type: "shift" }

    if (!shift) {
      return { ...result, ...adjusted }
    }

    if (adjusted.startTime !== undefined && adjusted.startTime !== shift.startTime) {
      result.startTime = adjusted.startTime
    }

    if (adjusted.endTime !== undefined && adjusted.endTime !== shift.endTime) {
      result.endTime = adjusted.endTime
    }

    if (adjusted.startTime2 !== undefined && adjusted.startTime2 !== shift.startTime2) {
      result.startTime2 = adjusted.startTime2
    }

    if (adjusted.endTime2 !== undefined && adjusted.endTime2 !== shift.endTime2) {
      result.endTime2 = adjusted.endTime2
    }

    return result
  }

  const finalizeAssignments = (assignments: ShiftAssignment[], shiftIdsOverride?: string[]) => {
    if (onAssignmentsChange) {
      onAssignmentsChange(assignments)
    } else if (onShiftChange) {
      const shiftIds =
        shiftIdsOverride ??
        assignments
          .map((assignment) => assignment.shiftId)
          .filter((id): id is string => Boolean(id))
      onShiftChange(shiftIds)
    }
    onOpenChange(false)
  }

  const handleQuickShiftSelect = (shiftId: string) => {
    const assignment = buildAssignmentFromShift(shiftId)
    finalizeAssignments([assignment], [shiftId])
  }

  const handleSave = () => {
    // Si es franco, retornar array con un solo elemento tipo franco
    if (specialType === "franco") {
      finalizeAssignments([{ type: "franco" }])
      return
    }

    // Si es medio franco, validar que tenga horario
    if (specialType === "medio_franco") {
      if (!medioFrancoTime.startTime || !medioFrancoTime.endTime) {
        toast({
          title: "Error",
          description: "Debes especificar un horario para el medio franco",
          variant: "destructive",
        })
        return
      }
      finalizeAssignments([
        {
          type: "medio_franco",
          startTime: medioFrancoTime.startTime,
          endTime: medioFrancoTime.endTime,
        },
      ])
      return
    }

    // Comportamiento normal para turnos
    const assignments: ShiftAssignment[] = tempSelected.map(buildAssignmentFromShift)
    finalizeAssignments(assignments, tempSelected)
  }

  const handleCancel = () => {
    resetToInitial()
    onOpenChange(false)
  }

  const handleSpecialTypeChange = (type: "shift" | "franco" | "medio_franco") => {
    setSpecialType(type)
    if (type === "franco" || type === "medio_franco") {
      // Limpiar turnos seleccionados cuando se cambia a franco/medio_franco
      setTempSelected([])
    }
    if (type === "medio_franco") {
      setSelectedMedioTurnoId(null)
      setMedioFrancoTime({ startTime: "", endTime: "" })
    }
    if (type === "shift") {
      setMedioFrancoTime({ startTime: "", endTime: "" })
      setSelectedMedioTurnoId(null)
    }
    if (type === "franco") {
      finalizeAssignments([{ type: "franco" }])
    }
  }

  const handleMedioFrancoTimeChange = (time: { startTime: string; endTime: string }) => {
    setMedioFrancoTime(time)
  }

  const handleMedioTurnoSelect = (id: string | null, time: { startTime: string; endTime: string }) => {
    setSelectedMedioTurnoId(id)
    setMedioFrancoTime(time)
  }

  const handleToggleExtension = (shiftId: string, type: "before" | "after") => {
    setExtensions((prev) => ({
      ...prev,
      [shiftId]: {
        before: type === "before" ? !prev[shiftId]?.before : prev[shiftId]?.before || false,
        after: type === "after" ? !prev[shiftId]?.after : prev[shiftId]?.after || false,
      },
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Asignar Turnos</DialogTitle>
          <DialogDescription>
            {employeeName} - {date}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Opciones de franco */}
          <SpecialTypeSelector
            specialType={specialType}
            onTypeChange={handleSpecialTypeChange}
            medioFrancoTime={medioFrancoTime}
            onMedioFrancoTimeChange={handleMedioFrancoTimeChange}
            selectedMedioTurnoId={selectedMedioTurnoId}
            onMedioTurnoSelect={handleMedioTurnoSelect}
            mediosTurnos={config?.mediosTurnos}
          />
          
          {/* Lista de turnos (solo mostrar si es turno normal) */}
          {(specialType === "shift" || specialType === null) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Turnos disponibles:</Label>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {shifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay turnos disponibles</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shifts.map((shift) => {
                      const isSelected = tempSelected.includes(shift.id)
                      const isEditing = editingShiftId === shift.id
                      const hasAdj = hasAdjustments(shift.id)

                      return (
                        <ShiftItem
                          key={shift.id}
                          shift={shift}
                          isSelected={isSelected}
                          isEditing={isEditing}
                          hasAdjustments={hasAdj}
                          adjustedTimes={adjustedTimes}
                          extensions={extensions}
                          onToggle={toggleShift}
                          onEdit={(shiftId) => setEditingShiftId(editingShiftId === shiftId ? null : shiftId)}
                          getDisplayTime={getDisplayTime}
                          onUpdateTime={updateAdjustedTime}
                          onAdjustTime={adjustTimeField}
                          onResetTime={resetAdjustedTime}
                          onResetAll={resetAllAdjustedTimes}
                          onToggleExtension={handleToggleExtension}
                          onQuickAssign={handleQuickShiftSelect}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
