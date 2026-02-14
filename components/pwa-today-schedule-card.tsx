"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Coffee, PartyPopper } from "lucide-react"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { getTodayScheduleInfo } from "@/lib/pwa-today-schedule-utils"
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
    ownerId,
    userId: ownerId,
  })) as Turno[]
}

/** Convierte snapshot de turnos (id, name, color) del horario público a Turno[] */
function shiftsFromWeekSnapshot(
  weekShifts: Array<{ id: string; name: string; color: string }> | undefined,
  ownerId: string
): Turno[] | null {
  if (!Array.isArray(weekShifts) || weekShifts.length === 0) return null
  return weekShifts.map((s) => ({
    id: s.id,
    name: s.name || `Turno ${s.id}`,
    color: s.color?.trim() || "#9ca3af",
    ownerId,
    userId: ownerId,
  })) as Turno[]
}

interface PwaTodayScheduleCardProps {
  companySlug: string
  horario?: any
  shifts?: Turno[]
}

/**
 * Bloque "HORARIO DE HOY" - protagonista del Home PWA.
 * Muestra el horario del día con estados visuales diferenciados:
 * - Trabaja (normal)
 * - Medio franco (warning)
 * - Franco completo (muted)
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
    const ownerId = horario.ownerId ?? ""
    const currentWeek = horario.weeks?.[horario.publishedWeekId]
    const fromSnapshot = shiftsFromWeekSnapshot(currentWeek?.shifts, ownerId)
    if (fromSnapshot) return fromSnapshot
    return buildShiftsFromAssignments(ownerId, currentWeek?.days)
  }, [horario, shiftsProp])

  if (!currentViewer) return null

  const isLoadingState = !horarioProp && (isLoading || !horario?.publishedWeekId)
  if (isLoadingState) {
    return (
      <Card className="overflow-hidden border">
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")
  const currentWeek = horario?.weeks?.[horario?.publishedWeekId]
  const dayData = currentWeek?.days?.[todayStr] as Record<string, any> | undefined
  const todayAssignments = dayData?.[currentViewer.employeeId]

  const scheduleInfo = getTodayScheduleInfo(todayAssignments, shifts)

  return (
    <PwaTodayScheduleCardContent
      employeeName={currentViewer.employeeName}
      scheduleInfo={scheduleInfo}
    />
  )
}

interface PwaTodayScheduleCardContentProps {
  employeeName: string
  scheduleInfo: ReturnType<typeof getTodayScheduleInfo>
}

function PwaTodayScheduleCardContent({ employeeName, scheduleInfo }: PwaTodayScheduleCardContentProps) {
  const { status, timeBlocks } = scheduleInfo

  const variants = {
    trabaja: {
      card: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      title: "text-blue-900 dark:text-blue-100",
      badge: "bg-blue-600 text-white border-blue-700 hover:bg-blue-600",
      label: "TRABAJA",
      icon: Clock,
      iconColor: "text-blue-600",
    },
    medio_franco: {
      card: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      title: "text-amber-900 dark:text-amber-100",
      badge: "bg-amber-500 text-amber-950 border-amber-600 hover:bg-amber-500",
      label: "MEDIO FRANCO",
      icon: Coffee,
      iconColor: "text-amber-600",
    },
    franco: {
      card: "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700",
      title: "text-slate-700 dark:text-slate-300",
      badge: "bg-slate-500 text-white border-slate-600 hover:bg-slate-500",
      label: "FRANCO COMPLETO",
      icon: PartyPopper,
      iconColor: "text-slate-500",
    },
  } as const

  const v = variants[status]
  const Icon = v.icon

  const barColorFallback = "#9ca3af"

  return (
    <Card className={`overflow-hidden border ${v.card} w-full`}>
      <CardHeader className="py-3 px-4 sm:px-5 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md bg-white/60 dark:bg-black/20 ${v.iconColor}`}>
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <CardTitle className={`text-base sm:text-lg font-bold ${v.title}`}>
                HORARIO DE HOY
              </CardTitle>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                {employeeName}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`${v.badge} text-xs font-bold px-3 py-1 w-fit`}>
            {v.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 pt-0">
        {status === "franco" ? (
          <div className="flex flex-col items-center justify-center py-6 sm:py-8 gap-2">
            <Icon className={`h-10 w-10 sm:h-12 sm:w-12 ${v.iconColor}`} />
            <p className="text-lg sm:text-xl font-bold text-slate-600 dark:text-slate-400">
              ¡Franco completo!
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hoy tenés descanso
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {timeBlocks.length > 0 ? (
              timeBlocks.map((block, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 px-2 rounded-md bg-white/50 dark:bg-black/10 min-h-0"
                >
                  <div
                    className="w-1 shrink-0 self-stretch rounded-full min-h-[2rem]"
                    style={{ backgroundColor: block.color || barColorFallback }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    {block.label && (
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">{block.label}</p>
                    )}
                    <p className="text-base sm:text-lg font-semibold tabular-nums tracking-tight">
                      {block.startTime} – {block.endTime}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3 py-2 px-2 rounded-md bg-white/50 dark:bg-black/10">
                <div
                  className="w-1 shrink-0 self-stretch rounded-full min-h-[2rem]"
                  style={{ backgroundColor: barColorFallback }}
                  aria-hidden
                />
                <p className="text-sm font-medium text-muted-foreground">
                  {status === "medio_franco"
                    ? "Medio franco asignado (sin horario detallado)"
                    : "Sin horario detallado"}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
