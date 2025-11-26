"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil } from "lucide-react"
import { Turno, ShiftAssignment } from "@/lib/types"
import { TimeAdjustmentForm } from "./time-adjustment-form"
import { adjustTime, cn } from "@/lib/utils"

interface ShiftItemProps {
  shift: Turno
  isSelected: boolean
  isEditing: boolean
  hasAdjustments: boolean
  adjustedTimes: Record<string, Partial<ShiftAssignment>>
  extensions: Record<string, { before: boolean; after: boolean }>
  onToggle: (shiftId: string) => void
  onEdit: (shiftId: string) => void
  getDisplayTime: (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2") => string
  onUpdateTime: (shiftId: string, field: keyof ShiftAssignment, value: string) => void
  onAdjustTime: (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2", minutes: number) => void
  onResetTime: (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2") => void
  onResetAll: (shiftId: string) => void
  onToggleExtension: (shiftId: string, type: "before" | "after") => void
  onQuickAssign?: (shiftId: string) => void
  className?: string
}

export function ShiftItem({
  shift,
  isSelected,
  isEditing,
  hasAdjustments,
  adjustedTimes,
  extensions,
  onToggle,
  onEdit,
  getDisplayTime,
  onUpdateTime,
  onAdjustTime,
  onResetTime,
  onResetAll,
  onToggleExtension,
  onQuickAssign,
  className,
}: ShiftItemProps) {
  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const isInteractive = 
      target.closest('button') || 
      target.closest('input') || 
      target.closest('[data-slot="checkbox"]') ||
      target.closest('label') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'LABEL'
    
    if (!isInteractive) {
      if (onQuickAssign) {
        onQuickAssign(shift.id)
      } else {
        onToggle(shift.id)
      }
    }
  }

  const handleCheckboxChange = (checked: boolean) => {
    // El checkbox maneja su propio estado
    if (checked && !isSelected) {
      if (onQuickAssign) {
        onQuickAssign(shift.id)
        return
      }
      onToggle(shift.id)
    } else if (!checked && isSelected) {
      onToggle(shift.id)
    }
  }

  const handleExtensionToggle = (type: "before" | "after") => {
    const currentExtension = extensions[shift.id]?.[type] || false
    const newExtensionState = !currentExtension
    
    // Actualizar estado de extensión
    onToggleExtension(shift.id, type)
    
    // Ajustar horario automáticamente
    if (type === "before") {
      const newStartTime = newExtensionState
        ? adjustTime(shift.startTime || "", -30)
        : shift.startTime
      if (newStartTime && shift.startTime) {
        if (newStartTime !== shift.startTime) {
          onUpdateTime(shift.id, "startTime", newStartTime)
        } else {
          onResetTime(shift.id, "startTime")
        }
      }
    } else {
      const newEndTime = newExtensionState
        ? adjustTime(shift.endTime || "", 30)
        : shift.endTime
      if (newEndTime && shift.endTime) {
        if (newEndTime !== shift.endTime) {
          onUpdateTime(shift.id, "endTime", newEndTime)
        } else {
          onResetTime(shift.id, "endTime")
        }
      }
    }
  }

  return (
    <div
      className={cn(
        "border rounded-lg p-3 space-y-3 transition-colors h-full",
        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
        className,
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox y nombre del turno */}
      <div 
        className="flex items-center justify-between"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-3 flex-1">
          <Checkbox
            id={`shift-${shift.id}`}
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <label
            htmlFor={`shift-${shift.id}`}
            className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer flex-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{ backgroundColor: shift.color }}
            />
            <span>{shift.name}</span>
          </label>
        </div>
        
        {isSelected && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {hasAdjustments && (
              <Badge variant="secondary" className="text-xs">
                Ajustado
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(shift.id)
              }}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Horarios base del turno */}
      {(shift.startTime || shift.endTime) && (
        <div className="pl-7 space-y-2">
          <div className="text-base font-semibold text-foreground">
            {shift.startTime && shift.endTime
              ? `${shift.startTime} - ${shift.endTime}`
              : "Sin horario"}
            {shift.startTime2 && shift.endTime2 && (
              <span className="text-base"> / {shift.startTime2} - {shift.endTime2}</span>
            )}
          </div>
          
          {/* Botones de extensión de 30 min */}
          {isSelected && shift.startTime && shift.endTime && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={extensions[shift.id]?.before ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleExtensionToggle("before")
                }}
                className="text-xs h-7 px-3"
              >
                +30 min antes
              </Button>
              <Button
                type="button"
                variant={extensions[shift.id]?.after ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleExtensionToggle("after")
                }}
                className="text-xs h-7 px-3"
              >
                +30 min después
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Formulario para ajustar horarios */}
      {isSelected && isEditing && (
        <TimeAdjustmentForm
          shift={shift}
          isEditing={isEditing}
          adjustedTimes={adjustedTimes}
          getDisplayTime={getDisplayTime}
          onUpdateTime={onUpdateTime}
          onAdjustTime={onAdjustTime}
          onResetTime={onResetTime}
          onResetAll={onResetAll}
          hasAdjustments={(shiftId: string) => hasAdjustments}
        />
      )}
    </div>
  )
}

