"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Settings, CalendarDays } from 'lucide-react'
import { SpecialDayManager } from '@/components/calendar/special-day-manager'
import { SpecialDayCalendar } from '@/components/calendar/special-day-calendar'
import { useData } from '@/contexts/data-context'

export default function DiasEspecialesPage() {
  const { userData } = useData()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDateSpecialDays, setSelectedDateSpecialDays] = useState<any[]>([])

  // Configuración por defecto (se podría obtener de la configuración del usuario)
  const defaultConfig = {
    city: 'Viedma',
    province: 'Río Negro',
    country: 'Argentina'
  }

  const handleDateSelect = (date: Date, specialDays: any[]) => {
    setSelectedDate(date)
    setSelectedDateSpecialDays(specialDays)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Días Especiales</h1>
        </div>
        <p className="text-muted-foreground">
          Gestiona feriados, días no laborables y eventos especiales que afectan la generación de horarios.
        </p>
      </div>

      {/* Información de ubicación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ubicación activa:</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {defaultConfig.city}
                </Badge>
                <Badge variant="outline">
                  {defaultConfig.province}
                </Badge>
                <Badge variant="outline">
                  {defaultConfig.country}
                </Badge>
              </div>
            </div>
            
            {userData?.role && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Tu rol:</p>
                <Badge variant="secondary">
                  {userData.role}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs principal */}
      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Gestión
          </TabsTrigger>
        </TabsList>

        {/* Tab: Calendario */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendario principal */}
            <div className="lg:col-span-2">
              <SpecialDayCalendar
                city={defaultConfig.city}
                province={defaultConfig.province}
                country={defaultConfig.country}
                onDateSelect={handleDateSelect}
                showWeekends={true}
                compact={false}
              />
            </div>

            {/* Panel lateral */}
            <div className="space-y-6">
              {/* Información de fecha seleccionada */}
              {selectedDate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {selectedDate.toLocaleDateString('es-AR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedDateSpecialDays.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          {selectedDateSpecialDays.length} día{selectedDateSpecialDays.length > 1 ? 's' : ''} especial{selectedDateSpecialDays.length > 1 ? 'es' : ''}:
                        </p>
                        <div className="space-y-2">
                          {selectedDateSpecialDays.map((specialDay) => (
                            <div key={specialDay.id} className="p-2 border rounded">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {specialDay.type}
                                </Badge>
                                <Badge 
                                  variant={specialDay.severity === 'critical' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {specialDay.severity}
                                </Badge>
                              </div>
                              <p className="font-medium text-sm">{specialDay.title}</p>
                              {specialDay.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {specialDay.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {specialDay.location}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay días especiales para esta fecha.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Estadísticas rápidas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumen Rápido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Feriados nacionales:</span>
                      <Badge variant="destructive">Crítico</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Días no laborables:</span>
                      <Badge variant="secondary">Advertencia</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Eventos locales:</span>
                      <Badge variant="outline">Info</Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Los días especiales afectan la generación de horarios y se mostrarán como advertencias.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Gestión */}
        <TabsContent value="manage">
          <SpecialDayManager
            city={defaultConfig.city}
            province={defaultConfig.province}
            country={defaultConfig.country}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
