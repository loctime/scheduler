"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar, Clock, Eye, Globe, CheckCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DateDisplay, WeekDisplay } from "@/components/ui/date-display"
import { WeekRangeDisplay } from "@/components/ui/week-range-display"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/contexts/data-context"
import { useWeekNavigation, type WeekData } from "@/hooks/use-week-navigation"
import { useSettings } from "@/hooks/use-settings"
import { useWeekData } from "@/hooks/use-week-data"
import { useToast } from "@/hooks/use-toast"

export default function HorarioPage() {
  const { settings, isLoading: settingsLoading, updatePublishedWeek } = useSettings()
  const { 
    currentWeek, 
    isLoading: weekLoading, 
    goToPreviousWeek, 
    goToNextWeek,
    formatWeekDisplay 
  } = useWeekNavigation(settings?.publishedWeekId)
  
  const { weekData, isLoading: dataLoading, error } = useWeekData(currentWeek?.weekId || null)
  const { userData } = useData()
  const { toast } = useToast()

  const isLoading = settingsLoading || weekLoading || dataLoading

  const isAdmin = userData?.role === 'admin'
  const isCurrentWeekPublished = currentWeek?.weekId === settings?.publishedWeekId

  const handlePublishWeek = async () => {
    if (!currentWeek?.weekId) return
    
    try {
      await updatePublishedWeek(currentWeek.weekId)
      toast({
        title: "Semana publicada",
        description: `La semana ${currentWeek.weekId} ahora es la semana publicada.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo publicar la semana.",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      })
    }
  }, [error, toast])

  useEffect(() => {
    // Sincronizar datos de navegación con Firestore cuando cambia la semana
    if (currentWeek && weekData && !dataLoading) {
      const needsUpdate = 
        weekData.startDate !== currentWeek.startDate ||
        weekData.endDate !== currentWeek.endDate ||
        weekData.weekNumber !== currentWeek.weekNumber ||
        weekData.year !== currentWeek.year ||
        weekData.month !== currentWeek.month

      if (needsUpdate) {
        // Aquí podríamos llamar a saveWeekData para sincronizar
        console.log("Week data needs synchronization")
      }
    }
  }, [currentWeek, weekData, dataLoading])

  const handleNavigation = (direction: 'previous' | 'next') => {
    if (direction === 'previous') {
      goToPreviousWeek()
    } else {
      goToNextWeek()
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Principal - Estilo Dashboard */}
      <div className="space-y-4">
        {/* Navegación y título */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Horario Semanal</h1>
            {currentWeek && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <WeekRangeDisplay 
                  startDate={currentWeek.startDate}
                  endDate={currentWeek.endDate}
                  className="text-lg font-medium"
                />
              </div>
            )}
            {userData?.grupoIds && userData.grupoIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Empresa activa: {userData.grupoIds.join(', ')}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigation('previous')}
              disabled={!currentWeek}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Semana anterior
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigation('next')}
              disabled={!currentWeek}
              aria-label="Semana siguiente"
            >
              Semana siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* UI de Estado - Chips */}
        {currentWeek && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                Semana visualizada: {currentWeek.weekId}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-green-600" />
              <Badge 
                variant={isCurrentWeekPublished ? "default" : "secondary"}
                className={isCurrentWeekPublished 
                  ? "bg-green-100 text-green-800 border-green-200" 
                  : "bg-orange-100 text-orange-800 border-orange-200"
                }
              >
                {isCurrentWeekPublished && <CheckCircle className="h-3 w-3 mr-1" />}
                Semana publicada: {settings?.publishedWeekId || "No definida"}
              </Badge>
            </div>
          </div>
        )}

        {/* Barra de Acciones */}
        {currentWeek && isAdmin && (
          <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isCurrentWeekPublished 
                  ? "Esta semana está publicada y visible para todos los usuarios."
                  : "Esta semana no está publicada. Solo los administradores pueden verla."
                }
              </span>
            </div>
            
            {!isCurrentWeekPublished && (
              <Button
                onClick={handlePublishWeek}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="h-4 w-4 mr-2" />
                Publicar esta semana
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Información de la semana */}
      {currentWeek && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ID de Semana</CardTitle>
              <Calendar className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentWeek.weekId}</div>
              <p className="text-xs text-muted-foreground">
                Semana {currentWeek.weekNumber} de {currentWeek.year}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fecha Inicio</CardTitle>
              <Clock className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <DateDisplay date={currentWeek.startDate} format="short" />
              </div>
              <p className="text-xs text-muted-foreground">Lunes de la semana</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fecha Fin</CardTitle>
              <Clock className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <DateDisplay date={currentWeek.endDate} format="short" />
              </div>
              <p className="text-xs text-muted-foreground">Domingo de la semana</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Placeholder para el contenido del horario */}
      {currentWeek && (
        <Card>
          <CardHeader>
            <CardTitle>Contenido del Horario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Horario de la Semana</h3>
              <p className="mb-4">
                Aquí se mostrará el horario correspondiente a la semana {currentWeek.weekId}
              </p>
              <p className="text-sm">
                Las fechas están en formato argentino (DD/MM/AAAA) como solicitaste.
              </p>
              <div className="mt-6 p-4 bg-muted rounded-md">
                <p className="text-sm font-mono">
                  <DateDisplay date={currentWeek.startDate} format="short" /> - <DateDisplay date={currentWeek.endDate} format="short" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado de carga inicial */}
      {!currentWeek && !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No hay semana seleccionada</h3>
            <p className="text-muted-foreground">
              No se pudo cargar la información de la semana. 
              {settings?.publishedWeekId ? (
                <> La semana configurada es: {settings.publishedWeekId}</>
              ) : (
                <> No hay una semana publicada configurada.</>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
