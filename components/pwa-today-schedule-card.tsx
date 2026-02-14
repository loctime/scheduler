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
    const currentWeek = horario.weeks?.[horario.publishedWeekId]
    return buildShiftsFromAssignments(horario.ownerId, currentWeek?.days)
  }, [horario, shiftsProp])

  if (!currentViewer) return null

  const isLoadingState = !horarioProp && (isLoading || !horario?.publishedWeekId)
  if (isLoadingState) {
    return (
      <Card className="overflow-hidden border-2">
        <CardHeader className="pb-4">
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
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

  return (
    <Card className={`overflow-hidden border-2 ${v.card} w-full`}>
      <CardHeader className="pb-3 pt-6 px-6 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white/60 dark:bg-black/20 ${v.iconColor}`}>
              <Calendar className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <CardTitle className={`text-xl sm:text-2xl font-bold ${v.title}`}>
                HORARIO DE HOY
              </CardTitle>
              <p className="text-sm sm:text-base font-medium text-muted-foreground mt-0.5">
                {employeeName}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`${v.badge} text-xs sm:text-sm font-bold px-4 py-1.5 w-fit`}>
            {v.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 sm:px-8 pb-8 pt-0">
        {status === "franco" ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4">
            <Icon className={`h-12 w-12 sm:h-16 sm:w-16 ${v.iconColor}`} />
            <p className="text-2xl sm:text-3xl font-bold text-slate-600 dark:text-slate-400">
              ¡Franco completo!
            </p>
            <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
              Hoy tenés descanso
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {timeBlocks.length > 0 ? (
              timeBlocks.map((block, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 sm:p-5 rounded-xl bg-white/70 dark:bg-black/20 border"
                >
                  <Clock className={`h-6 w-6 sm:h-7 sm:w-7 shrink-0 ${v.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    {block.label && (
                      <p className="text-sm font-medium text-muted-foreground mb-1">{block.label}</p>
                    )}
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">
                      {block.startTime} – {block.endTime}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-4 p-4 sm:p-5 rounded-xl bg-white/70 dark:bg-black/20 border">
                <Icon className={`h-6 w-6 sm:h-7 sm:w-7 shrink-0 ${v.iconColor}`} />
                <p className="text-lg sm:text-xl font-medium text-muted-foreground">
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
