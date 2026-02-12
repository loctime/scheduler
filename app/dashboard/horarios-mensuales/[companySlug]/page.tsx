"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Calendar, Users, Clock } from "lucide-react"
import { Horario } from "@/lib/types"
import { useConfig } from "@/hooks/use-config"
import { format, parseISO, startOfWeek, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { WeekSchedule } from "@/components/schedule-calendar/week-schedule"
import { getCustomMonthRange, getMonthWeeks } from "@/lib/utils"
import { useExportSchedule } from "@/hooks/use-export-schedule"
import { ExportOverlay } from "@/components/export-overlay"
import { useCompanySlug } from "@/hooks/use-company-slug"
import type { EmployeeMonthlyStats } from "@/components/schedule-grid"
import { calculateDailyHours, calculateHoursBreakdown } from "@/lib/validations"
import { calculateTotalDailyHours, toWorkingHoursConfig } from "@/lib/domain/working-hours"
import { ShiftAssignment, ShiftAssignmentValue } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Share2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { usePublicMonthlySchedulesV2 } from "@/hooks/use-public-monthly-schedules-v2"

const normalizeAssignments = (value: ShiftAssignmentValue | undefined): ShiftAssignment[] => {
  if (!value || !Array.isArray(value) || value.length === 0) return []
  return (value as any[]).map((assignment) => ({
    type: assignment.type,
    shiftId: assignment.shiftId || "",
    startTime: assignment.startTime || "",
    endTime: assignment.endTime || "",
  }))
}

interface MonthGroup {
  monthKey: string // YYYY-MM
  monthName: string // "Enero 2024"
  monthDate: Date // Fecha del mes
  weeks: WeekGroup[]
}

interface WeekGroup {
  weekStartDate: Date
  weekEndDate: Date
  weekStartStr: string
  schedule: Horario | null
  weekDays: Date[]
}

interface PageProps {
  params: {
    companySlug: string
  }
}

export default function PublicMensualPage({ params }: PageProps) {
  const { companySlug } = params
  const { toast } = useToast()
  const { config } = useConfig(null) // Pasamos null para obtener config pública si existe

  const {
    monthGroups,
    companyName,
    isLoading,
    error,
    calculateMonthlyStats,
    refetch
  } = usePublicMonthlySchedulesV2({
    companySlug,
    employees: [], // En modo público no tenemos acceso a todos los empleados
    shifts: [],    // En modo público no tenemos acceso a todos los turnos
    config: config,
    monthStartDay: 1,
    weekStartsOn: 1
  })

  const handleShare = async () => {
    try {
      const url = window.location.href
      await navigator.clipboard.writeText(url)
      toast({
        title: "✅ Enlace copiado",
        description: "El enlace del horario mensual se ha copiado al portapapeles"
      })
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "No se pudo copiar el enlace"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando horario mensual...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/pwa/horario">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al horario semanal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!companyName || monthGroups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Sin horarios publicados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Esta empresa aún no ha publicado horarios mensuales.
            </p>
            <Link href={`/pwa/horario/${companySlug}`}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ver horario semanal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {companyName}
              </h1>
              <p className="text-sm text-gray-600">
                Horario mensual público
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center space-x-2"
              >
                <Share2 className="h-4 w-4" />
                <span>Compartir</span>
              </Button>
              <Link href={`/pwa/horario/${companySlug}`}>
                <Button variant="outline" size="sm">
                  Ver semanal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Meses publicados</p>
                  <p className="text-2xl font-bold text-gray-900">{monthGroups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total semanas</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monthGroups.reduce((total, month) => total + month.weeks.length, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Período</p>
                  <p className="text-lg font-bold text-gray-900">
                    {monthGroups.length > 0 && (
                      <>
                        {format(monthGroups[monthGroups.length - 1].monthDate, "MMM yyyy", { locale: es })} - {" "}
                        {format(monthGroups[0].monthDate, "MMM yyyy", { locale: es })}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Schedules */}
        <div className="space-y-6">
          {monthGroups.map((monthGroup) => (
            <Card key={monthGroup.monthKey}>
              <CardHeader>
                <CardTitle className="text-xl">{monthGroup.monthName}</CardTitle>
              </CardHeader>
              <CardContent>
                {monthGroup.weeks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No hay horarios publicados para este mes
                  </p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {monthGroup.weeks.map((weekGroup) => (
                      <AccordionItem key={weekGroup.weekStartStr} value={weekGroup.weekStartStr}>
                        <AccordionTrigger className="text-left">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span>
                              Semana del {format(weekGroup.weekStartDate, "dd 'de' MMMM", { locale: es })}
                            </span>
                            <span className="text-sm text-gray-500">
                              {format(weekGroup.weekStartDate, "dd/MM/yyyy")} - {format(weekGroup.weekEndDate, "dd/MM/yyyy")}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-4">
                            {weekGroup.schedule && (
                              <WeekSchedule
                                weekDays={weekGroup.weekDays}
                                weekIndex={0}
                                weekSchedule={weekGroup.schedule}
                                employees={weekGroup.schedule.employeesSnapshot || []}
                                allEmployees={weekGroup.schedule.employeesSnapshot || []}
                                shifts={[]}
                                monthRange={{
                                  start: getCustomMonthRange(weekGroup.weekStartDate, 1).startDate,
                                  end: getCustomMonthRange(weekGroup.weekStartDate, 1).endDate
                                }}
                                employeeStats={[]}
                                readonly={true}
                                showActions={false}
                                title={`Semana del ${format(weekGroup.weekStartDate, "dd 'de' MMMM", { locale: es })}`}
                              />
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
