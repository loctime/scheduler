"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Calendar, Users, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePublicSchedule } from "@/hooks/use-public-schedule"
import { usePublicWeekNavigation } from "@/hooks/use-public-week-navigation"
import { DateDisplay } from "@/components/ui/date-display"

export default function PublicHorarioPage() {
  const params = useParams()
  const publicScheduleId = params.publicScheduleId as string
  
  const { publicSchedule, isLoading, error } = usePublicSchedule(publicScheduleId)
  const { 
    currentWeek, 
    isLoading: weekLoading, 
    goToPreviousWeek, 
    goToNextWeek,
    formatWeekDisplay,
    formatWeekRange
  } = usePublicWeekNavigation(publicSchedule?.publishedWeekId || "")

  const isLoadingData = isLoading || weekLoading

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-2">
              <Calendar className="h-12 w-12 mx-auto" />
            </div>
            <h1 className="text-lg font-semibold mb-2">Horario no encontrado</h1>
            <p className="text-gray-600 text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoadingData || !publicSchedule || !currentWeek) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-24" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-6 w-6" />
                {publicSchedule.companyName}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Horario público de empleados
              </p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Público
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Semana anterior
            </Button>

            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {formatWeekDisplay()}
              </div>
              <div className="text-sm text-gray-600">
                {formatWeekRange()}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
              className="flex items-center gap-2"
            >
              Semana siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="max-w-4xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horario Semanal
            </CardTitle>
            <p className="text-sm text-gray-600">
              Semana {currentWeek.weekNumber} - {currentWeek.startDate} al {currentWeek.endDate}
            </p>
          </CardHeader>
          <CardContent>
            {publicSchedule.weekData?.assignments ? (
              <div className="space-y-4">
                {Object.entries(publicSchedule.weekData.assignments).map(([date, dayAssignments]) => (
                  <div key={date} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 text-gray-900">
                      {new Date(date).toLocaleDateString('es-AR', { 
                        weekday: 'long', 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}
                    </h3>
                    <div className="grid gap-2">
                      {Object.entries(dayAssignments).map(([employeeId, assignments]) => (
                        <div key={employeeId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium text-gray-900">
                            Empleado {employeeId}
                          </span>
                          <div className="flex gap-1">
                            {Array.isArray(assignments) && assignments.length > 0 ? (
                              assignments.map((assignment, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {assignment.shift || assignment.turno || 'Turno'}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-500">
                                Sin asignación
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay asignaciones para esta semana</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Horario actualizado: {publicSchedule.updatedAt ? new Date(publicSchedule.updatedAt.toDate()).toLocaleDateString('es-AR') : 'Desconocido'}</p>
          <p className="mt-1">Este horario es de solo lectura</p>
        </div>
      </div>
    </div>
  )
}
