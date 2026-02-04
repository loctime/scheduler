"use client"

import React, { useState, useEffect } from "react"
import { format, getDay } from "date-fns"
import { es } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmployeeFixedRule, Turno, Empleado } from "@/lib/types"
import { useEmployeeFixedRules } from "@/hooks/use-employee-fixed-rules"
import { Lock, Calendar, User } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

interface FixedRuleModalProps {
  isOpen: boolean
  onClose: () => void
  employeeId: string
  employeeName: string
  date: Date
  shifts: Turno[]
  user?: any
}

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

export function FixedRuleModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  date,
  shifts,
  user
}: FixedRuleModalProps) {
  const [ruleType, setRuleType] = useState<"SHIFT" | "OFF">("SHIFT")
  const [selectedShiftId, setSelectedShiftId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { userData } = useData()
  const resolvedOwnerId = getOwnerIdForActor(user, userData)
  
  const { createOrUpdateRule, deleteRule, getRuleForDay } = useEmployeeFixedRules({ 
    ownerId: resolvedOwnerId ?? undefined
  })
  
  const dayOfWeek = getDay(date) // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const existingRule = getRuleForDay(employeeId, dayOfWeek)

  useEffect(() => {
    if (existingRule) {
      setRuleType(existingRule.type)
      if (existingRule.type === "SHIFT" && existingRule.shiftId) {
        setSelectedShiftId(existingRule.shiftId)
      }
    } else {
      setRuleType("SHIFT")
      setSelectedShiftId("")
    }
  }, [existingRule])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (ruleType === "SHIFT" && !selectedShiftId) {
      return
    }

    setIsSubmitting(true)

    try {
      const ruleData: Omit<EmployeeFixedRule, "id" | "createdAt" | "updatedAt"> = {
        employeeId,
        ownerId: resolvedOwnerId || "", // ID de la empresa/cuenta
        createdBy: user?.uid || "", // ID del usuario que crea
        dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        type: ruleType,
        shiftId: ruleType === "SHIFT" ? selectedShiftId : undefined,
        priority: 1
      }

      const result = await createOrUpdateRule(ruleData)
      
      if (result) {
        onClose()
      }
    } catch (error) {
      console.error("Error saving rule:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!existingRule) return
    
    setIsSubmitting(true)
    try {
      const success = await deleteRule(existingRule.id)
      if (success) {
        onClose()
      }
    } catch (error) {
      console.error("Error deleting rule:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Crear Regla Fija
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información del empleado y día */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{employeeName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>Todos los {DAY_NAMES[dayOfWeek]}</span>
            </div>
          </div>

          {/* Tipo de regla */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de regla</Label>
            <RadioGroup
              value={ruleType}
              onValueChange={(value) => setRuleType(value as "SHIFT" | "OFF")}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="SHIFT" id="shift" />
                <Label htmlFor="shift" className="text-sm">Turno específico</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="OFF" id="off" />
                <Label htmlFor="off" className="text-sm">Libre</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Selección de turno */}
          {ruleType === "SHIFT" && (
            <div className="space-y-2">
              <Label htmlFor="shift-select" className="text-sm font-medium">
                Turno
              </Label>
              <Select
                value={selectedShiftId}
                onValueChange={setSelectedShiftId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar turno..." />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: shift.color }}
                        />
                        <span>{shift.name}</span>
                        {shift.startTime && shift.endTime && (
                          <span className="text-gray-500 text-sm">
                            ({shift.startTime} - {shift.endTime})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Información de regla existente */}
          {existingRule && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              {existingRule.type === "SHIFT" ? (
                <p>
                  Esta regla reemplazará el turno actual: 
                  <strong> {shifts.find(s => s.id === existingRule.shiftId)?.name}</strong>
                </p>
              ) : (
                <p>Esta regla reemplazará el día libre actual</p>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {existingRule && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Eliminar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (ruleType === "SHIFT" && !selectedShiftId)}
            >
              {isSubmitting ? "Guardando..." : existingRule ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
