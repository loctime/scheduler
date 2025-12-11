"use client"

import React, { useState } from "react"
import type { CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Check, RotateCcw, Undo2, Lock, FileText, X } from "lucide-react"
import { ShiftAssignment, Turno, MedioTurno, Configuracion } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"
import { QuickShiftSelector } from "./quick-shift-selector"
import { getDay, parseISO } from "date-fns"
import type { PatternSuggestion } from "@/lib/pattern-learning"

interface ScheduleCellProps {
  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  backgroundStyle?: CSSProperties
  isSelected: boolean
  isClickable: boolean
  getShiftInfo: (shiftId: string) => Turno | undefined
  onCellClick: (date: string, employeeId: string) => void
  showExtraActions: boolean
  extraMenuOpenKey: string | null
  cellKey: string
  hasExtraBefore: boolean
  hasExtraAfter: boolean
  onToggleExtra: (type: "before" | "after") => void
  onExtraMenuOpenChange: (open: boolean) => void
  quickShifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onQuickAssignments?: (assignments: ShiftAssignment[]) => void
  onAssignmentUpdate?: (
    date: string,
    employeeId: string,
    assignments: ShiftAssignment[],
    options?: { scheduleId?: string }
  ) => void
  scheduleId?: string
  readonly?: boolean
  hasCellHistory?: boolean
  onCellUndo?: () => void
  hasFixedSchedule?: boolean
  suggestionWeeks?: number
  isManuallyFixed?: boolean
  onToggleFixed?: (date: string, employeeId: string, dayOfWeek: number) => void
  suggestion?: PatternSuggestion | null
  config?: Configuracion | null
}

export function ScheduleCell({
  date,
  employeeId,
  assignments,
  backgroundStyle,
  isSelected,
  isClickable,
  getShiftInfo,
  onCellClick,
  showExtraActions,
  extraMenuOpenKey,
  cellKey,
  hasExtraBefore,
  hasExtraAfter,
  onToggleExtra,
  onExtraMenuOpenChange,
  quickShifts,
  mediosTurnos,
  onQuickAssignments,
  onAssignmentUpdate,
  scheduleId,
  readonly = false,
  hasCellHistory = false,
  onCellUndo,
  hasFixedSchedule = false,
  suggestionWeeks,
  isManuallyFixed = false,
  onToggleFixed,
  suggestion,
  config,
}: ScheduleCellProps) {
  const [notaDialogOpen, setNotaDialogOpen] = useState(false)
  const [notaTexto, setNotaTexto] = useState("")
  
  const hasBackgroundStyle = !!backgroundStyle
  const dayOfWeek = getDay(parseISO(date))
  const hoverClass = hasBackgroundStyle
    ? isClickable
      ? "hover:brightness-95"
      : ""
    : isClickable
    ? "hover:bg-muted/50"
    : ""
  const selectedClass = hasBackgroundStyle ? "ring-2 ring-primary/30" : isSelected ? "bg-primary/10" : ""

  // Verificar si ya hay una nota en esta celda
  const existingNota = assignments.find((a) => a.type === "nota")
  
  const handleOpenNotaDialog = () => {
    if (existingNota?.texto) {
      setNotaTexto(existingNota.texto)
    } else {
      setNotaTexto("")
    }
    setNotaDialogOpen(true)
  }

  const handleSaveNota = () => {
    if (!onAssignmentUpdate) return
    
    const trimmedTexto = notaTexto.trim()
    
    if (trimmedTexto === "") {
      // Si el texto está vacío, eliminar la nota
      const updatedAssignments = assignments.filter((a) => a.type !== "nota")
      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    } else {
      // Crear o actualizar la nota
      const notaAssignment: ShiftAssignment = {
        type: "nota",
        texto: trimmedTexto,
      }
      
      // Si ya existe una nota, reemplazarla; si no, agregarla
      const otherAssignments = assignments.filter((a) => a.type !== "nota")
      const updatedAssignments = [...otherAssignments, notaAssignment]
      
      onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    }
    
    setNotaDialogOpen(false)
    setNotaTexto("")
  }

  const handleDeleteNota = () => {
    if (!onAssignmentUpdate) return
    
    const updatedAssignments = assignments.filter((a) => a.type !== "nota")
    onAssignmentUpdate(date, employeeId, updatedAssignments, { scheduleId })
    setNotaDialogOpen(false)
    setNotaTexto("")
  }

  const handleClearCell = () => {
    if (!onAssignmentUpdate) return
    
    // Limpiar todas las asignaciones de la celda
    onAssignmentUpdate(date, employeeId, [], { scheduleId })
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <td
            className={`border-r-2 border-black px-1 sm:px-1.5 md:px-2 py-1 sm:py-1.5 md:py-2 last:border-r-0 relative group ${
              isClickable ? `cursor-pointer transition-all ${hoverClass} active:brightness-90 touch-manipulation` : ""
            } ${selectedClass} ${
              isSelected && isClickable && onQuickAssignments ? "min-h-[140px] py-2 sm:py-2.5 md:py-3" : ""
            }`}
            style={backgroundStyle}
            onClick={() => onCellClick(date, employeeId)}
          >
            {/* Botón pequeño de deshacer en celda (arriba a la izquierda) */}
            {!readonly && hasCellHistory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCellUndo?.()
                }}
                className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-primary/90 text-primary-foreground opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100 hover:bg-primary shadow-sm"
                title="Deshacer cambio en esta celda"
                aria-label="Deshacer cambio en esta celda"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            {/* Indicador de horario modificado (puntito) - solo visible en exportación */}
            {(hasExtraBefore || hasExtraAfter) && (
              <div
                className="schedule-cell-indicator absolute bottom-1 right-1 z-10 h-2 w-2 rounded-full bg-primary shadow-sm hidden"
                title={hasExtraBefore && hasExtraAfter ? "Horario modificado (+30 min antes y después)" : hasExtraBefore ? "Horario modificado (+30 min antes)" : "Horario modificado (+30 min después)"}
                aria-label="Horario modificado"
              />
            )}
            {/* Indicador de horario fijo - oculto en exportaciones */}
            {hasFixedSchedule && (
              <div
                className="schedule-fixed-indicator absolute top-1 left-1 z-10 flex items-center gap-1 bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Horario fijo detectado (${suggestionWeeks || 0} semanas consecutivas)`}
                aria-label="Horario fijo"
              >
                <Lock className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold text-primary">{suggestionWeeks}</span>
              </div>
            )}
        {showExtraActions && (
          <div className="absolute -top-1 right-1" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu open={extraMenuOpenKey === cellKey} onOpenChange={onExtraMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-6 px-2 text-xs">
                  +Extra
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    onToggleExtra("before")
                    onExtraMenuOpenChange(false)
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="flex-1">+30 min antes</span>
                  {hasExtraBefore && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    onToggleExtra("after")
                    onExtraMenuOpenChange(false)
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="flex-1">+30 min después</span>
                  {hasExtraAfter && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {isSelected && isClickable && onQuickAssignments ? (
            <QuickShiftSelector
              shifts={quickShifts}
              mediosTurnos={mediosTurnos}
              onSelectAssignments={onQuickAssignments}
              onUndo={hasCellHistory ? onCellUndo : undefined}
              onToggleFixed={
                onToggleFixed
                  ? () => {
                      const dayOfWeek = getDay(parseISO(date))
                      onToggleFixed(date, employeeId, dayOfWeek)
                    }
                  : undefined
              }
              isManuallyFixed={isManuallyFixed}
              hasCellHistory={hasCellHistory}
              readonly={readonly}
              config={config}
              employeeId={employeeId}
              dayOfWeek={dayOfWeek}
            />
          ) : (
            <CellAssignments assignments={assignments} getShiftInfo={getShiftInfo} />
          )}
        </div>
        {/* Botón de candado para marcar como fijo (abajo al centro) - oculto en exportaciones */}
        {!readonly && isClickable && onToggleFixed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const dayOfWeek = getDay(parseISO(date))
              onToggleFixed(date, employeeId, dayOfWeek)
            }}
            className={`schedule-lock-button absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex h-5 w-5 items-center justify-center rounded transition-all ${
              isManuallyFixed
                ? "bg-primary text-primary-foreground opacity-100"
                : "bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
            }`}
            title={isManuallyFixed ? "Desmarcar como horario fijo" : "Marcar como horario fijo"}
            aria-label={isManuallyFixed ? "Desmarcar como horario fijo" : "Marcar como horario fijo"}
          >
            <Lock className={`h-3 w-3 ${isManuallyFixed ? "" : "opacity-60"}`} />
          </button>
        )}
      </td>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!readonly && (
            <>
              <ContextMenuItem onClick={() => onCellClick(date, employeeId)}>
                Editar turno
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleOpenNotaDialog}>
                <FileText className="mr-2 h-4 w-4" />
                {existingNota ? "Editar nota" : "Agregar nota"}
              </ContextMenuItem>
              {assignments.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleClearCell}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar
                  </ContextMenuItem>
                </>
              )}
              {hasCellHistory && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onCellUndo?.()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Deshacer cambio en esta celda
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Diálogo para agregar/editar nota */}
      <Dialog open={notaDialogOpen} onOpenChange={setNotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existingNota ? "Editar nota" : "Agregar nota"}</DialogTitle>
            <DialogDescription>
              Ingresa un texto personalizado para esta celda (ej: enfermedad, viaje, vacaciones)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Ej: Enfermedad / Viaje / Vacaciones"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSaveNota()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            {existingNota && (
              <Button variant="destructive" onClick={handleDeleteNota}>
                Eliminar nota
              </Button>
            )}
            <Button variant="outline" onClick={() => setNotaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNota}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

