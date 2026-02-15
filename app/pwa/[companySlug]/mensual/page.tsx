"use client"

import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, UserCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PwaViewerBadge, useViewer, notifyViewerChanged } from "@/components/pwa/PwaViewerBadge"
import { UserStatusMenu } from "@/components/pwa/UserStatusMenu"
import { PwaEmployeeSelectorModal } from "@/components/pwa/PwaEmployeeSelectorModal"
import { useToast } from "@/hooks/use-toast"
import { useParams } from "next/navigation"
import { useMonthlySchedules } from "@/hooks/use-monthly-schedules"
import { useOwnerIdFromSlug, useEmployeesByOwnerId, useShiftsByOwnerId, useConfigByOwnerId } from "@/hooks/use-owner-data"
import { MonthlyScheduleView } from "@/components/monthly-schedule-view"
import { PWA_THEMES } from "@/lib/pwa-themes"
import type { MonthGroup } from "@/lib/monthly-utils"

/**
 * Página PWA de horarios mensuales bajo /pwa/[slug]/mensual.
 * Obtiene ownerId desde slug y usa useMonthlySchedules.
 */
export default function PwaMensualPage() {
  const params = useParams()
  const companySlug = params.companySlug as string
  const searchParams = useSearchParams()
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined
  const viewer = useViewer()
  const preferredEmployeeId = viewer?.employeeId ?? null
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false)
  const { toast } = useToast()

  const { ownerId } = useOwnerIdFromSlug(companySlug)
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
    ownerId: ownerId ?? "",
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

  if (!companySlug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Empresa no especificada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              La URL debe incluir el identificador de la empresa.
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
            <Link href={`/pwa/${companySlug}/home`}>
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
              No hay horarios mensuales para esta empresa.
            </p>
            <Link href={`/pwa/${companySlug}/home`}>
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
      <div className={["border-b sticky top-0 z-10", PWA_THEMES.mensual.soft].join(" ")}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {config?.nombreEmpresa ?? "Horario mensual"}
              </h1>
              <p className="text-sm text-muted-foreground">Vista mensual</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowEmployeeSelector(true)}
                className="shrink-0 rounded-full p-0 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Cambiar empleado"
              >
                {viewer ? (
                  <PwaViewerBadge companySlug={undefined} />
                ) : (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <UserCircle className="h-5 w-5" />
                  </span>
                )}
              </button>
              <UserStatusMenu />
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
          mobileIndividualOnly
          preferredEmployeeId={preferredEmployeeId}
        />
      </div>

      <PwaEmployeeSelectorModal
        open={showEmployeeSelector}
        onClose={() => setShowEmployeeSelector(false)}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        onSelect={(employeeId, employeeName) => {
          const v = { employeeId, employeeName }
          if (typeof window !== "undefined") {
            localStorage.setItem("horario.viewer", JSON.stringify(v))
            notifyViewerChanged(v)
          }
          toast({ title: "Identificación guardada", description: `Hola, ${employeeName}` })
          setShowEmployeeSelector(false)
        }}
      />
    </div>
  )
}
