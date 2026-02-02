"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Turno, ShiftAssignment, MedioTurno, Configuracion } from "@/lib/types"
import { getEmployeeRequest } from "@/lib/employee-requests"

type SelectionMode = "none" | "franco" | "turno" | "medio_franco"

interface QuickShiftSelectorProps {
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onSelectAssignments: (assignments: ShiftAssignment[]) => void
  onUndo?: () => void
  onToggleFixed?: () => void
  isManuallyFixed?: boolean
  hasCellHistory?: boolean
  readonly?: boolean
  config?: Configuracion | null
  employeeId?: string
  dayOfWeek?: number
  date?: string
  scheduleId?: string
  updateEmployeeRequestCache?: (key: string, request: any) => void
}

export function QuickShiftSelector({
  shifts,
  mediosTurnos = [],
  onSelectAssignments,
  onUndo,
  onToggleFixed,
  isManuallyFixed = false,
  hasCellHistory = false,
  readonly = false,
  config,
  employeeId,
  dayOfWeek,
  date,
  scheduleId,
  updateEmployeeRequestCache,
}: QuickShiftSelectorProps) {
  const { toast } = useToast()
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("turno")
  const [medioFrancoTime, setMedioFrancoTime] = useState({ startTime: "", endTime: "" })
  const [employeeRequest, setEmployeeRequest] = useState<any>(null)

  // Cargar employee request si existe
  useEffect(() => {
    const loadEmployeeRequest = async () => {
      if (!employeeId || !date || !scheduleId) return
      
      try {
        const request = await getEmployeeRequest(scheduleId, employeeId, date)
        
        // Actualizar caché
        if (updateEmployeeRequestCache) {
          const cacheKey = `${scheduleId}_${employeeId}_${date}`
          updateEmployeeRequestCache(cacheKey, request)
        }
        
        if (request && request.active && request.requestedShift) {
          setEmployeeRequest(request)
          
          // Si hay un request, mostrar el horario solicitado
          const requestedShift = request.requestedShift
          if (requestedShift.type === 'franco') {
            setSelectionMode('franco')
          } else if (requestedShift.type === 'medio-franco') {
            setSelectionMode('medio_franco')
            if (requestedShift.startTime && requestedShift.endTime) {
              setMedioFrancoTime({
                startTime: requestedShift.startTime,
                endTime: requestedShift.endTime
              })
            }
          } else if (requestedShift.type === 'existing' && requestedShift.shiftId) {
            setSelectionMode('turno')
          }
        } else {
          setEmployeeRequest(null)
        }
      } catch (error) {
        console.error("Error loading employee request:", error)
      }
    }

    loadEmployeeRequest()
  }, [employeeId, date, scheduleId, updateEmployeeRequestCache])

  const resetMode = () => {
    setSelectionMode("none")
    setMedioFrancoTime({ startTime: "", endTime: "" })
  }

  const handleFranco = () => {
    onSelectAssignments([{ type: "franco" }])
    resetMode()
  }

  const handleTurno = (shift: Turno) => {
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
    resetMode()
  }

  const handleTurnoMode = () => {
    if (shifts.length === 1) return handleTurno(shifts[0])
    if (shifts.length === 0) return
    setSelectionMode(selectionMode === "turno" ? "none" : "turno")
  }

  const handleMedioFranco = (time?: { startTime: string; endTime: string }) => {
    if (mediosTurnos.length === 1 && !time) {
      onSelectAssignments([
        {
          type: "medio_franco",
          startTime: mediosTurnos[0].startTime,
          endTime: mediosTurnos[0].endTime,
        },
      ])
      resetMode()
      return
    }

    if (time?.startTime && time?.endTime) {
      onSelectAssignments([{ type: "medio_franco", startTime: time.startTime, endTime: time.endTime }])
      resetMode()
      return
    }

    setSelectionMode(selectionMode === "medio_franco" ? "none" : "medio_franco")
  }

  const handleMedioFrancoTimeChange = (field: "startTime" | "endTime", value: string) => {
    const next = { ...medioFrancoTime, [field]: value }
    setMedioFrancoTime(next)
    if (next.startTime && next.endTime) handleMedioFranco(next)
  }

  // Obtener asignaciones guardadas manualmente desde config.fixedSchedules
  const getManualFixedAssignments = (): ShiftAssignment[] | null => {
    if (!config?.fixedSchedules || !employeeId || dayOfWeek === undefined) {
      return null
    }
    
    const fixed = config.fixedSchedules.find(
      (f) => f.employeeId === employeeId && f.dayOfWeek === dayOfWeek
    )
    
    if (fixed && fixed.assignments && fixed.assignments.length > 0) {
      return fixed.assignments
    }
    
    return null
  }

  const handleApplySuggestion = () => {
    const manualAssignments = getManualFixedAssignments()
    if (manualAssignments && manualAssignments.length > 0) {
      onSelectAssignments(manualAssignments)
      resetMode()
      toast({
        title: "Horario fijo aplicado",
        description: "Se aplicó el horario fijo guardado manualmente.",
      })
    }
  }

  // Solo mostrar si está marcado manualmente Y tiene asignaciones guardadas
  const manualAssignments = getManualFixedAssignments()
  const hasManualSuggestion = isManuallyFixed && manualAssignments && manualAssignments.length > 0

  return (
    <div
      className="flex flex-col h-full w-full p-0 m-0"
      onClick={(e) => e.stopPropagation()}
      data-quick-selector="true"
    >
      {/* Indicador de employee request */}
      {employeeRequest && (
        <div className="w-full p-1.5 mb-1 flex-shrink-0">
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
        </div>
      )}
      
      {/* BOTÓN SUGERIR - Solo para horarios fijos manuales con asignaciones guardadas */}
      {hasManualSuggestion && (
        <div className="w-full p-1.5 mb-1 flex-shrink-0">
          <Button
            type="button"
            variant="default"
            className="w-full text-xs font-semibold h-8 rounded-md bg-primary/90 hover:bg-primary transition-all"
            onClick={(e) => {
              e.stopPropagation()
              handleApplySuggestion()
            }}
          >
            <Sparkles className="h-3 w-3 mr-1.5" />
            Sugerir
          </Button>
        </div>
      )}
      {/* CONTENIDO PRINCIPAL */}
      <div className="flex flex-col flex-1 min-h-0 p-0 m-0 overflow-hidden">
        {/* FRANCO / TURNO - 30% (50%-50% cada uno) */}
        <div className="h-[75%] flex gap-0 p-0 m-0">
          <Button
            type="button"
            variant={selectionMode === "franco" ? "default" : "outline"}
            className="h-full w-1/2 text-lg sm:text-xl font-bold rounded-none border-r-0"
            style={{
              backgroundColor: "#10b981",
              color: "#ffffff",
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleFranco()
            }}
          >
            FRANCO
          </Button>

          <Button
            type="button"
            variant={selectionMode === "turno" ? "default" : "outline"}
            className="h-full w-1/2 text-lg sm:text-xl font-bold rounded-none"
            disabled={shifts.length === 0}
            onClick={(e) => {
              e.stopPropagation()
              handleTurnoMode()
            }}
          >
            TURNO
          </Button>
        </div>

        {/* 1/2 FRANCO - 10% */}
        <Button
          type="button"
          variant={selectionMode === "medio_franco" ? "default" : "outline"}
          className="h-[25%] w-full text-sm font-semibold rounded-none"
          onClick={(e) => {
            e.stopPropagation()
            handleMedioFranco()
          }}
        >
          1/2 FRANCO
        </Button>
      </div>

      {/* TURNOS - 50% (máximo 3 por fila) */}
      {selectionMode === "turno" && shifts.length > 0 && (
        <div className="h-[50%] flex flex-wrap gap-2 p-2 m-0 overflow-y-auto">
          {shifts.map((shift, index) => (
            <Button
              key={shift.id}
              type="button"
              variant="outline"
              className="h-1/2 flex-[0_0_calc(33.333%-0.5rem)] text-sm font-semibold flex items-center justify-center rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 px-1"
              style={{ 
                backgroundColor: shift.color,
                color: '#ffffff',
                borderColor: shift.color
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleTurno(shift)
              }}
            >
              <span className="text-center truncate">
                {shift.name.length > 6 ? shift.name.substring(0, 6) : shift.name}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* MEDIO FRANCO - 50% */}
      {selectionMode === "medio_franco" && (
        <div className="h-[50%] flex flex-col gap-2 p-2 m-0">
          {/* Opciones predefinidas */}
          {mediosTurnos.length > 0 && (
            <div className="flex flex-wrap gap-2 flex-1">
              {mediosTurnos.map((medio, index) => (
                <Button
                  key={medio.id}
                  type="button"
                  variant="outline"
                  className="flex-1 min-w-[calc(50%-0.5rem)] text-sm font-semibold rounded-md border-2 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
                  style={{ 
                    backgroundColor: medio.color || '#10b981',
                    color: '#ffffff',
                    borderColor: medio.color || '#10b981'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMedioFranco({
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

          {/* Inputs personalizados */}
          <div className="flex gap-2 flex-1">
            <Input
              type="time"
              className="h-full flex-1 rounded-md text-sm"
              placeholder="Inicio"
              value={medioFrancoTime.startTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleMedioFrancoTimeChange("startTime", e.target.value)}
            />
            <Input
              type="time"
              className="h-full flex-1 rounded-md text-sm"
              placeholder="Fin"
              value={medioFrancoTime.endTime}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleMedioFrancoTimeChange("endTime", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
