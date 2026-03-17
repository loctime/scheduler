"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { format, addDays } from "date-fns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Clock, Coffee } from "lucide-react"
import { usePublicHorario } from "@/hooks/use-public-horario"
import { getTodayScheduleInfo } from "@/lib/pwa-today-schedule-utils"
import type { Turno } from "@/lib/types"
import { getCache, setCache } from "@/lib/cache/indexeddb-cache"

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
  /** "inline" = una línea compacta para el header; "card" = tarjeta completa (default) */
  variant?: "card" | "inline"
}

/**
 * Bloque "HORARIO DE HOY" - protagonista del Home PWA.
 * Muestra el horario del día con estados visuales diferenciados:
 * - Trabaja (normal)
 * - Medio franco (warning)
 * - Franco completo (muted)
 */
function PwaTodayScheduleCardComponent({ companySlug, horario: horarioProp, shifts: shiftsProp, variant = "card" }: PwaTodayScheduleCardProps) {
  const { horario: horarioFromHook, isLoading } = usePublicHorario(companySlug)
  const horario = horarioProp ?? horarioFromHook
  const [currentViewer, setCurrentViewer] = useState<{
    employeeId: string
    employeeName: string
  } | null>(null)
  const scheduleInfoCacheRef = useRef<ReturnType<typeof getTodayScheduleInfo> | null>(null)
  const lastCacheKeyRef = useRef<string>("")

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

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")
  const tomorrow = addDays(today, 1)
  const tomorrowStr = format(tomorrow, "yyyy-MM-dd")
  const currentWeek = horario?.weeks?.[horario?.publishedWeekId]
  const dayData = currentWeek?.days?.[todayStr] as Record<string, any> | undefined
  const todayAssignments = currentViewer && currentViewer.employeeId ? dayData?.[currentViewer.employeeId] : undefined
  const tomorrowData = currentWeek?.days?.[tomorrowStr] as Record<string, any> | undefined
  const tomorrowAssignments = currentViewer && currentViewer.employeeId ? tomorrowData?.[currentViewer.employeeId] : undefined
  
  // OBTENER dayStatus DE MAÑANA (fuente de verdad)
  const tomorrowDayStatus = currentViewer && currentViewer.employeeId 
    ? currentWeek?.dayStatus?.[tomorrowStr]?.[currentViewer.employeeId] as "normal" | "franco" | "medio_franco" | undefined
    : undefined

  // FUNCIÓN PARA OBTENER TEXTO CORRECTO DEL ESTADO
  const getTomorrowStatusText = (dayStatus: "normal" | "franco" | "medio_franco" | undefined, fallbackInfo: ReturnType<typeof getTodayScheduleInfo>) => {
    // Priorizar dayStatus sobre el análisis de assignments
    if (dayStatus === "medio_franco") {
      // Para medio franco, mostrar horario si existe, sino solo el label
      if (fallbackInfo.timeBlocks.length > 0) {
        return fallbackInfo.timeBlocks.map((b) => {
          const start = b.startTime.endsWith(":00") ? b.startTime.slice(0, -3) : b.startTime
          const end = b.endTime.endsWith(":00") ? b.endTime.slice(0, -3) : b.endTime
          return `${start} a ${end}`
        }).join(", ")
      } else {
        return "1/2 Franco"
      }
    }
    
    if (dayStatus === "franco") {
      return "Franco"
    }
    
    // Para "normal" o undefined, usar el análisis de assignments (trabaja)
    if (fallbackInfo.status === "franco") {
      return "Franco"
    }
    
    if (fallbackInfo.status === "medio_franco") {
      return fallbackInfo.timeBlocks.length > 0
        ? fallbackInfo.timeBlocks.map((b) => {
            const start = b.startTime.endsWith(":00") ? b.startTime.slice(0, -3) : b.startTime
            const end = b.endTime.endsWith(":00") ? b.endTime.slice(0, -3) : b.endTime
            return `${start} a ${end}`
          }).join(", ")
        : "Medio franco"
    }
    
    // Trabaja - mostrar horarios
    return fallbackInfo.timeBlocks.length > 0
      ? fallbackInfo.timeBlocks.map((b) => {
          const start = b.startTime.endsWith(":00") ? b.startTime.slice(0, -3) : b.startTime
          const end = b.endTime.endsWith(":00") ? b.endTime.slice(0, -3) : b.endTime
          return `${start} a ${end}`
        }).join(", ")
      : "—"
  }

  const isLoadingState = !horarioProp && (isLoading || !horario?.publishedWeekId)
  
  // Cache del scheduleInfo para evitar recálculos innecesarios
  // IMPORTANTE: Este hook debe ejecutarse siempre, antes de cualquier early return
  const defaultScheduleInfo = getTodayScheduleInfo(undefined, [])
  const [scheduleInfo, setScheduleInfo] = useState<ReturnType<typeof getTodayScheduleInfo>>(defaultScheduleInfo)
  
  // IMPORTANTE: Este useEffect debe ejecutarse siempre, antes de cualquier early return
  useEffect(() => {
    if (!currentViewer || !horario || isLoadingState) {
      const defaultInfo = getTodayScheduleInfo(undefined, [])
      setScheduleInfo(defaultInfo)
      scheduleInfoCacheRef.current = defaultInfo
      return
    }
    
    // Si es variant inline, usar fecha de mañana para el cache key
    const dateStrForCache = variant === "inline" ? tomorrowStr : todayStr
    const cacheKey = `schedule-info-${companySlug}-${currentViewer.employeeId}-${dateStrForCache}-${horario.publishedWeekId}`
    
    // Si es el mismo día y mismo horario, usar cache en memoria
    if (cacheKey === lastCacheKeyRef.current && scheduleInfoCacheRef.current) {
      setScheduleInfo(scheduleInfoCacheRef.current)
      return
    }
    
    // 1. Intentar cargar desde cache IndexedDB primero
    getCache<ReturnType<typeof getTodayScheduleInfo>>(cacheKey)
      .then((cachedInfo) => {
        if (cachedInfo) {
          scheduleInfoCacheRef.current = cachedInfo
          lastCacheKeyRef.current = cacheKey
          setScheduleInfo(cachedInfo)
        }
      })
      .catch(() => {
        // Ignorar errores de cache
      })
    
    // 2. Calcular scheduleInfo
    // Si es variant inline, usar horario de mañana, sino usar hoy
    const assignmentsToUse = variant === "inline" ? tomorrowAssignments : todayAssignments
    const info = getTodayScheduleInfo(assignmentsToUse, shifts)
    scheduleInfoCacheRef.current = info
    lastCacheKeyRef.current = cacheKey
    setScheduleInfo(info)
    
    // 3. Cachear en IndexedDB en background
    setCache(cacheKey, info).catch(() => {
      // Ignorar errores de cache
    })
  }, [currentViewer, horario, isLoadingState, companySlug, todayStr, tomorrowStr, todayAssignments, tomorrowAssignments, shifts, variant])

  if (!currentViewer) return null

  if (variant === "inline") {
    if (isLoadingState) {
      return (
        <p className="text-sm text-muted-foreground">
          mañana: <span className="inline-block h-4 w-24 align-middle bg-muted rounded animate-pulse" />
        </p>
      )
    }
    
    // USAR dayStatus PRIORITARIO sobre assignments
    const text = getTomorrowStatusText(tomorrowDayStatus, scheduleInfo)
    
    return (
      <p className="text-sm text-muted-foreground">
        mañana: <span className="font-medium text-foreground tabular-nums">{text}</span>
      </p>
    )
  }

  if (isLoadingState) {
    return (
      <Card className="overflow-hidden border rounded-none sm:rounded-md">
        <CardHeader className="py-3 px-4">
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </CardContent>
      </Card>
    )
  }

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

// Memoizar el componente principal para evitar re-renders innecesarios
export const PwaTodayScheduleCard = React.memo(PwaTodayScheduleCardComponent, (prevProps, nextProps) => {
  // Solo re-renderizar si cambian props críticas
  return (
    prevProps.companySlug === nextProps.companySlug &&
    prevProps.variant === nextProps.variant &&
    prevProps.horario?.publishedWeekId === nextProps.horario?.publishedWeekId &&
    prevProps.shifts?.length === nextProps.shifts?.length
  )
})

function PwaTodayScheduleCardContent({ employeeName, scheduleInfo }: PwaTodayScheduleCardContentProps) {
  const { status, timeBlocks } = scheduleInfo

  const variants = {
    trabaja: {
      card: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      header: "text-blue-900 dark:text-blue-100",
      iconColor: "text-blue-600",
    },
    medio_franco: {
      card: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      header: "text-amber-900 dark:text-amber-100",
      iconColor: "text-amber-600",
    },
    franco: {
      card: "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700",
      header: "text-slate-700 dark:text-slate-300",
      iconColor: "text-slate-500",
    },
  } as const

  const v = variants[status]
  const barColorFallback = "#9ca3af"

  return (
    <Card className={`overflow-hidden border rounded-none sm:rounded-md ${v.card} w-full`}>
      <CardHeader className="py-3 px-4 sm:px-5 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className={`h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0 ${v.iconColor}`} />
          <span className={`font-semibold text-sm sm:text-base truncate ${v.header}`}>
            HORARIO DE HOY – {employeeName}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 pt-0">
        {status === "franco" ? (
          <p className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-400">
            FRANCO
          </p>
        ) : (
          <div className="space-y-1">
            {timeBlocks.length > 0 ? (
              timeBlocks.map((block, i) => (
                <div key={i} className="flex items-center gap-3 py-2 min-h-0">
                  <div
                    className="w-1 shrink-0 self-stretch rounded-full min-h-[1.5rem]"
                    style={{ backgroundColor: block.color || barColorFallback }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">
                      {block.startTime} – {block.endTime}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3 py-2">
                <div
                  className="w-1 shrink-0 self-stretch rounded-full min-h-[1.5rem]"
                  style={{ backgroundColor: barColorFallback }}
                  aria-hidden
                />
                <p className="text-sm font-medium text-muted-foreground">
                  {status === "medio_franco"
                    ? "Medio franco (sin horario detallado)"
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
