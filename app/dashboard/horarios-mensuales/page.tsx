"use client"

import { useMemo, useCallback } from "react"
import { format } from "date-fns"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useData } from "@/contexts/data-context"
import { useConfig } from "@/hooks/use-config"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { getCompanySlugFromOwnerId } from "@/lib/public-companies"
import { useToast } from "@/hooks/use-toast"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { ExportOverlay } from "@/components/export-overlay"
import { useMonthlySchedule } from "@/hooks/use-monthly-schedule"
import { MonthlyScheduleView } from "@/components/monthly-schedule-view"
import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import type { Horario } from "@/lib/types"

export default function HorariosMensualesPage() {
  const { employees, shifts, loading: dataLoading, user, userData } = useData()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const { config } = useConfig(user)
  const { toast } = useToast()
  const { exporting, exportImage, exportPDF, exportExcel } = useExportSchedule()

  const {
    monthGroups,
    isLoading: scheduleLoading,
    calculateMonthlyStats,
  } = useMonthlySchedule({
    ownerId,
    employees,
    shifts,
    config,
    monthStartDay: config?.mesInicioDia || 1,
    weekStartsOn: (config?.semanaInicioDia || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
  })

  const isLoading = dataLoading || scheduleLoading

  const handleExportWeekImage = useCallback(
    async (weekStartDate: Date, weekEndDate: Date) => {
      const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
      await exportImage(weekId, `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.png`, {
        nombreEmpresa: config?.nombreEmpresa,
        colorEmpresa: config?.colorEmpresa,
      })
    },
    [exportImage, config]
  )

  const handleExportWeekPDF = useCallback(
    async (weekStartDate: Date, weekEndDate: Date) => {
      const weekId = `schedule-week-${format(weekStartDate, "yyyy-MM-dd")}`
      const filename = `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.pdf`
      
      await exportPDF(
        weekId,
        filename,
        {
          nombreEmpresa: config?.nombreEmpresa,
          colorEmpresa: config?.colorEmpresa,
        }
      )
    },
    [exportPDF, config]
  )

  const handleExportWeekExcel = useCallback(
    async (weekStartDate: Date, weekDays: Date[], weekSchedule: Horario | null) => {
      await exportExcel(
        weekDays,
        employees,
        shifts,
        weekSchedule,
        `horario-semana-${format(weekStartDate, "yyyy-MM-dd")}.xlsx`
      )
    },
    [exportExcel, employees, shifts]
  )

  const handleShareLink = useCallback(async () => {
    if (!user) return

    if (ownerId) {
      const companySlug = await getCompanySlugFromOwnerId(ownerId)
      const shareUrl = companySlug
        ? `${window.location.origin}/pwa/${companySlug}/mensual`
        : null

      if (!shareUrl) {
        toast({
          title: "No disponible",
          description: "No se encontró el enlace público. Publica tu horario primero.",
          variant: "destructive",
        })
        return
      }

      try {
        await navigator.clipboard.writeText(shareUrl)
        toast({
          title: "Enlace copiado",
          description: "El enlace PWA se ha copiado al portapapeles. Compártelo con tu equipo.",
        })
      } catch {
        toast({
          title: "Error",
          description: "No se pudo copiar el enlace",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "No disponible",
        description: "No se pudo obtener el identificador para compartir.",
        variant: "destructive",
      })
    }
  }, [user, ownerId, toast])

  return (
    <>
      <ExportOverlay isExporting={exporting} message="Exportando horario..." />
      <DashboardLayout user={user}>
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              {config?.nombreEmpresa && (
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1">
                  {config.nombreEmpresa}
                </h1>
              )}
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Horarios Mensuales</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Vista jerárquica de todos los horarios organizados por mes y semana
              </p>
            </div>
            {user && (
              <Button onClick={handleShareLink} variant="outline" size="default" className="shrink-0">
                <Share2 className="mr-2 h-4 w-4" />
                Compartir enlace
              </Button>
            )}
          </div>

          {isLoading ? (
            <Card className="p-6 sm:p-8 md:p-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm sm:text-base text-muted-foreground">Cargando datos...</p>
            </Card>
          ) : employees.length === 0 ? (
            <Card className="p-6 sm:p-8 md:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">
                No hay empleados registrados. Agrega empleados para crear horarios.
              </p>
            </Card>
          ) : shifts.length === 0 ? (
            <Card className="p-6 sm:p-8 md:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">
                No hay turnos configurados. Agrega turnos para crear horarios.
              </p>
            </Card>
          ) : (
            <MonthlyScheduleView
              monthGroups={monthGroups}
              companyName={config?.nombreEmpresa}
              employees={employees}
              shifts={shifts}
              config={config}
              monthStartDay={config?.mesInicioDia || 1}
              isLoading={false}
              calculateMonthlyStats={calculateMonthlyStats}
              onExportImage={handleExportWeekImage}
              onExportPDF={handleExportWeekPDF}
              onExportExcel={handleExportWeekExcel}
              exporting={exporting}
              readonly
            />
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
