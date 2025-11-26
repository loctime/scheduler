"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react"
import { Turno, ShiftAssignment } from "@/lib/types"

interface TimeAdjustmentFormProps {
  shift: Turno
  isEditing: boolean
  adjustedTimes: Record<string, Partial<ShiftAssignment>>
  getDisplayTime: (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2") => string
  onUpdateTime: (shiftId: string, field: keyof ShiftAssignment, value: string) => void
  onAdjustTime: (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2", minutes: number) => void
  onResetTime: (shiftId: string, field: "startTime" | "endTime" | "startTime2" | "endTime2") => void
  onResetAll: (shiftId: string) => void
  hasAdjustments: (shiftId: string) => boolean
}

export function TimeAdjustmentForm({
  shift,
  isEditing,
  adjustedTimes,
  getDisplayTime,
  onUpdateTime,
  onAdjustTime,
  onResetTime,
  onResetAll,
  hasAdjustments,
}: TimeAdjustmentFormProps) {
  const TimeField = ({
    field,
    label,
    shiftId,
  }: {
    field: "startTime" | "endTime" | "startTime2" | "endTime2"
    label: string
    shiftId: string
  }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        <Input
          type="time"
          value={getDisplayTime(shiftId, field)}
          onChange={(e) => onUpdateTime(shiftId, field, e.target.value)}
          className="text-xs flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdjustTime(shiftId, field, -30)}
          className="h-9 px-2"
          title="-30 min"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdjustTime(shiftId, field, 30)}
          className="h-9 px-2"
          title="+30 min"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        {adjustedTimes[shiftId]?.[field] && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onResetTime(shiftId, field)}
            className="h-9 px-2"
            title="Restaurar"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="pl-7 space-y-4 mt-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
      {/* Primera franja horaria */}
      {(shift.startTime || shift.endTime) && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Primera Franja Horaria</Label>
          <div className="space-y-2">
            <TimeField field="startTime" label="Hora Inicio" shiftId={shift.id} />
            <TimeField field="endTime" label="Hora Fin" shiftId={shift.id} />
          </div>
        </div>
      )}

      {/* Segunda franja horaria */}
      {(shift.startTime2 || shift.endTime2) && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Segunda Franja Horaria</Label>
          <div className="space-y-2">
            <TimeField field="startTime2" label="Hora Inicio" shiftId={shift.id} />
            <TimeField field="endTime2" label="Hora Fin" shiftId={shift.id} />
          </div>
        </div>
      )}

      {/* Botón para restaurar todos los ajustes */}
      {hasAdjustments(shift.id) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onResetAll(shift.id)}
          className="w-full text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Restaurar todos los horarios
        </Button>
      )}
    </div>
  )
}

