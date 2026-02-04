/**
 * Badge para mostrar días especiales en el calendario
 */

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Calendar, 
  AlertTriangle, 
  Info, 
  XCircle,
  MapPin,
  Clock
} from 'lucide-react'
import type { FormattedSpecialDay } from '@/lib/types/calendar-special-days'
import { getSpecialDayTypeColor, getSeverityColor } from '@/lib/calendar-special-days'

interface SpecialDayBadgeProps {
  specialDay: FormattedSpecialDay
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  showLocation?: boolean
  className?: string
}

export function SpecialDayBadge({
  specialDay,
  size = 'md',
  showTooltip = true,
  showLocation = false,
  className = ''
}: SpecialDayBadgeProps) {
  // Determinar ícono según tipo
  const getIcon = () => {
    switch (specialDay.type) {
      case 'feriado':
        return <Calendar className="h-3 w-3" />
      case 'no_laborable':
        return <XCircle className="h-3 w-3" />
      case 'evento':
        return <Calendar className="h-3 w-3" />
      case 'local':
        return <MapPin className="h-3 w-3" />
      default:
        return <Info className="h-3 w-3" />
    }
  }

  // Determinar ícono de severidad
  const getSeverityIcon = () => {
    switch (specialDay.severity) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3" />
      case 'warning':
        return <AlertTriangle className="h-3 w-3" />
      case 'info':
        return <Info className="h-3 w-3" />
      default:
        return <Info className="h-3 w-3" />
    }
  }

  // Determinar color del badge
  const getBadgeColor = () => {
    const baseColor = getSpecialDayTypeColor(specialDay.type)
    
    // Variar intensidad según severidad
    if (specialDay.severity === 'critical') {
      return 'destructive'
    } else if (specialDay.severity === 'warning') {
      return 'secondary'
    } else {
      return 'outline'
    }
  }

  // Determinar tamaño
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-1.5 py-0.5 text-xs'
      case 'lg':
        return 'px-3 py-1.5 text-sm'
      default:
        return 'px-2 py-1 text-xs'
    }
  }

  // Contenido del tooltip
  const tooltipContent = (
    <div className="space-y-2 max-w-xs">
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="font-medium">{specialDay.title}</span>
      </div>
      
      {specialDay.description && (
        <p className="text-xs text-muted-foreground">
          {specialDay.description}
        </p>
      )}
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{specialDay.dateDisplay}</span>
      </div>
      
      {showLocation && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{specialDay.location}</span>
        </div>
      )}
      
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Tipo:</span>
        <span>{specialDay.type}</span>
        {specialDay.scope !== 'nacional' && (
          <span className="text-muted-foreground">({specialDay.scope})</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Severidad:</span>
        <span className="flex items-center gap-1">
          {getSeverityIcon()}
          {specialDay.severity}
        </span>
      </div>
      
      {specialDay.affectsScheduling && (
        <div className="text-xs text-orange-600 dark:text-orange-400">
          ⚠️ Afecta la generación de horarios
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        Fuente: {specialDay.source === 'api' ? 'API Argentina' : 'Manual'}
      </div>
    </div>
  )

  const badgeContent = (
    <Badge 
      variant={getBadgeColor() as any}
      className={`${getSizeClasses()} ${className} flex items-center gap-1`}
    >
      {getIcon()}
      <span className="truncate max-w-20">
        {specialDay.title}
      </span>
      {specialDay.severity === 'critical' && (
        <AlertTriangle className="h-2 w-2" />
      )}
    </Badge>
  )

  if (!showTooltip) {
    return badgeContent
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Badge compacto para espacios reducidos
 */
export function SpecialDayBadgeCompact({
  specialDay,
  className = ''
}: {
  specialDay: FormattedSpecialDay
  className?: string
}) {
  const getColor = () => {
    switch (specialDay.severity) {
      case 'critical':
        return 'bg-red-500'
      case 'warning':
        return 'bg-orange-500'
      case 'info':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`w-2 h-2 rounded-full ${getColor()} ${className}`}
            title={specialDay.title}
          />
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <div className="space-y-1">
            <div className="font-medium text-sm">{specialDay.title}</div>
            <div className="text-xs text-muted-foreground">
              {specialDay.dateDisplay}
            </div>
            {specialDay.affectsScheduling && (
              <div className="text-xs text-orange-600 dark:text-orange-400">
                Afecta horarios
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Lista de badges para múltiples días especiales
 */
export function SpecialDayBadgesList({
  specialDays,
  maxVisible = 3,
  size = 'sm',
  className = ''
}: {
  specialDays: FormattedSpecialDay[]
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  if (!specialDays.length) {
    return null
  }

  const visibleDays = specialDays.slice(0, maxVisible)
  const hiddenCount = specialDays.length - maxVisible

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleDays.map((specialDay) => (
        <SpecialDayBadge
          key={specialDay.id}
          specialDay={specialDay}
          size={size}
          showTooltip={true}
        />
      ))}
      
      {hiddenCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                +{hiddenCount}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <div className="font-medium text-sm">
                  {hiddenCount} día{hiddenCount > 1 ? 's' : ''} especial{hiddenCount > 1 ? 'es' : ''} más
                </div>
                {specialDays.slice(maxVisible).map((specialDay) => (
                  <div key={specialDay.id} className="text-xs text-muted-foreground">
                    • {specialDay.title} ({specialDay.dateDisplay})
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
