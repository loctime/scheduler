"use client"

import React from "react"
import { ShiftAssignment } from "@/lib/types"
import { Turno, MedioTurno } from "@/lib/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface CellAssignmentsMobileProps {
  assignments: ShiftAssignment[]
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  dayStatus: "normal" | "franco" | "medio_franco"
  readonly?: boolean
  cellSize?: number
}

export function CellAssignmentsMobile({ 
  assignments, 
  shifts, 
  mediosTurnos,
  dayStatus, 
  readonly = false,
  cellSize = 80 
}: CellAssignmentsMobileProps) {
  // Obtener información del turno
  const getShiftInfo = (shiftId?: string) => {
    if (!shiftId) return null
    return shifts.find(shift => shift.id === shiftId)
  }

  // Obtener información del medio turno
  const getMedioTurnoInfo = (medioTurnoId?: string) => {
    if (!medioTurnoId) return null
    return mediosTurnos?.find(mt => mt.id === medioTurnoId)
  }

  // Renderizar estado del día
  const renderDayStatus = () => {
    if (dayStatus === "franco") {
      return (
        <div className="text-center font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
          FRANCO
        </div>
      )
    }
    
    if (dayStatus === "medio_franco") {
      return (
        <div className="text-center font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">
          1/2 FRANCO
        </div>
      )
    }
    
    return null
  }

  // Renderizar asignaciones
  const renderAssignments = () => {
    if (!assignments || assignments.length === 0) {
      return null
    }

    return assignments.map((assignment, index) => {
      // Caso especial: medio franco usa mediosTurnos o horas directas
      if (assignment.type === "medio_franco") {
        console.log("medio_franco assignment", assignment)
        
        // Primero intentar buscar por shiftId (si existe)
        let medioTurnoInfo = null
        if (assignment.shiftId) {
          medioTurnoInfo = getMedioTurnoInfo(assignment.shiftId)
        }
        
        // Si no hay shiftId o no se encuentra, usar horas directas del assignment
        if (!medioTurnoInfo) {
          const formatTime = (time?: string) => {
            if (!time) return ""
            try {
              const [hours, minutes] = time.split(':')
              return `${hours}:${minutes}`
            } catch {
              return time || ""
            }
          }

          return (
            <div key={index} className="border-l-2 border-orange-200 pl-2 mb-1">
              <div className="text-xs text-gray-600">
                {formatTime(assignment.startTime)} - {formatTime(assignment.endTime)}
              </div>
              {assignment.texto && (
                <div className="text-xs text-gray-500 mt-1 italic">
                  "{assignment.texto}"
                </div>
              )}
            </div>
          )
        }

        // Formatear horas
        const formatTime = (time?: string) => {
          if (!time) return ""
          try {
            const [hours, minutes] = time.split(':')
            return `${hours}:${minutes}`
          } catch {
            return time || ""
          }
        }

        return (
          <div key={index} className="border-l-2 border-orange-200 pl-2 mb-1">
            <div className="font-medium text-sm text-orange-600">
              {medioTurnoInfo.nombre}
            </div>
            <div className="text-xs text-gray-600">
              {formatTime(medioTurnoInfo.startTime)} - {formatTime(medioTurnoInfo.endTime)}
            </div>
            {assignment.texto && (
              <div className="text-xs text-gray-500 mt-1 italic">
                "{assignment.texto}"
              </div>
            )}
          </div>
        )
      }

      const shiftInfo = getShiftInfo(assignment.shiftId)
      
      if (!shiftInfo) {
        return (
          <div key={index} className="text-xs text-gray-500">
            Turno no encontrado
          </div>
        )
      }

      // Formatear horas
      const formatTime = (time?: string) => {
        if (!time) return ""
        try {
          const [hours, minutes] = time.split(':')
          return `${hours}:${minutes}`
        } catch {
          return time || ""
        }
      }

      return (
        <div key={index} className="border-l-2 border-gray-200 pl-2 mb-1">
          <div className="font-medium text-sm text-gray-800">
            {shiftInfo.name}
          </div>
          <div className="text-xs text-gray-600">
            {formatTime(shiftInfo.startTime)} - {formatTime(shiftInfo.endTime)}
          </div>
          {assignment.texto && (
            <div className="text-xs text-gray-500 mt-1 italic">
              "{assignment.texto}"
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="w-full p-2 min-h-[60px] bg-white border border-gray-100 rounded">
      {/* Estado del día (franco/medio franco) */}
      {renderDayStatus()}
      
      {/* Asignaciones */}
      {renderAssignments()}
      
      {/* Espacio vacío si no hay nada */}
      {!dayStatus || dayStatus === "normal" ? (
        assignments.length === 0 && (
          <div className="text-xs text-gray-400 text-center">
            Sin asignaciones
          </div>
        )
      ) : null}
    </div>
  )
}
