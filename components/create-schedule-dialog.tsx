"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Empleado, Turno, Horario, ShiftAssignmentValue, ShiftAssignment } from "@/lib/types"

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { nombre: string; assignments: Record<string, Record<string, ShiftAssignment[]>> }) => void
  weekDays: Date[]
  employees: Empleado[]
  shifts: Turno[]
  existingSchedule?: Horario | null
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  onSubmit,
  weekDays,
  employees,
  shifts,
  existingSchedule,
}: CreateScheduleDialogProps) {
  const [assignments, setAssignments] = useState<Record<string, Record<string, ShiftAssignment[]>>>({})
  const [nombre, setNombre] = useState("")

  /**
   * Construye un assignment completo desde un turno base
   * Copia TODA la estructura del turno (autosuficiencia)
   */
  const buildAssignmentFromShift = (shiftId: string): ShiftAssignment => {
    const shift = shifts.find((s) => s.id === shiftId)
    if (!shift) {
      return { shiftId, type: "shift" }
    }

    // CRÍTICO: Copiar TODA la estructura del turno siempre
    const result: ShiftAssignment = { shiftId, type: "shift" }

    // Turno simple: copiar primera franja
    if (shift.startTime) {
      result.startTime = shift.startTime
    }
    if (shift.endTime) {
      result.endTime = shift.endTime
    }

    // Turno cortado: copiar segunda franja también
    if (shift.startTime2) {
      result.startTime2 = shift.startTime2
    }
    if (shift.endTime2) {
      result.endTime2 = shift.endTime2
    }

    return result
  }

  // Función para convertir ShiftAssignmentValue a ShiftAssignment[]
  const convertToAssignments = (value: ShiftAssignmentValue): ShiftAssignment[] => {
    if (Array.isArray(value) && value.length > 0) {
      // Si ya es ShiftAssignment[], usarlo directamente
      return value as ShiftAssignment[]
    }
    return []
  }

  useEffect(() => {
    if (existingSchedule?.assignments) {
      // Convertir ShiftAssignmentValue a ShiftAssignment[] completos para cada asignación
      const convertedAssignments: Record<string, Record<string, ShiftAssignment[]>> = {}
      Object.keys(existingSchedule.assignments).forEach((date) => {
        convertedAssignments[date] = {}
        Object.keys(existingSchedule.assignments[date]).forEach((employeeId) => {
          convertedAssignments[date][employeeId] = convertToAssignments(
            existingSchedule.assignments[date][employeeId]
          )
        })
      })
      setAssignments(convertedAssignments)
    } else {
      setAssignments({})
    }
    if (existingSchedule?.nombre) {
      setNombre(existingSchedule.nombre)
    } else {
      setNombre("")
    }
  }, [existingSchedule, shifts])

  const toggleShift = (date: string, employeeId: string, shiftId: string) => {
    setAssignments((prev) => {
      const newAssignments = { ...prev }
      if (!newAssignments[date]) {
        newAssignments[date] = {}
      }
      if (!newAssignments[date][employeeId]) {
        newAssignments[date][employeeId] = []
      }

      const employeeAssignments = newAssignments[date][employeeId]
      const shiftIndex = employeeAssignments.findIndex((a) => a.shiftId === shiftId)

      if (shiftIndex > -1) {
        // Remover assignment
        newAssignments[date][employeeId] = employeeAssignments.filter((a) => a.shiftId !== shiftId)
      } else {
        // Agregar assignment completo
        const newAssignment = buildAssignmentFromShift(shiftId)
        newAssignments[date][employeeId] = [...employeeAssignments, newAssignment]
      }

      return newAssignments
    })
  }

  const isShiftAssigned = (date: string, employeeId: string, shiftId: string) => {
    return assignments[date]?.[employeeId]?.some((a) => a.shiftId === shiftId) || false
  }

  const handleSubmit = () => {
    if (!nombre.trim()) {
      return
    }
    onSubmit({ nombre: nombre.trim(), assignments })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            {existingSchedule ? "Editar Horario" : "Crear Horario"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Asigna turnos a los empleados para cada día de la semana
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombre" className="text-foreground">
              Nombre del Horario *
            </Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Semana del 15 de Enero"
              className="border-input bg-background text-foreground"
              required
            />
          </div>
          {employees.map((employee) => (
            <div key={employee.id} className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground">{employee.name}</h3>
              <div className="grid gap-4 md:grid-cols-7">
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd")
                  return (
                    <div key={day.toISOString()} className="space-y-2">
                      <Label className="text-xs font-medium capitalize text-foreground">
                        {format(day, "EEE d", { locale: es })}
                      </Label>
                      <div className="space-y-2">
                        {shifts.map((shift) => (
                          <div key={shift.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${employee.id}-${dateStr}-${shift.id}`}
                              checked={isShiftAssigned(dateStr, employee.id, shift.id)}
                              onCheckedChange={() => toggleShift(dateStr, employee.id, shift.id)}
                            />
                            <label
                              htmlFor={`${employee.id}-${dateStr}-${shift.id}`}
                              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              <span
                                className="inline-block h-2 w-2 rounded-full mr-1"
                                style={{ backgroundColor: shift.color }}
                              />
                              {shift.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!nombre.trim()}>
            {existingSchedule ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
