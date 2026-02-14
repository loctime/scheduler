"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Share2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useMonthlySchedules } from "@/hooks/use-monthly-schedules"
import { useEmployeesByOwnerId, useShiftsByOwnerId, useConfigByOwnerId } from "@/hooks/use-owner-data"
import { MonthlyScheduleView } from "@/components/monthly-schedule-view"
import type { MonthGroup } from "@/lib/monthly-utils"

/**
 * Página PWA de horarios mensuales.
 * Misma fuente que el dashboard: Firestore schedules, employees, shifts, config (ownerId == uid).
 * Query: ?uid=XXXX (obligatorio). Opcional: ?year=YYYY&month=M
 */
export default function PwaMensualPage() {
  const searchParams = useSearchParams()
  const uid = searchParams.get("uid") ?? ""
  const ownerId = uid || null
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined
  const { toast } = useToast()

  const { employees, loading: employeesLoading } = useEmployeesByOwnerId(ownerId)
  const { shifts, loading: shiftsLoading } = useShiftsByOwnerId(ownerId)
  const { config, loading: configLoading } = useConfigByOwnerId(ownerId)

  const monthStartDay = config?.mesInicioDia ?? 1
  const weekStartsOn = (config?.semanaInicioDia ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  const {
    monthGroups: allMonthGroups,
    isLoading: schedulesLoading,
    error,
    calculateMonthlyStats,
  } = useMonthlySchedules({
    ownerId: uid,
    employees,
    shifts,
    config,
    monthStartDay,
    weekStartsOn,
  })

  const isLoading = employeesLoading || shiftsLoading || configLoading || schedulesLoading

  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (year == null && month == null) return allMonthGroups
    return allMonthGroups.filter((g) => {
      const [gYear, gMonth] = g.monthKey.split("-").map(Number)
      if (year != null && gYear !== year) return false
      if (month != null && gMonth !== month) return false
      return true
    })
  }, [allMonthGroups, year, month])

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Enlace copiado",
        description: "El enlace del horario mensual se ha copiado al portapapeles",
      })
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive",
      })
    }
  }

  if (!uid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Parámetro requerido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Indica el usuario con <code className="bg-muted px-1 rounded">?uid=</code> en la URL.
              Ejemplo: /pwa/mensual?uid=tu-owner-id
            </p>
            <Link href="/pwa">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando horario mensual...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link href="/pwa">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (monthGroups.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Sin horarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No hay horarios mensuales para este usuario.
            </p>
            <Link href="/pwa">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {config?.nombreEmpresa ?? "Horario mensual"}
              </h1>
              <p className="text-sm text-muted-foreground">Vista mensual (misma fuente que el dashboard)</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Compartir
              </Button>
              <Link href="/pwa">
                <Button variant="outline" size="sm">
                  Volver
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MonthlyScheduleView
          monthGroups={monthGroups}
          companyName={config?.nombreEmpresa}
          employees={employees}
          shifts={shifts}
          config={config ?? undefined}
          monthStartDay={monthStartDay}
          isLoading={false}
          calculateMonthlyStats={calculateMonthlyStats}
          readonly
        />
      </div>
    </div>
  )
}
