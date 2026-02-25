"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShiftAssignment, Separador, Turno } from "@/lib/types"

interface AsignarSectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: ShiftAssignment
  shift?: Turno
  sectors: Separador[]
  onSave: (updatedAssignment: ShiftAssignment) => void
}

type SlotValue = "none" | string

const getSlotValue = (assignment: ShiftAssignment, slot: 1 | 2): SlotValue => {
  const found = assignment.sectorSlots?.find((item) => item.slot === slot)
  return found?.sectorId || "none"
}

const upsertSlot = (
  slots: NonNullable<ShiftAssignment["sectorSlots"]>,
  slot: 1 | 2,
  value: SlotValue
): NonNullable<ShiftAssignment["sectorSlots"]> => {
  const filtered = slots.filter((item) => item.slot !== slot)
  if (value === "none") {
    return filtered
  }
  return [...filtered, { slot, sectorId: value }].sort((a, b) => a.slot - b.slot)
}

export function AsignarSectorDialog({
  open,
  onOpenChange,
  assignment,
  shift,
  sectors,
  onSave,
}: AsignarSectorDialogProps) {
  const hasSecondSegment = Boolean(
    assignment.startTime2 && assignment.endTime2
      ? true
      : shift?.startTime2 && shift?.endTime2
  )

  const existingSlots = assignment.sectorSlots || []
  const hasVisualDivision = !hasSecondSegment && existingSlots.some((item) => item.slot === 2)

  const mode: "cut" | "split" | "single" = hasSecondSegment
    ? "cut"
    : hasVisualDivision
      ? "split"
      : "single"

  const slot1Value = getSlotValue(assignment, 1)
  const slot2Value = getSlotValue(assignment, 2)

  const apply = (nextSlot1: SlotValue, nextSlot2: SlotValue, withSlot2: boolean) => {
    let nextSlots: NonNullable<ShiftAssignment["sectorSlots"]> = []
    nextSlots = upsertSlot(nextSlots, 1, nextSlot1)
    if (withSlot2) {
      nextSlots = upsertSlot(nextSlots, 2, nextSlot2)
    }

    const updatedAssignment: ShiftAssignment = {
      ...assignment,
      sectorSlots: nextSlots.length > 0 ? nextSlots : undefined,
    }

    onSave(updatedAssignment)
  }

  const handleSlot1Change = (value: SlotValue) => {
    apply(value, slot2Value, mode !== "single")
  }

  const handleSlot2Change = (value: SlotValue) => {
    apply(slot1Value, value, true)
  }

  const handleSplitShift = () => {
    apply(slot1Value, "none", true)
  }

  const handleRemoveDivision = () => {
    apply(slot1Value, "none", false)
  }

  const handleRemoveSector = () => {
    const updatedAssignment: ShiftAssignment = {
      ...assignment,
      sectorSlots: undefined,
    }
    onSave(updatedAssignment)
  }

  const selector = (slot: 1 | 2, value: SlotValue, label: string, onValueChange: (value: SlotValue) => void) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(val) => onValueChange(val as SlotValue)}>
        <SelectTrigger>
          <SelectValue placeholder="Sin sector" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin sector</SelectItem>
          {sectors.map((sector) => (
            <SelectItem key={`${sector.id}-${slot}`} value={sector.id}>
              {sector.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar sector</DialogTitle>
          <DialogDescription>
            Asigna sectores visuales por slot sin modificar horas ni cálculos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {mode === "single" && (
            <>
              {selector(1, slot1Value, "Sector", handleSlot1Change)}
              <Button variant="outline" onClick={handleSplitShift}>
                Dividir turno en 2 sectores
              </Button>
            </>
          )}

          {mode === "cut" && (
            <>
              {selector(1, slot1Value, "Franja 1", handleSlot1Change)}
              {selector(2, slot2Value, "Franja 2", handleSlot2Change)}
            </>
          )}

          {mode === "split" && (
            <>
              {selector(1, slot1Value, "Slot 1", handleSlot1Change)}
              {selector(2, slot2Value, "Slot 2", handleSlot2Change)}
              <Button variant="outline" onClick={handleRemoveDivision}>
                Quitar división
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          {mode !== "single" && (
            <Button variant="outline" onClick={handleRemoveDivision}>
              Quitar división
            </Button>
          )}
          <Button variant="destructive" onClick={handleRemoveSector}>
            Quitar sector
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
