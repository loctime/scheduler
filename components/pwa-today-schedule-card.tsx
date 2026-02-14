"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicHorario } from "@/hooks/use-public-horario"
import type { Turno } from "@/lib/types"

const buildShiftsFromAssignments = (ownerId: string, days?: Record<string, any>) => {
  const shiftIds = new Set<string>()
  if (days) {
    Object.values(days).forEach((dayAssignments) => {
      if (dayAssignments && typeof dayAssignments === "object") {
        Object.values(dayAssignments as Record<string, any>).forEach((assignments) => {
          if (!Array.isArray(assignments)) return
          assignments.forEach((assignment) => {
            if (typeof assignment === "string") {
              shiftIds.add(assignment)
              return
            }
            if (assignment && typeof assignment === "object" && "shiftId" in assignment && assignment.shiftId) {
              shiftIds.add(assignment.shiftId)
            }
          })
        })
      }
    })
  }

  return Array.from(shiftIds).map((shiftId) => ({
    id: shiftId,
    name: `Turno ${shiftId}`,
    color: "#9ca3af",
    userId: ownerId,
  })) as Turno[]
}

interface PwaTodayScheduleCardProps {
  companySlug: string
  /** Datos ya cargados (evita llamada duplicada a Firestore cuando se usa en public-horario-page) */
  horario?: any
  shifts?: Turno[]
}

/**
 * Bloque "HORARIO DE HOY" - card azul que muestra el horario del día
 * para el empleado identificado. Reutilizable en PWA home y horario.
 *
 * - Usa usePublicHorario si no recibe horario/shifts (no duplica lógica Firestore)
 * - Lee currentViewer desde localStorage (compartido con PublicHorarioPage)
 * - Solo se muestra si hay empleado identificado
 */
export function PwaTodayScheduleCard({ companySlug, horario: horarioProp, shifts: shiftsProp }: PwaTodayScheduleCardProps) {
  const { horario: horarioFromHook, isLoading } = usePublicHorario(companySlug)
  const horario = horarioProp ?? horarioFromHook
  const [currentViewer, setCurrentViewer] = useState<{
    employeeId: string
    employeeName: string
  } | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const savedViewer = localStorage.getItem("horario.viewer")
      if (savedViewer) {
        const viewer = JSON.parse(savedViewer)
        setCurrentViewer(viewer)
      }
    } catch {
      // Ignorar errores de parse
    }
  }, [])

  const shifts = useMemo(() => {
    if (shiftsProp) return shiftsProp
    if (!horario) return []
    const currentWeek = horario.weeks?.[horario.publishedWeekId]
    return buildShiftsFromAssignments(horario.ownerId, currentWeek?.days)
  }, [horario, shiftsProp])

  // No mostrar si no hay empleado identificado
  if (!currentViewer) {
    return null
  }

  // Loading: skeleton compacto (solo cuando no hay datos pre-cargados)
  const isLoadingState = !horarioProp && (isLoading || !horario?.publishedWeekId)
  if (isLoadingState) {
    return (
      <div className="w-full">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-36 bg-blue-100" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full bg-blue-100" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")
  const currentWeek = horario.weeks?.[horario.publishedWeekId]
  const dayData = currentWeek?.days?.[todayStr] as Record<string, any> | undefined
  const todayAssignments = dayData?.[currentViewer.employeeId]

  const renderTodaySchedule = (): string => {
    if (!todayAssignments || (Array.isArray(todayAssignments) && todayAssignments.length === 0)) {
      return "🎉 Hoy tenés franco"
    }

    if (Array.isArray(todayAssignments)) {
      return todayAssignments
        .map((assignment: any) => {
          if (assignment && typeof assignment === "object") {
            if (assignment.type === "franco") return "Franco"
            if (assignment.type === "medio-franco") return "Medio franco"
            if (assignment.type === "shift") {
              if (assignment.startTime && assignment.endTime) {
                return `${assignment.startTime} a ${assignment.endTime}`
              }
              if (assignment.shiftId) {
                const shift = shifts.find((s) => s.id === assignment.shiftId)
                if (shift) return `${shift.startTime} a ${shift.endTime}`
              }
            }
            return assignment.shiftId || "Turno"
          }
          if (typeof assignment === "string") {
            const shift = shifts.find((s) => s.id === assignment)
            if (shift) return `${shift.startTime} a ${shift.endTime}`
            return assignment
          }
          return "Turno"
        })
        .join(" • ")
    }

    if (typeof todayAssignments === "string") {
      const shift = shifts.find((s) => s.id === todayAssignments)
      if (shift) return `${shift.startTime} a ${shift.endTime}`
      return todayAssignments
    }

    return String(todayAssignments)
  }

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-blue-900">HORARIO DE HOY</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-sm text-blue-700 mb-2">{currentViewer.employeeName}</p>
          <p className="text-xs text-blue-600">{renderTodaySchedule()}</p>
        </div>
      </CardContent>
    </Card>
  )
}
