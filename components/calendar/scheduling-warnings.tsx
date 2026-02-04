/**
 * Componente para mostrar advertencias de días especiales al generar horarios
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  AlertTriangle, 
  Info, 
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock
} from 'lucide-react'
import { SpecialDayBadge } from './special-day-badge'
import { useCalendarSpecialDays } from '@/hooks/use-calendar-special-days'
import type { SchedulingWarning } from '@/lib/types/calendar-special-days'

interface SchedulingWarningsProps {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  city?: string
  province?: string
  country?: string
  onContinue?: () => void
  onCancel?: () => void
  showContinueButton?: boolean
  className?: string
}

export function SchedulingWarnings({
  startDate,
  endDate,
  city,
  province,
  country = 'Argentina',
  onContinue,
  onCancel,
  showContinueButton = true,
  className = ''
}: SchedulingWarningsProps) {
  const [showDetails, setShowDetails] = useState(true)

  // Obtener advertencias para el rango de fechas
  const { getSchedulingWarnings } = useCalendarSpecialDays({
    autoSubscribe: true,
    initialFilter: {
      city: city?.toLowerCase(),
      province: province?.toLowerCase(),
      country: country.toLowerCase()
    }
  })

  const warnings = getSchedulingWarnings(startDate, endDate)

  // Si no hay advertencias, mostrar mensaje de éxito
  if (warnings.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Info className="h-5 w-5" />
            <span className="font-medium">No hay conflictos con días especiales</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            El período {startDate} a {endDate} no contiene días especiales que afecten la generación de horarios.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Agrupar advertencias por severidad
  const criticalWarnings = warnings.filter(w => w.severity === 'critical')
  const warningWarnings = warnings.filter(w => w.severity === 'warning')
  const infoWarnings = warnings.filter(w => w.severity === 'info')

  // Obtener ícono según severidad
  const getSeverityIcon = (severity: SchedulingWarning['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return <Info className="h-5 w-5" />
    }
  }

  // Obtener color de alerta según severidad
  const getAlertVariant = (severity: SchedulingWarning['severity']) => {
    switch (severity) {
      case 'critical':
        return 'destructive' as const
      case 'warning':
        return 'default' as const
      case 'info':
        return 'default' as const
      default:
        return 'default' as const
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Resumen general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Advertencias de Días Especiales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se encontraron {warnings.length} día{warnings.length > 1 ? 's' : ''} especial{warnings.length > 1 ? 'es' : ''} que afectan la generación de horarios en el período seleccionado.
            </p>
            
            <div className="flex flex-wrap gap-2">
              {criticalWarnings.length > 0 && (
                <Badge variant="destructive">
                  {criticalWarnings.length} crítico{criticalWarnings.length > 1 ? 's' : ''}
                </Badge>
              )}
              {warningWarnings.length > 0 && (
                <Badge variant="secondary">
                  {warningWarnings.length} advertencia{warningWarnings.length > 1 ? 's' : ''}
                </Badge>
              )}
              {infoWarnings.length > 0 && (
                <Badge variant="outline">
                  {infoWarnings.length} informativo{infoWarnings.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  {showDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Ocultar detalles
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Ver detalles
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3 mt-4">
                {warnings.map((warning, index) => (
                  <Alert key={index} variant={getAlertVariant(warning.severity)}>
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(warning.severity)}
                      <div className="flex-1 space-y-2">
                        <AlertTitle className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {warning.dateDisplay}
                        </AlertTitle>
                        <AlertDescription>
                          {warning.message}
                        </AlertDescription>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <SpecialDayBadge 
                            specialDay={warning.specialDay} 
                            size="sm" 
                            showTooltip={false}
                          />
                        </div>
                        
                        {warning.specialDay.location && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{warning.specialDay.location}</span>
                          </div>
                        )}
                        
                        {warning.specialDay.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {warning.specialDay.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      {/* Recomendaciones */}
      {criticalWarnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Recomendación importante</AlertTitle>
          <AlertDescription>
            Se encontraron días críticos que podrían afectar seriamente la operación. 
            Considere ajustar los horarios manualmente o verificar la asignación de personal para estos días.
          </AlertDescription>
        </Alert>
      )}

      {/* Acciones */}
      {showContinueButton && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">¿Desea continuar con la generación de horarios?</p>
                <p className="text-sm text-muted-foreground">
                  Los días especiales serán marcados pero las reglas no se modificarán automáticamente.
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancelar
                  </Button>
                )}
                <Button onClick={onContinue}>
                  Continuar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Componente compacto para mostrar advertencias en espacios reducidos
 */
export function SchedulingWarningsCompact({
  startDate,
  endDate,
  city,
  province,
  country = 'Argentina',
  className = ''
}: Omit<SchedulingWarningsProps, 'onContinue' | 'onCancel' | 'showContinueButton'>) {
  const { getSchedulingWarnings } = useCalendarSpecialDays({
    autoSubscribe: true,
    initialFilter: {
      city: city?.toLowerCase(),
      province: province?.toLowerCase(),
      country: country.toLowerCase()
    }
  })

  const warnings = getSchedulingWarnings(startDate, endDate)

  if (warnings.length === 0) {
    return null
  }

  const criticalCount = warnings.filter(w => w.severity === 'critical').length
  const warningCount = warnings.filter(w => w.severity === 'warning').length

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {criticalCount > 0 && (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
        </Badge>
      )}
      
      {warningCount > 0 && (
        <Badge variant="secondary" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {warningCount} advertencia{warningCount > 1 ? 's' : ''}
        </Badge>
      )}
      
      {warnings.length > criticalCount + warningCount && (
        <Badge variant="outline">
          {warnings.length - criticalCount - warningCount} más
        </Badge>
      )}
    </div>
  )
}

/**
 * Hook para usar advertencias en componentes
 */
export function useSchedulingWarnings(
  startDate: string,
  endDate: string,
  city?: string,
  province?: string,
  country?: string
) {
  const { getSchedulingWarnings } = useCalendarSpecialDays({
    autoSubscribe: true,
    initialFilter: {
      city: city?.toLowerCase(),
      province: province?.toLowerCase(),
      country: country?.toLowerCase()
    }
  })

  const warnings = getSchedulingWarnings(startDate, endDate)
  
  const hasCriticalWarnings = warnings.some(w => w.severity === 'critical')
  const hasWarnings = warnings.some(w => w.severity === 'warning')
  const hasAnyWarnings = warnings.length > 0
  
  return {
    warnings,
    hasCriticalWarnings,
    hasWarnings,
    hasAnyWarnings,
    criticalCount: warnings.filter(w => w.severity === 'critical').length,
    warningCount: warnings.filter(w => w.severity === 'warning').length,
    totalCount: warnings.length
  }
}
