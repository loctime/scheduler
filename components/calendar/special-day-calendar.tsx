/**
 * Componente para mostrar días especiales en un calendario
 */

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  AlertTriangle
} from 'lucide-react'
import { SpecialDayBadge, SpecialDayBadgeCompact } from './special-day-badge'
import { useCalendarSpecialDays } from '@/hooks/use-calendar-special-days'
import type { FormattedSpecialDay } from '@/lib/types/calendar-special-days'

interface SpecialDayCalendarProps {
  initialDate?: Date
  city?: string
  province?: string
  country?: string
  onDateSelect?: (date: Date, specialDays: FormattedSpecialDay[]) => void
  showWeekends?: boolean
  compact?: boolean
  className?: string
}

export function SpecialDayCalendar({
  initialDate = new Date(),
  city,
  province,
  country = 'Argentina',
  onDateSelect,
  showWeekends = true,
  compact = false,
  className = ''
}: SpecialDayCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(initialDate)
  
  // Filtrar días especiales por ubicación
  const filter = useMemo(() => ({
    startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
    city: city?.toLowerCase(),
    province: province?.toLowerCase(),
    country: country.toLowerCase()
  }), [currentMonth, city, province, country])

  const { 
    specialDays, 
    formattedSpecialDays, 
    loading, 
    error,
    isSpecialDay 
  } = useCalendarSpecialDays({ 
    autoSubscribe: true, 
    initialFilter: filter 
  })

  // Agrupar días especiales por fecha
  const specialDaysByDate = useMemo(() => {
    const grouped: Record<string, FormattedSpecialDay[]> = {}
    
    formattedSpecialDays.forEach((specialDay) => {
      const date = specialDay.date
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(specialDay)
    })
    
    return grouped
  }, [formattedSpecialDays])

  // Generar días del mes
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Navegación de meses
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  // Manejar selección de fecha
  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const daySpecialDays = specialDaysByDate[dateStr] || []
    onDateSelect?.(date, daySpecialDays)
  }

  // Obtener días especiales para una fecha
  const getSpecialDaysForDate = (date: Date): FormattedSpecialDay[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return specialDaysByDate[dateStr] || []
  }

  // Verificar si es fin de semana
  const isWeekend = (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6
  }

  // Renderizar día del calendario
  const renderDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const daySpecialDays = getSpecialDaysForDate(date)
    const isCurrentMonth = isSameMonth(date, currentMonth)
    const isWeekendDay = isWeekend(date)
    const hasCriticalDay = daySpecialDays.some(day => day.severity === 'critical')

    if (compact) {
      return (
        <div
          key={dateStr}
          className={`
            relative p-1 text-center cursor-pointer border rounded
            ${!isCurrentMonth ? 'text-muted-foreground bg-muted/30' : ''}
            ${isWeekendDay && !showWeekends ? 'opacity-50' : ''}
            ${hasCriticalDay ? 'border-red-200 dark:border-red-800' : 'border-border'}
            hover:bg-accent/50 transition-colors
          `}
          onClick={() => handleDateClick(date)}
        >
          <div className="text-xs font-medium">
            {format(date, 'd')}
          </div>
          
          {daySpecialDays.length > 0 && (
            <div className="flex justify-center gap-0.5 mt-1">
              {daySpecialDays.slice(0, 2).map((specialDay) => (
                <SpecialDayBadgeCompact
                  key={specialDay.id}
                  specialDay={specialDay}
                />
              ))}
              {daySpecialDays.length > 2 && (
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <Card 
        key={dateStr}
        className={`
          p-2 cursor-pointer transition-all hover:shadow-md
          ${!isCurrentMonth ? 'opacity-50' : ''}
          ${isWeekendDay && !showWeekends ? 'opacity-30' : ''}
          ${hasCriticalDay ? 'border-red-200 dark:border-red-800' : ''}
        `}
        onClick={() => handleDateClick(date)}
      >
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium">
              {format(date, 'd')}
            </span>
            
            {daySpecialDays.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {daySpecialDays.length}
              </Badge>
            )}
          </div>
          
          {daySpecialDays.length > 0 && (
            <div className="space-y-1">
              {daySpecialDays.slice(0, 2).map((specialDay) => (
                <SpecialDayBadge
                  key={specialDay.id}
                  specialDay={specialDay}
                  size="sm"
                  showTooltip={true}
                />
              ))}
              
              {daySpecialDays.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{daySpecialDays.length - 2} más
                </div>
              )}
            </div>
          )}
          
          {hasCriticalDay && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <span>Crítico</span>
            </div>
          )}
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600 dark:text-red-400">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error cargando días especiales</p>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Hoy
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {(city || province) && (
          <div className="text-sm text-muted-foreground">
            {city && `${city}, `}
            {province && `${province}, `}
            {country}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Encabezado de días de la semana */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            
            {/* Días del mes */}
            <div className={`
              grid gap-1
              ${compact ? 'grid-cols-7' : 'grid-cols-7'}
            `}>
              {monthDays.map(renderDay)}
            </div>
            
            {/* Resumen del mes */}
            {formattedSpecialDays.length > 0 && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Resumen del mes
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {formattedSpecialDays.length} día{formattedSpecialDays.length > 1 ? 's' : ''} especial{formattedSpecialDays.length > 1 ? 'es' : ''}
                  </Badge>
                  <Badge variant="destructive">
                    {formattedSpecialDays.filter(d => d.severity === 'critical').length} crítico{formattedSpecialDays.filter(d => d.severity === 'critical').length > 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary">
                    {formattedSpecialDays.filter(d => d.affectsScheduling).length} afectan horarios
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
