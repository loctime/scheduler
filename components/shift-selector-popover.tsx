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
import { Badge } from "@/components/ui/badge"
import { Turno, ShiftAssignment, Horario } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/hooks/use-config"
import { useData } from "@/contexts/data-context"
import { useShiftSelector } from "@/hooks/use-shift-selector"
import { SpecialTypeSelector } from "@/components/shift-selector/special-type-selector"
import { ShiftItem } from "@/components/shift-selector/shift-item"
import { cn } from "@/lib/utils"
import { getSuggestionForDay } from "@/lib/pattern-learning"
import { format, parseISO, getDay } from "date-fns"
import { useState, useEffect } from "react"

interface ShiftSelectorPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shifts: Turno[]
  selectedShiftIds: string[]
  selectedAssignments?: ShiftAssignment[]
  onShiftChange?: (shiftIds: string[]) => void
  onAssignmentsChange?: (assignments: ShiftAssignment[]) => void
  employeeName: string
  employeeId: string
  date: string
  schedules?: Horario[]
  weekStartDate?: Date
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
  employeeId,
  date,
  schedules = [],
  weekStartDate,
}: ShiftSelectorPopoverProps) {
  const { toast } = useToast()
  const { user } = useData()
  const { config } = useConfig(user)
  const [licenciaEmbarazoTime, setLicenciaEmbarazoTime] = useState({ startTime: "", endTime: "" })
  
  // Inicializar licencia embarazo time si hay asignación existente
  useEffect(() => {
    if (open) {
      const existingLicencia = selectedAssignments.find(a => a.type === "licencia" && a.licenciaType === "embarazo")
      if (existingLicencia) {
        setLicenciaEmbarazoTime({
          startTime: existingLicencia.startTime || "",
          endTime: existingLicencia.endTime || ""
        })
      } else {
        setLicenciaEmbarazoTime({ startTime: "", endTime: "" })
      }
    }
  }, [open, selectedAssignments])
  
  // Obtener sugerencia de patrón para este día
  const suggestion = weekStartDate && schedules.length > 0
    ? (() => {
        const dayOfWeek = getDay(parseISO(date))
        const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
        return getSuggestionForDay(employeeId, dayOfWeek, schedules, weekStartStr)
      })()
    : null

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

  /**
   * Construye un assignment completo desde un turno base
   * 
   * CRÍTICO: Copia TODA la estructura del turno siempre (autosuficiencia).
   * Luego aplica ajustes si existen.
   * 
   * Turno simple: copia startTime, endTime
   * Turno cortado: copia startTime, endTime, startTime2, endTime2
   */
  const buildAssignmentFromShift = (shiftId: string): ShiftAssignment => {
    const shift = shifts.find((s) => s.id === shiftId)
    const adjusted = adjustedTimes[shiftId] || {}
    const result: ShiftAssignment = { shiftId, type: "shift" }

    if (!shift) {
      // Si no hay turno base, solo usar ajustes si existen
      return { ...result, ...adjusted }
    }

    // CRÍTICO: Copiar TODA la estructura del turno siempre
    // Turno simple: copiar primera franja
    if (shift.startTime) {
      result.startTime = adjusted.startTime !== undefined ? adjusted.startTime : shift.startTime
    }
    if (shift.endTime) {
      result.endTime = adjusted.endTime !== undefined ? adjusted.endTime : shift.endTime
    }

    // Turno cortado: copiar segunda franja también
    if (shift.startTime2) {
      result.startTime2 = adjusted.startTime2 !== undefined ? adjusted.startTime2 : shift.startTime2
    }
    if (shift.endTime2) {
      result.endTime2 = adjusted.endTime2 !== undefined ? adjusted.endTime2 : shift.endTime2
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
  
  const handleApplySuggestion = () => {
    if (suggestion && onAssignmentsChange) {
      onAssignmentsChange(suggestion.assignments)
      onOpenChange(false)
      toast({
        title: "Sugerencia aplicada",
        description: `Se aplicó la sugerencia basada en ${suggestion.weeksMatched} semanas consecutivas.`,
      })
    }
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

    // Si es licencia, validar que tenga horario
    if (specialType === "licencia") {
      if (!licenciaEmbarazoTime.startTime || !licenciaEmbarazoTime.endTime) {
        toast({
          title: "Error",
          description: "Debes especificar un horario para la licencia por embarazo",
          variant: "destructive",
        })
        return
      }
      finalizeAssignments([
        {
          type: "licencia",
          licenciaType: "embarazo",
          startTime: licenciaEmbarazoTime.startTime,
          endTime: licenciaEmbarazoTime.endTime,
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

  const handleSpecialTypeChange = (type: "shift" | "franco" | "medio_franco" | "licencia") => {
    setSpecialType(type)
    if (type === "franco" || type === "medio_franco" || type === "licencia") {
      // Limpiar turnos seleccionados cuando se cambia a tipo especial
      setTempSelected([])
    }
    if (type === "medio_franco") {
      setSelectedMedioTurnoId(null)
      setMedioFrancoTime({ startTime: "", endTime: "" })
    }
    if (type === "licencia") {
      setLicenciaEmbarazoTime({ startTime: "", endTime: "" })
    }
    if (type === "shift") {
      setMedioFrancoTime({ startTime: "", endTime: "" })
      setLicenciaEmbarazoTime({ startTime: "", endTime: "" })
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
          {/* Mostrar sugerencia de patrón si existe */}
          {suggestion && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">Sugerencia Detectada</span>
                <Badge variant="secondary" className="ml-auto">
                  {suggestion.weeksMatched} semanas
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Este empleado ha tenido el mismo horario en este día durante {suggestion.weeksMatched} semanas consecutivas.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplySuggestion}
                className="w-full"
              >
                Aplicar Sugerencia
              </Button>
            </div>
          )}
          {/* Opciones de franco */}
          <SpecialTypeSelector
            specialType={specialType}
            onTypeChange={handleSpecialTypeChange}
            medioFrancoTime={medioFrancoTime}
            onMedioFrancoTimeChange={handleMedioFrancoTimeChange}
            selectedMedioTurnoId={selectedMedioTurnoId}
            onMedioTurnoSelect={handleMedioTurnoSelect}
            mediosTurnos={config?.mediosTurnos}
            licenciaEmbarazoTime={licenciaEmbarazoTime}
            onLicenciaEmbarazoTimeChange={setLicenciaEmbarazoTime}
          />
          
          {/* Lista de turnos (solo mostrar si es turno normal) */}
          {(specialType === "shift" || specialType === null || specialType === undefined) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Turnos disponibles:</Label>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {shifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay turnos disponibles</p>
                ) : (
                  <div
                    className={cn(
                      "grid grid-cols-1 gap-3",
                      !editingShiftId && "sm:grid-cols-2 lg:grid-cols-3",
                    )}
                  >
                    {editingShiftId && (
                      <div className="bg-secondary/60 border border-secondary rounded-md px-3 py-2 text-xs text-secondary-foreground shadow-sm">
                        <p className="font-semibold">Edición puntual</p>
                        <p>
                          Los cambios solo afectan a <span className="font-medium">{employeeName}</span> el{" "}
                          <span className="font-medium">{date}</span>.
                        </p>
                      </div>
                    )}
                    {(editingShiftId ? shifts.filter((shift) => shift.id === editingShiftId) : shifts).map((shift) => {
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
                        className={isEditing ? "p-5 sm:p-6 border-2" : undefined}
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
