"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { MedioTurno, ShiftAssignment, Turno } from "@/lib/types"
import { getEmployeeRequest } from "@/lib/employee-requests"

type SpecialType = "shift" | "franco" | "medio_franco"

interface InlineShiftSelectorProps {
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onSelectAssignments: (assignments: ShiftAssignment[]) => void
  employeeId?: string
  date?: string
  scheduleId?: string
}

export function InlineShiftSelector({ 
  shifts, 
  mediosTurnos, 
  onSelectAssignments, 
  employeeId, 
  date, 
  scheduleId 
}: InlineShiftSelectorProps) {
  const [specialType, setSpecialType] = useState<SpecialType>("shift")
  const [medioFrancoTime, setMedioFrancoTime] = useState<{ startTime: string; endTime: string }>({
    startTime: "",
    endTime: "",
  })
  const [employeeRequest, setEmployeeRequest] = useState<any>(null)

  // Cargar employee request si existe
  useEffect(() => {
    const loadEmployeeRequest = async () => {
      if (!employeeId || !date || !scheduleId) return
      
      try {
        const request = await getEmployeeRequest(scheduleId, employeeId, date)
        if (request && request.active && request.requestedShift) {
          setEmployeeRequest(request)
          
          // Si hay un request, mostrar el horario solicitado
          const requestedShift = request.requestedShift
          if (requestedShift.type === 'franco') {
            setSpecialType('franco')
          } else if (requestedShift.type === 'medio-franco') {
            setSpecialType('medio_franco')
            if (requestedShift.startTime && requestedShift.endTime) {
              setMedioFrancoTime({
                startTime: requestedShift.startTime,
                endTime: requestedShift.endTime
              })
            }
          } else if (requestedShift.type === 'existing' && requestedShift.shiftId) {
            setSpecialType('shift')
          }
        } else {
          setEmployeeRequest(null)
        }
      } catch (error) {
        console.error("Error loading employee request:", error)
      }
    }

    loadEmployeeRequest()
  }, [employeeId, date, scheduleId])

  const handleSelectShift = (shift: Turno) => {
    // CRÍTICO: Crear assignment completo con horarios desde el inicio
    // Esto previene que se guarden assignments sin startTime/endTime
    const assignment: ShiftAssignment = {
      type: "shift",
      shiftId: shift.id,
    }
    
    // Copiar primera franja siempre
    if (shift.startTime) {
      assignment.startTime = shift.startTime
    }
    if (shift.endTime) {
      assignment.endTime = shift.endTime
    }
    
    // Copiar segunda franja si existe (turno cortado)
    if (shift.startTime2) {
      assignment.startTime2 = shift.startTime2
    }
    if (shift.endTime2) {
      assignment.endTime2 = shift.endTime2
    }
    
    onSelectAssignments([assignment])
  }

  const handleSelectFranco = () => {
    onSelectAssignments([{ type: "franco" }])
  }

  const handleSelectMedioFranco = (time: { startTime: string; endTime: string }) => {
    if (!time.startTime || !time.endTime) return
    onSelectAssignments([
      {
        type: "medio_franco",
        startTime: time.startTime,
        endTime: time.endTime,
      },
    ])
  }

  // Por ahora mostramos todos los turnos configurados como opciones rápidas
  // El usuario puede nombrarlos "Mañana", "Tarde", "Noche", etc.
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()} data-inline-selector="true">
      {/* Indicador de employee request */}
      {employeeRequest && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-xs">
          <div className="flex items-center gap-1 text-blue-700 font-medium">
            <span>📋</span>
            <span>Horario solicitado</span>
          </div>
          {employeeRequest.requestedShift?.type === 'franco' && (
            <div className="text-blue-600 mt-1">Franco</div>
          )}
          {employeeRequest.requestedShift?.type === 'medio-franco' && (
            <div className="text-blue-600 mt-1">
              Medio franco ({employeeRequest.requestedShift.startTime} - {employeeRequest.requestedShift.endTime})
            </div>
          )}
          {employeeRequest.requestedShift?.type === 'existing' && (
            <div className="text-blue-600 mt-1">
              Turno: {shifts.find(s => s.id === employeeRequest.requestedShift?.shiftId)?.name || 'Eliminado'}
            </div>
          )}
          {employeeRequest.requestedShift?.type === 'manual' && (
            <div className="text-blue-600 mt-1">
              Manual ({employeeRequest.requestedShift.startTime} - {employeeRequest.requestedShift.endTime})
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={specialType === "franco" ? "default" : "outline"}
          className="h-8 text-xs px-2"
          onClick={(e) => {
            e.stopPropagation()
            setSpecialType("franco")
            handleSelectFranco()
          }}
        >
          Franco
        </Button>
        <Button
          type="button"
          size="sm"
          variant={specialType === "medio_franco" ? "default" : "outline"}
          className="h-8 text-xs px-2"
          onClick={(e) => {
            e.stopPropagation()
            setSpecialType("medio_franco")
          }}
        >
          1/2 Franco
        </Button>
        <Button
          type="button"
          size="sm"
          variant={specialType === "shift" ? "default" : "outline"}
          className="h-8 text-xs px-2"
          onClick={(e) => {
            e.stopPropagation()
            setSpecialType("shift")
          }}
        >
          Turno
        </Button>
      </div>

      {specialType === "shift" && (
        <div className="flex flex-wrap gap-1.5">
          {shifts.length === 0 ? (
            <span className="text-xs text-muted-foreground">No hay turnos</span>
          ) : (
            shifts.map((shift) => (
              <Button
                key={shift.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectShift(shift)
                }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full mr-1.5"
                  style={{ backgroundColor: shift.color }}
                />
                {shift.name}
              </Button>
            ))
          )}
        </div>
      )}

      {specialType === "medio_franco" && (
        <div className="space-y-2">
          {mediosTurnos && mediosTurnos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mediosTurnos.map((medio) => (
                <Button
                  key={medio.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectMedioFranco({
                      startTime: medio.startTime,
                      endTime: medio.endTime,
                    })
                  }}
                >
                  {medio.nombre || "1/2 Franco"}
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <Input
              type="time"
              className="h-8 px-2 text-xs"
              placeholder="Inicio"
              value={medioFrancoTime.startTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation()
                const next = { ...medioFrancoTime, startTime: e.target.value }
                setMedioFrancoTime(next)
                // Solo guardar y cerrar si ambos campos están completos
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
              onBlur={(e) => {
                // Al perder el foco, si ambos campos están completos, guardar y cerrar
                const currentValue = e.target.value
                const next = { ...medioFrancoTime, startTime: currentValue }
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
            />
            <Input
              type="time"
              className="h-8 px-2 text-xs"
              placeholder="Fin"
              value={medioFrancoTime.endTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation()
                const next = { ...medioFrancoTime, endTime: e.target.value }
                setMedioFrancoTime(next)
                // Solo guardar y cerrar si ambos campos están completos
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
              onBlur={(e) => {
                // Al perder el foco, si ambos campos están completos, guardar y cerrar
                const currentValue = e.target.value
                const next = { ...medioFrancoTime, endTime: currentValue }
                if (next.startTime && next.endTime) {
                  handleSelectMedioFranco(next)
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}


